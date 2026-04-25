import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
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
  type ProjectApiRecord,
  type WorkerApiRecord,
} from "../services/api";
import { formatTzs } from "../utils/format";

export const LaborPage = () => {
  const { markSaved } = useUnsavedChanges();
  const [searchParams] = useSearchParams();
  const projectFromQuery = searchParams.get("projectId") ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState<ProjectApiRecord[]>([]);
  const [workers, setWorkers] = useState<WorkerApiRecord[]>([]);
  const [totalLaborPaidThisMonth, setTotalLaborPaidThisMonth] = useState(0);
  const [outstandingLaborPayments, setOutstandingLaborPayments] = useState(0);

  const [listProjectFilter, setListProjectFilter] = useState(
    projectFromQuery || "All",
  );

  const [workerFullName, setWorkerFullName] = useState("");
  const [workerPhone, setWorkerPhone] = useState("");
  const [workerSkillRole, setWorkerSkillRole] = useState("");
  const [workerPaymentType, setWorkerPaymentType] = useState<
    "Daily" | "Weekly" | "Monthly" | "Contract"
  >("Daily");
  const [workerRateAmount, setWorkerRateAmount] = useState("");
  const [workerAssignedProjectId, setWorkerAssignedProjectId] = useState(
    projectFromQuery,
  );
  const [workerNotes, setWorkerNotes] = useState("");
  const [savingWorker, setSavingWorker] = useState(false);

  const [paymentProjectId, setPaymentProjectId] = useState(projectFromQuery);
  const [paymentWorkerId, setPaymentWorkerId] = useState("");
  const [workStart, setWorkStart] = useState("");
  const [workEnd, setWorkEnd] = useState("");
  const [daysWorked, setDaysWorked] = useState("6");
  const [rate, setRate] = useState("45000");
  const [amountPaid, setAmountPaid] = useState("180000");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [projectRows, workerResponse] = await Promise.all([
          api.getProjects(),
          api.getWorkers(),
        ]);
        if (!mounted) {
          return;
        }

        setProjects(projectRows);
        setWorkers(workerResponse.rows);
        setTotalLaborPaidThisMonth(workerResponse.summary.totalLaborPaidThisMonth);
        setOutstandingLaborPayments(workerResponse.summary.outstandingLaborPayments);
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
    if (listProjectFilter === "All") {
      return workers;
    }
    return workers.filter((worker) => worker.assignedProjectId === listProjectFilter);
  }, [listProjectFilter, workers]);

  const workersPagination = useTablePagination(filteredWorkers);

  const totalPayable = useMemo(() => {
    const days = Number(daysWorked) || 0;
    const workerRate = Number(rate) || 0;
    return days * workerRate;
  }, [daysWorked, rate]);

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
    const workerResponse = await api.getWorkers();
    setWorkers(workerResponse.rows);
    setTotalLaborPaidThisMonth(workerResponse.summary.totalLaborPaidThisMonth);
    setOutstandingLaborPayments(workerResponse.summary.outstandingLaborPayments);
  };

  const resetWorkerForm = () => {
    setWorkerFullName("");
    setWorkerPhone("");
    setWorkerSkillRole("");
    setWorkerPaymentType("Daily");
    setWorkerRateAmount("");
    setWorkerNotes("");
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
        notes: workerNotes.trim(),
      });
      await refreshWorkers();
      markSaved();
      resetWorkerForm();
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : "Failed to save worker.";
      setError(message);
    } finally {
      setSavingWorker(false);
    }
  };

  const handlePaymentWorkerChange = (workerId: string) => {
    setPaymentWorkerId(workerId);
    const selectedWorker = workers.find((worker) => worker.id === workerId);
    if (selectedWorker) {
      setRate(String(selectedWorker.rateAmount));
    }
  };

  const handleRecordPayment = async () => {
    if (
      paymentProjectId.trim().length === 0 ||
      paymentWorkerId.trim().length === 0 ||
      workStart.trim().length === 0 ||
      workEnd.trim().length === 0
    ) {
      setError("Please fill project, worker, and work date range.");
      return;
    }

    setSavingPayment(true);
    setError("");

    try {
      await api.recordLaborPayment({
        projectId: paymentProjectId,
        workerId: paymentWorkerId,
        workStart,
        workEnd,
        daysWorked: Number(daysWorked) || 0,
        rateAmount: Number(rate) || 0,
        amountPaid: Number(amountPaid) || 0,
        paymentMethod,
        notes: paymentNotes.trim(),
      });
      await refreshWorkers();
      markSaved();
      setAmountPaid("");
      setPaymentNotes("");
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

  return (
    <div className="space-y-6">
      <SectionTitle
        subtitle="Track workers, assignments, wages, and outstanding labor payments."
        title="Labor / Workforce Management"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SurfaceCard title="Total labor paid this month">
          <p className="text-2xl font-bold text-slate-900">
            {formatTzs(totalLaborPaidThisMonth)}
          </p>
        </SurfaceCard>
        <SurfaceCard title="Outstanding labor payments">
          <p className="text-2xl font-bold text-amber-700">
            {formatTzs(outstandingLaborPayments)}
          </p>
        </SurfaceCard>
        <SurfaceCard title="Labor cost per project">
          <ul className="space-y-2 text-sm text-slate-700">
            {laborCostPerProject.map((row) => (
              <li className="flex justify-between" key={row.projectName}>
                <span>{row.projectName}</span>
                <span>{formatTzs(row.total)}</span>
              </li>
            ))}
          </ul>
        </SurfaceCard>
      </div>

      <SurfaceCard title="Workers List">
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="form-field">
            <span>Filter by Project</span>
            <GuiSelect
              className="input-field"
              onChange={(event) => setListProjectFilter(event.target.value)}
              value={listProjectFilter}
            >
              <option value="All">All Projects</option>
              {projects.map((project) => (
                <option key={`wk-list-${project.id}`} value={project.id}>
                  {project.name}
                </option>
              ))}
            </GuiSelect>
          </label>
        </div>

        {error && <p className="mb-4 text-sm text-red-700">{error}</p>}

        {loading ? (
          <SkeletonTable rows={5} />
        ) : filteredWorkers.length === 0 ? (
          <EmptyState
            description="No workers found for the selected project."
            title="No workers"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[960px]">
                <thead>
                  <tr>
                    <th>S/N</th>
                    <th>Worker Name</th>
                    <th>Phone Number</th>
                    <th>Skill/Role</th>
                    <th>Assigned Project</th>
                    <th>Wage Type</th>
                    <th>Rate</th>
                    <th>Total Paid</th>
                    <th>Outstanding</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {workersPagination.paginatedRows.map((worker, index) => (
                    <tr key={worker.id}>
                      <td>{workersPagination.startIndex + index + 1}</td>
                      <td>{worker.fullName}</td>
                      <td>{worker.phone}</td>
                      <td>{worker.skillRole}</td>
                      <td>{worker.assignedProjectName || "Unassigned"}</td>
                      <td>{worker.paymentType}</td>
                      <td>{formatTzs(worker.rateAmount)}</td>
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
                        <StatusBadge status={worker.status} />
                      </td>
                    </tr>
                  ))}
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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SurfaceCard title="Add Worker">
          <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" id="add-worker-form">
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
                    event.target.value as "Daily" | "Weekly" | "Monthly" | "Contract",
                  )
                }
                value={workerPaymentType}
              >
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
              <span>Assigned Project/Site</span>
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
              <button className="btn-secondary" type="button">
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

        <SurfaceCard title="Labor Payment Form">
          <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" id="add-worker-payment-form">
            <label className="form-field">
              <span>Select Project</span>
              <GuiSelect
                className="input-field"
                onChange={(event) => setPaymentProjectId(event.target.value)}
                value={paymentProjectId}
              >
                {projects.map((project) => (
                  <option key={`lp-${project.id}`} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </GuiSelect>
            </label>
            <label className="form-field">
              <span>Select Worker</span>
              <GuiSelect
                className="input-field"
                onChange={(event) => handlePaymentWorkerChange(event.target.value)}
                value={paymentWorkerId}
              >
                {paymentWorkers.map((worker) => (
                  <option key={`lp-worker-${worker.id}`} value={worker.id}>
                    {worker.fullName}
                  </option>
                ))}
              </GuiSelect>
            </label>
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
            <label className="form-field sm:col-span-2">
              <span>Days Worked</span>
              <input
                className="input-field"
                onChange={(event) => setDaysWorked(event.target.value)}
                type="number"
                value={daysWorked}
              />
            </label>
            <FinancialInput label="Rate" onChange={setRate} placeholder="45000" value={rate} />
            <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Auto Calculated</p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <p className="text-sm text-slate-700">
                  Total Payable: <span className="font-semibold">{formatTzs(totalPayable)}</span>
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
              <button className="btn-secondary" type="button">
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
    </div>
  );
};


