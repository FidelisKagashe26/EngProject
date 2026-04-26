import {
  Activity,
  Bell,
  BriefcaseBusiness,
  Cog,
  CreditCard,
  DollarSign,
  FileText,
  Gauge,
  HardHat,
  Package,
  PieChart,
  Receipt,
  ShieldCheck,
  Truck,
  Users,
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
  { label: "Labor / Workforce", path: "/labor", icon: HardHat },
  { label: "Materials", path: "/materials", icon: Package },
  { label: "Expenses", path: "/expenses", icon: Receipt },
  { label: "Payments & Cash Flow", path: "/payments", icon: CreditCard },
  { label: "Documents", path: "/documents", icon: FileText },
  { label: "Reports & Analytics", path: "/reports", icon: PieChart },
  { label: "Suppliers", path: "/suppliers", icon: Truck },
  { label: "Equipment", path: "/equipment", icon: Wrench },
  { label: "Petty Cash", path: "/petty-cash", icon: DollarSign },
  { label: "Users & Roles", path: "/users", icon: Users },
  { label: "Settings", path: "/settings", icon: Cog },
];

export const utilityNavItems: NavItem[] = [
  { label: "Notifications", path: "/notifications", icon: Bell },
  { label: "Mobile Supervisor", path: "/mobile-supervisor", icon: ShieldCheck },
  { label: "Activity Log", path: "/activity-log", icon: Activity },
];

export const quickAddActions = [
  { label: "New Project", path: "/projects/new" },
  { label: "New Expense", path: "/expenses#add-expense-form" },
  { label: "New Payment", path: "/payments#add-payment-form" },
  { label: "New Material Purchase", path: "/materials#add-material-purchase-form" },
  { label: "New Worker Payment", path: "/labor#add-worker-payment-form" },
  { label: "Upload Document", path: "/documents#upload-document" },
];
