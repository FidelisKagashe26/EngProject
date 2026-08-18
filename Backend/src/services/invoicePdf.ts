import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

/** First existing logo, checked in order: uploaded brand logo, then the app logo. */
const resolveLogoPath = (): string | null => {
  const candidates = [
    path.resolve(process.cwd(), "uploads", "brand", "logo.png"),
    path.resolve(process.cwd(), "uploads", "brand", "logo.jpg"),
    path.resolve(process.cwd(), "uploads", "brand", "logo.jpeg"),
    path.resolve(process.cwd(), "..", "Frontend", "public", "EngLogo.png"),
    path.resolve(process.cwd(), "..", "Frontend", "dist", "EngLogo.png"),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // ignore unreadable candidate
    }
  }
  return null;
};

/** The invoice shape the route hands us (already mapped for the API). */
type InvoiceData = {
  type: string;
  number: string;
  projectName: string;
  clientName: string;
  clientAddress: string;
  clientContact: string;
  clientTin: string;
  issueDate: string;
  dueDate: string | null;
  currency: string;
  subtotal: number;
  discountAmount: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  amountPaid: number;
  balance: number;
  notes: string;
  terms: string;
  items: Array<{
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    amount: number;
  }>;
};

type CompanyData = {
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  tin: string;
  vrn: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_branch: string;
  bank_swift: string;
};

const NAVY = "#0b2a53";
const INK = "#1a1a1a";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";
const MARGIN = 48;

const money = (currency: string, value: number): string =>
  `${currency} ${Math.round(value).toLocaleString("en-TZ")}`;

const formatDate = (iso: string | null): string => {
  if (!iso) return "-";
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
};

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

const threeDigitsToWords = (n: number): string => {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)]);
    n %= 10;
  }
  if (n > 0) parts.push(ONES[n]);
  return parts.join(" ").trim();
};

/** "1,230,000" -> "One Million Two Hundred Thirty Thousand". */
const numberToWords = (value: number): string => {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return "Zero";
  const scales = ["", "Thousand", "Million", "Billion", "Trillion"];
  const groups: number[] = [];
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }
  const words: string[] = [];
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    if (groups[i] === 0) continue;
    words.push(`${threeDigitsToWords(groups[i])}${scales[i] ? ` ${scales[i]}` : ""}`);
  }
  return words.join(" ").trim();
};

export const renderInvoicePdf = (
  invoice: InvoiceData,
  company: CompanyData,
): Promise<{ filename: string; data: Buffer }> =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: MARGIN });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on("end", () => {
      const token = invoice.number.replace(/[^A-Za-z0-9-]+/g, "-");
      resolve({ filename: `${token}.pdf`, data: Buffer.concat(chunks) });
    });
    doc.on("error", reject);

    const pageWidth = doc.page.width;
    const left = MARGIN;
    const right = pageWidth - MARGIN;
    const contentWidth = right - left;
    const title = invoice.type === "Proforma" ? "PROFORMA INVOICE" : "INVOICE";

    try {
      // ── Title (left) + logo/company name (right) ──
      doc.font("Helvetica-Bold").fontSize(24).fillColor(NAVY).text(title, left, MARGIN);

      const logoPath = resolveLogoPath();
      let headerBottom = MARGIN + 30;
      if (logoPath) {
        try {
          const logoWidth = 120;
          doc.image(logoPath, right - logoWidth, MARGIN - 4, { fit: [logoWidth, 46], align: "right" });
          headerBottom = Math.max(headerBottom, MARGIN + 46);
        } catch {
          doc
            .font("Helvetica-Bold")
            .fontSize(13)
            .fillColor(INK)
            .text(company.name || "Company", left, MARGIN, { width: contentWidth, align: "right" });
        }
      } else {
        doc
          .font("Helvetica-Bold")
          .fontSize(13)
          .fillColor(INK)
          .text(company.name || "Company", left, MARGIN, { width: contentWidth, align: "right" });
      }

      let y = Math.max(MARGIN + 40, headerBottom + 8);

      // ── Meta (number / dates) ──
      const metaLabel = (label: string, value: string, top: number) => {
        doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED).text(label, left, top);
        doc.font("Helvetica").fontSize(10).fillColor(INK).text(value, left + 90, top);
      };
      metaLabel("Invoice number", invoice.number, y);
      metaLabel("Date of issue", formatDate(invoice.issueDate), y + 15);
      if (invoice.dueDate) metaLabel("Date due", formatDate(invoice.dueDate), y + 30);

      // ── From / Bill To ──
      const colY = y + 58;
      const colWidth = (contentWidth - 24) / 2;
      const fromLines = [
        company.location || "",
        company.email ? `Email: ${company.email}` : "",
        company.phone ? `Phone: ${company.phone}` : "",
        company.tin ? `TIN: ${company.tin}` : "",
        company.vrn ? `VRN: ${company.vrn}` : "",
      ].filter(Boolean);
      const billLines = [
        invoice.clientAddress || "",
        invoice.clientContact || "",
        invoice.clientTin ? `TIN: ${invoice.clientTin}` : "",
        invoice.projectName ? `Project: ${invoice.projectName}` : "",
      ].filter(Boolean);

      doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED).text("FROM", left, colY);
      doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED).text("BILL TO", left + colWidth + 24, colY);
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(INK)
        .text(company.name || "Company", left, colY + 13, { width: colWidth });
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(INK)
        .text(invoice.clientName, left + colWidth + 24, colY + 13, { width: colWidth });
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(MUTED)
        .text(fromLines.join("\n"), left, colY + 28, { width: colWidth, lineGap: 2 });
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(MUTED)
        .text(billLines.join("\n"), left + colWidth + 24, colY + 28, { width: colWidth, lineGap: 2 });

      // ── Headline amount ──
      const bandY = Math.max(doc.y, colY + 28) + 24;
      const headlineAmount = invoice.type === "Proforma" ? invoice.total : invoice.balance;
      const headlineLabel = invoice.type === "Proforma" ? "Total payable" : "Amount due";
      doc
        .font("Helvetica-Bold")
        .fontSize(17)
        .fillColor(NAVY)
        .text(
          `${money(invoice.currency, headlineAmount)} ${headlineLabel.toLowerCase()}${
            invoice.dueDate ? ` by ${formatDate(invoice.dueDate)}` : ""
          }`,
          left,
          bandY,
          { width: contentWidth },
        );

      // ── Items table: Item Description | Qty | Unit Rate | Amount ──
      let ty = doc.y + 18;
      const wDesc = contentWidth * 0.46;
      const wQty = contentWidth * 0.14;
      const wRate = contentWidth * 0.2;
      const wTotal = contentWidth * 0.2;
      const xDesc = left;
      const xQty = xDesc + wDesc;
      const xRate = xQty + wQty;
      const xTotal = xRate + wRate;

      doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED);
      doc.text("ITEM DESCRIPTION", xDesc, ty, { width: wDesc });
      doc.text("QTY", xQty, ty, { width: wQty, align: "right" });
      doc.text("UNIT RATE", xRate, ty, { width: wRate, align: "right" });
      doc.text("AMOUNT", xTotal, ty, { width: wTotal, align: "right" });
      ty += 14;
      doc.moveTo(left, ty).lineTo(right, ty).strokeColor(LINE).lineWidth(1).stroke();
      ty += 8;

      const ensureRoom = (needed: number) => {
        if (ty + needed > doc.page.height - MARGIN - 40) {
          doc.addPage();
          ty = MARGIN;
        }
      };

      for (const item of invoice.items) {
        const descHeight = doc
          .font("Helvetica")
          .fontSize(10)
          .heightOfString(item.description || "-", { width: wDesc - 6 });
        ensureRoom(descHeight + 8);
        const rowTop = ty;
        doc.font("Helvetica").fontSize(10).fillColor(INK).text(item.description || "-", xDesc, rowTop, {
          width: wDesc - 6,
        });
        doc.fillColor(MUTED).text(String(item.quantity), xQty, rowTop, { width: wQty, align: "right" });
        doc.text(money(invoice.currency, item.unitPrice), xRate, rowTop, { width: wRate, align: "right" });
        doc
          .fillColor(INK)
          .text(money(invoice.currency, item.amount), xTotal, rowTop, { width: wTotal, align: "right" });
        ty = Math.max(rowTop + descHeight, doc.y) + 8;
      }

      doc.moveTo(left, ty).lineTo(right, ty).strokeColor(LINE).lineWidth(1).stroke();
      ty += 12;

      // ── Totals (right aligned) ──
      const totalsLeft = left + contentWidth * 0.55;
      const totalsValRight = right;
      const totalRow = (label: string, value: string, bold = false) => {
        ensureRoom(18);
        doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 11 : 10);
        doc.fillColor(bold ? INK : MUTED).text(label, totalsLeft, ty, { width: contentWidth * 0.2 });
        doc
          .fillColor(bold ? NAVY : INK)
          .text(value, totalsLeft + contentWidth * 0.2, ty, {
            width: totalsValRight - (totalsLeft + contentWidth * 0.2),
            align: "right",
          });
        ty += bold ? 20 : 16;
      };

      totalRow("Subtotal", money(invoice.currency, invoice.subtotal));
      if (invoice.discountAmount > 0) totalRow("Discount", `- ${money(invoice.currency, invoice.discountAmount)}`);
      if (invoice.vatRate > 0) totalRow(`VAT (${invoice.vatRate}%)`, money(invoice.currency, invoice.vatAmount));
      totalRow("Total", money(invoice.currency, invoice.total), true);
      if (invoice.amountPaid > 0) {
        totalRow("Amount paid", `- ${money(invoice.currency, invoice.amountPaid)}`);
        totalRow("Balance due", money(invoice.currency, invoice.balance), true);
      }

      // ── Amount in words ──
      ensureRoom(30);
      ty += 6;
      doc
        .font("Helvetica-Oblique")
        .fontSize(9.5)
        .fillColor(MUTED)
        .text(
          `Amount in words: ${invoice.currency} ${numberToWords(invoice.total)} only.`,
          left,
          ty,
          { width: contentWidth },
        );
      ty = doc.y + 14;

      // ── Bank details ──
      const bankLines = [
        company.bank_name ? `Bank: ${company.bank_name}` : "",
        company.bank_account_name ? `Account name: ${company.bank_account_name}` : "",
        company.bank_account_number ? `Account number: ${company.bank_account_number}` : "",
        company.bank_branch ? `Branch: ${company.bank_branch}` : "",
        company.bank_swift ? `SWIFT: ${company.bank_swift}` : "",
      ].filter(Boolean);
      if (bankLines.length > 0) {
        ensureRoom(20 + bankLines.length * 12);
        doc.font("Helvetica-Bold").fontSize(9).fillColor(NAVY).text("PAYMENT DETAILS", left, ty);
        ty += 13;
        doc.font("Helvetica").fontSize(9.5).fillColor(INK).text(bankLines.join("\n"), left, ty, { lineGap: 2 });
        ty = doc.y + 12;
      }

      // ── Terms / notes ──
      for (const [label, text] of [
        ["PAYMENT TERMS", invoice.terms],
        ["NOTES", invoice.notes],
      ] as const) {
        if (text && text.trim()) {
          ensureRoom(28);
          doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED).text(label, left, ty);
          ty += 12;
          doc.font("Helvetica").fontSize(9.5).fillColor(INK).text(text.trim(), left, ty, {
            width: contentWidth,
            lineGap: 2,
          });
          ty = doc.y + 10;
        }
      }

      // ── Footer ──
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(MUTED)
        .text(
          invoice.type === "Proforma"
            ? "This is a proforma invoice and is not a tax document."
            : "Thank you for your business.",
          left,
          doc.page.height - MARGIN - 14,
          { width: contentWidth, align: "center" },
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
