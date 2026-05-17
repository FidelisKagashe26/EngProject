import { useEffect, useMemo, useState, type ReactNode } from "react";import { useSearchParams } from "react-router-dom";
import {
  ConfirmModal,
  EmptyState,
  FinancialInput,
  SectionTitle,
  SkeletonTable,
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

type LaborPageProps = {
  embedded?: boolean;
  search?: string;
  tabBar?: ReactNode;
};

export const LaborPage = ({ embedded = false, search = "", tabBar }: LaborPageProps) => {
  const { markSaved } = useUnsavedChanges();
  const [searchParams] = useSearchParams();
  const projectFromQuery = searchParams.get("projectId") ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState<ProjectApiRecord[]>([]);
  const [workers, setWorkers] = useState<WorkerApiRecord[]>([]);

  const [listProjectFilter, setListProjectFilter] = useState(
    projectFromQuery || "All",
  );

  // Modal states
  const [showAddWorkerModal, setShowAddWorkerModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedWorkerForPayment, setSelectedWorkerForPayment] = useState<WorkerApiRecord | null>(null);
  const [workerToDelete, setWorkerToDelete] = useState<WorkerApiRecord | null>(null);
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
  const [workerNotes, setWorkerNotes] = useState("");
  const [savingWorker, setSavingWorker] = useState(false);

  const [paymentProjectId, setPaymentProjectId] = useState(projectFromQuery);
  const [paymentWorkerId, setPaymentWorkerId] = useState("");
  const [workStart, setWorkStart] = useState("");
  const [workEnd, setWorkEnd] = useState("");
  const [daysWorked, setDaysWorked] = useState("6");
  const [hoursWorked, setHoursWorked] = useState("8");
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

  const totalPayable = useMemo(() => {
    const workerRate = Number(rate) || 0;
    if (selectedWorkerForPayment?.paymentType === "Hourly") {
      return (Number(hoursWorked) || 0) * workerRate;
    }
    return (Number(daysWorked) || 0) * workerRate;
  }, [daysWorked, hoursWorked, rate, selectedWorkerForPayment]);

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
    const workerResponse = await api.getWorkers();
    setWorkers(workerResponse.rows);
  };

  const resetWorkerForm = () => {
    setWorkerFullName("");
    setWorkerPhone("");
    setWorkerSkillRole("");
    setWorkerPaymentType("Daily");
    setWorkerRateAmount("");
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

  const openPaymentModal = (worker: WorkerApiRecord) => {
    setSelectedWorkerForPayment(worker);
    setPaymentWorkerId(worker.id);
    setRate(String(worker.rateAmount));
    setWorkStart("");
    setWorkEnd("");
    setDaysWorked("6");
    setHoursWorked("8");
    setAmountPaid("");
    setPaymentNotes("");
    setShowPaymentModal(true);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedWorkerForPayment(null);
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
    if (
      !selectedWorkerForPayment ||
      workStart.trim().length === 0 ||
      workEnd.trim().length === 0
    ) {
      setError("Please fill work date range.");
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
        workEnd,
        daysWorked: Number(daysWorked) || 0,
        hoursWorked: Number(hoursWorked) || 0,
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

      {/* Filter and Add Worker Button - Right aligned */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-end sm:gap-3">
        <div className="w-full sm:w-48">
          <label className="form-field">
            <span className="text-sm">Filter by Site</span>
            <GuiSelect
              className="input-field"
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
          </label>
        </div>
        <button
          className="btn-primary whitespace-nowrap"
          onClick={openAddWorkerModal}
        >
          + Add Worker
        </button>
      </div>

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

      {/* Tab bar — between stats and table */}
      {tabBar}

      {/* Workers List Table */}
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
            <div className="overflow-x-auto">
              <table className="data-table min-w-full">
                <thead>
                  <tr>
                    <th>S/N</th>
                    <th>Worker Name</th>
                    <th>Phone</th>
                    <th>Skill/Role</th>
                    <th>Site</th>
                    <th>Wage Type</th>
                    <th>Rate</th>
                    <th>Total Paid</th>
                    <th>Outstanding</th>
                    <th>Status</th>
                    <th>Actions</th>
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
                        <span
                          className={
                            worker.status === "Active"
                              ? "text-sm font-medium text-emerald-700"
                              : worker.status === "Pending"
                                ? "text-sm font-medium text-amber-700"
                                : "text-sm font-medium text-slate-500"
                          }
                        >
                          {worker.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            className="btn-primary py-1 px-3 text-xs"
                            onClick={() => openPaymentModal(worker)}
                          >
                            Pay
                          </button>
                          <button
                            className="btn-danger py-1 px-3 text-xs"
                            onClick={() => setWorkerToDelete(worker)}
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
                  <span>Days Worked</span>
                  <input
                    className="input-field"
                    onChange={(event) => setDaysWorked(event.target.value)}
                    type="number"
                    value={daysWorked}
                  />
                </label>
              )}
              <FinancialInput label="Rate" onChange={setRate} placeholder="45000" value={rate} />
              <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Auto Calculated</p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <p className="text-sm text-slate-700">
                    {selectedWorkerForPayment.paymentType === "Hourly"
                      ? `${hoursWorked} hrs × ${formatTzs(Number(rate))}`
                      : `${daysWorked} days × ${formatTzs(Number(rate))}`}
                    {" → "}Total Payable: <span className="font-semibold">{formatTzs(totalPayable)}</span>
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
      {/* Confirm Delete Modal */}
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

