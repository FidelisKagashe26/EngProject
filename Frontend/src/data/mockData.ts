export type ProjectStatus =
  | "Active"
  | "Pending"
  | "Completed"
  | "On Hold"
  | "Over Budget"
  | "Payment Pending"
  | "Closed";

export type Priority = "High" | "Medium" | "Low";

export interface ProjectRecord {
  id: string;
  name: string;
  site: string;
  client: string;
  contractNumber: string;
  startDate: string;
  endDate: string;
  contractValue: number;
  amountReceived: number;
  spent: number;
  status: ProjectStatus;
  progress: number;
  pendingPayments: number;
}

export interface WorkerRecord {
  id: string;
  name: string;
  phone: string;
  skill: string;
  project: string;
  paymentType: "Daily" | "Weekly" | "Monthly" | "Contract";
  rate: number;
  totalPaid: number;
  outstanding: number;
  status: "Active" | "Pending" | "Inactive";
}

export interface MaterialRecord {
  id: string;
  material: string;
  project: string;
  needed: number;
  purchased: number;
  unit: string;
  supplier: string;
  unitCost: number;
  purchaseDate: string;
  deliveryStatus: "Delivered" | "Pending Delivery" | "Partially Delivered";
}

export interface ExpenseRecord {
  id: string;
  date: string;
  project: string;
  category: string;
  description: string;
  amount: number;
  paidBy: string;
  method: string;
  receipt: string;
  status: "Approved" | "Pending" | "Flagged";
}

export interface ClientPaymentRecord {
  id: string;
  date: string;
  project: string;
  client: string;
  paymentType: "Advance" | "Milestone" | "Stage" | "Final" | "Other";
  milestone: string;
  expected: number;
  received: number;
  method: string;
  reference: string;
  status: "Received" | "Partial" | "Pending";
}

export interface DocumentRecord {
  id: string;
  name: string;
  project: string;
  category: string;
  uploadedBy: string;
  uploadDate: string;
  fileType: string;
  size: string;
}

export interface SupplierRecord {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  location: string;
  materials: string;
  totalPurchases: number;
  outstandingBalance: number;
  status: "Active" | "Pending" | "On Hold";
}

export interface EquipmentRecord {
  id: string;
  name: string;
  type: string;
  project: string;
  owner: string;
  rentalCost: number;
  maintenanceCost: number;
  usageDates: string;
  status: "In Use" | "Idle" | "Under Maintenance";
}

export interface PettyCashRecord {
  id: string;
  date: string;
  project: string;
  description: string;
  cashIn: number;
  cashOut: number;
  balance: number;
  recordedBy: string;
  receipt: string;
  status: "Reconciled" | "Pending";
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  role:
    | "Admin"
    | "Engineer / Project Manager"
    | "Accountant"
    | "Store Keeper"
    | "Site Supervisor";
  assignedProjects: string;
  status: "Active" | "Invited" | "Suspended";
  lastLogin: string;
}

export interface NotificationRecord {
  id: string;
  title: string;
  project: string;
  description: string;
  dateTime: string;
  priority: Priority;
  type:
    | "Overspending"
    | "Budget"
    | "Client Payment"
    | "Labor"
    | "Material"
    | "Deadline"
    | "Document";
}

export interface ActivityRecord {
  id: string;
  dateTime: string;
  user: string;
  action: string;
  module: string;
  project: string;
  description: string;
  ipDevice: string;
}

export const projects: ProjectRecord[] = [
  {
    id: "PRJ-001",
    name: "Dodoma Drainage Construction",
    site: "Dodoma Urban",
    client: "Dodoma Municipal Council",
    contractNumber: "DMC-DRN-2026-01",
    startDate: "2026-01-12",
    endDate: "2026-09-30",
    contractValue: 120_000_000,
    amountReceived: 65_000_000,
    spent: 48_500_000,
    status: "Active",
    progress: 45,
    pendingPayments: 28_000_000,
  },
  {
    id: "PRJ-002",
    name: "Arusha Office Renovation",
    site: "Arusha CBD",
    client: "Kilimanjaro Holdings Ltd",
    contractNumber: "KHL-REN-2026-03",
    startDate: "2026-02-08",
    endDate: "2026-08-14",
    contractValue: 85_000_000,
    amountReceived: 40_000_000,
    spent: 32_200_000,
    status: "Active",
    progress: 60,
    pendingPayments: 18_500_000,
  },
  {
    id: "PRJ-003",
    name: "Mwanza Site Extension",
    site: "Mwanza North",
    client: "Lake Zone Engineering Co.",
    contractNumber: "LZE-EXT-2025-11",
    startDate: "2025-11-20",
    endDate: "2026-11-20",
    contractValue: 150_000_000,
    amountReceived: 75_000_000,
    spent: 54_000_000,
    status: "On Hold",
    progress: 35,
    pendingPayments: 40_000_000,
  },
  {
    id: "PRJ-004",
    name: "Mbeya Road Works",
    site: "Mbeya - Chunya",
    client: "Southern Contractors Ltd",
    contractNumber: "SCL-RDW-2026-04",
    startDate: "2026-03-04",
    endDate: "2027-01-22",
    contractValue: 130_000_000,
    amountReceived: 30_000_000,
    spent: 21_700_000,
    status: "Active",
    progress: 25,
    pendingPayments: 52_500_000,
  },
];

export const monthlyFinance = [
  { month: "Jan", income: 36_000_000, expenses: 24_500_000 },
  { month: "Feb", income: 45_000_000, expenses: 29_300_000 },
  { month: "Mar", income: 29_000_000, expenses: 31_000_000 },
  { month: "Apr", income: 40_000_000, expenses: 27_500_000 },
  { month: "May", income: 33_000_000, expenses: 22_000_000 },
  { month: "Jun", income: 27_000_000, expenses: 22_100_000 },
];

export const projectStatusBreakdown = [
  { label: "Active", value: 8, color: "#0b2a53" },
  { label: "Completed", value: 4, color: "#1f8a4c" },
  { label: "On Hold", value: 2, color: "#d97706" },
  { label: "Over Budget", value: 2, color: "#c0392b" },
];

export const budgetAlerts = [
  {
    id: "AL-1",
    title: "Dodoma Drainage Project is 82% budget consumed",
    subtitle: "Material and transport costs have moved above planned monthly band.",
    priority: "High" as Priority,
  },
  {
    id: "AL-2",
    title: "Arusha Office Renovation has pending labor payment",
    subtitle: "Weekly crew payroll for finishing team remains unpaid.",
    priority: "Medium" as Priority,
  },
  {
    id: "AL-3",
    title: "Mbeya Road Works has pending material delivery",
    subtitle: "PVC pipe batch #PV-011 expected in 2 days.",
    priority: "Low" as Priority,
  },
];

export const recentActivities = [
  "TZS 2,500,000 material purchase added to Dodoma Drainage Project",
  "Worker payment recorded for Arusha Office Renovation",
  "Client milestone payment received for Mwanza Site Extension",
  "Fuel expense entry approved for Mbeya Road Works",
];

export const workers: WorkerRecord[] = [
  {
    id: "WK-001",
    name: "Juma Hassan",
    phone: "+255 754 112 334",
    skill: "Mason",
    project: "Dodoma Drainage Construction",
    paymentType: "Daily",
    rate: 45_000,
    totalPaid: 2_250_000,
    outstanding: 315_000,
    status: "Active",
  },
  {
    id: "WK-002",
    name: "Peter Mwakyusa",
    phone: "+255 767 531 882",
    skill: "Welder",
    project: "Arusha Office Renovation",
    paymentType: "Daily",
    rate: 55_000,
    totalPaid: 2_970_000,
    outstanding: 440_000,
    status: "Pending",
  },
  {
    id: "WK-003",
    name: "Asha Mohamed",
    phone: "+255 718 223 601",
    skill: "Site Assistant",
    project: "Mwanza Site Extension",
    paymentType: "Weekly",
    rate: 280_000,
    totalPaid: 1_680_000,
    outstanding: 0,
    status: "Active",
  },
  {
    id: "WK-004",
    name: "Joseph Mrema",
    phone: "+255 714 771 122",
    skill: "Electrician",
    project: "Mbeya Road Works",
    paymentType: "Contract",
    rate: 4_200_000,
    totalPaid: 2_100_000,
    outstanding: 2_100_000,
    status: "Pending",
  },
];

export const materials: MaterialRecord[] = [
  {
    id: "MAT-001",
    material: "Cement",
    project: "Dodoma Drainage Construction",
    needed: 1500,
    purchased: 1200,
    unit: "Bags",
    supplier: "Mkombozi Building Supplies",
    unitCost: 17_500,
    purchaseDate: "2026-04-18",
    deliveryStatus: "Partially Delivered",
  },
  {
    id: "MAT-002",
    material: "Steel bars",
    project: "Arusha Office Renovation",
    needed: 900,
    purchased: 900,
    unit: "Pieces",
    supplier: "Arusha Steel Centre",
    unitCost: 28_000,
    purchaseDate: "2026-04-12",
    deliveryStatus: "Delivered",
  },
  {
    id: "MAT-003",
    material: "PVC pipes",
    project: "Mbeya Road Works",
    needed: 400,
    purchased: 150,
    unit: "Lengths",
    supplier: "SCL Infrastructure Depot",
    unitCost: 52_000,
    purchaseDate: "2026-04-16",
    deliveryStatus: "Pending Delivery",
  },
  {
    id: "MAT-004",
    material: "Fuel",
    project: "Mwanza Site Extension",
    needed: 1200,
    purchased: 800,
    unit: "Litres",
    supplier: "Lake Petroleum",
    unitCost: 3_450,
    purchaseDate: "2026-04-11",
    deliveryStatus: "Partially Delivered",
  },
];

export const expenses: ExpenseRecord[] = [
  {
    id: "EXP-001",
    date: "2026-04-21",
    project: "Dodoma Drainage Construction",
    category: "Transport",
    description: "Sand delivery from quarry",
    amount: 780_000,
    paidBy: "Accountant",
    method: "Bank Transfer",
    receipt: "RCP-2011.pdf",
    status: "Approved",
  },
  {
    id: "EXP-002",
    date: "2026-04-20",
    project: "Arusha Office Renovation",
    category: "Food Allowance",
    description: "Weekend team meal support",
    amount: 240_000,
    paidBy: "Site Supervisor",
    method: "Cash",
    receipt: "RCP-2012.jpg",
    status: "Pending",
  },
  {
    id: "EXP-003",
    date: "2026-04-19",
    project: "Mbeya Road Works",
    category: "Machine Rental",
    description: "Mini excavator - 3 days",
    amount: 1_560_000,
    paidBy: "Engineer",
    method: "Mobile Money",
    receipt: "RCP-2013.pdf",
    status: "Approved",
  },
  {
    id: "EXP-004",
    date: "2026-04-18",
    project: "Mwanza Site Extension",
    category: "Accommodation",
    description: "Field lodging for survey team",
    amount: 420_000,
    paidBy: "Accountant",
    method: "Bank Transfer",
    receipt: "RCP-2014.pdf",
    status: "Flagged",
  },
];

export const clientPayments: ClientPaymentRecord[] = [
  {
    id: "PAY-001",
    date: "2026-04-16",
    project: "Dodoma Drainage Construction",
    client: "Dodoma Municipal Council",
    paymentType: "Milestone",
    milestone: "Excavation Phase",
    expected: 24_000_000,
    received: 20_000_000,
    method: "Bank Transfer",
    reference: "DMC-MP-4411",
    status: "Partial",
  },
  {
    id: "PAY-002",
    date: "2026-04-15",
    project: "Arusha Office Renovation",
    client: "Kilimanjaro Holdings Ltd",
    paymentType: "Stage",
    milestone: "Roofing Stage",
    expected: 15_000_000,
    received: 15_000_000,
    method: "Bank Transfer",
    reference: "KHL-ST-2088",
    status: "Received",
  },
  {
    id: "PAY-003",
    date: "2026-04-10",
    project: "Mwanza Site Extension",
    client: "Lake Zone Engineering Co.",
    paymentType: "Advance",
    milestone: "Initial Mobilization",
    expected: 30_000_000,
    received: 20_000_000,
    method: "Cheque",
    reference: "LZE-AD-1188",
    status: "Partial",
  },
  {
    id: "PAY-004",
    date: "2026-04-08",
    project: "Mbeya Road Works",
    client: "Southern Contractors Ltd",
    paymentType: "Milestone",
    milestone: "Survey & Marking",
    expected: 18_000_000,
    received: 0,
    method: "Bank Transfer",
    reference: "SCL-MP-8883",
    status: "Pending",
  },
];

export const documents: DocumentRecord[] = [
  {
    id: "DOC-001",
    name: "Dodoma Contract Signed.pdf",
    project: "Dodoma Drainage Construction",
    category: "Contracts",
    uploadedBy: "Admin",
    uploadDate: "2026-04-09",
    fileType: "PDF",
    size: "2.1 MB",
  },
  {
    id: "DOC-002",
    name: "Arusha BOQ Rev2.xlsx",
    project: "Arusha Office Renovation",
    category: "BOQ Documents",
    uploadedBy: "Engineer",
    uploadDate: "2026-04-12",
    fileType: "XLSX",
    size: "986 KB",
  },
  {
    id: "DOC-003",
    name: "Fuel Receipts Week15.zip",
    project: "Mbeya Road Works",
    category: "Receipts",
    uploadedBy: "Site Supervisor",
    uploadDate: "2026-04-17",
    fileType: "ZIP",
    size: "8.4 MB",
  },
  {
    id: "DOC-004",
    name: "Mwanza Drawing Set A.dwg",
    project: "Mwanza Site Extension",
    category: "Drawings",
    uploadedBy: "Project Manager",
    uploadDate: "2026-04-13",
    fileType: "DWG",
    size: "6.2 MB",
  },
];

export const suppliers: SupplierRecord[] = [
  {
    id: "SUP-001",
    name: "Mkombozi Building Supplies",
    contactPerson: "Neema Macha",
    phone: "+255 745 661 332",
    location: "Dodoma",
    materials: "Cement, Sand, Aggregates",
    totalPurchases: 38_500_000,
    outstandingBalance: 5_800_000,
    status: "Active",
  },
  {
    id: "SUP-002",
    name: "Arusha Steel Centre",
    contactPerson: "Gilbert Lema",
    phone: "+255 763 223 992",
    location: "Arusha",
    materials: "Steel bars, Cables",
    totalPurchases: 22_300_000,
    outstandingBalance: 0,
    status: "Active",
  },
  {
    id: "SUP-003",
    name: "Lake Petroleum",
    contactPerson: "Amina Salim",
    phone: "+255 712 201 118",
    location: "Mwanza",
    materials: "Fuel, Lubricants",
    totalPurchases: 17_200_000,
    outstandingBalance: 3_450_000,
    status: "Pending",
  },
];

export const equipmentRecords: EquipmentRecord[] = [
  {
    id: "EQ-001",
    name: "JCB 3DX",
    type: "Backhoe Loader",
    project: "Dodoma Drainage Construction",
    owner: "Rented - BuildFleet Ltd",
    rentalCost: 4_800_000,
    maintenanceCost: 320_000,
    usageDates: "10 Apr - 26 Apr",
    status: "In Use",
  },
  {
    id: "EQ-002",
    name: "Concrete Mixer 400L",
    type: "Mixer",
    project: "Arusha Office Renovation",
    owner: "Owned",
    rentalCost: 0,
    maintenanceCost: 190_000,
    usageDates: "02 Apr - 30 Apr",
    status: "In Use",
  },
  {
    id: "EQ-003",
    name: "Toyota Hilux T920",
    type: "Transport Vehicle",
    project: "Mbeya Road Works",
    owner: "Rented - SCL Transport",
    rentalCost: 2_100_000,
    maintenanceCost: 0,
    usageDates: "15 Apr - 12 May",
    status: "Idle",
  },
];

export const pettyCash: PettyCashRecord[] = [
  {
    id: "PC-001",
    date: "2026-04-18",
    project: "Dodoma Drainage Construction",
    description: "Small tool replacement",
    cashIn: 0,
    cashOut: 150_000,
    balance: 1_850_000,
    recordedBy: "Store Keeper",
    receipt: "PC-RCP-101",
    status: "Reconciled",
  },
  {
    id: "PC-002",
    date: "2026-04-19",
    project: "Arusha Office Renovation",
    description: "Fuel top-up for generator",
    cashIn: 0,
    cashOut: 220_000,
    balance: 1_630_000,
    recordedBy: "Site Supervisor",
    receipt: "PC-RCP-102",
    status: "Pending",
  },
  {
    id: "PC-003",
    date: "2026-04-21",
    project: "Main Office",
    description: "Petty cash replenishment",
    cashIn: 500_000,
    cashOut: 0,
    balance: 2_130_000,
    recordedBy: "Accountant",
    receipt: "PC-BNK-201",
    status: "Reconciled",
  },
];

export const users: UserRecord[] = [
  {
    id: "USR-001",
    name: "Faraja Nyerere",
    email: "faraja.n@engicost.co.tz",
    phone: "+255 754 111 992",
    role: "Admin",
    assignedProjects: "All Projects",
    status: "Active",
    lastLogin: "24 Apr 2026, 09:30",
  },
  {
    id: "USR-002",
    name: "John Msuya",
    email: "john.m@engicost.co.tz",
    phone: "+255 766 101 778",
    role: "Engineer / Project Manager",
    assignedProjects: "Dodoma, Mbeya",
    status: "Active",
    lastLogin: "24 Apr 2026, 08:12",
  },
  {
    id: "USR-003",
    name: "Rehema Sululu",
    email: "rehema.s@engicost.co.tz",
    phone: "+255 713 220 007",
    role: "Accountant",
    assignedProjects: "All Projects",
    status: "Active",
    lastLogin: "23 Apr 2026, 17:01",
  },
  {
    id: "USR-004",
    name: "Salum Nundu",
    email: "salum.n@engicost.co.tz",
    phone: "+255 752 600 220",
    role: "Store Keeper",
    assignedProjects: "Arusha, Mwanza",
    status: "Invited",
    lastLogin: "Never",
  },
];

export const notifications: NotificationRecord[] = [
  {
    id: "NT-001",
    title: "Overspending Alert",
    project: "Dodoma Drainage Construction",
    description: "Fuel and transport expenses are 12% above plan.",
    dateTime: "2026-04-24 08:20",
    priority: "High",
    type: "Overspending",
  },
  {
    id: "NT-002",
    title: "Pending Client Payment",
    project: "Mbeya Road Works",
    description: "Milestone payment overdue by 6 days.",
    dateTime: "2026-04-23 15:44",
    priority: "High",
    type: "Client Payment",
  },
  {
    id: "NT-003",
    title: "Outstanding Labor Payment",
    project: "Arusha Office Renovation",
    description: "Finishing crew wages pending approval.",
    dateTime: "2026-04-22 11:32",
    priority: "Medium",
    type: "Labor",
  },
  {
    id: "NT-004",
    title: "Pending Material Delivery",
    project: "Mwanza Site Extension",
    description: "Electrical cables PO is still in transit.",
    dateTime: "2026-04-22 09:06",
    priority: "Medium",
    type: "Material",
  },
  {
    id: "NT-005",
    title: "Missing Document Reminder",
    project: "Dodoma Drainage Construction",
    description: "Upload signed delivery note for batch CMT-1102.",
    dateTime: "2026-04-21 18:41",
    priority: "Low",
    type: "Document",
  },
];

export const activityLog: ActivityRecord[] = [
  {
    id: "ACT-001",
    dateTime: "2026-04-24 08:12",
    user: "Rehema Sululu",
    action: "Recorded Client Payment",
    module: "Payments",
    project: "Dodoma Drainage Construction",
    description: "Accountant recorded TZS 5,000,000 client payment",
    ipDevice: "102.45.11.90 / Chrome - Windows",
  },
  {
    id: "ACT-002",
    dateTime: "2026-04-24 07:58",
    user: "Salum Nundu",
    action: "Added Material Purchase",
    module: "Materials",
    project: "Arusha Office Renovation",
    description: "Store Keeper added cement purchase",
    ipDevice: "102.45.21.44 / Android App",
  },
  {
    id: "ACT-003",
    dateTime: "2026-04-23 17:34",
    user: "John Msuya",
    action: "Uploaded Receipt",
    module: "Documents",
    project: "Mbeya Road Works",
    description: "Site Supervisor uploaded fuel receipt",
    ipDevice: "102.45.100.10 / Safari - iOS",
  },
  {
    id: "ACT-004",
    dateTime: "2026-04-23 14:10",
    user: "Faraja Nyerere",
    action: "Edited Project Budget",
    module: "Projects",
    project: "Mwanza Site Extension",
    description: "Admin edited project budget",
    ipDevice: "102.45.10.81 / Firefox - Windows",
  },
];

export const reportCards = [
  "Project Cost Summary Report",
  "Labor Payment Report",
  "Material Purchase Report",
  "Expense Report",
  "Project Balance Report",
  "Payment Received Report",
  "Profit/Loss Estimation Report",
  "Multi-Project Summary Report",
  "Budget Variance Report",
];

export const documentCategories = [
  "Contracts",
  "Quotations",
  "BOQ Documents",
  "Site Instructions",
  "Invoices",
  "Receipts",
  "Delivery Notes",
  "Payment References",
  "Drawings",
  "Technical Files",
  "Other Documents",
];

export const paymentMethods = [
  "Cash",
  "Bank Transfer",
  "Mobile Money",
  "Cheque",
  "Other",
];

export const expenseCategories = [
  "Transport",
  "Fuel",
  "Machine Rental",
  "Accommodation",
  "Food Allowances",
  "Equipment Maintenance",
  "Communication",
  "Permits",
  "Miscellaneous",
];

export const materialUnits = ["Bags", "Pieces", "Tonnes", "Litres", "Lengths", "Cubic Meter"];

export const permissionGroups = [
  "View dashboard",
  "Manage projects",
  "Manage contracts",
  "Manage labor",
  "Manage materials",
  "Manage expenses",
  "Manage payments",
  "Upload documents",
  "View reports",
  "Manage users",
  "Export reports",
];

export const rolePermissions: Record<string, string[]> = {
  Admin: permissionGroups,
  "Engineer / Project Manager": [
    "View dashboard",
    "Manage projects",
    "Manage contracts",
    "Manage labor",
    "Manage materials",
    "Manage expenses",
    "Manage payments",
    "Upload documents",
    "View reports",
    "Export reports",
  ],
  Accountant: [
    "View dashboard",
    "Manage expenses",
    "Manage payments",
    "Upload documents",
    "View reports",
    "Export reports",
  ],
  "Store Keeper": ["View dashboard", "Manage materials", "Upload documents"],
  "Site Supervisor": ["View dashboard", "Manage labor", "Manage expenses", "Upload documents"],
};
