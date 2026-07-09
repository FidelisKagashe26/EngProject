import { pushTopToast } from "../components/topToast";

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
  laborBudget: number;
  materialBudget: number;
  operationalBudget: number;
  expectedProfitMarginPct: number;
  paymentTerms: string;
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
  laborBudget: number;
  materialBudget: number;
  operationalBudget: number;
  expectedProfitMarginPct: number;
  paymentTerms: string;
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
  reminderCount: number;
  lastRemindedAt: string | null;
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
  paymentType: "Hourly" | "Daily" | "Weekly" | "Monthly" | "Contract";
  rateAmount: number;
  assignedProjectId: string | null;
  assignedProjectName: string;
  totalPaid: number;
  outstandingAmount: number;
  status: string;
  payCycleStartDate: string;
  nextPaymentDueDate: string | null;
  employmentEndDate: string | null;
  lastPaymentCoveredDate: string | null;
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
  paymentType: "Hourly" | "Daily" | "Weekly" | "Monthly" | "Contract";
  rateAmount: number;
  assignedProjectId: string;
  employmentStartDate: string;
  employmentEndDate?: string;
  notes: string;
}

export interface LaborPaymentPayload {
  projectId: string;
  workerId: string;
  workStart?: string;
  workEnd?: string;
  daysWorked?: number;
  hoursWorked?: number;
  cycleCount?: number;
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
  unitsWorked: number;
  payCycleType: string;
  payCycleCount: number;
  rateAmount: number;
  totalPayable: number;
  amountPaid: number;
  balance: number;
  paymentMethod: string;
  notes: string;
  createdAt: string;
  nextPaymentDueDate: string | null;
  approvalStatus: string;
}

export type MaterialSupplySource = "Company Purchased" | "Client Supplied";

export interface MaterialRequirementApiRecord {
  id: string;
  projectId: string;
  projectName: string;
  materialName: string;
  requiredQuantity: number;
  purchasedQuantity: number;
  orderedQuantity: number;
  deliveredQuantity: number;
  companyPurchasedQuantity: number;
  clientSuppliedQuantity: number;
  remainingQuantity: number;
  unit: string;
  estimatedUnitCost: number;
  supplySource: MaterialSupplySource;
  requestedQuantity: number;
  lastRequestDate: string | null;
  supplyStatus: string;
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
  deliveredQuantity: number;
  supplierName: string;
  unitCost: number;
  totalCost: number;
  supplySource: MaterialSupplySource;
  purchaseDate: string;
  deliveryNoteNumber: string;
  deliveryStatus: string;
  receiptRef: string;
  notes: string;
  approvalStatus: string;
}

export interface MaterialSupplyRequestApiRecord {
  id: string;
  requirementId: string;
  projectId: string;
  requestedQuantity: number;
  requestDate: string;
  status: string;
  requestedBy: string;
  notes: string;
  createdAt: string;
}

export interface MaterialsResponse {
  requirements: MaterialRequirementApiRecord[];
  purchases: MaterialPurchaseApiRecord[];
  supplyRequests: MaterialSupplyRequestApiRecord[];
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
  approvalStatus: string;
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

export type UpdateExpensePayload = Partial<CreateExpensePayload>;

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
  attachmentUrl: string;
  attachmentName: string;
  attachmentType: string;
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
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: string;
}

export type UpdatePaymentPayload = Partial<CreatePaymentPayload>;

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
  attachmentUrl: string;
  attachmentName: string;
  attachmentType: string;
}

export interface EquipmentApiRecord {
  id: string;
  projectId: string;
  projectName: string;
  equipmentName: string;
  equipmentType: string;
  assetTag: string;
  quantity: number;
  assignedTo: string;
  conditionStatus: string;
  checkInDate: string | null;
  ownershipType: "Owned" | "Rented";
  ownerName: string;
  startDate: string;
  endDate: string;
  usageDays: number;
  dailyRate: number;
  rentalCost: number;
  maintenanceCost: number;
  totalCost: number;
  status: EquipmentStatus;
  maintenanceNotes: string;
  createdAt: string;
  updatedAt: string;
  approvalStatus: string;
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
  assetTag: string;
  quantity: number;
  assignedTo: string;
  conditionStatus: string;
  checkInDate?: string;
  ownershipType: "Owned" | "Rented";
  ownerName: string;
  startDate: string;
  endDate: string;
  usageDays: number;
  dailyRate: number;
  maintenanceCost: number;
  status: EquipmentStatus;
  maintenanceNotes: string;
}

export type EquipmentStatus = "In Use" | "Idle" | "Under Maintenance" | "Out of Use";

export type UpdateEquipmentPayload = Partial<CreateEquipmentPayload>;

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
  supplySource: MaterialSupplySource;
  requestedQuantity: number;
  supplyStatus: string;
  priority: string;
  neededByDate?: string;
  notes: string;
}

export type UpdateMaterialRequirementPayload = Partial<CreateMaterialRequirementPayload>;

export interface RequestMaterialSupplyPayload {
  requestedQuantity: number;
  requestDate?: string;
  notes: string;
}

export interface CreateMaterialPurchasePayload {
  projectId: string;
  requirementId: string;
  materialName: string;
  quantityPurchased: number;
  deliveredQuantity: number;
  supplierName: string;
  unitCost: number;
  supplySource: MaterialSupplySource;
  purchaseDate: string;
  deliveryNoteNumber: string;
  deliveryStatus: string;
  receiptRef: string;
  notes: string;
}

export type UpdateMaterialPurchasePayload = Partial<CreateMaterialPurchasePayload>;

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

export interface UpdateMyProfileResponse extends MeResponse {
  token: string;
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

export interface CreateDocumentPayload {
  projectId: string;
  category: string;
  documentName: string;
  fileType: string;
  fileSize: string;
  fileReference: string;
  uploadedBy: string;
  notes: string;
}

export interface ReportProjectCostRow {
  id: string;
  projectName: string;
  contractValue: number;
  amountReceived: number;
  laborCost: number;
  materialCost: number;
  otherExpenses: number;
  totalSpent: number;
  remainingBalance: number;
  estimatedProfitLoss: number;
  pendingClientPayments: number;
  status: string;
  progress: number;
}

export interface ReportsResponse {
  totals: {
    contractValue: number;
    amountReceived: number;
    laborCost: number;
    materialCost: number;
    otherExpenses: number;
    totalSpent: number;
    remainingBalance: number;
    estimatedProfitLoss: number;
  };
  projectCostSummary: ReportProjectCostRow[];
  laborByProject: Array<{ projectId: string | null; projectName: string; totalPaid: number; outstanding: number; workerCount: number }>;
  materialByProject: Array<{ projectId: string | null; projectName: string; totalCost: number; purchaseCount: number }>;
  laborDetails: Array<{
    workerId: string;
    workerName: string;
    projectId: string | null;
    projectName: string;
    paymentType: string;
    rateAmount: number;
    totalPaid: number;
    outstandingAmount: number;
    status: string;
  }>;
  materialPurchaseDetails: Array<{
    purchaseId: string;
    projectId: string | null;
    projectName: string;
    materialName: string;
    quantityPurchased: number;
    unitCost: number;
    totalCost: number;
    purchaseDate: string;
    supplierName: string;
  }>;
  expenseByProject: Array<{ projectId: string | null; projectName: string; totalAmount: number; expenseCount: number }>;
  paymentByProject: Array<{ projectId: string | null; projectName: string; totalExpected: number; totalReceived: number; totalBalance: number }>;
  expenseByCategory: Array<{ category: string; total: number; count: number }>;
  expenseByCategoryByProject: Array<{
    projectId: string | null;
    projectName: string;
    category: string;
    total: number;
    count: number;
  }>;
  monthlyExpenseTrend: Array<{ month: string; total: number }>;
  budgetVariance: Array<{ projectName: string; contractValue: number; totalSpent: number; variance: number; variancePct: number }>;
}

export type PdfReportType =
  | "comprehensive"
  | "project-cost-summary"
  | "income-expense"
  | "payments"
  | "labor"
  | "materials"
  | "expenses-by-category"
  | "budget-variance";

export interface DownloadReportPdfParams {
  reportType?: PdfReportType;
  projectId?: string;
  category?: string;
  fromDate?: string;
  toDate?: string;
}

export interface DownloadedReportPdf {
  blob: Blob;
  filename: string;
}

export interface UserApiRecord {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  assignedProjects: string;
  lastLogin: string;
  createdAt: string;
  updatedAt: string;
}

export interface UsersResponse {
  rows: UserApiRecord[];
}

export interface CreateUserPayload {
  fullName: string;
  email: string;
  phone: string;
  role: string;
  assignedProjects: string;
  status: string;
  password?: string;
}

export interface UpdateUserPayload {
  fullName?: string;
  email?: string;
  phone?: string;
  role?: string;
  assignedProjects?: string;
  status?: string;
  password?: string;
}

export interface PettyCashApiRecord {
  id: string;
  projectId: string | null;
  projectName: string;
  transactionDate: string;
  transactionType: "Cash In" | "Cash Out";
  description: string;
  amount: number;
  recordedBy: string;
  receiptRef: string;
  status: "Pending" | "Reconciled";
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface PettyCashResponse {
  summary: {
    totalCashIn: number;
    totalCashOut: number;
    pendingCount: number;
  };
  rows: PettyCashApiRecord[];
}

export interface CreatePettyCashPayload {
  projectId: string;
  transactionDate: string;
  transactionType: "Cash In" | "Cash Out";
  description: string;
  amount: number;
  recordedBy: string;
  receiptRef: string;
  status: "Pending" | "Reconciled";
  notes: string;
}

export type UpdatePettyCashPayload = CreatePettyCashPayload;

export type UpdateLaborPaymentPayload = Partial<Pick<LaborPaymentPayload, "amountPaid" | "rateAmount" | "paymentMethod" | "notes">>;

export interface QuoteRequestApiRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  service: string;
  message: string;
  status: "New" | "Read" | "Replied";
  createdAt: string;
}

export interface SubmitQuoteRequestPayload {
  fullName: string;
  email: string;
  phone: string;
  service: string;
  message: string;
}

export interface WebsiteSettings {
  phone_main: string;
  phone_whatsapp: string;
  email_main: string;
  location: string;
  hours: string;
  social_facebook: string;
  social_instagram: string;
  social_linkedin: string;
  social_twitter: string;
}

export interface GalleryItemRecord {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  imageUrl: string;
  sortOrder?: number;
  isVisible?: boolean;
  createdAt?: string;
}

export interface GalleryResponse {
  items: GalleryItemRecord[];
  categories: string[];
}

export type DeletedItemEntity =
  | "projects"
  | "workers"
  | "users"
  | "documents"
  | "suppliers"
  | "quote-requests"
  | "gallery"
  | "expenses"
  | "payments"
  | "labor-payments"
  | "material-purchases"
  | "equipment"
  | "petty-cash";

export interface DeletedItemApiRecord {
  entity: DeletedItemEntity;
  id: string;
  module: string;
  title: string;
  subtitle: string;
  deletedAt: string | null;
  deletedBy: string;
  deleteReason: string;
  restorePreview: string;
}

export interface DeletedItemsResponse {
  rows: DeletedItemApiRecord[];
}
export interface CreateGalleryItemPayload {
  title: string;
  subtitle: string;
  category: string;
  imageUrl: string;
  sortOrder?: number;
  isVisible?: boolean;
}

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

const parseContentDispositionFilename = (headerValue: string | null): string | null => {
  if (!headerValue) {
    return null;
  }

  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(headerValue);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      // Fall through to standard filename parsing.
    }
  }

  const basicMatch = /filename="?([^";]+)"?/i.exec(headerValue);
  if (basicMatch?.[1]) {
    return basicMatch[1];
  }

  return null;
};

type ApiRequestOptions = RequestInit & {
  notifyError?: boolean;
  notifySuccess?: boolean;
  successMessage?: string;
  successTitle?: string;
  errorTitle?: string;
};

const extractPayloadMessage = (payload: unknown): string | null => {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "message" in payload &&
    typeof (payload as { message?: unknown }).message === "string"
  ) {
    return (payload as { message: string }).message;
  }

  return null;
};

const defaultSuccessMessage = (method: string): string => {
  if (method === "POST") {
    return "Saved successfully.";
  }
  if (method === "PUT" || method === "PATCH") {
    return "Updated successfully.";
  }
  if (method === "DELETE") {
    return "Deleted successfully.";
  }
  return "Operation completed successfully.";
};

const apiRequest = async <T>(
  path: string,
  options?: ApiRequestOptions,
): Promise<T> => {
  const {
    notifyError,
    notifySuccess,
    successMessage: customSuccessMessage,
    successTitle: customSuccessTitle,
    errorTitle,
    ...requestOptions
  } = options ?? {};

  beginApiRequest();
  const method = (requestOptions.method ?? "GET").toUpperCase();
  const shouldNotifyError = notifyError ?? true;
  const shouldNotifySuccess =
    notifySuccess ?? (method !== "GET" && method !== "HEAD");

  const headers = new Headers(requestOptions.headers ?? {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...requestOptions,
      headers,
    });

    const payload = await parseJsonSafe(response);

    if (!response.ok) {
      const message = extractPayloadMessage(payload) ?? `Request failed with status ${response.status}`;
      if (shouldNotifyError) {
        pushTopToast({
          tone: "error",
          title:
            errorTitle ??
            (method === "GET" || method === "HEAD" ? "Load Failed" : "Action Failed"),
          message,
        });
      }
      throw new ApiError(message, response.status, payload);
    }

    if (shouldNotifySuccess) {
      const successMessage =
        customSuccessMessage ?? extractPayloadMessage(payload) ?? defaultSuccessMessage(method);
      pushTopToast({
        tone: "success",
        title: customSuccessTitle ?? "Success",
        message: successMessage,
      });
    }

    return payload as T;
  } finally {
    endApiRequest();
  }
};

type UploadFileResponse = {
  url: string;
  filename: string;
  originalName: string;
  size: number;
  mimetype: string;
};

const uploadSingleFile = async (
  endpointPath: string,
  fieldName: "image" | "file",
  file: File,
  options?: {
    notifySuccess?: boolean;
    successMessage?: string;
  },
): Promise<UploadFileResponse> => {
  beginApiRequest();
  try {
    const formData = new FormData();
    formData.append(fieldName, file);

    const headers = new Headers();
    if (authToken) headers.set("Authorization", `Bearer ${authToken}`);

    const response = await fetch(`${API_BASE_URL}${endpointPath}`, {
      method: "POST",
      headers,
      body: formData,
    });

    const payload = (await parseJsonSafe(response)) as {
      url?: string;
      filename?: string;
      originalName?: string;
      size?: number;
      mimetype?: string;
      message?: string;
    };

    if (!response.ok) {
      const message = payload.message ?? "Upload failed";
      pushTopToast({
        tone: "error",
        title: "Upload Failed",
        message,
      });
      throw new ApiError(message, response.status, payload);
    }

    if (options?.notifySuccess !== false) {
      pushTopToast({
        tone: "success",
        title: "Success",
        message: options?.successMessage ?? "File uploaded successfully.",
      });
    }

    return {
      url: payload.url ?? "",
      filename: payload.filename ?? "",
      originalName: payload.originalName ?? "",
      size: payload.size ?? 0,
      mimetype: payload.mimetype ?? "",
    };
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
  me: () => apiRequest<MeResponse>("/auth/me", { notifyError: false }),
  updateMyProfile: (payload: UpdateMyProfilePayload) =>
    apiRequest<UpdateMyProfileResponse>("/auth/me", {
      method: "PUT",
      body: JSON.stringify(payload),
      notifyError: false,
      notifySuccess: false,
    }),
  logout: () =>
    apiRequest<{ message: string }>("/auth/logout", {
      method: "POST",
      notifyError: false,
      notifySuccess: false,
    }),
  changePassword: (payload: { oldPassword: string; newPassword: string }) =>
    apiRequest<{ message: string }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify(payload),
      notifyError: false,
      notifySuccess: false,
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
  getSmtpStatus: () => apiRequest<SmtpStatusResponse>("/auth/smtp/status", { notifyError: false }),
  sendSmtpTestEmail: (payload?: { to?: string }) =>
    apiRequest<SmtpTestResponse>("/auth/smtp/test", {
      method: "POST",
      body: JSON.stringify(payload ?? {}),
      notifyError: false,
      notifySuccess: false,
    }),
  getSettings: () => apiRequest<SettingsResponse>("/settings"),
  updateCompanyProfile: (payload: UpdateCompanyProfilePayload) =>
    apiRequest<CompanyProfile>("/settings/company", {
      method: "PUT",
      body: JSON.stringify(payload),
      notifyError: false,
      notifySuccess: false,
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
  updateExpense: (id: string, payload: UpdateExpensePayload) =>
    apiRequest<ExpenseApiRecord>(`/expenses/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteExpense: (id: string) =>
    apiRequest<{ message: string; reversedAmount: number }>(`/expenses/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  restoreExpense: (id: string) =>
    apiRequest<{ message: string }>(`/expenses/${encodeURIComponent(id)}/restore`, {
      method: "PATCH",
    }),
  getPayments: () => apiRequest<PaymentsResponse>("/payments"),
  createPayment: (payload: CreatePaymentPayload) =>
    apiRequest<CreatePaymentResponse>("/payments", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updatePayment: (id: string, payload: UpdatePaymentPayload) =>
    apiRequest<{ message: string; amountDifference: number; newAmountReceived: number }>(
      `/payments/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    ),
  deletePayment: (id: string) =>
    apiRequest<{ message: string; reversedAmount: number }>(`/payments/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  getEquipment: () => apiRequest<EquipmentResponse>("/equipment"),
  createEquipment: (payload: CreateEquipmentPayload) =>
    apiRequest<EquipmentApiRecord>("/equipment", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateEquipment: (id: string, payload: UpdateEquipmentPayload) =>
    apiRequest<{ message: string; costDifference: number; newTotalCost: number }>(
      `/equipment/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    ),
  deleteEquipment: (id: string) =>
    apiRequest<{ message: string; reversedAmount: number }>(`/equipment/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  restoreEquipment: (id: string) =>
    apiRequest<{ message: string }>(`/equipment/${encodeURIComponent(id)}/restore`, {
      method: "PATCH",
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
      notifySuccess: false,
    }),
  updateProject: (projectId: string, payload: UpdateProjectPayload) =>
    apiRequest<ProjectApiRecord>(`/projects/${encodeURIComponent(projectId)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
      notifySuccess: false,
    }),
  getWorkers: () => apiRequest<WorkersResponse>("/workers"),
  createWorker: (payload: CreateWorkerPayload) =>
    apiRequest<WorkerApiRecord>("/workers", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteWorker: (workerId: string) =>
    apiRequest<{ message: string }>(`/workers/${encodeURIComponent(workerId)}`, {
      method: "DELETE",
    }),
  recordLaborPayment: (payload: LaborPaymentPayload) =>
    apiRequest<LaborPaymentApiRecord>("/workers/payments", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getLaborPayments: () => apiRequest<LaborPaymentApiRecord[]>("/workers/payments"),
  updateLaborPayment: (id: string, payload: UpdateLaborPaymentPayload) =>
    apiRequest<{ message: string; amountDifference: number; newAmountPaid: number }>(
      `/workers/labor-payments/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(payload) },
    ),
  deleteLaborPayment: (id: string) =>
    apiRequest<{ message: string; reversedAmount: number }>(`/workers/labor-payments/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  restoreLaborPayment: (id: string) =>
    apiRequest<{ message: string }>(`/workers/labor-payments/${encodeURIComponent(id)}/restore`, {
      method: "PATCH",
    }),
  getMaterials: () => apiRequest<MaterialsResponse>("/materials"),
  createMaterialRequirement: (payload: CreateMaterialRequirementPayload) =>
    apiRequest<MaterialRequirementApiRecord>("/materials/requirements", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateMaterialRequirement: (id: string, payload: UpdateMaterialRequirementPayload) =>
    apiRequest<MaterialRequirementApiRecord>(`/materials/requirements/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  requestMaterialSupply: (id: string, payload: RequestMaterialSupplyPayload) =>
    apiRequest<{ id: string; requestedQuantity: number; lastRequestDate: string | null; supplyStatus: string }>(
      `/materials/requirements/${encodeURIComponent(id)}/request-supply`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    ),
  createMaterialPurchase: (payload: CreateMaterialPurchasePayload) =>
    apiRequest<MaterialPurchaseApiRecord>("/materials/purchases", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateMaterialPurchase: (id: string, payload: UpdateMaterialPurchasePayload) =>
    apiRequest<{ message: string; totalCostDifference: number; newTotalCost: number }>(
      `/materials/purchases/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    ),
  deleteMaterialPurchase: (id: string) =>
    apiRequest<{ message: string; reversedAmount: number }>(
      `/materials/purchases/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    ),
  getDocuments: (params?: { projectId?: string }) => {
    const query = new URLSearchParams();
    if (params?.projectId && params.projectId.trim().length > 0) {
      query.set("projectId", params.projectId.trim());
    }
    const suffix = query.toString().length > 0 ? `?${query.toString()}` : "";
    return apiRequest<DocumentApiRecord[]>(`/documents${suffix}`);
  },
  createDocument: (payload: CreateDocumentPayload) =>
    apiRequest<DocumentApiRecord>("/documents", {
      method: "POST",
      body: JSON.stringify(payload),
      notifySuccess: false,
    }),
  deleteDocument: (id: string) =>
    apiRequest<{ message: string }>(`/documents/${encodeURIComponent(id)}`, {
      method: "DELETE",
      notifySuccess: false,
    }),
  getNotifications: () => apiRequest<NotificationApiRecord[]>("/notifications"),
  remindNotification: (id: string) =>
    apiRequest<{ id: string; reminderCount: number; lastRemindedAt: string; message: string }>(
      `/notifications/${encodeURIComponent(id)}/remind`,
      { method: "POST" },
    ),
  resolveNotification: (id: string) =>
    apiRequest<{ message: string }>(`/notifications/${encodeURIComponent(id)}/resolve`, {
      method: "PATCH",
    }),
  getActivityLog: () => apiRequest<ActivityApiRecord[]>("/notifications/activity-log"),
  getReports: () => apiRequest<ReportsResponse>("/reports"),
  downloadReportPdf: async (params?: DownloadReportPdfParams): Promise<DownloadedReportPdf> => {
    beginApiRequest();
    try {
      const query = new URLSearchParams();
      if (params?.reportType) query.set("reportType", params.reportType);
      if (params?.projectId) query.set("projectId", params.projectId);
      if (params?.category) query.set("category", params.category);
      if (params?.fromDate) query.set("fromDate", params.fromDate);
      if (params?.toDate) query.set("toDate", params.toDate);
      const suffix = query.toString().length > 0 ? `?${query.toString()}` : "";

      const headers = new Headers();
      if (authToken) {
        headers.set("Authorization", `Bearer ${authToken}`);
      }

      const response = await fetch(`${API_BASE_URL}/reports/pdf${suffix}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        const payload = await parseJsonSafe(response);
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "message" in payload &&
          typeof (payload as { message?: unknown }).message === "string"
            ? (payload as { message: string }).message
            : `Request failed with status ${response.status}`;
        throw new ApiError(message, response.status, payload);
      }

      const blob = await response.blob();
      const filename =
        parseContentDispositionFilename(response.headers.get("content-disposition")) ??
        `report-${new Date().toISOString().slice(0, 10)}.pdf`;
      return { blob, filename };
    } finally {
      endApiRequest();
    }
  },
  getPettyCash: () => apiRequest<PettyCashResponse>("/petty-cash"),
  createPettyCash: (payload: CreatePettyCashPayload) =>
    apiRequest<PettyCashApiRecord>("/petty-cash", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updatePettyCash: (id: string, payload: UpdatePettyCashPayload) =>
    apiRequest<PettyCashApiRecord>(`/petty-cash/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deletePettyCash: (id: string) =>
    apiRequest<{ message: string }>(`/petty-cash/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  restorePettyCash: (id: string) =>
    apiRequest<{ message: string }>(`/petty-cash/${encodeURIComponent(id)}/restore`, {
      method: "PATCH",
    }),
  getDeletedItems: () => apiRequest<DeletedItemsResponse>("/deleted-items"),
  purgeDeletedItem: (entity: DeletedItemEntity, id: string) =>
    apiRequest<{ message: string }>(`/deleted-items/${encodeURIComponent(entity)}/${encodeURIComponent(id)}/purge`, {
      method: "DELETE",
      body: JSON.stringify({ confirm: "PURGE" }),
      successMessage: "Deleted record permanently purged.",
    }),
  restoreDeletedItem: (entity: DeletedItemEntity, id: string) => {
    const encodedId = encodeURIComponent(id);
    const restorePaths: Record<DeletedItemEntity, string> = {
      projects: "/projects/" + encodedId + "/restore",
      workers: "/workers/" + encodedId + "/restore",
      users: "/users/" + encodedId + "/restore",
      documents: "/documents/" + encodedId + "/restore",
      suppliers: "/suppliers/" + encodedId + "/restore",
      "quote-requests": "/quote-requests/" + encodedId + "/restore",
      gallery: "/gallery/" + encodedId + "/restore",
      expenses: "/expenses/" + encodedId + "/restore",
      payments: "/payments/" + encodedId + "/restore",
      "labor-payments": "/workers/labor-payments/" + encodedId + "/restore",
      "material-purchases": "/materials/purchases/" + encodedId + "/restore",
      equipment: "/equipment/" + encodedId + "/restore",
      "petty-cash": "/petty-cash/" + encodedId + "/restore",
    };

    return apiRequest<{ message: string }>(restorePaths[entity], {
      method: "PATCH",
      successMessage: "Record restored successfully.",
    });
  },
  getUsers: () => apiRequest<UsersResponse>("/users"),
  createUser: (payload: CreateUserPayload) =>
    apiRequest<UserApiRecord>("/users", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateUser: (id: number, payload: UpdateUserPayload) =>
    apiRequest<UserApiRecord>(`/users/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  suspendUser: (id: number) =>
    apiRequest<{ message: string }>(`/users/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  // Public — no auth required
  submitQuoteRequest: (payload: SubmitQuoteRequestPayload) =>
    apiRequest<{ message: string; id: string }>("/public/quote-requests", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  // Admin — quote requests management
  getQuoteRequests: () => apiRequest<QuoteRequestApiRecord[]>("/quote-requests", { notifyError: false }),
  updateQuoteRequestStatus: (id: string, status: "New" | "Read" | "Replied") =>
    apiRequest<{ message: string; id: string }>(`/quote-requests/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
      notifyError: false,
      notifySuccess: false,
    }),
  deleteQuoteRequest: (id: string) =>
    apiRequest<{ message: string }>(`/quote-requests/${encodeURIComponent(id)}`, {
      method: "DELETE",
      notifyError: false,
      notifySuccess: false,
    }),
  // Public — website settings (no auth)
  getPublicWebsiteSettings: () =>
    apiRequest<Partial<WebsiteSettings>>("/public/website-settings"),
  // Admin — website settings
  getWebsiteSettings: () =>
    apiRequest<Partial<WebsiteSettings>>("/website-settings"),
  saveWebsiteSettings: (payload: Partial<WebsiteSettings>) =>
    apiRequest<Partial<WebsiteSettings>>("/website-settings", {
      method: "PUT",
      body: JSON.stringify(payload),
      notifyError: false,
      notifySuccess: false,
    }),
  // Public — gallery (no auth)
  getPublicGallery: () =>
    apiRequest<GalleryResponse>("/public/gallery"),
  // Admin — gallery management
  getGallery: () =>
    apiRequest<GalleryResponse>("/gallery"),
  createGalleryItem: (payload: CreateGalleryItemPayload) =>
    apiRequest<GalleryItemRecord>("/gallery", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateGalleryItem: (id: string, payload: Partial<CreateGalleryItemPayload>) =>
    apiRequest<GalleryItemRecord>(`/gallery/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteGalleryItem: (id: string) =>
    apiRequest<{ message: string }>(`/gallery/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  uploadGalleryImage: async (file: File): Promise<{ url: string }> => {
    const uploaded = await uploadSingleFile("/upload/gallery", "image", file, {
      successMessage: "Image uploaded successfully.",
    });
    return { url: uploaded.url };
  },
  uploadDocumentFile: async (
    file: File,
    options?: { notifySuccess?: boolean },
  ): Promise<UploadFileResponse> =>
    uploadSingleFile("/upload/document", "file", file, {
      notifySuccess: options?.notifySuccess,
      successMessage: "Document uploaded successfully.",
    }),
};

