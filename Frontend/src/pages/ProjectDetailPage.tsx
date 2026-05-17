import {
  ArrowLeft,
  Briefcase,
  Calendar,
  DollarSign,
  FileText,
  HardHat,
  Package,
  Plus,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ConfirmModal,
  EmptyState,
  ProgressBar,
  SectionTitle,
  SkeletonCards,
  SkeletonTable,
  SurfaceCard,
} from "../components/ui";
import { api, type ProjectApiRecord, type WorkOrderApiRecord } from "../services/api";
import { formatDate, formatTzs } from "../utils/format";
import { WorkOrderModal } from "./WorkOrdersPage";

// ─── Quick Link tile ──────────────────────────────────────────────────────────

type QuickLinkProps = {
  icon: React.ReactNode;
  label: string;
  to: string;
  color: string;
};

const QuickLink = ({ icon, label, to, color }: QuickLinkProps) => (
  <Link
    className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm transition hover:border-slate-300 hover:shadow-md"
    to={to}
  >
    <span className={`grid h-10 w-10 place-items-center rounded-lg ${color}`}>{icon}</span>
    <span className="text-xs font-semibold text-slate-700">{label}</span>
  </Link>
);

// ─── Status badge helper ──────────────────────────────────────────────────────

const woStatusClass = (status: string) => {
  if (status === "Completed") return "text-sm font-medium text-emerald-700";
  if (status === "Approved" || status === "In Progress") return "text-sm font-medium text-blue-700";
  if (status === "Cancelled") return "text-sm font-medium text-red-600";
  return "text-sm font-medium text-slate-500";
};

// ─── Inline Work Orders section ───────────────────────────────────────────────

type InlineWorkOrdersProps = {
  project: ProjectApiRecord;
};

const InlineWorkOrders = ({ project }: InlineWorkOrdersProps) => {
  const [orders, setOrders] = useState<WorkOrderApiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<WorkOrderApiRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkOrderApiRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await api.getWorkOrders({ projectId: project.id });
      setOrders(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [project.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteWorkOrder(deleteTarget.id);
      await load();
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  // Summary totals
  const totalGrand = orders.reduce((s, o) => s + o.grandTotal, 0);
  const totalProfit = orders.reduce((s, o) => s + o.totalProfit, 0);

  return (
    <>
      <SurfaceCard
        title={`Work Orders (${orders.length})`}
      >
        {/* Mini summary + Add button */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-slate-500">
              Grand Total:{" "}
              <span className="font-semibold text-[#0b2a53]">{formatTzs(totalGrand)}</span>
            </span>
            <span className="text-slate-500">
              Faida:{" "}
              <span className="font-semibold text-emerald-700">{formatTzs(totalProfit)}</span>
            </span>
          </div>
          <button
            className="btn-primary flex items-center gap-1 text-sm"
            onClick={() => { setEditingOrder(null); setShowModal(true); }}
            type="button"
          >
            <Plus className="h-4 w-4" />
            Work Order Mpya
          </button>
        </div>

        {loading ? (
          <SkeletonTable rows={3} />
        ) : orders.length === 0 ? (
          <EmptyState
            actionLabel="Unda Work Order"
            description="Hakuna work orders kwa mradi huu bado."
            title="Hakuna Work Orders"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[900px]">
              <thead>
                <tr>
                  <th>S/N</th>
                  <th>Namba ya Order</th>
                  <th>Tarehe</th>
                  <th>Gharama Vifaa</th>
                  <th>Gharama Wafanyakazi</th>
                  <th>Jumla Gharama</th>
                  <th>Faida</th>
                  <th>Grand Total</th>
                  <th>Hali</th>
                  <th>Vitendo</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, idx) => (
                  <tr key={order.id}>
                    <td>{idx + 1}</td>
                    <td className="font-medium">{order.orderNumber}</td>
                    <td>{formatDate(order.orderDate)}</td>
                    <td>{formatTzs(order.materialsCost)}</td>
                    <td>{formatTzs(order.labourCost)}</td>
                    <td>{formatTzs(order.totalCost)}</td>
                    <td className="font-semibold text-emerald-700">{formatTzs(order.totalProfit)}</td>
                    <td className="font-bold text-[#0b2a53]">{formatTzs(order.grandTotal)}</td>
                    <td>
                      <span className={woStatusClass(order.status)}>{order.status}</span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          className="btn-secondary py-1 px-3 text-xs"
                          onClick={() => { setEditingOrder(order); setShowModal(true); }}
                          type="button"
                        >
                          Hariri
                        </button>
                        <button
                          className="btn-danger py-1 px-3 text-xs"
                          onClick={() => setDeleteTarget(order)}
                          type="button"
                        >
                          Futa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>

      {/* Work Order Modal — project locked to this project */}
      {showModal && (
        <WorkOrderModal
          editingOrder={editingOrder}
          lockedProjectId={project.id}
          onClose={() => { setShowModal(false); setEditingOrder(null); }}
          onSaved={async () => {
            setShowModal(false);
            setEditingOrder(null);
            await load();
          }}
          projects={[project]}
        />
      )}

      <ConfirmModal
        cancelLabel="Ghairi"
        confirmClassName="btn-danger"
        confirmLabel={deleting ? "Inafuta..." : "Futa"}
        description={
          deleteTarget
            ? `Futa work order "${deleteTarget.orderNumber}"? Haiwezi kurudishwa.`
            : ""
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        open={deleteTarget !== null}
        title="Futa Work Order"
      />
    </>
  );
};

// ─── Project Detail Page ──────────────────────────────────────────────────────

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<ProjectApiRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!projectId) return;
    let mounted = true;

    const load = async () => {
      try {
        const data = await api.getProjectById(projectId);
        if (mounted) { setProject(data); setError(""); }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Imeshindwa kupakia mradi.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => { mounted = false; };
  }, [projectId]);

  if (loading) return <div className="space-y-6"><SkeletonCards /></div>;

  if (error || !project) {
    return (
      <div className="space-y-4">
        <Link className="btn-secondary inline-flex items-center gap-2" to="/projects">
          <ArrowLeft className="h-4 w-4" /> Rudi kwa Miradi
        </Link>
        <SurfaceCard>
          <p className="text-sm text-red-700">{error || "Mradi haukupatikana."}</p>
        </SurfaceCard>
      </div>
    );
  }

  const quickLinks: QuickLinkProps[] = [
    {
      icon: <Users className="h-5 w-5 text-emerald-700" />,
      label: "Wafanyakazi",
      to: `/site-operations?tab=labor&projectId=${encodeURIComponent(project.id)}`,
      color: "bg-emerald-50",
    },
    {
      icon: <Package className="h-5 w-5 text-amber-700" />,
      label: "Vifaa",
      to: `/site-operations?tab=materials&projectId=${encodeURIComponent(project.id)}`,
      color: "bg-amber-50",
    },
    {
      icon: <DollarSign className="h-5 w-5 text-purple-700" />,
      label: "Malipo",
      to: `/payments?projectId=${encodeURIComponent(project.id)}`,
      color: "bg-purple-50",
    },
    {
      icon: <TrendingUp className="h-5 w-5 text-orange-700" />,
      label: "Matumizi",
      to: `/site-operations?tab=expenses&projectId=${encodeURIComponent(project.id)}`,
      color: "bg-orange-50",
    },
    {
      icon: <HardHat className="h-5 w-5 text-slate-700" />,
      label: "Vifaa vya Ujenzi",
      to: `/site-operations?tab=equipment&projectId=${encodeURIComponent(project.id)}`,
      color: "bg-slate-100",
    },
    {
      icon: <FileText className="h-5 w-5 text-indigo-700" />,
      label: "Nyaraka",
      to: `/documents?projectId=${encodeURIComponent(project.id)}`,
      color: "bg-indigo-50",
    },
    {
      icon: <Briefcase className="h-5 w-5 text-[#0b2a53]" />,
      label: "Work Orders (Zote)",
      to: `/work-orders?projectId=${encodeURIComponent(project.id)}`,
      color: "bg-blue-50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Back + Edit */}
      <div className="flex items-center justify-between gap-3">
        <Link className="btn-secondary inline-flex items-center gap-2" to="/projects">
          <ArrowLeft className="h-4 w-4" /> Rudi
        </Link>
        <Link
          className="btn-primary"
          to={`/projects/${encodeURIComponent(project.id)}/edit`}
        >
          Hariri Mradi
        </Link>
      </div>

      <SectionTitle
        subtitle={`${project.siteLocation} · ${project.contractNumber}`}
        title={project.name}
      />

      {/* Project Info + Progress */}
      <SurfaceCard>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Taarifa za Mradi
            </p>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Mteja</dt>
                <dd className="font-medium text-slate-900">{project.clientName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Hali</dt>
                <dd>
                  <span
                    className={
                      project.status === "Active"
                        ? "font-semibold text-emerald-700"
                        : project.status === "Completed"
                          ? "font-semibold text-blue-700"
                          : project.status === "On Hold"
                            ? "font-semibold text-amber-700"
                            : project.status === "Over Budget"
                              ? "font-semibold text-red-600"
                              : "font-semibold text-slate-500"
                    }
                  >
                    {project.status}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Kuanza
                </dt>
                <dd className="font-medium">{formatDate(project.startDate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Kukamilika
                </dt>
                <dd className="font-medium">{formatDate(project.expectedCompletionDate)}</dd>
              </div>
            </dl>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Maendeleo
            </p>
            <ProgressBar value={project.progress} />
            {project.description && (
              <p className="mt-4 text-xs text-slate-500">{project.description}</p>
            )}
          </div>
        </div>
      </SurfaceCard>

      {/* Financial Overview */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Thamani ya Mkataba", value: project.contractValue, color: "text-slate-900" },
          { label: "Kilichopokelewa", value: project.amountReceived, color: "text-emerald-700" },
          { label: "Kilichotumika", value: project.totalSpent, color: "text-slate-900" },
          {
            label: "Salio",
            value: project.remainingBalance,
            color: project.remainingBalance >= 0 ? "text-emerald-700" : "text-red-700",
          },
          {
            label: "Faida / Hasara",
            value: project.profitLossEstimate,
            color: project.profitLossEstimate >= 0 ? "text-emerald-700" : "text-red-700",
          },
          { label: "Malipo Yanayosubiri", value: project.pendingClientPayments, color: "text-amber-700" },
        ].map((card) => (
          <SurfaceCard key={card.label}>
            <p className="text-xs text-slate-500">{card.label}</p>
            <p className={`mt-1 text-lg font-bold ${card.color}`}>{formatTzs(card.value)}</p>
          </SurfaceCard>
        ))}
      </div>

      {/* ── Work Orders — inline ── */}
      <InlineWorkOrders project={project} />

      {/* Quick Access — other modules */}
      <SurfaceCard title="Ufikiaji wa Haraka">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          {quickLinks.map((link) => (
            <QuickLink key={link.label} {...link} />
          ))}
        </div>
      </SurfaceCard>

      {/* Notes */}
      {project.notes && (
        <SurfaceCard title="Maelezo ya Ziada">
          <p className="whitespace-pre-wrap text-sm text-slate-700">{project.notes}</p>
        </SurfaceCard>
      )}
    </div>
  );
}
