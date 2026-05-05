import {
  ArrowLeft,
  Briefcase,
  Calendar,
  DollarSign,
  FileText,
  HardHat,
  Package,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ProgressBar, SectionTitle, SkeletonCards, SurfaceCard } from "../components/ui";
import { api, type ProjectApiRecord } from "../services/api";
import { formatDate, formatTzs } from "../utils/format";

type QuickLinkProps = {
  icon: React.ReactNode;
  label: string;
  to: string;
  color: string;
};

const QuickLink = ({ icon, label, to, color }: QuickLinkProps) => (
  <Link
    className={`flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm transition hover:shadow-md hover:border-slate-300`}
    to={to}
  >
    <span className={`grid h-10 w-10 place-items-center rounded-lg ${color}`}>{icon}</span>
    <span className="text-xs font-semibold text-slate-700">{label}</span>
  </Link>
);

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
        if (mounted) {
          setProject(data);
          setError("");
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load project.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => { mounted = false; };
  }, [projectId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonCards />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="space-y-4">
        <Link className="btn-secondary inline-flex items-center gap-2" to="/projects">
          <ArrowLeft className="h-4 w-4" /> Back to Projects
        </Link>
        <SurfaceCard>
          <p className="text-sm text-red-700">{error || "Project not found."}</p>
        </SurfaceCard>
      </div>
    );
  }

  const quickLinks: QuickLinkProps[] = [
    {
      icon: <Briefcase className="h-5 w-5 text-[#0b2a53]" />,
      label: "Work Orders",
      to: `/work-orders?projectId=${encodeURIComponent(project.id)}`,
      color: "bg-blue-50",
    },
    {
      icon: <Users className="h-5 w-5 text-emerald-700" />,
      label: "Labour",
      to: `/labor?projectId=${encodeURIComponent(project.id)}`,
      color: "bg-emerald-50",
    },
    {
      icon: <Package className="h-5 w-5 text-amber-700" />,
      label: "Materials",
      to: `/materials?projectId=${encodeURIComponent(project.id)}`,
      color: "bg-amber-50",
    },
    {
      icon: <DollarSign className="h-5 w-5 text-purple-700" />,
      label: "Payments",
      to: `/payments?projectId=${encodeURIComponent(project.id)}`,
      color: "bg-purple-50",
    },
    {
      icon: <TrendingUp className="h-5 w-5 text-orange-700" />,
      label: "Expenses",
      to: `/expenses?projectId=${encodeURIComponent(project.id)}`,
      color: "bg-orange-50",
    },
    {
      icon: <HardHat className="h-5 w-5 text-slate-700" />,
      label: "Equipment",
      to: `/equipment?projectId=${encodeURIComponent(project.id)}`,
      color: "bg-slate-100",
    },
    {
      icon: <FileText className="h-5 w-5 text-indigo-700" />,
      label: "Documents",
      to: `/documents?projectId=${encodeURIComponent(project.id)}`,
      color: "bg-indigo-50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Back + Edit */}
      <div className="flex items-center justify-between gap-3">
        <Link className="btn-secondary inline-flex items-center gap-2" to="/projects">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <Link
          className="btn-primary"
          to={`/projects/${encodeURIComponent(project.id)}/edit`}
        >
          Edit Project
        </Link>
      </div>

      <SectionTitle
        subtitle={`${project.siteLocation} · ${project.contractNumber}`}
        title={project.name}
      />

      {/* Status + Progress */}
      <SurfaceCard>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Project Info
            </p>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Client</dt>
                <dd className="font-medium text-slate-900">{project.clientName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Status</dt>
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
                  <Calendar className="h-3.5 w-3.5" /> Start
                </dt>
                <dd className="font-medium">{formatDate(project.startDate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Expected End
                </dt>
                <dd className="font-medium">{formatDate(project.expectedCompletionDate)}</dd>
              </div>
            </dl>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Progress
            </p>
            <ProgressBar value={project.progress} />
            <p className="mt-4 text-xs text-slate-500">
              {project.description}
            </p>
          </div>
        </div>
      </SurfaceCard>

      {/* Financial Overview */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Contract Value", value: project.contractValue, color: "text-slate-900" },
          { label: "Amount Received", value: project.amountReceived, color: "text-emerald-700" },
          { label: "Total Spent", value: project.totalSpent, color: "text-slate-900" },
          { label: "Remaining Balance", value: project.remainingBalance, color: project.remainingBalance >= 0 ? "text-emerald-700" : "text-red-700" },
          { label: "Profit / Loss Est.", value: project.profitLossEstimate, color: project.profitLossEstimate >= 0 ? "text-emerald-700" : "text-red-700" },
          { label: "Pending Payments", value: project.pendingClientPayments, color: "text-amber-700" },
        ].map((card) => (
          <SurfaceCard key={card.label}>
            <p className="text-xs text-slate-500">{card.label}</p>
            <p className={`mt-1 text-lg font-bold ${card.color}`}>{formatTzs(card.value)}</p>
          </SurfaceCard>
        ))}
      </div>

      {/* Quick Links */}
      <SurfaceCard title="Quick Access">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          {quickLinks.map((link) => (
            <QuickLink key={link.label} {...link} />
          ))}
        </div>
      </SurfaceCard>

      {/* Notes */}
      {project.notes && (
        <SurfaceCard title="Notes">
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{project.notes}</p>
        </SurfaceCard>
      )}
    </div>
  );
}
