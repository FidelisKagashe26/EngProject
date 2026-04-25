import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { db } from "./pool";
import { makeId } from "./ids";

const seedProjects = [
  {
    id: "PRJ-001",
    name: "Dodoma Drainage Construction",
    site_location: "Dodoma Urban",
    client_name: "Dodoma Municipal Council",
    contract_number: "DMC-DRN-2026-01",
    start_date: "2026-01-12",
    expected_completion_date: "2026-09-30",
    contract_value: 120_000_000,
    amount_received: 65_000_000,
    total_spent: 48_500_000,
    status: "Active",
    progress: 45,
    pending_client_payments: 28_000_000,
    description: "Drainage and culvert construction works.",
  },
  {
    id: "PRJ-002",
    name: "Arusha Office Renovation",
    site_location: "Arusha CBD",
    client_name: "Kilimanjaro Holdings Ltd",
    contract_number: "KHL-REN-2026-03",
    start_date: "2026-02-08",
    expected_completion_date: "2026-08-14",
    contract_value: 85_000_000,
    amount_received: 40_000_000,
    total_spent: 32_200_000,
    status: "Active",
    progress: 60,
    pending_client_payments: 18_500_000,
    description: "Office renovation and electrical upgrade.",
  },
  {
    id: "PRJ-003",
    name: "Mwanza Site Extension",
    site_location: "Mwanza North",
    client_name: "Lake Zone Engineering Co.",
    contract_number: "LZE-EXT-2025-11",
    start_date: "2025-11-20",
    expected_completion_date: "2026-11-20",
    contract_value: 150_000_000,
    amount_received: 75_000_000,
    total_spent: 54_000_000,
    status: "On Hold",
    progress: 35,
    pending_client_payments: 40_000_000,
    description: "Site extension and foundations.",
  },
  {
    id: "PRJ-004",
    name: "Mbeya Road Works",
    site_location: "Mbeya - Chunya",
    client_name: "Southern Contractors Ltd",
    contract_number: "SCL-RDW-2026-04",
    start_date: "2026-03-04",
    expected_completion_date: "2027-01-22",
    contract_value: 130_000_000,
    amount_received: 30_000_000,
    total_spent: 21_700_000,
    status: "Active",
    progress: 25,
    pending_client_payments: 52_500_000,
    description: "Road grading and pavement prep.",
  },
];

export const initializeDatabase = async (): Promise<void> => {
  await db.query("CREATE SCHEMA IF NOT EXISTS engicost");

  await db.query(`
    CREATE TABLE IF NOT EXISTS engicost.companies (
      id SERIAL PRIMARY KEY,
      name VARCHAR(180) NOT NULL,
      email VARCHAR(160),
      phone VARCHAR(60),
      location VARCHAR(160),
      currency VARCHAR(10) NOT NULL DEFAULT 'TZS',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS engicost.users (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES engicost.companies(id) ON DELETE CASCADE,
      full_name VARCHAR(160) NOT NULL,
      email VARCHAR(180) NOT NULL UNIQUE,
      phone VARCHAR(60),
      password_hash VARCHAR(255),
      role VARCHAR(80) NOT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'Active',
      last_login TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    ALTER TABLE engicost.users
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)
  `);
  await db.query(`
    ALTER TABLE engicost.users
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  `);
  await db.query(`
    ALTER TABLE engicost.users
    ADD COLUMN IF NOT EXISTS assigned_projects TEXT NOT NULL DEFAULT ''
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS engicost.projects (
      id VARCHAR(40) PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES engicost.companies(id) ON DELETE CASCADE,
      name VARCHAR(200) NOT NULL,
      site_location VARCHAR(200) NOT NULL,
      client_name VARCHAR(200) NOT NULL,
      contract_number VARCHAR(80) NOT NULL UNIQUE,
      start_date DATE NOT NULL,
      expected_completion_date DATE NOT NULL,
      contract_value NUMERIC(16, 2) NOT NULL DEFAULT 0,
      amount_received NUMERIC(16, 2) NOT NULL DEFAULT 0,
      total_spent NUMERIC(16, 2) NOT NULL DEFAULT 0,
      status VARCHAR(40) NOT NULL DEFAULT 'Pending',
      progress INTEGER NOT NULL DEFAULT 0,
      pending_client_payments NUMERIC(16, 2) NOT NULL DEFAULT 0,
      description TEXT,
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS engicost.expenses (
      id VARCHAR(40) PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES engicost.companies(id) ON DELETE CASCADE,
      project_id VARCHAR(40) NOT NULL REFERENCES engicost.projects(id) ON DELETE CASCADE,
      expense_date DATE NOT NULL,
      category VARCHAR(80) NOT NULL,
      description TEXT NOT NULL,
      amount NUMERIC(16, 2) NOT NULL DEFAULT 0,
      paid_by VARCHAR(120) NOT NULL,
      payment_method VARCHAR(80) NOT NULL,
      receipt_ref VARCHAR(120),
      status VARCHAR(40) NOT NULL DEFAULT 'Pending',
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS engicost.client_payments (
      id VARCHAR(40) PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES engicost.companies(id) ON DELETE CASCADE,
      project_id VARCHAR(40) NOT NULL REFERENCES engicost.projects(id) ON DELETE CASCADE,
      client_name VARCHAR(180) NOT NULL,
      payment_type VARCHAR(60) NOT NULL,
      milestone VARCHAR(120),
      amount_expected NUMERIC(16, 2) NOT NULL DEFAULT 0,
      amount_received NUMERIC(16, 2) NOT NULL DEFAULT 0,
      payment_date DATE NOT NULL,
      payment_method VARCHAR(80) NOT NULL,
      reference_number VARCHAR(120),
      status VARCHAR(40) NOT NULL DEFAULT 'Pending',
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS engicost.workers (
      id VARCHAR(40) PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES engicost.companies(id) ON DELETE CASCADE,
      full_name VARCHAR(160) NOT NULL,
      phone VARCHAR(60) NOT NULL,
      skill_role VARCHAR(120) NOT NULL,
      payment_type VARCHAR(40) NOT NULL,
      rate_amount NUMERIC(16, 2) NOT NULL DEFAULT 0,
      assigned_project_id VARCHAR(40) REFERENCES engicost.projects(id) ON DELETE SET NULL,
      total_paid NUMERIC(16, 2) NOT NULL DEFAULT 0,
      outstanding_amount NUMERIC(16, 2) NOT NULL DEFAULT 0,
      status VARCHAR(40) NOT NULL DEFAULT 'Active',
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS engicost.labor_payments (
      id VARCHAR(40) PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES engicost.companies(id) ON DELETE CASCADE,
      project_id VARCHAR(40) NOT NULL REFERENCES engicost.projects(id) ON DELETE CASCADE,
      worker_id VARCHAR(40) NOT NULL REFERENCES engicost.workers(id) ON DELETE CASCADE,
      work_start DATE NOT NULL,
      work_end DATE NOT NULL,
      days_worked INTEGER NOT NULL,
      rate_amount NUMERIC(16, 2) NOT NULL DEFAULT 0,
      total_payable NUMERIC(16, 2) NOT NULL DEFAULT 0,
      amount_paid NUMERIC(16, 2) NOT NULL DEFAULT 0,
      balance NUMERIC(16, 2) NOT NULL DEFAULT 0,
      payment_method VARCHAR(80) NOT NULL,
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS engicost.material_requirements (
      id VARCHAR(40) PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES engicost.companies(id) ON DELETE CASCADE,
      project_id VARCHAR(40) NOT NULL REFERENCES engicost.projects(id) ON DELETE CASCADE,
      material_name VARCHAR(140) NOT NULL,
      required_quantity NUMERIC(16, 2) NOT NULL DEFAULT 0,
      unit VARCHAR(40) NOT NULL,
      estimated_unit_cost NUMERIC(16, 2) NOT NULL DEFAULT 0,
      priority VARCHAR(40) NOT NULL DEFAULT 'Medium',
      needed_by_date DATE,
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS engicost.material_purchases (
      id VARCHAR(40) PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES engicost.companies(id) ON DELETE CASCADE,
      project_id VARCHAR(40) NOT NULL REFERENCES engicost.projects(id) ON DELETE CASCADE,
      requirement_id VARCHAR(40) REFERENCES engicost.material_requirements(id) ON DELETE SET NULL,
      material_name VARCHAR(140) NOT NULL,
      quantity_purchased NUMERIC(16, 2) NOT NULL DEFAULT 0,
      supplier_name VARCHAR(180) NOT NULL,
      unit_cost NUMERIC(16, 2) NOT NULL DEFAULT 0,
      total_cost NUMERIC(16, 2) NOT NULL DEFAULT 0,
      purchase_date DATE NOT NULL,
      delivery_note_number VARCHAR(120),
      delivery_status VARCHAR(40) NOT NULL DEFAULT 'Pending Delivery',
      receipt_ref VARCHAR(120),
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS engicost.documents (
      id VARCHAR(40) PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES engicost.companies(id) ON DELETE CASCADE,
      project_id VARCHAR(40) REFERENCES engicost.projects(id) ON DELETE SET NULL,
      category VARCHAR(80) NOT NULL,
      document_name VARCHAR(220) NOT NULL,
      file_type VARCHAR(20),
      file_size VARCHAR(30),
      file_reference TEXT,
      uploaded_by VARCHAR(120) NOT NULL,
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS engicost.notifications (
      id VARCHAR(40) PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES engicost.companies(id) ON DELETE CASCADE,
      project_id VARCHAR(40) REFERENCES engicost.projects(id) ON DELETE SET NULL,
      alert_type VARCHAR(60) NOT NULL,
      title VARCHAR(220) NOT NULL,
      description TEXT NOT NULL,
      priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
      status VARCHAR(20) NOT NULL DEFAULT 'Unread',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS engicost.activity_logs (
      id VARCHAR(40) PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES engicost.companies(id) ON DELETE CASCADE,
      actor_name VARCHAR(160) NOT NULL,
      action VARCHAR(120) NOT NULL,
      module VARCHAR(80) NOT NULL,
      project_id VARCHAR(40) REFERENCES engicost.projects(id) ON DELETE SET NULL,
      description TEXT NOT NULL,
      ip_device VARCHAR(180),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS engicost.suppliers (
      id VARCHAR(40) PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES engicost.companies(id) ON DELETE CASCADE,
      name VARCHAR(220) NOT NULL,
      contact_person VARCHAR(160) NOT NULL,
      phone VARCHAR(60) NOT NULL,
      email VARCHAR(180),
      location VARCHAR(180),
      material_categories TEXT,
      total_purchases NUMERIC(16, 2) NOT NULL DEFAULT 0,
      outstanding_balance NUMERIC(16, 2) NOT NULL DEFAULT 0,
      status VARCHAR(40) NOT NULL DEFAULT 'Active',
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS engicost.equipment_usage (
      id VARCHAR(40) PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES engicost.companies(id) ON DELETE CASCADE,
      project_id VARCHAR(40) NOT NULL REFERENCES engicost.projects(id) ON DELETE CASCADE,
      equipment_name VARCHAR(180) NOT NULL,
      equipment_type VARCHAR(120) NOT NULL,
      ownership_type VARCHAR(30) NOT NULL,
      owner_name VARCHAR(180) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      usage_days INTEGER NOT NULL DEFAULT 0,
      daily_rate NUMERIC(16, 2) NOT NULL DEFAULT 0,
      rental_cost NUMERIC(16, 2) NOT NULL DEFAULT 0,
      maintenance_cost NUMERIC(16, 2) NOT NULL DEFAULT 0,
      total_cost NUMERIC(16, 2) NOT NULL DEFAULT 0,
      status VARCHAR(40) NOT NULL DEFAULT 'In Use',
      maintenance_notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS engicost.petty_cash_transactions (
      id VARCHAR(40) PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES engicost.companies(id) ON DELETE CASCADE,
      project_id VARCHAR(40) REFERENCES engicost.projects(id) ON DELETE SET NULL,
      transaction_date DATE NOT NULL,
      transaction_type VARCHAR(20) NOT NULL,
      description TEXT NOT NULL,
      amount NUMERIC(16, 2) NOT NULL DEFAULT 0,
      recorded_by VARCHAR(160) NOT NULL,
      receipt_ref VARCHAR(140),
      status VARCHAR(30) NOT NULL DEFAULT 'Pending',
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS engicost.password_reset_otps (
      id VARCHAR(40) PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES engicost.companies(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES engicost.users(id) ON DELETE CASCADE,
      email VARCHAR(180) NOT NULL,
      otp_hash VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      consumed_at TIMESTAMP,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  const companyResult = await db.query<{ id: number }>(
    "SELECT id FROM engicost.companies ORDER BY id ASC LIMIT 1",
  );

  let companyId: number;
  if (companyResult.rowCount === 0) {
    const created = await db.query<{ id: number }>(
      `
      INSERT INTO engicost.companies (name, email, phone, location, currency)
      VALUES ('Nexivo Company Limited', 'info@nexivo.co.tz', '+255 754 000 100', 'Dar es Salaam, Tanzania', 'TZS')
      RETURNING id
      `,
    );
    companyId = created.rows[0].id;
  } else {
    companyId = companyResult.rows[0].id;
  }

  await db.query(
    `
    INSERT INTO engicost.users (company_id, full_name, email, phone, role, status, last_login)
    VALUES ($1, 'Faraja Nyerere', $2, '+255 754 111 992', 'Admin', 'Active', NOW())
    ON CONFLICT (email) DO NOTHING
    `,
    [companyId, env.adminSeedEmail.trim().toLowerCase()],
  );

  const adminPasswordHash = await bcrypt.hash(env.adminSeedPassword, 12);
  await db.query(
    `
    UPDATE engicost.users
    SET password_hash = $2, updated_at = NOW()
    WHERE lower(email) = $1
      AND (password_hash IS NULL OR length(trim(password_hash)) = 0)
    `,
    [env.adminSeedEmail.trim().toLowerCase(), adminPasswordHash],
  );

  const existingProjects = await db.query("SELECT id FROM engicost.projects LIMIT 1");
  if (existingProjects.rowCount === 0) {
    for (const project of seedProjects) {
      await db.query(
        `
        INSERT INTO engicost.projects (
          id, company_id, name, site_location, client_name, contract_number, start_date,
          expected_completion_date, contract_value, amount_received, total_spent, status, progress,
          pending_client_payments, description
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14, $15
        )
        `,
        [
          project.id,
          companyId,
          project.name,
          project.site_location,
          project.client_name,
          project.contract_number,
          project.start_date,
          project.expected_completion_date,
          project.contract_value,
          project.amount_received,
          project.total_spent,
          project.status,
          project.progress,
          project.pending_client_payments,
          project.description,
        ],
      );
    }

    const workerSeeds = [
      {
        id: "WK-001",
        full_name: "Juma Hassan",
        phone: "+255 754 112 334",
        skill_role: "Mason",
        payment_type: "Daily",
        rate_amount: 45_000,
        assigned_project_id: "PRJ-001",
        total_paid: 2_250_000,
        outstanding_amount: 315_000,
        status: "Active",
      },
      {
        id: "WK-002",
        full_name: "Peter Mwakyusa",
        phone: "+255 767 531 882",
        skill_role: "Welder",
        payment_type: "Daily",
        rate_amount: 55_000,
        assigned_project_id: "PRJ-002",
        total_paid: 2_970_000,
        outstanding_amount: 440_000,
        status: "Pending",
      },
      {
        id: "WK-003",
        full_name: "Asha Mohamed",
        phone: "+255 718 223 601",
        skill_role: "Site Assistant",
        payment_type: "Weekly",
        rate_amount: 280_000,
        assigned_project_id: "PRJ-003",
        total_paid: 1_680_000,
        outstanding_amount: 0,
        status: "Active",
      },
      {
        id: "WK-004",
        full_name: "Joseph Mrema",
        phone: "+255 714 771 122",
        skill_role: "Electrician",
        payment_type: "Contract",
        rate_amount: 4_200_000,
        assigned_project_id: "PRJ-004",
        total_paid: 2_100_000,
        outstanding_amount: 2_100_000,
        status: "Pending",
      },
    ];

    for (const worker of workerSeeds) {
      await db.query(
        `
        INSERT INTO engicost.workers (
          id, company_id, full_name, phone, skill_role, payment_type, rate_amount,
          assigned_project_id, total_paid, outstanding_amount, status
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        )
        `,
        [
          worker.id,
          companyId,
          worker.full_name,
          worker.phone,
          worker.skill_role,
          worker.payment_type,
          worker.rate_amount,
          worker.assigned_project_id,
          worker.total_paid,
          worker.outstanding_amount,
          worker.status,
        ],
      );
    }

    await db.query(
      `
      INSERT INTO engicost.expenses (id, company_id, project_id, expense_date, category, description, amount, paid_by, payment_method, receipt_ref, status)
      VALUES
      ($1, $2, 'PRJ-001', '2026-04-21', 'Transport', 'Sand delivery from quarry', 780000, 'Accountant', 'Bank Transfer', 'RCP-2011.pdf', 'Approved'),
      ($3, $2, 'PRJ-002', '2026-04-20', 'Food Allowance', 'Weekend team meal support', 240000, 'Site Supervisor', 'Cash', 'RCP-2012.jpg', 'Pending'),
      ($4, $2, 'PRJ-004', '2026-04-19', 'Machine Rental', 'Mini excavator - 3 days', 1560000, 'Engineer', 'Mobile Money', 'RCP-2013.pdf', 'Approved'),
      ($5, $2, 'PRJ-003', '2026-04-18', 'Accommodation', 'Field lodging for survey team', 420000, 'Accountant', 'Bank Transfer', 'RCP-2014.pdf', 'Flagged')
      `,
      [makeId("EXP"), companyId, makeId("EXP"), makeId("EXP"), makeId("EXP")],
    );

    await db.query(
      `
      INSERT INTO engicost.client_payments (
        id, company_id, project_id, client_name, payment_type, milestone,
        amount_expected, amount_received, payment_date, payment_method, reference_number, status
      ) VALUES
      ($1, $2, 'PRJ-001', 'Dodoma Municipal Council', 'Milestone', 'Excavation Phase', 24000000, 20000000, '2026-04-16', 'Bank Transfer', 'DMC-MP-4411', 'Partial'),
      ($3, $2, 'PRJ-002', 'Kilimanjaro Holdings Ltd', 'Stage', 'Roofing Stage', 15000000, 15000000, '2026-04-15', 'Bank Transfer', 'KHL-ST-2088', 'Received'),
      ($4, $2, 'PRJ-003', 'Lake Zone Engineering Co.', 'Advance', 'Initial Mobilization', 30000000, 20000000, '2026-04-10', 'Cheque', 'LZE-AD-1188', 'Partial'),
      ($5, $2, 'PRJ-004', 'Southern Contractors Ltd', 'Milestone', 'Survey & Marking', 18000000, 0, '2026-04-08', 'Bank Transfer', 'SCL-MP-8883', 'Pending')
      `,
      [makeId("PAY"), companyId, makeId("PAY"), makeId("PAY"), makeId("PAY")],
    );

    await db.query(
      `
      INSERT INTO engicost.material_requirements (
        id, company_id, project_id, material_name, required_quantity, unit, estimated_unit_cost, priority, needed_by_date
      ) VALUES
      ('REQ-001', $1, 'PRJ-001', 'Cement', 1500, 'Bags', 17500, 'High', '2026-05-10'),
      ('REQ-002', $1, 'PRJ-002', 'Steel bars', 900, 'Pieces', 28000, 'Medium', '2026-05-15'),
      ('REQ-003', $1, 'PRJ-004', 'PVC pipes', 400, 'Lengths', 52000, 'High', '2026-05-20'),
      ('REQ-004', $1, 'PRJ-003', 'Fuel', 1200, 'Litres', 3450, 'Medium', '2026-05-05')
      `,
      [companyId],
    );

    await db.query(
      `
      INSERT INTO engicost.material_purchases (
        id, company_id, project_id, requirement_id, material_name, quantity_purchased,
        supplier_name, unit_cost, total_cost, purchase_date, delivery_note_number, delivery_status, receipt_ref
      ) VALUES
      ($1, $2, 'PRJ-001', 'REQ-001', 'Cement', 1200, 'Mkombozi Building Supplies', 17500, 21000000, '2026-04-18', 'DN-001', 'Partially Delivered', 'MAT-RCP-001'),
      ($3, $2, 'PRJ-002', 'REQ-002', 'Steel bars', 900, 'Arusha Steel Centre', 28000, 25200000, '2026-04-12', 'DN-002', 'Delivered', 'MAT-RCP-002'),
      ($4, $2, 'PRJ-004', 'REQ-003', 'PVC pipes', 150, 'SCL Infrastructure Depot', 52000, 7800000, '2026-04-16', 'DN-003', 'Pending Delivery', 'MAT-RCP-003'),
      ($5, $2, 'PRJ-003', 'REQ-004', 'Fuel', 800, 'Lake Petroleum', 3450, 2760000, '2026-04-11', 'DN-004', 'Partially Delivered', 'MAT-RCP-004')
      `,
      [makeId("PUR"), companyId, makeId("PUR"), makeId("PUR"), makeId("PUR")],
    );

    await db.query(
      `
      INSERT INTO engicost.documents (
        id, company_id, project_id, category, document_name, file_type, file_size, file_reference, uploaded_by, notes
      ) VALUES
      ($1, $2, 'PRJ-001', 'Contracts', 'Dodoma Contract Signed.pdf', 'PDF', '2.1 MB', '/docs/dodoma-contract.pdf', 'Admin', 'Signed copy'),
      ($3, $2, 'PRJ-002', 'BOQ Documents', 'Arusha BOQ Rev2.xlsx', 'XLSX', '986 KB', '/docs/arusha-boq-rev2.xlsx', 'Engineer', 'Latest approved boq'),
      ($4, $2, 'PRJ-004', 'Receipts', 'Fuel Receipts Week15.zip', 'ZIP', '8.4 MB', '/docs/fuel-receipts-week15.zip', 'Site Supervisor', 'Weekly fuel receipts'),
      ($5, $2, 'PRJ-003', 'Drawings', 'Mwanza Drawing Set A.dwg', 'DWG', '6.2 MB', '/docs/mwanza-drawing-set-a.dwg', 'Project Manager', 'Design drawings')
      `,
      [makeId("DOC"), companyId, makeId("DOC"), makeId("DOC"), makeId("DOC")],
    );

    await db.query(
      `
      INSERT INTO engicost.notifications (
        id, company_id, project_id, alert_type, title, description, priority
      ) VALUES
      ($1, $2, 'PRJ-001', 'Overspending', 'Overspending Alert', 'Fuel and transport expenses are 12% above plan.', 'High'),
      ($3, $2, 'PRJ-004', 'Client Payment', 'Pending Client Payment', 'Milestone payment overdue by 6 days.', 'High'),
      ($4, $2, 'PRJ-002', 'Labor', 'Outstanding Labor Payment', 'Finishing crew wages pending approval.', 'Medium'),
      ($5, $2, 'PRJ-003', 'Material', 'Pending Material Delivery', 'Electrical cables PO is still in transit.', 'Medium'),
      ($6, $2, 'PRJ-001', 'Document', 'Missing Document Reminder', 'Upload signed delivery note for batch CMT-1102.', 'Low')
      `,
      [makeId("NT"), companyId, makeId("NT"), makeId("NT"), makeId("NT"), makeId("NT")],
    );

    await db.query(
      `
      INSERT INTO engicost.activity_logs (
        id, company_id, actor_name, action, module, project_id, description, ip_device
      ) VALUES
      ($1, $2, 'Rehema Sululu', 'Recorded Client Payment', 'Payments', 'PRJ-001', 'Accountant recorded TZS 5,000,000 client payment', '102.45.11.90 / Chrome - Windows'),
      ($3, $2, 'Salum Nundu', 'Added Material Purchase', 'Materials', 'PRJ-002', 'Store Keeper added cement purchase', '102.45.21.44 / Android App'),
      ($4, $2, 'John Msuya', 'Uploaded Receipt', 'Documents', 'PRJ-004', 'Site Supervisor uploaded fuel receipt', '102.45.100.10 / Safari - iOS'),
      ($5, $2, 'Faraja Nyerere', 'Edited Project Budget', 'Projects', 'PRJ-003', 'Admin edited project budget', '102.45.10.81 / Firefox - Windows')
      `,
      [makeId("ACT"), companyId, makeId("ACT"), makeId("ACT"), makeId("ACT")],
    );
  }

  await db.query(
    `
    UPDATE engicost.users
    SET assigned_projects = COALESCE(assigned_projects, '')
    WHERE company_id = $1
    `,
    [companyId],
  );

  const usersCount = await db.query<{ count: string }>(
    `
    SELECT COUNT(*)::text AS count
    FROM engicost.users
    WHERE company_id = $1
    `,
    [companyId],
  );
  if (Number(usersCount.rows[0]?.count ?? 0) < 4) {
    await db.query(
      `
      INSERT INTO engicost.users (company_id, full_name, email, phone, role, status, assigned_projects)
      VALUES
      ($1, 'John Msuya', 'john.m@engicost.co.tz', '+255 766 101 778', 'Engineer / Project Manager', 'Active', 'PRJ-001,PRJ-004'),
      ($1, 'Rehema Sululu', 'rehema.s@engicost.co.tz', '+255 713 220 007', 'Accountant', 'Active', 'PRJ-001,PRJ-002,PRJ-003,PRJ-004'),
      ($1, 'Salum Nundu', 'salum.n@engicost.co.tz', '+255 752 600 220', 'Store Keeper', 'Invited', 'PRJ-002,PRJ-003')
      ON CONFLICT (email) DO NOTHING
      `,
      [companyId],
    );
  }

  const existingSuppliers = await db.query(
    "SELECT id FROM engicost.suppliers WHERE company_id = $1 LIMIT 1",
    [companyId],
  );
  if (existingSuppliers.rowCount === 0) {
    await db.query(
      `
      INSERT INTO engicost.suppliers (
        id, company_id, name, contact_person, phone, email, location, material_categories,
        total_purchases, outstanding_balance, status, notes
      ) VALUES
      ('SUP-001', $1, 'Mkombozi Building Supplies', 'Neema Macha', '+255 745 661 332', 'sales@mkombozi.co.tz', 'Dodoma', 'Cement, Sand, Aggregates', 38500000, 5800000, 'Active', 'Preferred supplier for cement and aggregates'),
      ('SUP-002', $1, 'Arusha Steel Centre', 'Gilbert Lema', '+255 763 223 992', 'orders@arusha-steel.co.tz', 'Arusha', 'Steel bars, Cables', 22300000, 0, 'Active', 'Primary steel supplier'),
      ('SUP-003', $1, 'Lake Petroleum', 'Amina Salim', '+255 712 201 118', 'support@lakepetroleum.co.tz', 'Mwanza', 'Fuel, Lubricants', 17200000, 3450000, 'Pending', 'Pending reconciliation for April deliveries')
      `,
      [companyId],
    );
  }

  const existingEquipment = await db.query(
    "SELECT id FROM engicost.equipment_usage WHERE company_id = $1 LIMIT 1",
    [companyId],
  );
  if (existingEquipment.rowCount === 0) {
    await db.query(
      `
      INSERT INTO engicost.equipment_usage (
        id, company_id, project_id, equipment_name, equipment_type, ownership_type, owner_name,
        start_date, end_date, usage_days, daily_rate, rental_cost, maintenance_cost, total_cost, status, maintenance_notes
      ) VALUES
      ('EQ-001', $1, 'PRJ-001', 'JCB 3DX', 'Backhoe Loader', 'Rented', 'BuildFleet Ltd', '2026-04-10', '2026-04-26', 16, 300000, 4800000, 320000, 5120000, 'In Use', 'Hydraulic hose replaced on day 8'),
      ('EQ-002', $1, 'PRJ-002', 'Concrete Mixer 400L', 'Mixer', 'Owned', 'Nexivo Company Limited', '2026-04-02', '2026-04-30', 28, 0, 0, 190000, 190000, 'In Use', 'Routine lubrication completed'),
      ('EQ-003', $1, 'PRJ-004', 'Toyota Hilux T920', 'Transport Vehicle', 'Rented', 'SCL Transport', '2026-04-15', '2026-05-12', 27, 77777.78, 2100000, 0, 2100000, 'Idle', 'Standby transport for field logistics')
      `,
      [companyId],
    );
  }

  const existingPettyCash = await db.query(
    "SELECT id FROM engicost.petty_cash_transactions WHERE company_id = $1 LIMIT 1",
    [companyId],
  );
  if (existingPettyCash.rowCount === 0) {
    await db.query(
      `
      INSERT INTO engicost.petty_cash_transactions (
        id, company_id, project_id, transaction_date, transaction_type, description,
        amount, recorded_by, receipt_ref, status, notes
      ) VALUES
      ('PC-001', $1, 'PRJ-001', '2026-04-18', 'Cash Out', 'Small tool replacement', 150000, 'Store Keeper', 'PC-RCP-101', 'Reconciled', 'Approved by site supervisor'),
      ('PC-002', $1, 'PRJ-002', '2026-04-19', 'Cash Out', 'Fuel top-up for generator', 220000, 'Site Supervisor', 'PC-RCP-102', 'Pending', 'Awaiting receipt attachment'),
      ('PC-003', $1, NULL, '2026-04-21', 'Cash In', 'Petty cash replenishment', 500000, 'Accountant', 'PC-BNK-201', 'Reconciled', 'Bank transfer replenishment')
      `,
      [companyId],
    );
  }
};

export const getSingleTenantCompanyId = async (): Promise<number> => {
  const result = await db.query<{ id: number }>(
    "SELECT id FROM engicost.companies ORDER BY id ASC LIMIT 1",
  );

  if (result.rowCount === 0) {
    throw new Error("Company profile is not initialized.");
  }

  return result.rows[0].id;
};

