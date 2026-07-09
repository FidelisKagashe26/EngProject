import { Router } from "express";
import { z } from "zod";
import { getSingleTenantCompanyId } from "../db/init";
import { makeId } from "../db/ids";
import { db } from "../db/pool";
import { requireSuperAdmin } from "../middleware/auth";
import { handleAsync, toInteger, toMoney } from "./utils";
import {
  APPROVAL_THRESHOLDS,
  getApprovalStatusForAmount,
  isAppliedApprovalStatus,
  requiresApproval,
} from "../services/approval";
import { checkProjectSpendCapacity, spendGuardResponse } from "../services/spendingGuard";

const router = Router();

const equipmentSchema = z.object({
  projectId: z.string().min(3),
  equipmentName: z.string().min(2),
  equipmentType: z.string().min(2),
  assetTag: z.string().optional().default(""),
  quantity: z.number().int().min(1).optional().default(1),
  assignedTo: z.string().optional().default(""),
  conditionStatus: z.string().optional().default("Good"),
  ownershipType: z.enum(["Owned", "Rented"]),
  ownerName: z.string().min(2),
  startDate: z.string().date(),
  endDate: z.string().date(),
  usageDays: z.number().int().min(0).optional().default(0),
  dailyRate: z.number().nonnegative().optional().default(0),
  maintenanceCost: z.number().nonnegative().optional().default(0),
  status: z
    .enum(["In Use", "Idle", "Under Maintenance", "Out of Use"])
    .optional()
    .default("In Use"),
  maintenanceNotes: z.string().optional().default(""),
  checkInDate: z.string().date().optional(),
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
      asset_tag: string | null;
      quantity: number;
      assigned_to: string | null;
      condition_status: string;
      check_in_date: string | null;
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
      SELECT
        e.id,
        e.project_id,
        p.name AS project_name,
        e.equipment_name,
        e.equipment_type,
        e.asset_tag,
        e.quantity,
        e.assigned_to,
        e.condition_status,
        e.check_in_date::text,
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
        e.updated_at::text,
        e.approval_status
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
      assetTag: row.asset_tag ?? "",
      quantity: row.quantity,
      assignedTo: row.assigned_to ?? "",
      conditionStatus: row.condition_status,
      checkInDate: row.check_in_date,
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
      quantity: req.body.quantity !== undefined ? toInteger(req.body.quantity) : undefined,
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
      parsed.ownershipType === "Rented" ? usageDays * parsed.dailyRate * parsed.quantity : 0;
    const totalCost = rentalCost + parsed.maintenanceCost;
    const needsApproval = requiresApproval("equipment_usage", totalCost);
    const approvalStatus = getApprovalStatusForAmount("equipment_usage", totalCost);
    const requestedBy = req.body.requestedBy || req.authUser?.fullName || "Site Supervisor";

    const spendCheck = await checkProjectSpendCapacity(
      db,
      companyId,
      parsed.projectId,
      totalCost,
      "equipment usage",
    );
    const spendFailure = spendGuardResponse(spendCheck);
    if (spendFailure) {
      res.status(400).json(spendFailure);
      return;
    }

    const inserted = await db.query<{
      id: string;
      project_id: string;
      equipment_name: string;
      equipment_type: string;
      asset_tag: string | null;
      quantity: number;
      assigned_to: string | null;
      condition_status: string;
      check_in_date: string | null;
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
        id, company_id, project_id, equipment_name, equipment_type, asset_tag, quantity,
        assigned_to, condition_status, ownership_type, owner_name,
        start_date, end_date, usage_days, daily_rate, rental_cost, maintenance_cost, total_cost,
        status, maintenance_notes, check_in_date, approval_status, approval_requested_by, approval_requested_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23, NOW()
      )
      RETURNING
        id,
        project_id,
        equipment_name,
        equipment_type,
        asset_tag,
        quantity,
        assigned_to,
        condition_status,
        check_in_date::text,
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
        parsed.assetTag,
        parsed.quantity,
        parsed.assignedTo,
        parsed.conditionStatus,
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
        parsed.checkInDate ?? null,
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
      assetTag: row.asset_tag ?? "",
      quantity: row.quantity,
      assignedTo: row.assigned_to ?? "",
      conditionStatus: row.condition_status,
      checkInDate: row.check_in_date,
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
      quantity: req.body.quantity !== undefined ? toInteger(req.body.quantity) : undefined,
      dailyRate: req.body.dailyRate !== undefined ? toMoney(req.body.dailyRate) : undefined,
      maintenanceCost: req.body.maintenanceCost !== undefined ? toMoney(req.body.maintenanceCost) : undefined,
    });

    const result = await db.query<{
      project_id: string;
      start_date: string;
      end_date: string;
      usage_days: number;
      quantity: number;
      daily_rate: string;
      maintenance_cost: string;
      ownership_type: string;
      total_cost: string;
      approval_status: string | null;
    }>(
      `
      SELECT project_id, start_date::text, end_date::text, usage_days, quantity, daily_rate::text, maintenance_cost::text, ownership_type, total_cost::text, approval_status
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

    const newProjectId = parsed.projectId ?? oldEquipment.project_id;
    const newStartDate = parsed.startDate ?? oldEquipment.start_date;
    const newEndDate = parsed.endDate ?? oldEquipment.end_date;
    if (newEndDate < newStartDate) {
      res.status(400).json({ message: "Equipment end date must be on or after start date." });
      return;
    }

    if (parsed.projectId) {
      const projectResult = await db.query<{ id: string }>(
        `
        SELECT id
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
    }

    const start = new Date(newStartDate);
    const end = new Date(newEndDate);
    const computedDays =
      Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const newUsageDays = parsed.usageDays ?? computedDays;
    const newQuantity = parsed.quantity ?? oldEquipment.quantity;
    const newDailyRate = parsed.dailyRate ?? Number(oldEquipment.daily_rate);
    const newMaintenanceCost = parsed.maintenanceCost ?? Number(oldEquipment.maintenance_cost);
    const newOwnershipType = parsed.ownershipType ?? oldEquipment.ownership_type;
    
    const newRentalCost = newOwnershipType === "Rented" ? newUsageDays * newDailyRate * newQuantity : 0;
    const newTotalCost = newRentalCost + newMaintenanceCost;
    const costDifference = newTotalCost - oldTotalCost;
    const costFieldsChanged =
      parsed.projectId ||
      parsed.startDate ||
      parsed.endDate ||
      parsed.usageDays !== undefined ||
      parsed.quantity !== undefined ||
      parsed.dailyRate !== undefined ||
      parsed.maintenanceCost !== undefined ||
      parsed.ownershipType !== undefined;
    const isAppliedEquipment = isAppliedApprovalStatus(oldEquipment.approval_status);
    const spendAmountToCheck = isAppliedEquipment
      ? newProjectId !== oldEquipment.project_id
        ? newTotalCost
        : Math.max(costDifference, 0)
      : costFieldsChanged
        ? newTotalCost
        : 0;
    const spendCheck = await checkProjectSpendCapacity(
      db,
      companyId,
      newProjectId,
      spendAmountToCheck,
      "equipment usage update",
    );
    const spendFailure = spendGuardResponse(spendCheck);
    if (spendFailure) {
      res.status(400).json(spendFailure);
      return;
    }

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      const setClauses: string[] = [];
      const params: unknown[] = [companyId, equipmentId];
      let paramIndex = 3;

      if (parsed.projectId) {
        setClauses.push(`project_id = $${paramIndex++}`);
        params.push(parsed.projectId);
      }
      if (parsed.equipmentName) {
        setClauses.push(`equipment_name = $${paramIndex++}`);
        params.push(parsed.equipmentName);
      }
      if (parsed.equipmentType) {
        setClauses.push(`equipment_type = $${paramIndex++}`);
        params.push(parsed.equipmentType);
      }
      if (parsed.assetTag !== undefined) {
        setClauses.push(`asset_tag = $${paramIndex++}`);
        params.push(parsed.assetTag);
      }
      if (parsed.quantity !== undefined) {
        setClauses.push(`quantity = $${paramIndex++}`);
        params.push(newQuantity);
      }
      if (parsed.assignedTo !== undefined) {
        setClauses.push(`assigned_to = $${paramIndex++}`);
        params.push(parsed.assignedTo);
      }
      if (parsed.conditionStatus !== undefined) {
        setClauses.push(`condition_status = $${paramIndex++}`);
        params.push(parsed.conditionStatus);
      }
      if (parsed.ownershipType) {
        setClauses.push(`ownership_type = $${paramIndex++}`);
        params.push(parsed.ownershipType);
      }
      if (parsed.ownerName) {
        setClauses.push(`owner_name = $${paramIndex++}`);
        params.push(parsed.ownerName);
      }
      if (parsed.startDate) {
        setClauses.push(`start_date = $${paramIndex++}`);
        params.push(parsed.startDate);
      }
      if (parsed.endDate) {
        setClauses.push(`end_date = $${paramIndex++}`);
        params.push(parsed.endDate);
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
      if (parsed.checkInDate !== undefined) {
        setClauses.push(`check_in_date = $${paramIndex++}`);
        params.push(parsed.checkInDate ?? null);
      }

      setClauses.push(`rental_cost = $${paramIndex++}`);
      params.push(newRentalCost);
      setClauses.push(`total_cost = $${paramIndex++}`);
      params.push(newTotalCost);
      setClauses.push(`usage_days = $${paramIndex++}`);
      params.push(newUsageDays);
      setClauses.push(`quantity = $${paramIndex++}`);
      params.push(newQuantity);

      if (setClauses.length > 0) {
        await client.query(
          `UPDATE engicost.equipment_usage SET ${setClauses.join(", ")}, updated_at = NOW() WHERE company_id = $1 AND id = $2`,
          params,
        );
      }

      if (isAppliedEquipment) {
        if (newProjectId !== oldEquipment.project_id) {
          await client.query(
            `
            UPDATE engicost.projects
            SET total_spent = GREATEST(total_spent - $3, 0), updated_at = NOW()
            WHERE company_id = $1 AND id = $2
            `,
            [companyId, oldEquipment.project_id, oldTotalCost],
          );
          await client.query(
            `
            UPDATE engicost.projects
            SET total_spent = total_spent + $3, updated_at = NOW()
            WHERE company_id = $1 AND id = $2
            `,
            [companyId, newProjectId, newTotalCost],
          );
        } else if (costDifference !== 0) {
          await client.query(
            `
            UPDATE engicost.projects
            SET total_spent = GREATEST(total_spent + $3, 0), updated_at = NOW()
            WHERE company_id = $1 AND id = $2
            `,
            [companyId, oldEquipment.project_id, costDifference],
          );
        }
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
          newProjectId,
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

    if (isAppliedApprovalStatus(equipment.approval_status)) {
      const spendCheck = await checkProjectSpendCapacity(
        db,
        companyId,
        equipment.project_id,
        totalCost,
        "equipment usage restore",
      );
      const spendFailure = spendGuardResponse(spendCheck);
      if (spendFailure) {
        res.status(400).json(spendFailure);
        return;
      }
    }

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
  requireSuperAdmin,
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
