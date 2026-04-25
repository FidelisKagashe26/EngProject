import { Router } from "express";
import { z } from "zod";
import { getSingleTenantCompanyId } from "../db/init";
import { makeId } from "../db/ids";
import { db } from "../db/pool";
import { handleAsync, toInteger, toMoney } from "./utils";

const router = Router();

const workerSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(7),
  skillRole: z.string().min(2),
  paymentType: z.enum(["Daily", "Weekly", "Monthly", "Contract"]),
  rateAmount: z.number().nonnegative(),
  assignedProjectId: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

const laborPaymentSchema = z.object({
  projectId: z.string().min(3),
  workerId: z.string().min(3),
  workStart: z.string().date(),
  workEnd: z.string().date(),
  daysWorked: z.number().int().min(0),
  rateAmount: z.number().nonnegative(),
  amountPaid: z.number().nonnegative(),
  paymentMethod: z.string().min(2),
  notes: z.string().optional().default(""),
});

type ProjectLookup = {
  id: string;
  name: string;
};

type WorkerLookup = {
  id: string;
  full_name: string;
  assigned_project_id: string | null;
};

const getProjectById = async (
  companyId: number,
  projectId: string,
): Promise<ProjectLookup | null> => {
  const result = await db.query<ProjectLookup>(
    `
    SELECT id, name
    FROM engicost.projects
    WHERE company_id = $1 AND id = $2
    LIMIT 1
    `,
    [companyId, projectId],
  );
  return result.rows[0] ?? null;
};

const getWorkerById = async (
  companyId: number,
  workerId: string,
): Promise<WorkerLookup | null> => {
  const result = await db.query<WorkerLookup>(
    `
    SELECT id, full_name, assigned_project_id
    FROM engicost.workers
    WHERE company_id = $1 AND id = $2
    LIMIT 1
    `,
    [companyId, workerId],
  );
  return result.rows[0] ?? null;
};

const logLaborActivity = async (
  companyId: number,
  action: string,
  projectId: string | null,
  description: string,
): Promise<void> => {
  await db.query(
    `
    INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
    VALUES ($1, $2, 'Site Supervisor', $3, 'Labor', $4, $5, '127.0.0.1 / Local Dev')
    `,
    [makeId("ACT"), companyId, action, projectId, description],
  );
};

router.get(
  "/",
  handleAsync(async (_req, res) => {
    const companyId = await getSingleTenantCompanyId();

    const [workersResult, summaryResult] = await Promise.all([
      db.query<{
        id: string;
        full_name: string;
        phone: string;
        skill_role: string;
        payment_type: string;
        rate_amount: string;
        assigned_project_id: string | null;
        project_name: string | null;
        total_paid: string;
        outstanding_amount: string;
        status: string;
        notes: string | null;
      }>(
        `
        SELECT
          w.id,
          w.full_name,
          w.phone,
          w.skill_role,
          w.payment_type,
          w.rate_amount::text,
          w.assigned_project_id,
          p.name AS project_name,
          w.total_paid::text,
          w.outstanding_amount::text,
          w.status,
          w.notes
        FROM engicost.workers w
        LEFT JOIN engicost.projects p ON p.id = w.assigned_project_id
        WHERE w.company_id = $1
        ORDER BY w.created_at DESC
        `,
        [companyId],
      ),
      db.query<{
        total_paid: string;
        outstanding: string;
      }>(
        `
        SELECT
          COALESCE(SUM(total_paid), 0)::text AS total_paid,
          COALESCE(SUM(outstanding_amount), 0)::text AS outstanding
        FROM engicost.workers
        WHERE company_id = $1
        `,
        [companyId],
      ),
    ]);

    res.json({
      summary: {
        totalLaborPaidThisMonth: Number(summaryResult.rows[0]?.total_paid ?? 0),
        outstandingLaborPayments: Number(summaryResult.rows[0]?.outstanding ?? 0),
      },
      rows: workersResult.rows.map((row) => ({
        id: row.id,
        fullName: row.full_name,
        phone: row.phone,
        skillRole: row.skill_role,
        paymentType: row.payment_type,
        rateAmount: Number(row.rate_amount),
        assignedProjectId: row.assigned_project_id,
        assignedProjectName: row.project_name ?? "",
        totalPaid: Number(row.total_paid),
        outstandingAmount: Number(row.outstanding_amount),
        status: row.status,
        notes: row.notes ?? "",
      })),
    });
  }),
);

router.post(
  "/",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const parsed = workerSchema.parse({
      ...req.body,
      rateAmount: toMoney(req.body.rateAmount),
    });

    let assignedProjectName = "";
    if (parsed.assignedProjectId.trim().length > 0) {
      const project = await getProjectById(companyId, parsed.assignedProjectId);
      if (!project) {
        res
          .status(400)
          .json({ message: "Assigned project/site does not exist." });
        return;
      }
      assignedProjectName = project.name;
    }

    const inserted = await db.query(
      `
      INSERT INTO engicost.workers (
        id, company_id, full_name, phone, skill_role, payment_type,
        rate_amount, assigned_project_id, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, NULLIF($8, ''), $9
      )
      RETURNING
        id,
        full_name,
        phone,
        skill_role,
        payment_type,
        rate_amount::text,
        assigned_project_id,
        total_paid::text,
        outstanding_amount::text,
        status,
        notes
      `,
      [
        makeId("WK"),
        companyId,
        parsed.fullName,
        parsed.phone,
        parsed.skillRole,
        parsed.paymentType,
        parsed.rateAmount,
        parsed.assignedProjectId,
        parsed.notes,
      ],
    );

    const row = inserted.rows[0];

    await logLaborActivity(
      companyId,
      "Added Worker",
      row.assigned_project_id,
      row.assigned_project_id
        ? `Added worker ${row.full_name} and assigned to ${assignedProjectName}.`
        : `Added worker ${row.full_name} without project assignment.`,
    );

    res.status(201).json({
      id: row.id,
      fullName: row.full_name,
      phone: row.phone,
      skillRole: row.skill_role,
      paymentType: row.payment_type,
      rateAmount: Number(row.rate_amount),
      assignedProjectId: row.assigned_project_id,
      assignedProjectName,
      totalPaid: Number(row.total_paid),
      outstandingAmount: Number(row.outstanding_amount),
      status: row.status,
      notes: row.notes ?? "",
    });
  }),
);

router.post(
  "/payments",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const parsed = laborPaymentSchema.parse({
      ...req.body,
      daysWorked: toInteger(req.body.daysWorked),
      rateAmount: toMoney(req.body.rateAmount),
      amountPaid: toMoney(req.body.amountPaid),
    });

    if (parsed.workEnd < parsed.workStart) {
      res
        .status(400)
        .json({ message: "Work end date must be on or after work start date." });
      return;
    }

    if (parsed.daysWorked <= 0) {
      res
        .status(400)
        .json({ message: "Days worked must be greater than zero." });
      return;
    }

    const totalPayable = parsed.daysWorked * parsed.rateAmount;
    if (parsed.amountPaid > totalPayable) {
      res.status(400).json({
        message: "Amount paid cannot exceed total payable for this record.",
      });
      return;
    }

    const balance = Math.max(totalPayable - parsed.amountPaid, 0);

    const project = await getProjectById(companyId, parsed.projectId);
    if (!project) {
      res.status(400).json({ message: "Selected project/site does not exist." });
      return;
    }

    const worker = await getWorkerById(companyId, parsed.workerId);
    if (!worker) {
      res.status(400).json({ message: "Selected worker does not exist." });
      return;
    }

    if (
      worker.assigned_project_id &&
      worker.assigned_project_id !== parsed.projectId
    ) {
      res.status(400).json({
        message:
          "Worker is assigned to another project. Reassign worker before recording this payment.",
      });
      return;
    }

    const client = await db.connect();
    let insertedRow:
      | {
          id: string;
          project_id: string;
          worker_id: string;
          work_start: string;
          work_end: string;
          days_worked: number;
          rate_amount: string;
          total_payable: string;
          amount_paid: string;
          balance: string;
          payment_method: string;
          notes: string | null;
          created_at: string;
        }
      | undefined;

    try {
      await client.query("BEGIN");

      const inserted = await client.query<{
        id: string;
        project_id: string;
        worker_id: string;
        work_start: string;
        work_end: string;
        days_worked: number;
        rate_amount: string;
        total_payable: string;
        amount_paid: string;
        balance: string;
        payment_method: string;
        notes: string | null;
        created_at: string;
      }>(
        `
        INSERT INTO engicost.labor_payments (
          id, company_id, project_id, worker_id, work_start, work_end, days_worked,
          rate_amount, total_payable, amount_paid, balance, payment_method, notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13
        )
        RETURNING
          id,
          project_id,
          worker_id,
          work_start::text,
          work_end::text,
          days_worked,
          rate_amount::text,
          total_payable::text,
          amount_paid::text,
          balance::text,
          payment_method,
          notes,
          created_at::text
        `,
        [
          makeId("LP"),
          companyId,
          parsed.projectId,
          parsed.workerId,
          parsed.workStart,
          parsed.workEnd,
          parsed.daysWorked,
          parsed.rateAmount,
          totalPayable,
          parsed.amountPaid,
          balance,
          parsed.paymentMethod,
          parsed.notes,
        ],
      );
      insertedRow = inserted.rows[0];

      await client.query(
        `
        UPDATE engicost.workers
        SET
          total_paid = total_paid + $3,
          outstanding_amount = outstanding_amount + $4,
          status = CASE WHEN outstanding_amount + $4 > 0 THEN 'Pending' ELSE 'Active' END
        WHERE company_id = $1 AND id = $2
        `,
        [companyId, parsed.workerId, parsed.amountPaid, balance],
      );

      if (!worker.assigned_project_id) {
        await client.query(
          `
          UPDATE engicost.workers
          SET assigned_project_id = $3
          WHERE company_id = $1 AND id = $2
          `,
          [companyId, parsed.workerId, parsed.projectId],
        );
      }

      await client.query(
        `
        UPDATE engicost.projects
        SET total_spent = total_spent + $3, updated_at = NOW()
        WHERE company_id = $1 AND id = $2
        `,
        [companyId, parsed.projectId, parsed.amountPaid],
      );

      await client.query(
        `
        INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
        VALUES ($1, $2, 'Site Supervisor', 'Recorded Labor Payment', 'Labor', $3, $4, '127.0.0.1 / Local Dev')
        `,
        [
          makeId("ACT"),
          companyId,
          parsed.projectId,
          `Recorded labor payment for ${worker.full_name}: TZS ${parsed.amountPaid.toLocaleString("en-TZ")}.`,
        ],
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    if (!insertedRow) {
      res.status(500).json({ message: "Failed to create labor payment." });
      return;
    }

    const row = insertedRow;
    res.status(201).json({
      id: row.id,
      projectId: row.project_id,
      workerId: row.worker_id,
      workStart: row.work_start,
      workEnd: row.work_end,
      daysWorked: row.days_worked,
      rateAmount: Number(row.rate_amount),
      totalPayable: Number(row.total_payable),
      amountPaid: Number(row.amount_paid),
      balance: Number(row.balance),
      paymentMethod: row.payment_method,
      notes: row.notes ?? "",
      createdAt: row.created_at,
      projectName: project.name,
      workerName: worker.full_name,
    });
  }),
);

export default router;
