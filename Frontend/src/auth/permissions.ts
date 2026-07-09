export const APP_ROLES = [
  "Super Admin",
  "Admin",
  "Engineer / Project Manager",
  "Accountant",
  "Store Keeper",
  "Site Supervisor",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const APP_PERMISSIONS = [
  "dashboard.view",
  "projects.view",
  "projects.manage",
  "site.labor",
  "site.materials",
  "site.expenses",
  "site.equipment",
  "site.pettyCash",
  "payments.view",
  "payments.manage",
  "reports.view",
  "suppliers.view",
  "suppliers.manage",
  "documents.view",
  "documents.manage",
  "notifications.view",
  "settings.manage",
  "users.manage",
  "audit.view",
  "deleted.restore",
] as const;

export type AppPermission = (typeof APP_PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<AppPermission, string> = {
  "dashboard.view": "View dashboard",
  "projects.view": "View projects/sites",
  "projects.manage": "Create and edit projects",
  "site.labor": "Manage labor/workforce",
  "site.materials": "Manage material requirements and receipts",
  "site.expenses": "Manage project expenses",
  "site.equipment": "Manage equipment usage",
  "site.pettyCash": "Manage petty cash",
  "payments.view": "View payments and cash flow",
  "payments.manage": "Record and edit client payments",
  "reports.view": "View reports",
  "suppliers.view": "View suppliers",
  "suppliers.manage": "Create and update suppliers",
  "documents.view": "View documents",
  "documents.manage": "Upload and manage documents",
  "notifications.view": "View notifications",
  "settings.manage": "Manage company, website and system settings",
  "users.manage": "Manage users and roles",
  "audit.view": "View activity log/audit trail",
  "deleted.restore": "Restore deleted records",
};

export const ROLE_PERMISSIONS: Record<AppRole, readonly AppPermission[]> = {
  "Super Admin": APP_PERMISSIONS,
  Admin: APP_PERMISSIONS.filter((permission) => permission !== "deleted.restore"),
  "Engineer / Project Manager": [
    "dashboard.view",
    "projects.view",
    "projects.manage",
    "site.labor",
    "site.materials",
    "site.expenses",
    "site.equipment",
    "payments.view",
    "payments.manage",
    "reports.view",
    "suppliers.view",
    "suppliers.manage",
    "documents.view",
    "documents.manage",
    "notifications.view",
  ],
  Accountant: [
    "dashboard.view",
    "projects.view",
    "site.expenses",
    "site.pettyCash",
    "payments.view",
    "payments.manage",
    "reports.view",
    "suppliers.view",
    "documents.view",
    "documents.manage",
    "notifications.view",
    "audit.view",
  ],
  "Store Keeper": [
    "dashboard.view",
    "projects.view",
    "site.materials",
    "site.equipment",
    "suppliers.view",
    "suppliers.manage",
    "documents.view",
    "documents.manage",
    "notifications.view",
  ],
  "Site Supervisor": [
    "dashboard.view",
    "projects.view",
    "site.labor",
    "site.materials",
    "site.expenses",
    "site.equipment",
    "site.pettyCash",
    "documents.view",
    "documents.manage",
    "notifications.view",
  ],
};

export const isAppRole = (role: string | null | undefined): role is AppRole =>
  APP_ROLES.includes(role as AppRole);

export const hasPermission = (
  role: string | null | undefined,
  permission: AppPermission,
): boolean => isAppRole(role) && ROLE_PERMISSIONS[role].includes(permission);

export const hasAnyPermission = (
  role: string | null | undefined,
  permissions: readonly AppPermission[],
): boolean => permissions.some((permission) => hasPermission(role, permission));

export const SITE_OPERATION_PERMISSIONS = {
  labor: "site.labor",
  materials: "site.materials",
  expenses: "site.expenses",
  equipment: "site.equipment",
  "petty-cash": "site.pettyCash",
} as const satisfies Record<string, AppPermission>;
