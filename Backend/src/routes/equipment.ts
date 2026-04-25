import { Router } from "express";
import { z } from "zod";
import { getSingleTenantCompanyId } from "../db/init";
import { makeId } from "../db/ids";
import { db } from "../db/pool";
import { handleAsync, toInteger, toMoney } from "./utils";

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
      WHERE e.company_id = $1
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
    const usageDays = parsed.usageDays > 0 ? parsed.usageDays : computedDays;
    if (usageDays <= 0) {
      res.status(400).json({ message: "Usage days must be greater than zero." });
      return;
    }

    const rentalCost =
      parsed.ownershipType === "Rented" ? usageDays * parsed.dailyRate : 0;
    const totalCost = rentalCost + parsed.maintenanceCost;

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
    }>(
      `
      INSERT INTO engicost.equipment_usage (
        id, company_id, project_id, equipment_name, equipment_type, ownership_type, owner_name,
        start_date, end_date, usage_days, daily_rate, rental_cost, maintenance_cost, total_cost,
        status, maintenance_notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14,
        $15, $16
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
        updated_at::text
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
      ],
    );

    if (totalCost > 0) {
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
      VALUES ($1, $2, 'Site Supervisor', 'Added Equipment Usage', 'Equipment', $3, $4, '127.0.0.1 / Local Dev')
      `,
      [
        makeId("ACT"),
        companyId,
        parsed.projectId,
        `Recorded ${parsed.equipmentName} (${parsed.ownershipType}) usage for ${usageDays} day(s).`,
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
    });
  }),
);

export default router;

