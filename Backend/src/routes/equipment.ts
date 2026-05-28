import { Router } from "express";
import { z } from "zod";
import { getSingleTenantCompanyId } from "../db/init";
import { makeId } from "../db/ids";
import { db } from "../db/pool";
import { handleAsync, toInteger, toMoney } from "./utils";
import {
  APPROVAL_THRESHOLDS,
  getApprovalStatusForAmount,
  isAppliedApprovalStatus,
  requiresApproval,
} from "../services/approval";

const router = Router();

const equipmentSchema = z.object({
  projectId: z.string().min(3),
  equipmentName: z.string().min(2),
  equipmentType: z.string().min(2),
  ownershipType: z.enum(["Owned", "Rented"]),
  ownerName: z.string().min(2),
  startDate: z.string().date(),
  endDate: z.string().date(),
  usageDays: z.number().int().min(0).optional().default(0),
  dailyRate: z.number().nonnegative().optional().default(0),
  maintenanceCost: z.number().nonnegative().optional().default(0),
  status: z
    .enum(["In Use", "Idle", "Under Maintenance"])
    .optional()
    .default("In Use"),
  maintenanceNotes: z.string().optional().default(""),
});

router.get(
  "/",
  handleAsync(async (_req, res) => {
    const companyId = await getSingleTenantCompanyId();

    const result = await db.query<{
      id: string;
      project_id: string;
      project_name: string;
      equipment_name: string;
      equipment_type: string;
      ownership_type: string;
      owner_name: string;
      start_date: string;
      end_date: string;
      usage_days: number;
      daily_rate: string;
      rental_cost: string;
      maintenance_cost: string;
      total_cost: string;
      status: string;
      maintenance_notes: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `
      SELECT
        e.id,
        e.project_id,
        p.name AS project_name,
        e.equipment_name,
        e.equipment_type,
        e.ownership_type,
        e.owner_name,
        e.start_date::text,
        e.end_date::text,
        e.usage_days,
        e.daily_rate::text,
        e.rental_cost::text,
        e.maintenance_cost::text,
        e.total_cost::text,
        e.status,
        e.maintenance_notes,
        e.created_at::text,
        e.updated_at::text
      FROM engicost.equipment_usage e
      JOIN engicost.projects p ON p.id = e.project_id
      WHERE e.company_id = $1 AND e.is_deleted = FALSE
      ORDER BY e.created_at DESC
      `,
      [companyId],
    );

    const rows = result.rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      equipmentName: row.equipment_name,
      equipmentType: row.equipment_type,
      ownershipType: row.ownership_type,
      ownerName: row.owner_name,
      startDate: row.start_date,
      endDate: row.end_date,
      usageDays: row.usage_days,
      dailyRate: Number(row.daily_rate),
      rentalCost: Number(row.rental_cost),
      maintenanceCost: Number(row.maintenance_cost),
      totalCost: Number(row.total_cost),
      status: row.status,
      maintenanceNotes: row.maintenance_notes ?? "",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    const summary = rows.reduce(
      (acc, row) => ({
        totalRecords: acc.totalRecords + 1,
        totalRentalCost: acc.totalRentalCost + row.rentalCost,
        totalMaintenanceCost: acc.totalMaintenanceCost + row.maintenanceCost,
        totalCost: acc.totalCost + row.totalCost,
        inUseCount: acc.inUseCount + (row.status === "In Use" ? 1 : 0),
      }),
      {
        totalRecords: 0,
        totalRentalCost: 0,
        totalMaintenanceCost: 0,
        totalCost: 0,
        inUseCount: 0,
      },
    );

    res.json({ summary, rows });
  }),
);

router.post(
  "/",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const parsed = equipmentSchema.parse({
      ...req.body,
      usageDays: toInteger(req.body.usageDays),
      dailyRate: toMoney(req.body.dailyRate),
      maintenanceCost: toMoney(req.body.maintenanceCost),
    });

    const projectResult = await db.query<{ id: string; name: string }>(
      `
      SELECT id, name
      FROM engicost.projects
      WHERE company_id = $1 AND id = $2
      LIMIT 1
      `,
      [companyId, parsed.projectId],
    );

    if (projectResult.rowCount === 0) {
      res.status(400).json({ message: "Selected project/site does not exist." });
      return;
    }

    if (parsed.endDate < parsed.startDate) {
      res
        .status(400)
        .json({ message: "Equipment end date must be on or after start date." });
      return;
    }

    const start = new Date(parsed.startDate);
    const end = new Date(parsed.endDate);
    const computedDays =
      Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const usageDays = computedDays;
    if (usageDays <= 0) {
      res.status(400).json({ message: "Usage days must be greater than zero." });
      return;
    }

    const rentalCost =
      parsed.ownershipType === "Rented" ? usageDays * parsed.dailyRate : 0;
    const totalCost = rentalCost + parsed.maintenanceCost;
    const needsApproval = requiresApproval("equipment_usage", totalCost);
    const approvalStatus = getApprovalStatusForAmount("equipment_usage", totalCost);
    const requestedBy = req.body.requestedBy || req.authUser?.fullName || "Site Supervisor";

    const inserted = await db.query<{
      id: string;
      project_id: string;
      equipment_name: string;
      equipment_type: string;
      ownership_type: string;
      owner_name: string;
      start_date: string;
      end_date: string;
      usage_days: number;
      daily_rate: string;
      rental_cost: string;
      maintenance_cost: string;
      total_cost: string;
      status: string;
      maintenance_notes: string | null;
      created_at: string;
      updated_at: string;
      approval_status: string;
    }>(
      `
      INSERT INTO engicost.equipment_usage (
        id, company_id, project_id, equipment_name, equipment_type, ownership_type, owner_name,
        start_date, end_date, usage_days, daily_rate, rental_cost, maintenance_cost, total_cost,
        status, maintenance_notes, approval_status, approval_requested_by, approval_requested_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, NOW()
      )
      RETURNING
        id,
        project_id,
        equipment_name,
        equipment_type,
        ownership_type,
        owner_name,
        start_date::text,
        end_date::text,
        usage_days,
        daily_rate::text,
        rental_cost::text,
        maintenance_cost::text,
        total_cost::text,
        status,
        maintenance_notes,
        created_at::text,
        updated_at::text,
        approval_status
      `,
      [
        makeId("EQ"),
        companyId,
        parsed.projectId,
        parsed.equipmentName,
        parsed.equipmentType,
        parsed.ownershipType,
        parsed.ownerName,
        parsed.startDate,
        parsed.endDate,
        usageDays,
        parsed.dailyRate,
        rentalCost,
        parsed.maintenanceCost,
        totalCost,
        parsed.status,
        parsed.maintenanceNotes,
        approvalStatus,
        requestedBy,
      ],
    );

    if (totalCost > 0 && !needsApproval) {
      await db.query(
        `
        UPDATE engicost.projects
        SET total_spent = total_spent + $3, updated_at = NOW()
        WHERE company_id = $1 AND id = $2
        `,
        [companyId, parsed.projectId, totalCost],
      );
    }

    await db.query(
      `
      INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
      VALUES ($1, $2, $3, 'Added Equipment Usage', 'Equipment', $4, $5, '127.0.0.1 / Local Dev')
      `,
      [
        makeId("ACT"),
        companyId,
        requestedBy,
        parsed.projectId,
        needsApproval
          ? `Equipment usage pending approval: ${parsed.equipmentName} for TZS ${totalCost.toLocaleString("en-TZ")}.`
          : `Recorded ${parsed.equipmentName} (${parsed.ownershipType}) usage for ${usageDays} day(s).`,
      ],
    );

    const row = inserted.rows[0];
    res.status(201).json({
      id: row.id,
      projectId: row.project_id,
      projectName: projectResult.rows[0].name,
      equipmentName: row.equipment_name,
      equipmentType: row.equipment_type,
      ownershipType: row.ownership_type,
      ownerName: row.owner_name,
      startDate: row.start_date,
      endDate: row.end_date,
      usageDays: row.usage_days,
      dailyRate: Number(row.daily_rate),
      rentalCost: Number(row.rental_cost),
      maintenanceCost: Number(row.maintenance_cost),
      totalCost: Number(row.total_cost),
      status: row.status,
      maintenanceNotes: row.maintenance_notes ?? "",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      approvalStatus: row.approval_status,
      requiresApproval: needsApproval,
      threshold: APPROVAL_THRESHOLDS.equipment_usage,
    });
  }),
);

router.patch(
  "/:id",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const equipmentId = String(req.params.id);

    const updateSchema = equipmentSchema.partial();
    const parsed = updateSchema.parse({
      ...req.body,
      usageDays: req.body.usageDays !== undefined ? toInteger(req.body.usageDays) : undefined,
      dailyRate: req.body.dailyRate !== undefined ? toMoney(req.body.dailyRate) : undefined,
      maintenanceCost: req.body.maintenanceCost !== undefined ? toMoney(req.body.maintenanceCost) : undefined,
    });

    const result = await db.query<{
      project_id: string;
      usage_days: number;
      daily_rate: string;
      maintenance_cost: string;
      ownership_type: string;
      total_cost: string;
      approval_status: string | null;
    }>(
      `
      SELECT project_id, usage_days, daily_rate::text, maintenance_cost::text, ownership_type, total_cost::text, approval_status
      FROM engicost.equipment_usage
      WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
      LIMIT 1
      `,
      [companyId, equipmentId],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: "Equipment usage not found." });
      return;
    }

    const oldEquipment = result.rows[0];
    const oldTotalCost = Number(oldEquipment.total_cost);

    const newUsageDays = parsed.usageDays ?? oldEquipment.usage_days;
    const newDailyRate = parsed.dailyRate ?? Number(oldEquipment.daily_rate);
    const newMaintenanceCost = parsed.maintenanceCost ?? Number(oldEquipment.maintenance_cost);
    
    const newRentalCost = oldEquipment.ownership_type === "Rented" ? newUsageDays * newDailyRate : 0;
    const newTotalCost = newRentalCost + newMaintenanceCost;
    const costDifference = newTotalCost - oldTotalCost;

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      const setClauses: string[] = [];
      const params: unknown[] = [companyId, equipmentId];
      let paramIndex = 3;

      if (parsed.usageDays !== undefined) {
        setClauses.push(`usage_days = $${paramIndex++}`);
        params.push(parsed.usageDays);
      }
      if (parsed.dailyRate !== undefined) {
        setClauses.push(`daily_rate = $${paramIndex++}`);
        params.push(parsed.dailyRate);
      }
      if (parsed.maintenanceCost !== undefined) {
        setClauses.push(`maintenance_cost = $${paramIndex++}`);
        params.push(parsed.maintenanceCost);
      }
      if (parsed.status) {
        setClauses.push(`status = $${paramIndex++}`);
        params.push(parsed.status);
      }
      if (parsed.maintenanceNotes !== undefined) {
        setClauses.push(`maintenance_notes = $${paramIndex++}`);
        params.push(parsed.maintenanceNotes);
      }

      setClauses.push(`rental_cost = $${paramIndex++}`);
      params.push(newRentalCost);
      setClauses.push(`total_cost = $${paramIndex++}`);
      params.push(newTotalCost);

      if (setClauses.length > 2) {
        await client.query(
          `UPDATE engicost.equipment_usage SET ${setClauses.join(", ")}, updated_at = NOW() WHERE company_id = $1 AND id = $2`,
          params,
        );
      }

      if (costDifference !== 0 && isAppliedApprovalStatus(oldEquipment.approval_status)) {
        await client.query(
          `
          UPDATE engicost.projects
          SET total_spent = GREATEST(total_spent + $3, 0), updated_at = NOW()
          WHERE company_id = $1 AND id = $2
          `,
          [companyId, oldEquipment.project_id, costDifference],
        );
      }

      await client.query(
        `
        INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
        VALUES ($1, $2, $3, 'Updated Equipment Usage', 'Equipment', $4, $5, '127.0.0.1 / Local Dev')
        `,
        [
          makeId("ACT"),
          companyId,
          "Site Supervisor",
          oldEquipment.project_id,
          `Updated equipment - Cost change: ${costDifference > 0 ? "+" : ""}TZS ${costDifference.toLocaleString("en-TZ")}`,
        ],
      );

      await client.query("COMMIT");

      res.json({
        message: "Equipment usage updated successfully.",
        costDifference,
        newTotalCost,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

router.delete(
  "/:id",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const equipmentId = String(req.params.id);
    const deletedBy = req.body?.deletedBy || "Site Supervisor";

    const result = await db.query<{
      project_id: string;
      total_cost: string;
      approval_status: string | null;
    }>(
      `
      SELECT project_id, total_cost::text, approval_status
      FROM engicost.equipment_usage
      WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
      LIMIT 1
      `,
      [companyId, equipmentId],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: "Equipment usage record not found." });
      return;
    }

    const equipment = result.rows[0];
    const totalCost = Number(equipment.total_cost);

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      // Soft delete: mark as deleted instead of hard delete
      await client.query(
        `
        UPDATE engicost.equipment_usage
        SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = $3
        WHERE company_id = $1 AND id = $2
        `,
        [companyId, equipmentId, deletedBy],
      );

      if (isAppliedApprovalStatus(equipment.approval_status)) {
        await client.query(
          `
          UPDATE engicost.projects
          SET total_spent = GREATEST(total_spent - $3, 0), updated_at = NOW()
          WHERE company_id = $1 AND id = $2
          `,
          [companyId, equipment.project_id, totalCost],
        );
      }

      // Log the action
      await client.query(
        `
        INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
        VALUES ($1, $2, $3, 'Deleted Equipment Usage', 'Equipment', $4, $5, '127.0.0.1 / Local Dev')
        `,
        [
          makeId("ACT"),
          companyId,
          deletedBy,
          equipment.project_id,
          `Soft deleted equipment usage - Reversed amount: TZS ${totalCost.toLocaleString("en-TZ")}`,
        ],
      );

      await client.query("COMMIT");

      res.json({
        message: "Equipment usage deleted (soft delete) and total_spent reversed.",
        reversedAmount: totalCost,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

// Restore a soft-deleted equipment usage
router.patch(
  "/:id/restore",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const equipmentId = String(req.params.id);
    const restoredBy = req.body?.restoredBy || "Site Supervisor";

    const result = await db.query<{
      project_id: string;
      total_cost: string;
      approval_status: string | null;
    }>(
      `
      SELECT project_id, total_cost::text, approval_status
      FROM engicost.equipment_usage
      WHERE company_id = $1 AND id = $2 AND is_deleted = TRUE
      LIMIT 1
      `,
      [companyId, equipmentId],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: "Deleted equipment usage record not found." });
      return;
    }

    const equipment = result.rows[0];
    const totalCost = Number(equipment.total_cost);

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      // Restore: mark as not deleted
      await client.query(
        `
        UPDATE engicost.equipment_usage
        SET is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL
        WHERE company_id = $1 AND id = $2
        `,
        [companyId, equipmentId],
      );

      if (isAppliedApprovalStatus(equipment.approval_status)) {
        await client.query(
          `
          UPDATE engicost.projects
          SET total_spent = total_spent + $3, updated_at = NOW()
          WHERE company_id = $1 AND id = $2
          `,
          [companyId, equipment.project_id, totalCost],
        );
      }

      // Log the action
      await client.query(
        `
        INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
        VALUES ($1, $2, $3, 'Restored Equipment Usage', 'Equipment', $4, $5, '127.0.0.1 / Local Dev')
        `,
        [
          makeId("ACT"),
          companyId,
          restoredBy,
          equipment.project_id,
          `Restored soft-deleted equipment usage - Amount re-added: TZS ${totalCost.toLocaleString("en-TZ")}`,
        ],
      );

      await client.query("COMMIT");

      res.json({
        message: "Equipment usage restored successfully.",
        restoredAmount: totalCost,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

export default router;
