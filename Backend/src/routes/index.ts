import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import documentsRouter from "./documents";
import equipmentRouter from "./equipment";
import expensesRouter from "./expenses";
import materialsRouter from "./materials";
import notificationsRouter from "./notifications";
import paymentsRouter from "./payments";
import pettyCashRouter from "./pettyCash";
import projectsRouter from "./projects";
import galleryRouter from "./gallery";
import uploadRouter from "./upload";
import quoteRequestsRouter from "./quoteRequests";
import reportsRouter from "./reports";
import settingsRouter from "./settings";
import suppliersRouter from "./suppliers";
import tendersRouter from "./tenders";
import usersRouter from "./users";
import websiteSettingsRouter from "./websiteSettings";
import workersRouter from "./workers";
import workOrdersRouter from "./workOrders";
import { sendQuoteNotificationEmail } from "../services/mailer";
import { handleAsync } from "./utils";
import { getSingleTenantCompanyId } from "../db/init";
import { makeId } from "../db/ids";
import { db } from "../db/pool";

const apiRouter = Router();

apiRouter.use("/auth", authRouter);

// ── Public: get website settings (no auth) ──
apiRouter.get(
  "/public/website-settings",
  handleAsync(async (_req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const result = await db.query<{ key: string; value: string }>(
      `SELECT key, value FROM engicost.website_settings WHERE company_id = $1`,
      [companyId],
    );
    const settings: Record<string, string> = {};
    for (const row of result.rows) {
      settings[row.key] = row.value;
    }
    res.json(settings);
  }),
);

// ── Public: get gallery items (no auth) ──
apiRouter.get(
  "/public/gallery",
  handleAsync(async (_req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const items = await db.query<{
      id: string; title: string; subtitle: string;
      category: string; image_url: string; sort_order: number;
    }>(
      `SELECT id, title, subtitle, category, image_url, sort_order
       FROM engicost.gallery_items
       WHERE company_id = $1 AND is_visible = TRUE
       ORDER BY sort_order ASC, created_at DESC`,
      [companyId],
    );
    const categories = ["All", ...new Set(items.rows.map((r) => r.category))].sort((a, b) =>
      a === "All" ? -1 : b === "All" ? 1 : a.localeCompare(b),
    );
    res.json({
      items: items.rows.map((r) => ({
        id: r.id,
        title: r.title,
        subtitle: r.subtitle,
        category: r.category,
        imageUrl: r.image_url,
      })),
      categories,
    });
  }),
);

// ── Public: submit quote request from landing page ──
apiRouter.post(
  "/public/quote-requests",
  handleAsync(async (req, res) => {
    const { fullName, email, phone, service, message } = req.body as {
      fullName?: string;
      email?: string;
      phone?: string;
      service?: string;
      message?: string;
    };

    if (!fullName || fullName.trim().length < 2) {
      res.status(400).json({ message: "Full name is required." });
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      res.status(400).json({ message: "A valid email is required." });
      return;
    }
    if (!message || message.trim().length < 2) {
      res.status(400).json({ message: "Message is required." });
      return;
    }

    const companyId = await getSingleTenantCompanyId();
    const id = makeId("QR");

    await db.query(
      `
      INSERT INTO engicost.quote_requests
        (id, company_id, full_name, email, phone, service, message, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'New')
      `,
      [
        id,
        companyId,
        fullName.trim(),
        email.trim().toLowerCase(),
        (phone ?? "").trim(),
        (service ?? "").trim(),
        message.trim(),
      ],
    );

    // Send notification email to admin (fire-and-forget — don't block response)
    const adminEmailResult = await db.query<{ email: string }>(
      `SELECT email FROM engicost.users WHERE company_id = $1 AND role = 'Admin' AND status = 'Active' ORDER BY id ASC LIMIT 1`,
      [companyId],
    );
    const adminEmail = adminEmailResult.rows[0]?.email;
    if (adminEmail) {
      sendQuoteNotificationEmail({
        to: adminEmail,
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: (phone ?? "").trim(),
        service: (service ?? "").trim(),
        message: message.trim(),
      }).catch(() => { /* silently ignore email errors */ });
    }

    res.status(201).json({ message: "Quote request submitted successfully.", id });
  }),
);

apiRouter.use(authenticateToken);

apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/projects", projectsRouter);
apiRouter.use("/tenders", tendersRouter);
apiRouter.use("/expenses", expensesRouter);
apiRouter.use("/payments", paymentsRouter);
apiRouter.use("/workers", workersRouter);
apiRouter.use("/materials", materialsRouter);
apiRouter.use("/equipment", equipmentRouter);
apiRouter.use("/suppliers", suppliersRouter);
apiRouter.use("/documents", documentsRouter);
apiRouter.use("/settings", settingsRouter);
apiRouter.use("/notifications", notificationsRouter);
apiRouter.use("/petty-cash", pettyCashRouter);
apiRouter.use("/reports", reportsRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/work-orders", workOrdersRouter);
apiRouter.use("/quote-requests", quoteRequestsRouter);
apiRouter.use("/website-settings", websiteSettingsRouter);
apiRouter.use("/gallery", galleryRouter);
apiRouter.use("/upload", uploadRouter);

export default apiRouter;

