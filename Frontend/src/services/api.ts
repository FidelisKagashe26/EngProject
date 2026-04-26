export interface DashboardSummary {
  totalProjects: number;
  activeSites: number;
  totalContractValue: number;
  totalAmountReceived: number;
  totalExpenses: number;
  estimatedProfit: number;
  pendingClientPayments: number;
  overBudgetProjects: number;
}

export interface DashboardResponse {
  summary: DashboardSummary;
  monthlyFinance: Array<{ month: string; income: number; expenses: number }>;
  statusBreakdown: Array<{ label: string; value: number }>;
  recentProjects: Array<{
    id: string;
    name: string;
    site: string;
    client: string;
    contractValue: number;
    spent: number;
    balance: number;
    status: string;
    progress: number;
  }>;
  alerts: Array<{
    id: string;
    title: string;
    subtitle: string;
    priority: string;
    createdAt: string;
  }>;
  recentActivities: Array<{
    id: string;
    title: string;
    module: string;
    description: string;
    createdAt: string;
  }>;
}

export interface ProjectApiRecord {
  id: string;
  name: string;
  siteLocation: string;
  clientName: string;
  contractNumber: string;
  startDate: string;
  expectedCompletionDate: string;
  contractValue: number;
  amountReceived: number;
  totalSpent: number;
  remainingBalance: number;
  profitLossEstimate: number;
  status: string;
  progress: number;
  pendingClientPayments: number;
  description: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface TendersSummary {
  totalContracts: number;
  totalTenderAmount: number;
  totalContractSum: number;
  totalLaborCost: number;
  totalMaterialCost: number;
  totalSpent: number;
  totalRemainingBalance: number;
  overBudgetContracts: number;
  openVariationOrders: number;
  pendingClientPayments: number;
}

export interface TenderApiRecord {
  id: string;
  projectId: string;
  projectName: string;
  siteLocation: string;
  clientName: string;
  contractNo: string;
  tenderAmount: number;
  contractSum: number;
  amountReceived: number;
  totalSpent: number;
  remainingBalance: number;
  pendingClientPayments: number;
  paymentTerms: string;
  milestones: string;
  variationOrders: number;
  status: string;
  progress: number;
  documents: number;
  workerCount: number;
  materialRequirementCount: number;
  materialPurchaseCount: number;
  laborCost: number;
  materialCost: number;
  startDate: string;
  expectedCompletionDate: string;
}

export interface TendersResponse {
  summary: TendersSummary;
  rows: TenderApiRecord[];
}

export interface CreateProjectPayload {
  name: string;
  siteLocation: string;
  clientName: string;
  contractNumber: string;
  startDate: string;
  expectedCompletionDate: string;
  contractValue: number;
  amountReceived: number;
  totalSpent: number;
  status: string;
  progress: number;
  pendingClientPayments: number;
  description: string;
  notes: string;
}

export type UpdateProjectPayload = Partial<CreateProjectPayload>;

export interface NotificationApiRecord {
  id: string;
  projectId: string | null;
  projectName: string;
  type: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  createdAt: string;
}

export interface ActivityApiRecord {
  id: string;
  actorName: string;
  action: string;
  module: string;
  projectId: string | null;
  projectName: string;
  description: string;
  ipDevice: string;
  createdAt: string;
}

export interface WorkerApiRecord {
  id: string;
  fullName: string;
  phone: string;
  skillRole: string;
  paymentType: "Daily" | "Weekly" | "Monthly" | "Contract";
  rateAmount: number;
  assignedProjectId: string | null;
  assignedProjectName: string;
  totalPaid: number;
  outstandingAmount: number;
  status: string;
  notes: string;
}

export interface WorkersResponse {
  summary: {
    totalLaborPaidThisMonth: number;
    outstandingLaborPayments: number;
  };
  rows: WorkerApiRecord[];
}

export interface CreateWorkerPayload {
  fullName: string;
  phone: string;
  skillRole: string;
  paymentType: "Daily" | "Weekly" | "Monthly" | "Contract";
  rateAmount: number;
  assignedProjectId: string;
  notes: string;
}

export interface LaborPaymentPayload {
  projectId: string;
  workerId: string;
  workStart: string;
  workEnd: string;
  daysWorked: number;
  rateAmount: number;
  amountPaid: number;
  paymentMethod: string;
  notes: string;
}

export interface LaborPaymentApiRecord {
  id: string;
  projectId: string;
  projectName: string;
  workerId: string;
  workerName: string;
  workStart: string;
  workEnd: string;
  daysWorked: number;
  rateAmount: number;
  totalPayable: number;
  amountPaid: number;
  balance: number;
  paymentMethod: string;
  notes: string;
  createdAt: string;
}

export interface MaterialRequirementApiRecord {
  id: string;
  projectId: string;
  projectName: string;
  materialName: string;
  requiredQuantity: number;
  purchasedQuantity: number;
  remainingQuantity: number;
  unit: string;
  estimatedUnitCost: number;
  priority: string;
  neededByDate: string | null;
  notes: string;
}

export interface MaterialPurchaseApiRecord {
  id: string;
  projectId: string;
  projectName: string;
  requirementId: string | null;
  materialName: string;
  quantityPurchased: number;
  supplierName: string;
  unitCost: number;
  totalCost: number;
  purchaseDate: string;
  deliveryNoteNumber: string;
  deliveryStatus: string;
  receiptRef: string;
  notes: string;
}

export interface MaterialsResponse {
  requirements: MaterialRequirementApiRecord[];
  purchases: MaterialPurchaseApiRecord[];
}

export interface ExpenseApiRecord {
  id: string;
  projectId: string;
  projectName: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  paidBy: string;
  paymentMethod: string;
  receiptRef: string;
  status: string;
  notes: string;
  createdAt: string;
}

export interface ExpensesResponse {
  rows: ExpenseApiRecord[];
  charts: {
    byCategory: Array<{ label: string; total: number }>;
    byProject: Array<{ label: string; total: number }>;
    monthlyTrend: Array<{ month: string; total: number }>;
  };
}

export interface CreateExpensePayload {
  projectId: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  paidBy: string;
  paymentMethod: string;
  receiptRef: string;
  status: string;
  notes: string;
}

export interface CreateExpenseResponse {
  id: string;
  projectId: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  paidBy: string;
  paymentMethod: string;
  receiptRef: string;
  status: string;
  notes: string;
  createdAt: string;
}

export interface PaymentApiRecord {
  id: string;
  projectId: string;
  projectName: string;
  client: string;
  paymentType: string;
  milestone: string;
  amountExpected: number;
  amountReceived: number;
  balance: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber: string;
  status: string;
  notes: string;
}

export interface PaymentsResponse {
  topCards: {
    totalReceived: number;
    pendingReceivables: number;
    totalCashOutflow: number;
    netCashPosition: number;
    nextExpectedPayment: {
      payment_date?: string;
      amount_expected?: string;
      amount_received?: string;
      project_name?: string;
      milestone?: string | null;
    } | null;
  };
  rows: PaymentApiRecord[];
  cashFlow: {
    incomeVsOutflow: {
      income: number;
      outflow: number;
    };
    projectBalances: Array<{
      projectName: string;
      balance: number;
    }>;
  };
}

export interface CreatePaymentPayload {
  projectId: string;
  clientName: string;
  paymentType: "Advance" | "Milestone" | "Stage" | "Final" | "Other";
  milestone: string;
  amountExpected: number;
  amountReceived: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber: string;
  status: string;
  notes: string;
}

export interface CreatePaymentResponse {
  id: string;
  projectId: string;
  clientName: string;
  paymentType: string;
  milestone: string;
  amountExpected: number;
  amountReceived: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber: string;
  status: string;
  notes: string;
}

export interface EquipmentApiRecord {
  id: string;
  projectId: string;
  projectName: string;
  equipmentName: string;
  equipmentType: string;
  ownershipType: "Owned" | "Rented";
  ownerName: string;
  startDate: string;
  endDate: string;
  usageDays: number;
  dailyRate: number;
  rentalCost: number;
  maintenanceCost: number;
  totalCost: number;
  status: string;
  maintenanceNotes: string;
  createdAt: string;
  updatedAt: string;
}

export interface EquipmentResponse {
  summary: {
    totalRecords: number;
    totalRentalCost: number;
    totalMaintenanceCost: number;
    totalCost: number;
    inUseCount: number;
  };
  rows: EquipmentApiRecord[];
}

export interface CreateEquipmentPayload {
  projectId: string;
  equipmentName: string;
  equipmentType: string;
  ownershipType: "Owned" | "Rented";
  ownerName: string;
  startDate: string;
  endDate: string;
  usageDays: number;
  dailyRate: number;
  maintenanceCost: number;
  status: "In Use" | "Idle" | "Under Maintenance";
  maintenanceNotes: string;
}

export interface SupplierApiRecord {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  location: string;
  materialCategories: string;
  totalPurchases: number;
  outstandingBalance: number;
  status: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SuppliersResponse {
  summary: {
    totalSuppliers: number;
    totalPurchases: number;
    totalOutstandingBalance: number;
    activeSuppliers: number;
  };
  rows: SupplierApiRecord[];
}

export interface CreateSupplierPayload {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  location: string;
  materialCategories: string;
  totalPurchases: number;
  outstandingBalance: number;
  status: string;
  notes: string;
}

export interface CreateMaterialRequirementPayload {
  projectId: string;
  materialName: string;
  requiredQuantity: number;
  unit: string;
  estimatedUnitCost: number;
  priority: string;
  neededByDate?: string;
  notes: string;
}

export interface CreateMaterialPurchasePayload {
  projectId: string;
  requirementId: string;
  materialName: string;
  quantityPurchased: number;
  supplierName: string;
  unitCost: number;
  purchaseDate: string;
  deliveryNoteNumber: string;
  deliveryStatus: string;
  receiptRef: string;
  notes: string;
}

export interface DocumentApiRecord {
  id: string;
  projectId: string | null;
  projectName: string;
  category: string;
  documentName: string;
  fileType: string;
  fileSize: string;
  fileReference: string;
  uploadedBy: string;
  notes: string;
  createdAt: string;
}

export interface AuthUser {
  id: number;
  companyId: number;
  fullName: string;
  email: string;
  role: string;
  status: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface MeResponse {
  user: AuthUser;
}

export interface UpdateMyProfilePayload {
  fullName: string;
  email: string;
}

export interface ForgotPasswordRequestResponse {
  message: string;
  expiresInMinutes?: number;
}

export interface ForgotPasswordVerifyResponse {
  message: string;
  resetToken: string;
}

export interface SmtpStatusResponse {
  configured: boolean;
  host: string;
  port: number;
  secure: boolean;
  useTls: boolean;
  hostUser: string;
  fromEmail: string;
}

export interface SmtpTestResponse {
  message: string;
  recipient: string;
}

export interface CompanyProfile {
  id: number;
  name: string;
  email: string;
  phone: string;
  location: string;
  currency: string;
}

export interface SettingsResponse {
  singleTenantMode: boolean;
  company: CompanyProfile;
  expenseCategories: string[];
  materialUnits: string[];
  paymentMethods: string[];
}

export type UpdateCompanyProfilePayload = Pick<
  CompanyProfile,
  "name" | "email" | "phone" | "location" | "currency"
>;

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.toString().trim() ||
  "http://localhost:5050/api";

let authToken: string | null = null;
let activeApiRequests = 0;
const apiLoadingSubscribers = new Set<(isLoading: boolean) => void>();

const notifyApiLoading = (): void => {
  const isLoading = activeApiRequests > 0;
  apiLoadingSubscribers.forEach((listener) => listener(isLoading));
};

const beginApiRequest = (): void => {
  activeApiRequests += 1;
  notifyApiLoading();
};

const endApiRequest = (): void => {
  activeApiRequests = Math.max(0, activeApiRequests - 1);
  notifyApiLoading();
};

export const setApiAuthToken = (token: string | null): void => {
  authToken = token;
};

export const subscribeApiLoading = (
  listener: (isLoading: boolean) => void,
): (() => void) => {
  apiLoadingSubscribers.add(listener);
  listener(activeApiRequests > 0);
  return () => {
    apiLoadingSubscribers.delete(listener);
  };
};

const parseJsonSafe = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const apiRequest = async <T>(
  path: string,
  options?: RequestInit,
): Promise<T> => {
  beginApiRequest();

  const headers = new Headers(options?.headers ?? {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });

    const payload = await parseJsonSafe(response);

    if (!response.ok) {
      const message =
        typeof payload === "object" &&
        payload !== null &&
        "message" in payload &&
        typeof (payload as { message?: unknown }).message === "string"
          ? (payload as { message: string }).message
          : `Request failed with status ${response.status}`;
      throw new ApiError(message, response.status, payload);
    }

    return payload as T;
  } finally {
    endApiRequest();
  }
};

export const api = {
  health: () => apiRequest<{ message: string; db: string; timestamp: string }>("/health"),
  login: (payload: { email: string; password: string }) =>
    apiRequest<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  me: () => apiRequest<MeResponse>("/auth/me"),
  updateMyProfile: (payload: UpdateMyProfilePayload) =>
    apiRequest<MeResponse>("/auth/me", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  logout: () => apiRequest<{ message: string }>("/auth/logout", { method: "POST" }),
  changePassword: (payload: { oldPassword: string; newPassword: string }) =>
    apiRequest<{ message: string }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  requestPasswordResetOtp: (payload: { email: string }) =>
    apiRequest<ForgotPasswordRequestResponse>("/auth/forgot-password/request-otp", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  verifyPasswordResetOtp: (payload: { email: string; otp: string }) =>
    apiRequest<ForgotPasswordVerifyResponse>("/auth/forgot-password/verify-otp", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  resetPasswordByOtp: (payload: { resetToken: string; newPassword: string }) =>
    apiRequest<{ message: string }>("/auth/forgot-password/reset", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getSmtpStatus: () => apiRequest<SmtpStatusResponse>("/auth/smtp/status"),
  sendSmtpTestEmail: (payload?: { to?: string }) =>
    apiRequest<SmtpTestResponse>("/auth/smtp/test", {
      method: "POST",
      body: JSON.stringify(payload ?? {}),
    }),
  getSettings: () => apiRequest<SettingsResponse>("/settings"),
  updateCompanyProfile: (payload: UpdateCompanyProfilePayload) =>
    apiRequest<CompanyProfile>("/settings/company", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  getDashboard: () => apiRequest<DashboardResponse>("/dashboard"),
  getProjects: (params?: { search?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.status && params.status !== "All") query.set("status", params.status);
    const suffix = query.toString().length > 0 ? `?${query.toString()}` : "";
    return apiRequest<ProjectApiRecord[]>(`/projects${suffix}`);
  },
  getTenders: (params?: { search?: string; projectId?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.projectId && params.projectId !== "All") {
      query.set("projectId", params.projectId);
    }
    if (params?.status && params.status !== "All" && params.status !== "All Status") {
      query.set("status", params.status);
    }
    const suffix = query.toString().length > 0 ? `?${query.toString()}` : "";
    return apiRequest<TendersResponse>(`/tenders${suffix}`);
  },
  getExpenses: () => apiRequest<ExpensesResponse>("/expenses"),
  createExpense: (payload: CreateExpensePayload) =>
    apiRequest<CreateExpenseResponse>("/expenses", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getPayments: () => apiRequest<PaymentsResponse>("/payments"),
  createPayment: (payload: CreatePaymentPayload) =>
    apiRequest<CreatePaymentResponse>("/payments", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getEquipment: () => apiRequest<EquipmentResponse>("/equipment"),
  createEquipment: (payload: CreateEquipmentPayload) =>
    apiRequest<EquipmentApiRecord>("/equipment", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getSuppliers: () => apiRequest<SuppliersResponse>("/suppliers"),
  createSupplier: (payload: CreateSupplierPayload) =>
    apiRequest<SupplierApiRecord>("/suppliers", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getProjectById: (projectId: string) =>
    apiRequest<ProjectApiRecord>(`/projects/${encodeURIComponent(projectId)}`),
  createProject: (payload: CreateProjectPayload) =>
    apiRequest<ProjectApiRecord>("/projects", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateProject: (projectId: string, payload: UpdateProjectPayload) =>
    apiRequest<ProjectApiRecord>(`/projects/${encodeURIComponent(projectId)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  getWorkers: () => apiRequest<WorkersResponse>("/workers"),
  createWorker: (payload: CreateWorkerPayload) =>
    apiRequest<WorkerApiRecord>("/workers", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  recordLaborPayment: (payload: LaborPaymentPayload) =>
    apiRequest<LaborPaymentApiRecord>("/workers/payments", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getMaterials: () => apiRequest<MaterialsResponse>("/materials"),
  createMaterialRequirement: (payload: CreateMaterialRequirementPayload) =>
    apiRequest<MaterialRequirementApiRecord>("/materials/requirements", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createMaterialPurchase: (payload: CreateMaterialPurchasePayload) =>
    apiRequest<MaterialPurchaseApiRecord>("/materials/purchases", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getDocuments: () => apiRequest<DocumentApiRecord[]>("/documents"),
  getNotifications: () => apiRequest<NotificationApiRecord[]>("/notifications"),
  getActivityLog: () => apiRequest<ActivityApiRecord[]>("/notifications/activity-log"),
};
