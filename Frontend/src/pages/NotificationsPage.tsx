import {
  AlertTriangle,
  CalendarClock,
  CircleDollarSign,
  FileWarning,
  PackageSearch,
  UsersRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { SectionTitle, SurfaceCard } from "../components/ui";
import { notifications as fallbackNotifications } from "../data/mockData";
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

const fallbackRows: NotificationApiRecord[] = fallbackNotifications.map((item) => ({
  id: item.id,
  projectId: null,
  projectName: item.project,
  type: item.type,
  title: item.title,
  description: item.description,
  priority: item.priority,
  status: "Unread",
  createdAt: item.dateTime,
}));

export const NotificationsPage = () => {
  const [rows, setRows] = useState<NotificationApiRecord[]>(fallbackRows);
  const [error, setError] = useState("");

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
          setRows(fallbackRows);
          setError("Using local alert preview data. Backend API is not reachable yet.");
        }
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

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

      <SurfaceCard title="Alerts">
        <div className="space-y-3">
          {rows.map((notification) => {
            const Icon =
              iconByType[notification.type as keyof typeof iconByType] ?? AlertTriangle;
            const badgeClass =
              priorityClass[notification.priority as keyof typeof priorityClass] ??
              priorityClass.Medium;

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
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass}`}>
                      {notification.priority}
                    </span>
                    <p className="text-xs text-slate-500">{notification.createdAt}</p>
                    <button className="btn-secondary !px-2 !py-1 text-xs" type="button">
                      Resolve
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SurfaceCard>
    </div>
  );
};
