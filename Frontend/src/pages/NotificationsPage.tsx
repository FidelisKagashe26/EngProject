import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CircleDollarSign,
  FileWarning,
  PackageSearch,
  UsersRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { SectionTitle, SurfaceCard } from "../components/ui";
import { api, type NotificationApiRecord } from "../services/api";

const iconByType = {
  Overspending: AlertTriangle,
  Budget: AlertTriangle,
  "Client Payment": CircleDollarSign,
  Labor: UsersRound,
  Material: PackageSearch,
  Deadline: CalendarClock,
  Document: FileWarning,
};

const priorityClass = {
  High: "text-red-700 bg-red-50 border-red-200",
  Medium: "text-amber-700 bg-amber-50 border-amber-200",
  Low: "text-blue-700 bg-blue-50 border-blue-200",
};

export const NotificationsPage = () => {
  const [rows, setRows] = useState<NotificationApiRecord[]>([]);
  const [error, setError] = useState("");
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const loadNotifications = async () => {
    try {
      const response = await api.getNotifications();
      setRows(response);
      setError("");
    } catch {
      setRows([]);
      setError("Failed to load alerts from backend.");
    }
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const response = await api.getNotifications();
        if (mounted) {
          setRows(response);
          setError("");
        }
      } catch {
        if (mounted) {
          setRows([]);
          setError("Failed to load alerts from backend.");
        }
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleRemind = async (id: string) => {
    setRemindingId(id);
    try {
      await api.remindNotification(id);
      await loadNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reminder.");
    } finally {
      setRemindingId(null);
    }
  };

  const handleResolve = async (id: string) => {
    setResolvingId(id);
    try {
      await api.resolveNotification(id);
      await loadNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve notification.");
    } finally {
      setResolvingId(null);
    }
  };

  const activeRows = rows.filter((r) => r.status !== "Resolved");
  const resolvedRows = rows.filter((r) => r.status === "Resolved");

  return (
    <div className="space-y-6">
      <SectionTitle
        subtitle="Centralized alert center for risks, payments, deadlines and missing documents."
        title="Notifications / Alerts Center"
      />

      {error && (
        <SurfaceCard>
          <p className="text-sm text-amber-700">{error}</p>
        </SurfaceCard>
      )}

      {/* Active Alerts */}
      <SurfaceCard title={`Active Alerts (${activeRows.length})`}>
        {activeRows.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">No active alerts. All clear!</p>
        ) : (
          <div className="space-y-3">
            {activeRows.map((notification) => {
              const Icon =
                iconByType[notification.type as keyof typeof iconByType] ?? AlertTriangle;
              const badgeClass =
                priorityClass[notification.priority as keyof typeof priorityClass] ??
                priorityClass.Medium;
              const reminderCount = notification.reminderCount ?? 0;
              const canRemind = reminderCount < 3;

              return (
                <div className="rounded-xl border border-slate-200 bg-white p-4" key={notification.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <div className="mt-0.5 grid h-9 w-9 place-items-center rounded-lg bg-slate-50 text-[#0b2a53]">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Project: {notification.projectName}
                        </p>
                        <p className="mt-1 text-sm text-slate-700">{notification.description}</p>
                        {/* Reminder progress dots */}
                        <div className="mt-2 flex items-center gap-1.5">
                          <Bell className="h-3 w-3 text-slate-400" />
                          <span className="text-xs text-slate-500">Reminders:</span>
                          {[1, 2, 3].map((n) => (
                            <span
                              key={n}
                              className={`inline-block h-2.5 w-2.5 rounded-full border ${
                                n <= reminderCount
                                  ? "bg-[#0b2a53] border-[#0b2a53]"
                                  : "bg-slate-100 border-slate-300"
                              }`}
                            />
                          ))}
                          <span className="text-xs text-slate-400">{reminderCount}/3</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass}`}>
                        {notification.priority}
                      </span>
                      <p className="text-xs text-slate-500">{notification.createdAt}</p>
                      <div className="flex gap-2">
                        {canRemind && (
                          <button
                            className="btn-primary !px-2 !py-1 text-xs"
                            disabled={remindingId === notification.id}
                            onClick={() => void handleRemind(notification.id)}
                            type="button"
                          >
                            {remindingId === notification.id ? "Sending..." : `Remind (${reminderCount}/3)`}
                          </button>
                        )}
                        {!canRemind && (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-500">
                            Max reminders sent
                          </span>
                        )}
                        <button
                          className="btn-secondary !px-2 !py-1 text-xs"
                          disabled={resolvingId === notification.id}
                          onClick={() => void handleResolve(notification.id)}
                          type="button"
                        >
                          {resolvingId === notification.id ? "Resolving..." : "Resolve"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SurfaceCard>

      {/* Resolved Alerts */}
      {resolvedRows.length > 0 && (
        <SurfaceCard title={`Resolved Alerts (${resolvedRows.length})`}>
          <div className="space-y-2">
            {resolvedRows.map((notification) => (
              <div
                className="rounded-xl border border-slate-100 bg-slate-50 p-3 opacity-60"
                key={notification.id}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{notification.title}</p>
                    <p className="text-xs text-slate-500">{notification.projectName}</p>
                  </div>
                  <span className="text-xs text-emerald-700 font-semibold">Resolved</span>
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>
      )}
    </div>
  );
};
