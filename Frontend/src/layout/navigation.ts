import {
  Activity,
  BriefcaseBusiness,
  Bell,
  Cog,
  CreditCard,
  Gauge,
  PieChart,
  Truck,
  UserCog,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { AppPermission } from "../auth";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  permissions?: readonly AppPermission[];
}

export const mainNavItems: NavItem[] = [
  { label: "Dashboard", path: "/dashboard", icon: Gauge, permissions: ["dashboard.view"] },
  { label: "Projects / Sites", path: "/projects", icon: BriefcaseBusiness, permissions: ["projects.view"] },
  {
    label: "Site Operations",
    path: "/site-operations",
    icon: Wrench,
    permissions: ["site.labor", "site.materials", "site.expenses", "site.equipment", "site.pettyCash"],
  },
  { label: "Payments & Cash Flow", path: "/payments", icon: CreditCard, permissions: ["payments.view"] },
  { label: "Reports", path: "/reports", icon: PieChart, permissions: ["reports.view"] },
  { label: "Suppliers", path: "/suppliers", icon: Truck, permissions: ["suppliers.view"] },
  { label: "Notifications", path: "/notifications", icon: Bell, permissions: ["notifications.view"] },
];

export const utilityNavItems: NavItem[] = [
  { label: "Activity Log", path: "/activity-log", icon: Activity, permissions: ["audit.view"] },
  { label: "Users & Roles", path: "/users", icon: UserCog, permissions: ["users.manage"] },
  { label: "Settings", path: "/settings", icon: Cog, permissions: ["settings.manage"] },
];

export const quickAddActions = [
  { label: "New Project", path: "/projects/new", permissions: ["projects.manage"] as const },
  { label: "Record Payment", path: "/payments#add-payment-form", permissions: ["payments.manage"] as const },
];
