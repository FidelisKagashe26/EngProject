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
import { applyProjectSpend } from "../services/projectLedger";

const router = Router();

const recurringPaymentTypes = new Set(["Daily", "Weekly", "Monthly"]);

const getTodayIsoDate = (): string => new Date().toISOString().slice(0, 10);

const workerSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(7),
  skillRole: z.string().min(2),
  paymentType: z.enum(["Hourly", "Daily", "Weekly", "Monthly", "Contract"]),
  rateAmount: z.number().nonnegative(),
  assignedProjectId: z.string().optional().default(""),
  employmentStartDate: z.string().date().optional().default(() => getTodayIsoDate()),
  employmentEndDate: z.string().date().optional(),
  notes: z.string().optional().default(""),
});

const laborPaymentSchema = z.object({
  projectId: z.string().min(3),
  workerId: z.string().min(3),
  workStart: z.string().date().optional(),
  workEnd: z.string().date().optional(),
  daysWorked: z.number().int().min(0).optional().default(0),
  hoursWorked: z.number().min(0).optional().default(0),
  cycleCount: z.number().int().min(1).optional().default(1),
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
  payment_type: string;
  pay_cycle_start_date: string;
  next_payment_due_date: string | null;
  employment_end_date: string | null;
};

const isRecurringPaymentType = (paymentType: string): boolean =>
  recurringPaymentTypes.has(paymentType);

const parseIsoDateUtc = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [y, m, d] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  if (
    parsed.getUTCFullYear() !== y ||
    parsed.getUTCMonth() + 1 !== m ||
    parsed.getUTCDate() !== d
  ) {
    return null;
  }

  return parsed;
};

const formatIsoDateUtc = (value: Date): string =>
  `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(
    value.getUTCDate(),
  ).padStart(2, "0")}`;

const addDaysUtc = (date: Date, days: number): Date => {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const addMonthsUtcClamped = (date: Date, months: number): Date => {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  const firstOfMonth = new Date(Date.UTC(year, month + months, 1));
  const lastDayInTarget = new Date(
    Date.UTC(firstOfMonth.getUTCFullYear(), firstOfMonth.getUTCMonth() + 1, 0),
  ).getUTCDate();

  firstOfMonth.setUTCDate(Math.min(day, lastDayInTarget));
  return firstOfMonth;
};

const daysBetweenUtcInclusive = (start: Date, end: Date): number =>
  Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

const getRecurringEndDate = (
  paymentType: "Daily" | "Weekly" | "Monthly",
  startDate: Date,
  cycleCount: number,
): Date => {
  if (paymentType === "Daily") {
    return addDaysUtc(startDate, cycleCount - 1);
  }

  if (paymentType === "Weekly") {
    return addDaysUtc(startDate, (cycleCount * 7) - 1);
  }

  return addDaysUtc(addMonthsUtcClamped(startDate, cycleCount), -1);
};

const getCycleCountFromRange = (
  paymentType: "Daily" | "Weekly" | "Monthly",
  startDate: Date,
  endDate: Date,
): number => {
  const days = daysBetweenUtcInclusive(startDate, endDate);
  if (paymentType === "Daily") return Math.max(1, days);
  if (paymentType === "Weekly") return Math.max(1, Math.ceil(days / 7));

  const startYear = startDate.getUTCFullYear();
  const startMonth = startDate.getUTCMonth();
  const startDay = startDate.getUTCDate();
  const endYear = endDate.getUTCFullYear();
  const endMonth = endDate.getUTCMonth();
  const endDay = endDate.getUTCDate();

  let months = ((endYear - startYear) * 12) + (endMonth - startMonth) + 1;
  if (endDay < startDay) months -= 1;
  return Math.max(1, months);
};

const getProjectById = async (
  companyId: number,
  projectId: string,
): Promise<ProjectLookup | null> => {
  const result = await db.query<ProjectLookup>(
    `
    SELECT id, name
    FROM engicost.projects
    WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
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
    SELECT id, full_name, assigned_project_id, payment_type, pay_cycle_start_date::text, next_payment_due_date::text, employment_end_date::text
    FROM engicost.workers
    WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
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
        pay_cycle_start_date: string;
        next_payment_due_date: string | null;
        employment_end_date: string | null;
        last_payment_covered_date: string | null;
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
          w.pay_cycle_start_date::text,
          w.next_payment_due_date::text,
          w.employment_end_date::text,
          w.last_payment_covered_date::text,
          w.notes
        FROM engicost.workers w
        LEFT JOIN engicost.projects p ON p.id = w.assigned_project_id
        WHERE w.company_id = $1 AND w.is_deleted = FALSE
        ORDER BY w.created_at DESC
        `,
        [companyId],
      ),
      db.query<{
        total_paid_month: string;
        outstanding: string;
      }>(
        `
        SELECT
          (
            SELECT COALESCE(SUM(lp.amount_paid), 0)::text
            FROM engicost.labor_payments lp
            WHERE lp.company_id = $1
              AND lp.is_deleted = FALSE
              AND lp.approval_status IN ('APPROVED', 'AUTO_APPROVED')
              AND DATE_TRUNC('month', lp.work_end) = DATE_TRUNC('month', CURRENT_DATE)
          ) AS total_paid_month,
          (
            SELECT COALESCE(SUM(w.outstanding_amount), 0)::text
            FROM engicost.workers w
            WHERE w.company_id = $1 AND w.is_deleted = FALSE
          ) AS outstanding
        `,
        [companyId],
      ),
    ]);

    res.json({
      summary: {
        totalLaborPaidThisMonth: Number(summaryResult.rows[0]?.total_paid_month ?? 0),
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
        payCycleStartDate: row.pay_cycle_start_date,
        nextPaymentDueDate: row.next_payment_due_date,
        employmentEndDate: row.employment_end_date,
        lastPaymentCoveredDate: row.last_payment_covered_date,
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
      employmentStartDate: req.body.employmentStartDate || getTodayIsoDate(),
      employmentEndDate: req.body.employmentEndDate || undefined,
    });

    const startDate = parseIsoDateUtc(parsed.employmentStartDate);
    if (!startDate) {
      res.status(400).json({ message: "Employment start date must be in YYYY-MM-DD format." });
      return;
    }

    const employmentEndDate = parsed.employmentEndDate ? parseIsoDateUtc(parsed.employmentEndDate) : null;
    if (parsed.employmentEndDate && !employmentEndDate) {
      res.status(400).json({ message: "Employment end date must be in YYYY-MM-DD format." });
      return;
    }

    if (employmentEndDate && employmentEndDate < startDate) {
      res.status(400).json({ message: "Employment end date must be on or after the start date." });
      return;
    }

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

    const recurringType = isRecurringPaymentType(parsed.paymentType);
    const payCycleStartDate = formatIsoDateUtc(startDate);
    const nextPaymentDueDate = recurringType ? payCycleStartDate : null;

    const inserted = await db.query(
      `
      INSERT INTO engicost.workers (
        id, company_id, full_name, phone, skill_role, payment_type,
        rate_amount, assigned_project_id, pay_cycle_start_date, next_payment_due_date, employment_end_date, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, NULLIF($8, ''), $9, $10, $11, $12
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
        pay_cycle_start_date::text,
        next_payment_due_date::text,
        employment_end_date::text,
        last_payment_covered_date::text,
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
        payCycleStartDate,
        nextPaymentDueDate,
        parsed.employmentEndDate ?? null,
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
      payCycleStartDate: row.pay_cycle_start_date,
      nextPaymentDueDate: row.next_payment_due_date,
      employmentEndDate: row.employment_end_date,
      lastPaymentCoveredDate: row.last_payment_covered_date,
      notes: row.notes ?? "",
    });
  }),
);

router.get(
  "/payments",
  handleAsync(async (_req, res) => {
    const companyId = await getSingleTenantCompanyId();

    const result = await db.query<{
      id: string;
      project_id: string;
      project_name: string | null;
      worker_id: string;
      worker_name: string;
      work_start: string;
      work_end: string;
      days_worked: number;
      units_worked: string;
      pay_cycle_type: string;
      pay_cycle_count: number;
      rate_amount: string;
      total_payable: string;
      amount_paid: string;
      balance: string;
      payment_method: string;
      notes: string | null;
      created_at: string;
      approval_status: string;
    }>(
      `
      SELECT
        lp.id,
        lp.project_id,
        p.name AS project_name,
        lp.worker_id,
        w.full_name AS worker_name,
        lp.work_start::text,
        lp.work_end::text,
        lp.days_worked,
        lp.units_worked::text,
        lp.pay_cycle_type,
        lp.pay_cycle_count,
        lp.rate_amount::text,
        lp.total_payable::text,
        lp.amount_paid::text,
        lp.balance::text,
        lp.payment_method,
        lp.notes,
        lp.created_at::text,
        lp.approval_status
      FROM engicost.labor_payments lp
      INNER JOIN engicost.workers w ON w.id = lp.worker_id
      LEFT JOIN engicost.projects p ON p.id = lp.project_id
      WHERE lp.company_id = $1 AND lp.is_deleted = FALSE
      ORDER BY lp.created_at DESC
      LIMIT 200
      `,
      [companyId],
    );

    res.json(result.rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      projectName: row.project_name ?? "",
      workerId: row.worker_id,
      workerName: row.worker_name,
      workStart: row.work_start,
      workEnd: row.work_end,
      daysWorked: row.days_worked,
      unitsWorked: Number(row.units_worked),
      payCycleType: row.pay_cycle_type,
      payCycleCount: row.pay_cycle_count,
      rateAmount: Number(row.rate_amount),
      totalPayable: Number(row.total_payable),
      amountPaid: Number(row.amount_paid),
      balance: Number(row.balance),
      paymentMethod: row.payment_method,
      notes: row.notes ?? "",
      createdAt: row.created_at,
      approvalStatus: row.approval_status,
      nextPaymentDueDate: null,
    })));
  }),
);

router.post(
  "/payments",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const parsed = laborPaymentSchema.parse({
      ...req.body,
      daysWorked: toInteger(req.body.daysWorked),
      hoursWorked: Number(req.body.hoursWorked) || 0,
      cycleCount: Math.max(toInteger(req.body.cycleCount || 1), 1),
      rateAmount: toMoney(req.body.rateAmount),
      amountPaid: toMoney(req.body.amountPaid),
    });

    const worker = await getWorkerById(companyId, parsed.workerId);
    if (!worker) {
      res.status(400).json({ message: "Selected worker does not exist." });
      return;
    }

    const project = await getProjectById(companyId, parsed.projectId);
    if (!project) {
      res.status(400).json({ message: "Selected project/site does not exist." });
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

    const isHourly = worker.payment_type === "Hourly";
    const isRecurring = isRecurringPaymentType(worker.payment_type);

    let workStartDate: Date;
    let workEndDate: Date;
    let unitsWorked = 0;
    let daysWorked = 0;
    let cycleCount = 0;
    let payCycleType = "Manual";

    if (isHourly) {
      if (!parsed.workStart || !parsed.workEnd) {
        res.status(400).json({
          message: "Hourly payments require work start and end dates.",
        });
        return;
      }

      const startDate = parseIsoDateUtc(parsed.workStart);
      const endDate = parseIsoDateUtc(parsed.workEnd);
      if (!startDate || !endDate) {
        res.status(400).json({
          message: "Work dates must be in YYYY-MM-DD format.",
        });
        return;
      }

      if (endDate < startDate) {
        res.status(400).json({
          message: "Work end date must be on or after work start date.",
        });
        return;
      }

      const hoursWorked = Number(parsed.hoursWorked) || 0;
      if (hoursWorked <= 0) {
        res.status(400).json({ message: "Hours worked must be greater than zero." });
        return;
      }

      workStartDate = startDate;
      workEndDate = endDate;
      unitsWorked = hoursWorked;
      daysWorked = daysBetweenUtcInclusive(startDate, endDate);
      payCycleType = "Hourly";
    } else if (
      worker.payment_type === "Daily" ||
      worker.payment_type === "Weekly" ||
      worker.payment_type === "Monthly"
    ) {
      const configuredStart =
        parsed.workStart?.trim() ||
        worker.next_payment_due_date ||
        worker.pay_cycle_start_date ||
        getTodayIsoDate();

      const startDate = parseIsoDateUtc(configuredStart);
      if (!startDate) {
        res.status(400).json({
          message: "Unable to resolve recurring payment start date.",
        });
        return;
      }

      let resolvedCycleCount = parsed.cycleCount;
      if (!req.body.cycleCount && parsed.workEnd) {
        const endFromBody = parseIsoDateUtc(parsed.workEnd);
        if (endFromBody && endFromBody >= startDate) {
          resolvedCycleCount = getCycleCountFromRange(
            worker.payment_type,
            startDate,
            endFromBody,
          );
        }
      }

      const cycleCountSafe = Math.max(1, resolvedCycleCount);
      const endDate = getRecurringEndDate(
        worker.payment_type,
        startDate,
        cycleCountSafe,
      );

      workStartDate = startDate;
      workEndDate = endDate;
      cycleCount = cycleCountSafe;
      unitsWorked = cycleCountSafe;
      daysWorked = daysBetweenUtcInclusive(startDate, endDate);
      payCycleType = worker.payment_type;
    } else {
      if (!parsed.workStart || !parsed.workEnd) {
        res.status(400).json({
          message: "Contract payments require work start and end dates.",
        });
        return;
      }

      const startDate = parseIsoDateUtc(parsed.workStart);
      const endDate = parseIsoDateUtc(parsed.workEnd);
      if (!startDate || !endDate) {
        res.status(400).json({
          message: "Work dates must be in YYYY-MM-DD format.",
        });
        return;
      }

      if (endDate < startDate) {
        res.status(400).json({
          message: "Work end date must be on or after work start date.",
        });
        return;
      }

      const rangeDays = daysBetweenUtcInclusive(startDate, endDate);
      const unitsFromRequest = toInteger(parsed.daysWorked);
      const effectiveUnits = unitsFromRequest > 0 ? unitsFromRequest : rangeDays;
      if (effectiveUnits <= 0) {
        res.status(400).json({
          message: "Days worked must be greater than zero for contract payment.",
        });
        return;
      }

      workStartDate = startDate;
      workEndDate = endDate;
      unitsWorked = effectiveUnits;
      daysWorked = rangeDays;
      payCycleType = "Contract";
    }

    const workerEndDate = worker.employment_end_date
      ? parseIsoDateUtc(worker.employment_end_date)
      : null;

    if (workerEndDate && workStartDate > workerEndDate) {
      res.status(400).json({
        message: "This worker's employment period has ended. Extend the worker end date before recording another payment.",
      });
      return;
    }

    if (workerEndDate && workEndDate > workerEndDate) {
      res.status(400).json({
        message: "This payment period extends beyond the worker end date.",
      });
      return;
    }

    const totalPayable = unitsWorked * parsed.rateAmount;
    if (totalPayable <= 0) {
      res.status(400).json({ message: "Total payable must be greater than zero." });
      return;
    }

    if (parsed.amountPaid > totalPayable) {
      res.status(400).json({
        message: "Amount paid cannot exceed total payable for this record.",
      });
      return;
    }

    const balance = Math.max(totalPayable - parsed.amountPaid, 0);
    let nextPaymentDueDate =
      isRecurring && !isHourly ? formatIsoDateUtc(addDaysUtc(workEndDate, 1)) : null;
    if (nextPaymentDueDate && workerEndDate) {
      const parsedNextDue = parseIsoDateUtc(nextPaymentDueDate);
      if (parsedNextDue && parsedNextDue > workerEndDate) {
        nextPaymentDueDate = null;
      }
    }
    const lastPaymentCoveredDate =
      isRecurring && !isHourly ? formatIsoDateUtc(workEndDate) : null;
    const needsApproval = requiresApproval("labor_payments", parsed.amountPaid);
    const approvalStatus = getApprovalStatusForAmount("labor_payments", parsed.amountPaid);
    const requestedBy = req.body.requestedBy || req.authUser?.fullName || "Site Supervisor";

    const client = await db.connect();
    let insertedRow:
      | {
          id: string;
          project_id: string;
          worker_id: string;
          work_start: string;
          work_end: string;
          days_worked: number;
          units_worked: string;
          pay_cycle_type: string;
          pay_cycle_count: number;
          rate_amount: string;
          total_payable: string;
          amount_paid: string;
          balance: string;
          payment_method: string;
          notes: string | null;
          created_at: string;
          approval_status: string;
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
        units_worked: string;
        pay_cycle_type: string;
        pay_cycle_count: number;
        rate_amount: string;
        total_payable: string;
        amount_paid: string;
        balance: string;
          payment_method: string;
          notes: string | null;
          created_at: string;
          approval_status: string;
      }>(
        `
        INSERT INTO engicost.labor_payments (
          id, company_id, project_id, worker_id, work_start, work_end, days_worked,
          units_worked, pay_cycle_type, pay_cycle_count,
          rate_amount, total_payable, amount_paid, balance, payment_method, notes,
          approval_status, approval_requested_by, approval_requested_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10,
          $11, $12, $13, $14, $15, $16,
          $17, $18, NOW()
        )
        RETURNING
          id,
          project_id,
          worker_id,
          work_start::text,
          work_end::text,
          days_worked,
          units_worked::text,
          pay_cycle_type,
          pay_cycle_count,
          rate_amount::text,
          total_payable::text,
          amount_paid::text,
          balance::text,
          payment_method,
          notes,
          created_at::text,
          approval_status
        `,
        [
          makeId("LP"),
          companyId,
          parsed.projectId,
          parsed.workerId,
          formatIsoDateUtc(workStartDate),
          formatIsoDateUtc(workEndDate),
          daysWorked,
          unitsWorked,
          payCycleType,
          cycleCount,
          parsed.rateAmount,
          totalPayable,
          parsed.amountPaid,
          balance,
          parsed.paymentMethod,
          parsed.notes,
          approvalStatus,
          requestedBy,
        ],
      );
      insertedRow = inserted.rows[0];

      if (!needsApproval) {
        // Book the spend first so an over-capacity payment is rejected before
        // the worker's own totals move.
        const ledgerFailure = await applyProjectSpend(client, {
          companyId,
          projectId: parsed.projectId,
          category: "labor",
          delta: parsed.amountPaid,
          context: "labor payment",
        });

        if (ledgerFailure) {
          await client.query("ROLLBACK");
          res.status(400).json(ledgerFailure);
          return;
        }

        await client.query(
          `
          UPDATE engicost.workers
          SET
            total_paid = total_paid + $3,
            outstanding_amount = GREATEST(outstanding_amount - $3, 0) + $4,
            status = CASE WHEN GREATEST(outstanding_amount - $3, 0) + $4 > 0 THEN 'Pending' ELSE 'Active' END,
            updated_at = NOW()
    WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
          `,
          [companyId, parsed.workerId, parsed.amountPaid, balance],
        );

        if (lastPaymentCoveredDate) {
          await client.query(
            `
            UPDATE engicost.workers
            SET
              next_payment_due_date = $3,
              last_payment_covered_date = $4,
              updated_at = NOW()
    WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
            `,
            [companyId, parsed.workerId, nextPaymentDueDate, lastPaymentCoveredDate],
          );
        }

        if (!worker.assigned_project_id) {
          await client.query(
            `
            UPDATE engicost.workers
            SET assigned_project_id = $3, updated_at = NOW()
    WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
            `,
            [companyId, parsed.workerId, parsed.projectId],
          );
        }

      }

      await client.query(
        `
        INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
        VALUES ($1, $2, $3, 'Recorded Labor Payment', 'Labor', $4, $5, '127.0.0.1 / Local Dev')
        `,
        [
          makeId("ACT"),
          companyId,
          requestedBy,
          parsed.projectId,
          needsApproval
            ? `${payCycleType} labor payment pending approval for ${worker.full_name}: TZS ${parsed.amountPaid.toLocaleString("en-TZ")}.`
            : `Recorded ${payCycleType} labor payment for ${worker.full_name}: TZS ${parsed.amountPaid.toLocaleString("en-TZ")}.`,
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
      unitsWorked: Number(row.units_worked),
      payCycleType: row.pay_cycle_type,
      payCycleCount: row.pay_cycle_count,
      rateAmount: Number(row.rate_amount),
      totalPayable: Number(row.total_payable),
      amountPaid: Number(row.amount_paid),
      balance: Number(row.balance),
      paymentMethod: row.payment_method,
      notes: row.notes ?? "",
      createdAt: row.created_at,
      projectName: project.name,
      workerName: worker.full_name,
      nextPaymentDueDate,
      approvalStatus: row.approval_status,
      requiresApproval: needsApproval,
      threshold: APPROVAL_THRESHOLDS.labor_payments,
    });
  }),
);

router.delete(
  "/:workerId",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const workerId = req.params.workerId as string;

    const worker = await getWorkerById(companyId, workerId);
    if (!worker) {
      res.status(404).json({ message: "Worker not found." });
      return;
    }

    await db.query(
      "UPDATE engicost.workers SET status = 'Inactive', is_deleted = TRUE, deleted_at = NOW(), deleted_by = $3, updated_at = NOW() WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE",
      [companyId, workerId, req.authUser?.fullName ?? 'System Admin'],
    );

    await logLaborActivity(
      companyId,
      "Deactivated Worker",
      worker.assigned_project_id,
      `Deactivated worker ${worker.full_name}.`,
    );

    res.json({ message: "Worker deactivated successfully." });
  }),
);


router.patch(
  '/:workerId/restore',
  requireSuperAdmin,
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const workerId = req.params.workerId as string;
    const restored = await db.query<{ id: string; full_name: string; assigned_project_id: string | null }>(
      "UPDATE engicost.workers SET is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL, status = 'Active', updated_at = NOW() WHERE company_id = $1 AND id = $2 AND is_deleted = TRUE RETURNING id, full_name, assigned_project_id",
      [companyId, workerId],
    );

    if (restored.rowCount === 0) {
      res.status(404).json({ message: 'Deleted worker not found.' });
      return;
    }

    await logLaborActivity(companyId, 'Restored Worker', restored.rows[0].assigned_project_id, 'Restored worker ' + restored.rows[0].full_name + '.');

    res.json({ message: 'Worker restored successfully.' });
  }),
);
router.patch(
  "/labor-payments/:id",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const paymentId = String(req.params.id);

    const updateSchema = laborPaymentSchema.partial();
    const parsed = updateSchema.parse({
      ...req.body,
      amountPaid: req.body.amountPaid !== undefined ? toMoney(req.body.amountPaid) : undefined,
      rateAmount: req.body.rateAmount !== undefined ? toMoney(req.body.rateAmount) : undefined,
    });

    const result = await db.query<{
      project_id: string;
      worker_id: string;
      amount_paid: string;
      total_payable: string;
      balance: string;
      approval_status: string | null;
    }>(
      `
      SELECT project_id, worker_id, amount_paid::text, total_payable::text, balance::text, approval_status
      FROM engicost.labor_payments
      WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
      LIMIT 1
      `,
      [companyId, paymentId],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: "Labor payment not found." });
      return;
    }

    const oldPayment = result.rows[0];
    const oldAmountPaid = Number(oldPayment.amount_paid);
    const newAmountPaid = parsed.amountPaid ?? oldAmountPaid;
    const totalPayable = Number(oldPayment.total_payable);
    if (newAmountPaid > totalPayable) {
      res.status(400).json({ message: "Amount paid cannot exceed total payable for this record." });
      return;
    }
    const amountDifference = newAmountPaid - oldAmountPaid;
    const oldBalance = Number(oldPayment.balance);
    const newBalance = Math.max(totalPayable - newAmountPaid, 0);
    const balanceDifference = newBalance - oldBalance;

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      if (
        (amountDifference !== 0 || balanceDifference !== 0) &&
        isAppliedApprovalStatus(oldPayment.approval_status)
      ) {
        const ledgerFailure = await applyProjectSpend(client, {
          companyId,
          projectId: oldPayment.project_id,
          category: "labor",
          delta: amountDifference,
          context: "labor payment update",
        });

        if (ledgerFailure) {
          await client.query("ROLLBACK");
          res.status(400).json(ledgerFailure);
          return;
        }
      }

      const setClauses: string[] = [];
      const params: unknown[] = [companyId, paymentId];
      let paramIndex = 3;

      if (parsed.amountPaid !== undefined) {
        setClauses.push(`amount_paid = $${paramIndex++}`);
        params.push(parsed.amountPaid);
        setClauses.push(`balance = $${paramIndex++}`);
        params.push(newBalance);
      }
      if (parsed.rateAmount !== undefined) {
        setClauses.push(`rate_amount = $${paramIndex++}`);
        params.push(parsed.rateAmount);
      }
      if (parsed.paymentMethod) {
        setClauses.push(`payment_method = $${paramIndex++}`);
        params.push(parsed.paymentMethod);
      }
      if (parsed.notes !== undefined) {
        setClauses.push(`notes = $${paramIndex++}`);
        params.push(parsed.notes);
      }

      if (setClauses.length > 0) {
        await client.query(
          `UPDATE engicost.labor_payments SET ${setClauses.join(", ")}, updated_at = NOW() WHERE company_id = $1 AND id = $2`,
          params,
        );
      }

      if (
        (amountDifference !== 0 || balanceDifference !== 0) &&
        isAppliedApprovalStatus(oldPayment.approval_status)
      ) {
        await client.query(
          `
          UPDATE engicost.workers
          SET
            total_paid = total_paid + $3,
            outstanding_amount = GREATEST(outstanding_amount + $4, 0),
            status = CASE WHEN GREATEST(outstanding_amount + $4, 0) > 0 THEN 'Pending' ELSE 'Active' END,
            updated_at = NOW()
    WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
          `,
          [companyId, oldPayment.worker_id, amountDifference, balanceDifference],
        );
      }

      await logLaborActivity(
        companyId,
        "Updated Labor Payment",
        oldPayment.project_id,
        `Updated payment - Amount change: ${amountDifference > 0 ? "+" : ""}TZS ${amountDifference.toLocaleString("en-TZ")}`,
      );

      await client.query("COMMIT");

      res.json({
        message: "Labor payment updated successfully.",
        amountDifference,
        newAmountPaid,
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
  "/labor-payments/:id",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const paymentId = String(req.params.id);
    const deletedBy = req.body?.deletedBy || "System Admin";

    const result = await db.query<{
      project_id: string;
      worker_id: string;
      amount_paid: string;
      balance: string;
      approval_status: string | null;
    }>(
      `
      SELECT project_id, worker_id, amount_paid::text, balance::text, approval_status
      FROM engicost.labor_payments
      WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
      LIMIT 1
      `,
      [companyId, paymentId],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: "Labor payment not found." });
      return;
    }

    const payment = result.rows[0];
    const amountPaid = Number(payment.amount_paid);
    const balance = Number(payment.balance);

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      // Soft delete: mark as deleted instead of hard delete
      await client.query(
        `
        UPDATE engicost.labor_payments
        SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = $3
    WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
        `,
        [companyId, paymentId, deletedBy],
      );

      if (isAppliedApprovalStatus(payment.approval_status)) {
        await applyProjectSpend(client, {
          companyId,
          projectId: payment.project_id,
          category: "labor",
          delta: -amountPaid,
          context: "labor payment deletion",
        });

        await client.query(
          `
          UPDATE engicost.workers
          SET
            total_paid = GREATEST(total_paid - $3, 0),
            outstanding_amount = GREATEST(outstanding_amount + $3 - $4, 0),
            status = CASE WHEN GREATEST(outstanding_amount + $3 - $4, 0) > 0 THEN 'Pending' ELSE 'Active' END,
            updated_at = NOW()
    WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
          `,
          [companyId, payment.worker_id, amountPaid, balance],
        );
      }

      await logLaborActivity(
        companyId,
        "Deleted Labor Payment",
        payment.project_id,
        `Soft deleted labor payment - Reversed amount: TZS ${amountPaid.toLocaleString("en-TZ")}`,
      );

      await client.query("COMMIT");

      res.json({
        message: "Labor payment deleted (soft delete) and totals reversed.",
        reversedAmount: amountPaid,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

// Restore a soft-deleted labor payment
router.patch(
  "/labor-payments/:id/restore",
  requireSuperAdmin,
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const paymentId = String(req.params.id);
    const restoredBy = req.body?.restoredBy || "System Admin";

    const result = await db.query<{
      project_id: string;
      worker_id: string;
      amount_paid: string;
      balance: string;
      approval_status: string | null;
    }>(
      `
      SELECT project_id, worker_id, amount_paid::text, balance::text, approval_status
      FROM engicost.labor_payments
      WHERE company_id = $1 AND id = $2 AND is_deleted = TRUE
      LIMIT 1
      `,
      [companyId, paymentId],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: "Deleted labor payment not found." });
      return;
    }

    const payment = result.rows[0];
    const amountPaid = Number(payment.amount_paid);
    const balance = Number(payment.balance);

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      // Restore: mark as not deleted
      await client.query(
        `
        UPDATE engicost.labor_payments
        SET is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL
    WHERE company_id = $1 AND id = $2 AND is_deleted = TRUE
        `,
        [companyId, paymentId],
      );

      if (isAppliedApprovalStatus(payment.approval_status)) {
        const ledgerFailure = await applyProjectSpend(client, {
          companyId,
          projectId: payment.project_id,
          category: "labor",
          delta: amountPaid,
          context: "labor payment restore",
        });

        if (ledgerFailure) {
          await client.query("ROLLBACK");
          res.status(400).json(ledgerFailure);
          return;
        }

        await client.query(
          `
          UPDATE engicost.workers
          SET
            total_paid = total_paid + $3,
            outstanding_amount = GREATEST(outstanding_amount - $3, 0) + $4,
            status = CASE WHEN GREATEST(outstanding_amount - $3, 0) + $4 > 0 THEN 'Pending' ELSE 'Active' END,
            updated_at = NOW()
    WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
          `,
          [companyId, payment.worker_id, amountPaid, balance],
        );
      }

      await logLaborActivity(
        companyId,
        "Restored Labor Payment",
        payment.project_id,
        `Restored soft-deleted labor payment - Amount re-added: TZS ${amountPaid.toLocaleString("en-TZ")}`,
      );

      await client.query("COMMIT");

      res.json({
        message: "Labor payment restored successfully.",
        restoredAmount: amountPaid,
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
