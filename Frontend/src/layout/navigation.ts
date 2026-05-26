import {
  BriefcaseBusiness,
  Cog,
  CreditCard,
  Gauge,
  PieChart,
  Wrench,
} from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  icon: typeof Gauge;
}

export const mainNavItems: NavItem[] = [
  { label: "Dashboard", path: "/dashboard", icon: Gauge },
  { label: "Projects / Sites", path: "/projects", icon: BriefcaseBusiness },
  { label: "Site Operations", path: "/site-operations", icon: Wrench },
  { label: "Payments & Cash Flow", path: "/payments", icon: CreditCard },
  { label: "Reports", path: "/reports", icon: PieChart },
  { label: "Settings", path: "/settings", icon: Cog },
];

export const utilityNavItems: NavItem[] = [];

export const quickAddActions = [
  { label: "New Project", path: "/projects/new" },
  { label: "Record Payment", path: "/payments#add-payment-form" },
];
