import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ConfirmModal,
  DetailModal,
  EmptyState,
  FinancialInput,
  SectionTitle,
  SkeletonTable,
  StatusBadge,
  SurfaceCard,
  TablePagination,
  GuiSelect,
} from "../components/ui";
import { useUnsavedChanges } from "../guards/UnsavedChangesGuard";
import { useTablePagination } from "../hooks/useTablePagination";
import {
  api,
  type LaborPaymentApiRecord,
  type ProjectApiRecord,
  type WorkerApiRecord,
} from "../services/api";
import { formatDate, formatTzs } from "../utils/format";

type LaborPageProps = {
  embedded?: boolean;
  search?: string;
  /** Renders the shared operations tab bar with this page's filters on the search row. */
  renderTabBar?: (actions?: ReactNode) => ReactNode;
};

const RECURRING_PAYMENT_TYPES = ["Daily", "Weekly", "Monthly"] as const;

type WorkerPaymentProgress = {
  /** True when the worker is paid on a repeating cycle we can count. */
  cycleBased: boolean;
  timesPaid: number;
  cyclesPaid: number;
  cyclesDue: number;
  cyclesPending: number;
  label: "Paid" | "Pending" | "Not Paid";
};

const todayStr = (): string => new Date().toISOString().slice(0, 10);

const parseIsoDate = (value: string): Date | null => {
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

const formatIsoDate = (value: Date): string =>
  `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(
    value.getUTCDate(),
  ).padStart(2, "0")}`;

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const addMonthsClamped = (date: Date, months: number): Date => {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  const firstOfMonth = new Date(Date.UTC(year, month + months, 1));
  const maxDay = new Date(
    Date.UTC(firstOfMonth.getUTCFullYear(), firstOfMonth.getUTCMonth() + 1, 0),
  ).getUTCDate();
  firstOfMonth.setUTCDate(Math.min(day, maxDay));
  return firstOfMonth;
};

const dayDiffInclusive = (start: Date, end: Date): number =>
  Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

const payCycleLabel = (paymentType: WorkerApiRecord["paymentType"]): string => {
  if (paymentType === "Hourly") return "Hour";
  if (paymentType === "Daily") return "Day";
  if (paymentType === "Weekly") return "Week";
  if (paymentType === "Monthly") return "Month";
  return "Contract";
};

/** Cycles that have started between two dates, counted the way the worker is paid. */
const cyclesBetween = (
  paymentType: WorkerApiRecord["paymentType"],
  start: Date,
  end: Date,
): number => {
  if (end < start) return 0;

  if (paymentType === "Daily") return dayDiffInclusive(start, end);
  if (paymentType === "Weekly") return Math.ceil(dayDiffInclusive(start, end) / 7);

  if (paymentType === "Monthly") {
    let count = 0;
    while (addMonthsClamped(start, count) <= end) count += 1;
    return count;
  }

  return 0;
};

export const LaborPage = ({ embedded = false, search = "", renderTabBar }: LaborPageProps) => {
  const { markSaved } = useUnsavedChanges();
  const [searchParams] = useSearchParams();
  const projectFromQuery = searchParams.get("projectId") ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState<ProjectApiRecord[]>([]);
  const [workers, setWorkers] = useState<WorkerApiRecord[]>([]);
  const [laborPayments, setLaborPayments] = useState<LaborPaymentApiRecord[]>([]);

  const [listProjectFilter, setListProjectFilter] = useState(
    projectFromQuery || "All",
  );

  // Modal states
  const [showAddWorkerModal, setShowAddWorkerModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedWorkerForPayment, setSelectedWorkerForPayment] = useState<WorkerApiRecord | null>(null);
  const [viewWorker, setViewWorker] = useState<WorkerApiRecord | null>(null);
  const [viewPayment, setViewPayment] = useState<LaborPaymentApiRecord | null>(null);
  const [workerToDelete, setWorkerToDelete] = useState<WorkerApiRecord | null>(null);
  const [editingPayment, setEditingPayment] = useState<LaborPaymentApiRecord | null>(null);
  const [paymentToDelete, setPaymentToDelete] = useState<LaborPaymentApiRecord | null>(null);
  const [editingPaymentAmount, setEditingPaymentAmount] = useState('');
  const [editingPaymentMethod, setEditingPaymentMethod] = useState('Cash');
  const [editingPaymentNotes, setEditingPaymentNotes] = useState('');
  const [savingPaymentUpdate, setSavingPaymentUpdate] = useState(false);
  const [deletingPayment, setDeletingPayment] = useState(false);
  const [deletingWorker, setDeletingWorker] = useState(false);

  const [workerFullName, setWorkerFullName] = useState("");
  const [workerPhone, setWorkerPhone] = useState("");
  const [workerSkillRole, setWorkerSkillRole] = useState("");
  const [workerPaymentType, setWorkerPaymentType] = useState<
    "Hourly" | "Daily" | "Weekly" | "Monthly" | "Contract"
  >("Daily");
  const [workerRateAmount, setWorkerRateAmount] = useState("");
  const [workerAssignedProjectId, setWorkerAssignedProjectId] = useState(
    projectFromQuery,
  );
  const [workerEmploymentStartDate, setWorkerEmploymentStartDate] = useState(todayStr());
  const [workerEmploymentEndDate, setWorkerEmploymentEndDate] = useState("");
  const [workerNotes, setWorkerNotes] = useState("");
  const [savingWorker, setSavingWorker] = useState(false);

  const [paymentProjectId, setPaymentProjectId] = useState(projectFromQuery);
  const [paymentWorkerId, setPaymentWorkerId] = useState("");
  const [workStart, setWorkStart] = useState("");
  const [workEnd, setWorkEnd] = useState("");
  const [hoursWorked, setHoursWorked] = useState("8");
  const [paymentCycleCount, setPaymentCycleCount] = useState("1");
  const [rate, setRate] = useState("45000");
  const [amountPaid, setAmountPaid] = useState("180000");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [projectRows, workerResponse, paymentRows] = await Promise.all([
          api.getProjects(),
          api.getWorkers(),
          api.getLaborPayments(),
        ]);
        if (!mounted) {
          return;
        }

        setProjects(projectRows);
        setWorkers(workerResponse.rows);
        setLaborPayments(paymentRows);
        setError("");
      } catch (loadError) {
        if (!mounted) {
          return;
        }
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Failed to load labor/workers data.";
        setError(message);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (projectFromQuery.length === 0) {
      return;
    }

    setListProjectFilter(projectFromQuery);
    setWorkerAssignedProjectId(projectFromQuery);
    setPaymentProjectId(projectFromQuery);
  }, [projectFromQuery]);

  useEffect(() => {
    if (projects.length === 0) {
      return;
    }

    const fallbackProjectId = projects[0]?.id ?? "";

    if (workerAssignedProjectId.length === 0) {
      setWorkerAssignedProjectId(projectFromQuery || fallbackProjectId);
    }

    if (paymentProjectId.length === 0) {
      setPaymentProjectId(projectFromQuery || fallbackProjectId);
    }
  }, [paymentProjectId, projectFromQuery, projects, workerAssignedProjectId]);

  const filteredWorkers = useMemo(() => {
    let result = workers;
    if (listProjectFilter !== "All") {
      result = result.filter((worker) => worker.assignedProjectId === listProjectFilter);
    }
    if (search.trim().length > 0) {
      const q = search.toLowerCase();
      result = result.filter(
        (w) =>
          w.fullName.toLowerCase().includes(q) ||
          w.phone.toLowerCase().includes(q) ||
          w.skillRole.toLowerCase().includes(q) ||
          (w.assignedProjectName ?? "").toLowerCase().includes(q),
      );
    }
    return result;
  }, [listProjectFilter, search, workers]);

  const workersPagination = useTablePagination(filteredWorkers);

  const paymentsByWorker = useMemo(() => {
    const grouped = new Map<string, LaborPaymentApiRecord[]>();
    for (const payment of laborPayments) {
      const existing = grouped.get(payment.workerId);
      if (existing) {
        existing.push(payment);
      } else {
        grouped.set(payment.workerId, [payment]);
      }
    }
    for (const list of grouped.values()) {
      list.sort((a, b) => b.workStart.localeCompare(a.workStart));
    }
    return grouped;
  }, [laborPayments]);

  const progressByWorker = useMemo(() => {
    const today = parseIsoDate(todayStr());
    const progress = new Map<string, WorkerPaymentProgress>();

    for (const worker of workers) {
      const payments = paymentsByWorker.get(worker.id) ?? [];
      const timesPaid = payments.length;
      const cycleBased = RECURRING_PAYMENT_TYPES.some((type) => type === worker.paymentType);

      let cyclesPaid = 0;
      let cyclesDue = 0;

      if (cycleBased) {
        cyclesPaid = payments.reduce(
          (sum, payment) => sum + Math.max(payment.payCycleCount || 1, 1),
          0,
        );

        const start = parseIsoDate(worker.payCycleStartDate);
        const employmentEnd = worker.employmentEndDate
          ? parseIsoDate(worker.employmentEndDate)
          : null;
        // A finished contract stops accruing cycles on its last day.
        const end = employmentEnd && today && employmentEnd < today ? employmentEnd : today;

        if (start && end) {
          cyclesDue = cyclesBetween(worker.paymentType, start, end);
        }
      }

      const cyclesPending = Math.max(cyclesDue - cyclesPaid, 0);
      const owesMoney = cyclesPending > 0 || worker.outstandingAmount > 0;

      progress.set(worker.id, {
        cycleBased,
        timesPaid,
        cyclesPaid,
        cyclesDue,
        cyclesPending,
        label: timesPaid === 0 ? "Not Paid" : owesMoney ? "Pending" : "Paid",
      });
    }

    return progress;
  }, [paymentsByWorker, workers]);

  const viewWorkerPayments = useMemo(
    () => (viewWorker ? paymentsByWorker.get(viewWorker.id) ?? [] : []),
    [paymentsByWorker, viewWorker],
  );

  const viewWorkerProgress = viewWorker ? progressByWorker.get(viewWorker.id) : undefined;

  const isRecurringWorker = useMemo(() => {
    if (!selectedWorkerForPayment) return false;
    return ["Daily", "Weekly", "Monthly"].includes(selectedWorkerForPayment.paymentType);
  }, [selectedWorkerForPayment]);

  const resolvedCycleCount = useMemo(
    () => Math.max(Number(paymentCycleCount) || 1, 1),
    [paymentCycleCount],
  );

  const computedRecurringEndDate = useMemo(() => {
    if (!selectedWorkerForPayment || !isRecurringWorker) return "";
    const startDate = parseIsoDate(workStart);
    if (!startDate) return "";

    if (selectedWorkerForPayment.paymentType === "Daily") {
      return formatIsoDate(addDays(startDate, resolvedCycleCount - 1));
    }
    if (selectedWorkerForPayment.paymentType === "Weekly") {
      return formatIsoDate(addDays(startDate, (resolvedCycleCount * 7) - 1));
    }
    return formatIsoDate(addDays(addMonthsClamped(startDate, resolvedCycleCount), -1));
  }, [isRecurringWorker, resolvedCycleCount, selectedWorkerForPayment, workStart]);

  const nextRecurringDueDate = useMemo(() => {
    const endDate = parseIsoDate(computedRecurringEndDate);
    if (!endDate) return "";
    return formatIsoDate(addDays(endDate, 1));
  }, [computedRecurringEndDate]);

  const computedDaysWorked = useMemo(() => {
    const startDate = parseIsoDate(workStart);
    const endDate = parseIsoDate(
      isRecurringWorker ? computedRecurringEndDate : workEnd,
    );
    if (!startDate || !endDate || endDate < startDate) return 0;
    return dayDiffInclusive(startDate, endDate);
  }, [computedRecurringEndDate, isRecurringWorker, workEnd, workStart]);

  const totalPayable = useMemo(() => {
    const workerRate = Number(rate) || 0;
    if (selectedWorkerForPayment?.paymentType === "Hourly") {
      return (Number(hoursWorked) || 0) * workerRate;
    }
    if (isRecurringWorker) {
      return resolvedCycleCount * workerRate;
    }
    return computedDaysWorked * workerRate;
  }, [
    computedDaysWorked,
    hoursWorked,
    isRecurringWorker,
    rate,
    resolvedCycleCount,
    selectedWorkerForPayment,
  ]);

  const balance = Math.max(totalPayable - (Number(amountPaid) || 0), 0);

  const laborCostPerProject = useMemo(() => {
    const grouped = workers.reduce<Record<string, number>>((acc, worker) => {
      const key = worker.assignedProjectName || "Unassigned";
      acc[key] = (acc[key] ?? 0) + worker.totalPaid;
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([projectName, total]) => ({ projectName, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);
  }, [workers]);

  // Filtered stats based on selected site
  const filteredTotalLaborPaid = useMemo(() => {
    return filteredWorkers.reduce((total, worker) => total + worker.totalPaid, 0);
  }, [filteredWorkers]);

  const filteredOutstandingPayments = useMemo(() => {
    return filteredWorkers.reduce((total, worker) => total + worker.outstandingAmount, 0);
  }, [filteredWorkers]);

  const filteredLaborCostPerProject = useMemo(() => {
    if (listProjectFilter === "All") {
      return laborCostPerProject;
    }
    
    // Show only the selected project's workers cost
    const selectedProject = projects.find(p => p.id === listProjectFilter);
    const projectCost = filteredWorkers.reduce((total, worker) => total + worker.totalPaid, 0);
    
    return selectedProject ? [{ projectName: selectedProject.name, total: projectCost }] : [];
  }, [filteredWorkers, listProjectFilter, projects, laborCostPerProject]);

  const paymentWorkers = useMemo(() => {
    if (paymentProjectId.length === 0) {
      return workers;
    }

    return workers.filter(
      (worker) =>
        worker.assignedProjectId === paymentProjectId ||
        worker.assignedProjectId === null,
    );
  }, [paymentProjectId, workers]);

  useEffect(() => {
    if (paymentWorkers.length === 0) {
      setPaymentWorkerId("");
      return;
    }

    if (!paymentWorkers.some((worker) => worker.id === paymentWorkerId)) {
      setPaymentWorkerId(paymentWorkers[0].id);
      setRate(String(paymentWorkers[0].rateAmount));
    }
  }, [paymentWorkerId, paymentWorkers]);

  const refreshWorkers = async () => {
    const [workerResponse, paymentRows] = await Promise.all([
      api.getWorkers(),
      api.getLaborPayments(),
    ]);
    setWorkers(workerResponse.rows);
    setLaborPayments(paymentRows);
    // The worker detail modal stays open across payment edits, so re-point it
    // at the refreshed row instead of leaving stale totals on screen.
    setViewWorker((current) =>
      current ? workerResponse.rows.find((row) => row.id === current.id) ?? null : null,
    );
  };

  const resetWorkerForm = () => {
    setWorkerFullName("");
    setWorkerPhone("");
    setWorkerSkillRole("");
    setWorkerPaymentType("Daily");
    setWorkerRateAmount("");
    setWorkerEmploymentStartDate(todayStr());
    setWorkerEmploymentEndDate("");
    setWorkerNotes("");
  };

  const openAddWorkerModal = () => {
    resetWorkerForm();
    setShowAddWorkerModal(true);
  };

  const closeAddWorkerModal = () => {
    setShowAddWorkerModal(false);
    resetWorkerForm();
  };

  const hasWorkerEnded = (worker: WorkerApiRecord): boolean =>
    Boolean(worker.employmentEndDate && worker.employmentEndDate < todayStr());

  const openPaymentModal = (worker: WorkerApiRecord) => {
    if (hasWorkerEnded(worker)) {
      setError("This worker's employment period has ended. Extend the end date before recording another payment.");
      return;
    }

    const recurringType = ["Daily", "Weekly", "Monthly"].includes(worker.paymentType);
    const startDate = recurringType
      ? worker.nextPaymentDueDate || worker.payCycleStartDate || todayStr()
      : "";

    setSelectedWorkerForPayment(worker);
    setPaymentWorkerId(worker.id);
    setRate(String(worker.rateAmount));
    setWorkStart(startDate);
    setWorkEnd("");
    setHoursWorked("8");
    setPaymentCycleCount("1");
    setAmountPaid("");
    setPaymentNotes("");
    setShowPaymentModal(true);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedWorkerForPayment(null);
  };

  const openEditPayment = (payment: LaborPaymentApiRecord) => {
    setEditingPayment(payment);
    setEditingPaymentAmount(String(payment.amountPaid));
    setEditingPaymentMethod(payment.paymentMethod || 'Cash');
    setEditingPaymentNotes(payment.notes || '');
  };

  const closeEditPayment = () => {
    setEditingPayment(null);
    setEditingPaymentAmount('');
    setEditingPaymentMethod('Cash');
    setEditingPaymentNotes('');
  };

  const handleSaveWorker = async () => {
    if (
      workerFullName.trim().length < 2 ||
      workerPhone.trim().length < 7 ||
      workerSkillRole.trim().length < 2
    ) {
      setError("Please fill worker name, phone, and skill/role correctly.");
      return;
    }

    if (workerEmploymentEndDate && workerEmploymentEndDate < workerEmploymentStartDate) {
      setError("Employment end date must be on or after start date.");
      return;
    }

    setSavingWorker(true);
    setError("");

    try {
      await api.createWorker({
        fullName: workerFullName.trim(),
        phone: workerPhone.trim(),
        skillRole: workerSkillRole.trim(),
        paymentType: workerPaymentType,
        rateAmount: Number(workerRateAmount) || 0,
        assignedProjectId: workerAssignedProjectId,
        employmentStartDate: workerEmploymentStartDate,
        employmentEndDate: workerEmploymentEndDate || undefined,
        notes: workerNotes.trim(),
      });
      await refreshWorkers();
      markSaved();
      closeAddWorkerModal();
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : "Failed to save worker.";
      setError(message);
    } finally {
      setSavingWorker(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedWorkerForPayment) {
      setError("Please select worker.");
      return;
    }

    if (selectedWorkerForPayment.paymentType === "Hourly") {
      if (
        workStart.trim().length === 0 ||
        workEnd.trim().length === 0 ||
        workEnd < workStart
      ) {
        setError("Please provide valid work start/end dates for hourly payment.");
        return;
      }
    } else if (isRecurringWorker) {
      if (workStart.trim().length === 0 || computedRecurringEndDate.length === 0) {
        setError("Please provide valid recurring payment start date.");
        return;
      }
      if (resolvedCycleCount <= 0) {
        setError("Cycle count must be at least 1.");
        return;
      }
    } else {
      if (
        workStart.trim().length === 0 ||
        workEnd.trim().length === 0 ||
        workEnd < workStart
      ) {
        setError("Please provide valid work start/end dates.");
        return;
      }
    }

    if (computedDaysWorked <= 0) {
      setError("Computed working period is invalid.");
      return;
    }

    setSavingPayment(true);
    setError("");

    try {
      const projectId = selectedWorkerForPayment.assignedProjectId || paymentProjectId;
      await api.recordLaborPayment({
        projectId,
        workerId: selectedWorkerForPayment.id,
        workStart,
        workEnd: isRecurringWorker ? computedRecurringEndDate : workEnd,
        daysWorked: computedDaysWorked,
        hoursWorked: Number(hoursWorked) || 0,
        cycleCount: isRecurringWorker ? resolvedCycleCount : undefined,
        rateAmount: Number(rate) || 0,
        amountPaid: Number(amountPaid) || 0,
        paymentMethod,
        notes: paymentNotes.trim(),
      });
      await refreshWorkers();
      markSaved();
      closePaymentModal();
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Failed to record labor payment.";
      setError(message);
    } finally {
      setSavingPayment(false);
    }
  };

  const handleUpdatePayment = async () => {
    if (editingPayment === null) return;

    const nextAmountPaid = Number(editingPaymentAmount);
    if (Number.isFinite(nextAmountPaid) === false || nextAmountPaid < 0) {
      setError('Please enter a valid amount paid.');
      return;
    }

    if (nextAmountPaid > editingPayment.totalPayable) {
      setError('Amount paid cannot exceed total payable for this labor payment.');
      return;
    }

    setSavingPaymentUpdate(true);
    setError('');

    try {
      await api.updateLaborPayment(editingPayment.id, {
        amountPaid: nextAmountPaid,
        paymentMethod: editingPaymentMethod,
        notes: editingPaymentNotes.trim(),
      });
      await refreshWorkers();
      markSaved();
      closeEditPayment();
    } catch (updateError) {
      const message =
        updateError instanceof Error
          ? updateError.message
          : 'Failed to update labor payment.';
      setError(message);
    } finally {
      setSavingPaymentUpdate(false);
    }
  };

  const handleDeletePayment = async () => {
    if (paymentToDelete === null) return;

    setDeletingPayment(true);
    setError('');

    try {
      await api.deleteLaborPayment(paymentToDelete.id);
      await refreshWorkers();
      markSaved();
      setPaymentToDelete(null);
    } catch (deleteError) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : 'Failed to delete labor payment.';
      setError(message);
      setPaymentToDelete(null);
    } finally {
      setDeletingPayment(false);
    }
  };

  const handleDeleteWorker = async () => {
    if (!workerToDelete) return;

    setDeletingWorker(true);
    setError("");

    try {
      await api.deleteWorker(workerToDelete.id);
      await refreshWorkers();
      markSaved();
      setWorkerToDelete(null);
    } catch (deleteError) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to deactivate worker.";
      setError(message);
      setWorkerToDelete(null);
    } finally {
      setDeletingWorker(false);
    }
  };

  return (
    <div className="space-y-6">
      {!embedded ? (
        <SectionTitle
          subtitle="Track workers, assignments, wages, and outstanding labor payments."
          title="Labor / Workforce Management"
        />
      ) : null}

      {renderTabBar?.(
        <>
          <div className="w-full sm:w-52">
            <GuiSelect
              className="h-11"
              onChange={(event) => setListProjectFilter(event.target.value)}
              value={listProjectFilter}
            >
              <option value="All">All Sites</option>
              {projects.map((project) => (
                <option key={`wk-list-${project.id}`} value={project.id}>
                  {project.name}
                </option>
              ))}
            </GuiSelect>
          </div>
          <button
            className="btn-primary h-11 justify-center whitespace-nowrap"
            onClick={openAddWorkerModal}
            type="button"
          >
            + Add Worker
          </button>
        </>,
      )}

      {/* Stats cards - Dynamic based on filter */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SurfaceCard title="Total labor paid">
          <p className="text-2xl font-bold text-slate-900">
            {formatTzs(filteredTotalLaborPaid)}
          </p>
        </SurfaceCard>
        <SurfaceCard title="Outstanding labor payments">
          <p className="text-2xl font-bold text-amber-700">
            {formatTzs(filteredOutstandingPayments)}
          </p>
        </SurfaceCard>
        <SurfaceCard title="Labor cost">
          <ul className="space-y-2 text-sm text-slate-700">
            {filteredLaborCostPerProject.map((row) => (
              <li className="flex justify-between" key={row.projectName}>
                <span>{row.projectName}</span>
                <span>{formatTzs(row.total)}</span>
              </li>
            ))}
          </ul>
        </SurfaceCard>
      </div>

      {/* Single workers table — payment history lives in each worker's View modal */}
      <SurfaceCard title="Workers List">
        {error && <p className="mb-4 text-sm text-red-700">{error}</p>}

        {loading ? (
          <SkeletonTable rows={5} />
        ) : filteredWorkers.length === 0 ? (
          <EmptyState
            description="No workers found for the selected site."
            title="No workers"
          />
        ) : (
          <>
            <div className="ops-table-wrap">
              <table className="data-table ops-table min-w-[1180px]">
                <thead>
                  <tr>
                    <th className="ops-sticky-sn">S/N</th>
                    <th>Worker</th>
                    <th>Role</th>
                    <th>Site</th>
                    <th>Paid Every</th>
                    <th>Rate</th>
                    <th>Next Due</th>
                    <th>Total Paid</th>
                    <th>Outstanding</th>
                    <th>Payment Status</th>
                    <th className="ops-sticky-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {workersPagination.paginatedRows.map((worker, index) => {
                    const progress = progressByWorker.get(worker.id);

                    return (
                      <tr key={worker.id}>
                        <td className="ops-sticky-sn">{workersPagination.startIndex + index + 1}</td>
                        <td><span className="ops-cell-strong">{worker.fullName}</span></td>
                        <td><span className="ops-cell-text">{worker.skillRole}</span></td>
                        <td><span className="ops-cell-text">{worker.assignedProjectName || "Unassigned"}</span></td>
                        <td>
                          <span className="ops-cell-text">{payCycleLabel(worker.paymentType)}</span>
                        </td>
                        <td>{formatTzs(worker.rateAmount)}</td>
                        <td>{worker.nextPaymentDueDate ? formatDate(worker.nextPaymentDueDate) : "-"}</td>
                        <td>{formatTzs(worker.totalPaid)}</td>
                        <td
                          className={
                            worker.outstandingAmount > 0
                              ? "text-amber-700"
                              : "text-emerald-700"
                          }
                        >
                          {formatTzs(worker.outstandingAmount)}
                        </td>
                        <td>
                          <div className="flex flex-col items-start gap-1">
                            <span
                              className={[
                                "inline-flex items-center rounded-full border px-2.5 py-0.5",
                                "text-xs font-semibold",
                                progress?.label === "Paid"
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : progress?.label === "Pending"
                                    ? "border-amber-200 bg-amber-50 text-amber-700"
                                    : "border-slate-200 bg-slate-50 text-slate-600",
                              ].join(" ")}
                            >
                              {progress?.label ?? "Not Paid"}
                            </span>
                            <span className="text-xs text-slate-500">
                              Paid {progress?.timesPaid ?? 0}{" "}
                              {(progress?.timesPaid ?? 0) === 1 ? "time" : "times"}
                            </span>
                            {progress?.cycleBased ? (
                              <span className="text-xs text-slate-500">
                                {progress.cyclesPaid}/{progress.cyclesDue} cycles
                                {progress.cyclesPending > 0
                                  ? ` · ${progress.cyclesPending} unpaid`
                                  : ""}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="ops-sticky-actions">
                          <div className="ops-actions-row">
                            <button
                              className="btn-secondary py-1 px-3 text-xs"
                              onClick={() => setViewWorker(worker)}
                              type="button"
                            >
                              View
                            </button>
                            <button
                              className="btn-primary py-1 px-3 text-xs"
                              disabled={worker.status === "Inactive" || hasWorkerEnded(worker)}
                              onClick={() => openPaymentModal(worker)}
                              type="button"
                            >
                              Pay
                            </button>
                            <button
                              className="btn-danger py-1 px-3 text-xs"
                              onClick={() => setWorkerToDelete(worker)}
                              type="button"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <TablePagination
              endIndex={workersPagination.endIndex}
              itemLabel="workers"
              onPageChange={workersPagination.setPage}
              onPageSizeChange={workersPagination.setPageSize}
              page={workersPagination.page}
              pageSize={workersPagination.pageSize}
              startIndex={workersPagination.startIndex}
              totalCount={workersPagination.totalCount}
              totalPages={workersPagination.totalPages}
            />
          </>
        )}
      </SurfaceCard>

      {/* Add Worker Modal */}
      {showAddWorkerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <SurfaceCard className="w-full max-w-2xl m-4" title="Add Worker">
            <form className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="form-field">
                <span>Full Name</span>
                <input
                  className="input-field"
                  onChange={(event) => setWorkerFullName(event.target.value)}
                  placeholder="Worker full name"
                  required
                  value={workerFullName}
                />
              </label>
              <label className="form-field">
                <span>Phone</span>
                <input
                  className="input-field"
                  onChange={(event) => setWorkerPhone(event.target.value)}
                  placeholder="+255 ..."
                  required
                  value={workerPhone}
                />
              </label>
              <label className="form-field">
                <span>Role/Skill</span>
                <input
                  className="input-field"
                  onChange={(event) => setWorkerSkillRole(event.target.value)}
                  placeholder="Mason / Electrician..."
                  value={workerSkillRole}
                />
              </label>
              <label className="form-field">
                <span>Payment Type</span>
                <GuiSelect
                  className="input-field"
                  onChange={(event) =>
                    setWorkerPaymentType(
                      event.target.value as "Hourly" | "Daily" | "Weekly" | "Monthly" | "Contract",
                    )
                  }
                  value={workerPaymentType}
                >
                  <option value="Hourly">Hourly</option>
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Monthly">Monthly</option>
                  <option value="Contract">Contract</option>
                </GuiSelect>
              </label>
              <FinancialInput
                label="Rate Amount"
                onChange={setWorkerRateAmount}
                placeholder="45000"
                value={workerRateAmount}
              />
              <label className="form-field">
                <span>Assigned Site</span>
                <GuiSelect
                  className="input-field"
                  onChange={(event) => setWorkerAssignedProjectId(event.target.value)}
                  value={workerAssignedProjectId}
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </GuiSelect>
              </label>
              <label className="form-field">
                <span>Employment Start Date</span>
                <input
                  className="input-field"
                  onChange={(event) => setWorkerEmploymentStartDate(event.target.value)}
                  type="date"
                  value={workerEmploymentStartDate}
                />
              </label>
              <label className="form-field">
                <span>Employment End Date</span>
                <input
                  className="input-field"
                  min={workerEmploymentStartDate}
                  onChange={(event) => setWorkerEmploymentEndDate(event.target.value)}
                  type="date"
                  value={workerEmploymentEndDate}
                />
              </label>
              <label className="form-field sm:col-span-2">
                <span>Notes</span>
                <textarea
                  className="input-field min-h-20"
                  onChange={(event) => setWorkerNotes(event.target.value)}
                  placeholder="Extra notes..."
                  value={workerNotes}
                />
              </label>
              <div className="sm:col-span-2 flex justify-end gap-2">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={closeAddWorkerModal}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  disabled={savingWorker}
                  onClick={() => void handleSaveWorker()}
                  type="button"
                >
                  Save Worker
                </button>
              </div>
            </form>
          </SurfaceCard>
        </div>
      )}

      {/* Labor Payment Modal */}
      {showPaymentModal && selectedWorkerForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <SurfaceCard className="w-full max-w-2xl m-4" title={`Record Payment - ${selectedWorkerForPayment.fullName}`}>
            <form className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {isRecurringWorker ? (
                <>
                  <label className="form-field">
                    <span>Cycle Start Date</span>
                    <input
                      className="input-field"
                      onChange={(event) => setWorkStart(event.target.value)}
                      type="date"
                      value={workStart}
                    />
                  </label>
                  <label className="form-field">
                    <span>
                      Cycles to Pay (
                      {selectedWorkerForPayment.paymentType === "Daily"
                        ? "days"
                        : selectedWorkerForPayment.paymentType === "Weekly"
                          ? "weeks"
                          : "months"}
                      )
                    </span>
                    <input
                      className="input-field"
                      min="1"
                      onChange={(event) => setPaymentCycleCount(event.target.value)}
                      type="number"
                      value={paymentCycleCount}
                    />
                  </label>
                  <label className="form-field">
                    <span>Coverage End Date</span>
                    <input
                      className="input-field bg-slate-50"
                      readOnly
                      type="date"
                      value={computedRecurringEndDate}
                    />
                  </label>
                  <label className="form-field">
                    <span>Next Due Date</span>
                    <input
                      className="input-field bg-slate-50"
                      readOnly
                      type="date"
                      value={nextRecurringDueDate}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className="form-field">
                    <span>Work Start Date</span>
                    <input
                      className="input-field"
                      onChange={(event) => setWorkStart(event.target.value)}
                      type="date"
                      value={workStart}
                    />
                  </label>
                  <label className="form-field">
                    <span>Work End Date</span>
                    <input
                      className="input-field"
                      onChange={(event) => setWorkEnd(event.target.value)}
                      type="date"
                      value={workEnd}
                    />
                  </label>
                </>
              )}

              {!isRecurringWorker && workStart.trim().length > 0 && workEnd.trim().length > 0 && workEnd < workStart ? (
                <p className="text-xs text-red-600 sm:col-span-2">
                  Work end date must be the same day or after start date.
                </p>
              ) : null}

              {selectedWorkerForPayment.paymentType === "Hourly" ? (
                <label className="form-field sm:col-span-2">
                  <span>Hours Worked</span>
                  <input
                    className="input-field"
                    onChange={(event) => setHoursWorked(event.target.value)}
                    type="number"
                    value={hoursWorked}
                  />
                </label>
              ) : (
                <label className="form-field sm:col-span-2">
                  <span>Days Covered</span>
                  <input
                    className="input-field bg-slate-50"
                    readOnly
                    type="number"
                    value={computedDaysWorked > 0 ? String(computedDaysWorked) : ""}
                  />
                </label>
              )}

              <FinancialInput
                label={
                  selectedWorkerForPayment.paymentType === "Hourly"
                    ? "Hourly Rate"
                    : isRecurringWorker
                      ? `${selectedWorkerForPayment.paymentType} Rate`
                      : "Rate"
                }
                onChange={setRate}
                placeholder="45000"
                value={rate}
              />
              <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Auto Calculated</p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <p className="text-sm text-slate-700">
                    {selectedWorkerForPayment.paymentType === "Hourly"
                      ? `${hoursWorked || 0} hrs * ${formatTzs(Number(rate))}`
                      : isRecurringWorker
                        ? `${resolvedCycleCount} cycle(s) * ${formatTzs(Number(rate))}`
                        : `${computedDaysWorked} days * ${formatTzs(Number(rate))}`}
                    {" -> "}Total Payable: <span className="font-semibold">{formatTzs(totalPayable)}</span>
                  </p>
                  <p className="text-sm text-slate-700">
                    Amount Paid: <span className="font-semibold">{formatTzs(Number(amountPaid) || 0)}</span>
                  </p>
                  <p className="text-sm text-amber-700">
                    Balance: <span className="font-semibold">{formatTzs(balance)}</span>
                  </p>
                </div>
              </div>
              <FinancialInput label="Amount Paid" onChange={setAmountPaid} placeholder="180000" value={amountPaid} />
              <label className="form-field">
                <span>Payment Method</span>
                <GuiSelect
                  className="input-field"
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  value={paymentMethod}
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Mobile Money">Mobile Money</option>
                  <option value="Cheque">Cheque</option>
                </GuiSelect>
              </label>
              <label className="form-field sm:col-span-2">
                <span>Notes</span>
                <textarea
                  className="input-field min-h-20"
                  onChange={(event) => setPaymentNotes(event.target.value)}
                  placeholder="Labor payment remarks..."
                  value={paymentNotes}
                />
              </label>
              <div className="sm:col-span-2 flex justify-end gap-2">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={closePaymentModal}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  disabled={savingPayment}
                  onClick={() => void handleRecordPayment()}
                  type="button"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </SurfaceCard>
        </div>
      )}
      {editingPayment && (
        // Above the worker detail modal (z-80), which stays open behind it.
        <div className='fixed inset-0 z-90 flex items-center justify-center bg-black/50 p-4'>
          <SurfaceCard className='w-full max-w-xl max-h-[90vh] overflow-y-auto' title='Edit Labor Payment'>
            <form className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
              <p className='text-sm font-semibold text-slate-700 sm:col-span-2'>{editingPayment.workerName}</p>
              <FinancialInput
                label='Amount Paid'
                onChange={setEditingPaymentAmount}
                placeholder='180000'
                value={editingPaymentAmount}
              />
              <label className='form-field'>
                <span>Payment Method</span>
                <GuiSelect
                  className='input-field'
                  onChange={(event) => setEditingPaymentMethod(event.target.value)}
                  value={editingPaymentMethod}
                >
                  <option value='Cash'>Cash</option>
                  <option value='Mobile Money'>Mobile Money</option>
                  <option value='Bank Transfer'>Bank Transfer</option>
                  <option value='Cheque'>Cheque</option>
                </GuiSelect>
              </label>
              <label className='form-field sm:col-span-2'>
                <span>Notes</span>
                <textarea
                  className='input-field min-h-20'
                  onChange={(event) => setEditingPaymentNotes(event.target.value)}
                  value={editingPaymentNotes}
                />
              </label>
              <div className='rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 sm:col-span-2'>
                <p>Total payable: <span className='font-semibold'>{formatTzs(editingPayment.totalPayable)}</span></p>
                <p>Balance after edit: <span className='font-semibold'>{formatTzs(Math.max(editingPayment.totalPayable - (Number(editingPaymentAmount) || 0), 0))}</span></p>
              </div>
              <div className='flex justify-end gap-2 sm:col-span-2'>
                <button className='btn-secondary' onClick={closeEditPayment} type='button'>
                  Cancel
                </button>
                <button className='btn-primary' disabled={savingPaymentUpdate} onClick={() => void handleUpdatePayment()} type='button'>
                  {savingPaymentUpdate ? 'Updating...' : 'Update Payment'}
                </button>
              </div>
            </form>
          </SurfaceCard>
        </div>
      )}

      <DetailModal
        onClose={() => setViewWorker(null)}
        open={viewWorker !== null}
        rows={viewWorker ? [
          { label: "Full Name", value: viewWorker.fullName },
          { label: "Phone", value: viewWorker.phone },
          { label: "Skill / Role", value: viewWorker.skillRole },
          { label: "Assigned Project", value: viewWorker.assignedProjectName || "Unassigned" },
          { label: "Paid Every", value: payCycleLabel(viewWorker.paymentType) },
          { label: "Rate", value: formatTzs(viewWorker.rateAmount) },
          { label: "Total Paid", value: formatTzs(viewWorker.totalPaid) },
          { label: "Outstanding", value: formatTzs(viewWorker.outstandingAmount) },
          {
            label: "Times Paid",
            value: `${viewWorkerProgress?.timesPaid ?? 0}`,
          },
          {
            label: "Cycles Paid",
            value: viewWorkerProgress?.cycleBased
              ? `${viewWorkerProgress.cyclesPaid} of ${viewWorkerProgress.cyclesDue}` +
                (viewWorkerProgress.cyclesPending > 0
                  ? ` (${viewWorkerProgress.cyclesPending} unpaid)`
                  : " (up to date)")
              : "-",
          },
          { label: "Pay Cycle Start", value: viewWorker.payCycleStartDate ? formatDate(viewWorker.payCycleStartDate) : "-" },
          { label: "Employment End Date", value: viewWorker.employmentEndDate ? formatDate(viewWorker.employmentEndDate) : "-" },
          { label: "Next Payment Due", value: viewWorker.nextPaymentDueDate ? formatDate(viewWorker.nextPaymentDueDate) : "-" },
          { label: "Last Payment Covered", value: viewWorker.lastPaymentCoveredDate ? formatDate(viewWorker.lastPaymentCoveredDate) : "-" },
          { label: "Status", value: <StatusBadge status={viewWorker.status} /> },
          { label: "Notes", value: viewWorker.notes || "-", full: true },
        ] : []}
        subtitle={viewWorker ? viewWorker.skillRole : ""}
        title="Worker Details"
        widthClass="max-w-4xl"
      >
        <div className="mt-6 border-t border-slate-100 pt-4">
          <h4 className="mb-3 text-sm font-semibold text-slate-900">
            Payment History ({viewWorkerPayments.length})
          </h4>

          {viewWorkerPayments.length === 0 ? (
            <p className="text-sm text-slate-500">
              No payments recorded for this worker yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table min-w-[760px]">
                <thead>
                  <tr>
                    <th>S/N</th>
                    <th>Period</th>
                    <th>Cycles</th>
                    <th>Payable</th>
                    <th>Paid</th>
                    <th>Balance</th>
                    <th>Method</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {viewWorkerPayments.map((payment, index) => (
                    <tr key={payment.id}>
                      <td>{index + 1}</td>
                      <td className="whitespace-nowrap">
                        {formatDate(payment.workStart)} - {formatDate(payment.workEnd)}
                      </td>
                      <td>
                        {payment.payCycleType}
                        {payment.payCycleCount > 0 ? ` x ${payment.payCycleCount}` : ""}
                      </td>
                      <td>{formatTzs(payment.totalPayable)}</td>
                      <td className="text-emerald-700">{formatTzs(payment.amountPaid)}</td>
                      <td className={payment.balance > 0 ? "text-amber-700" : "text-emerald-700"}>
                        {formatTzs(payment.balance)}
                      </td>
                      <td>{payment.paymentMethod}</td>
                      <td>
                        <div className="flex gap-1">
                          <button
                            className="btn-secondary py-1 px-2 text-xs"
                            onClick={() => setViewPayment(payment)}
                            type="button"
                          >
                            View
                          </button>
                          <button
                            className="btn-secondary py-1 px-2 text-xs"
                            onClick={() => openEditPayment(payment)}
                            type="button"
                          >
                            Edit
                          </button>
                          <button
                            className="btn-danger py-1 px-2 text-xs"
                            onClick={() => setPaymentToDelete(payment)}
                            type="button"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DetailModal>

      <DetailModal
        onClose={() => setViewPayment(null)}
        open={viewPayment !== null}
        rows={viewPayment ? [
          { label: "Worker", value: viewPayment.workerName },
          { label: "Project / Site", value: viewPayment.projectName || "Unassigned" },
          { label: "Work Period", value: formatDate(viewPayment.workStart) + " - " + formatDate(viewPayment.workEnd) },
          { label: "Cycle", value: viewPayment.payCycleType + (viewPayment.payCycleCount > 0 ? " x " + viewPayment.payCycleCount : "") },
          { label: "Rate", value: formatTzs(viewPayment.rateAmount) },
          { label: "Total Payable", value: formatTzs(viewPayment.totalPayable) },
          { label: "Paid", value: formatTzs(viewPayment.amountPaid) },
          { label: "Balance", value: formatTzs(viewPayment.balance) },
          { label: "Payment Method", value: viewPayment.paymentMethod },
          { label: "Notes", value: viewPayment.notes || "-", full: true },
        ] : []}
        subtitle={viewPayment ? viewPayment.workerName : ""}
        title="Labor Payment Details"
      />

      {/* Confirm Delete Modal */}
      <ConfirmModal
        cancelLabel='Cancel'
        confirmClassName='btn-danger'
        confirmLabel={deletingPayment ? 'Deleting...' : 'Delete'}
        description={
          paymentToDelete
            ? 'Delete labor payment for ' + paymentToDelete.workerName + ' (' + formatTzs(paymentToDelete.amountPaid) + ')? Project and worker totals will be reversed.'
            : ''
        }
        onCancel={() => setPaymentToDelete(null)}
        onConfirm={() => void handleDeletePayment()}
        open={paymentToDelete !== null}
        title='Delete Labor Payment'
      />

      <ConfirmModal
        cancelLabel="Cancel"
        confirmClassName="btn-danger"
        confirmLabel={deletingWorker ? "Deactivating..." : "Deactivate"}
        description={
          workerToDelete
            ? `Are you sure you want to deactivate "${workerToDelete.fullName}"? Their payment history will be preserved. You can identify them by their Inactive status.`
            : ""
        }
        onCancel={() => setWorkerToDelete(null)}
        onConfirm={() => void handleDeleteWorker()}
        open={workerToDelete !== null}
        title="Deactivate Worker"
      />
    </div>
  );
};
