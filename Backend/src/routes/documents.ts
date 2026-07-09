import { Router } from "express";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { getSingleTenantCompanyId } from "../db/init";
import { makeId } from "../db/ids";
import { db } from "../db/pool";
import { requireSuperAdmin } from "../middleware/auth";
import { handleAsync } from "./utils";

const router = Router();

const documentSchema = z.object({
  projectId: z.string().min(3),
  category: z.string().min(2),
  documentName: z.string().min(2),
  fileType: z.string().optional().default(""),
  fileSize: z.string().optional().default(""),
  fileReference: z.string().optional().default(""),
  uploadedBy: z.string().min(2),
  notes: z.string().optional().default(""),
});

router.get(
  "/",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const projectId =
      typeof req.query.projectId === "string" && req.query.projectId.trim().length >= 3
        ? req.query.projectId.trim()
        : null;

    const whereClauses = ['d.company_id = $1', 'd.project_id IS NOT NULL', 'd.is_deleted = FALSE'];
    const params: Array<number | string> = [companyId];
    if (projectId) {
      params.push(projectId);
      whereClauses.push(`d.project_id = $${params.length}`);
    }

    const result = await db.query<{
      id: string;
      project_id: string | null;
      project_name: string | null;
      category: string;
      document_name: string;
      file_type: string | null;
      file_size: string | null;
      file_reference: string | null;
      uploaded_by: string;
      notes: string | null;
      created_at: string;
    }>(
      `
      SELECT
        d.id,
        d.project_id,
        p.name AS project_name,
        d.category,
        d.document_name,
        d.file_type,
        d.file_size,
        d.file_reference,
        d.uploaded_by,
        d.notes,
        d.created_at::text
      FROM engicost.documents d
      LEFT JOIN engicost.projects p ON p.id = d.project_id
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY d.created_at DESC
      `,
      params,
    );

    res.json(
      result.rows.map((row) => ({
        id: row.id,
        projectId: row.project_id,
        projectName: row.project_name ?? "Unknown Project",
        category: row.category,
        documentName: row.document_name,
        fileType: row.file_type ?? "",
        fileSize: row.file_size ?? "",
        fileReference: row.file_reference ?? "",
        uploadedBy: row.uploaded_by,
        notes: row.notes ?? "",
        createdAt: row.created_at,
      })),
    );
  }),
);

router.post(
  "/",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const parsed = documentSchema.parse(req.body);

    const projectExists = await db.query<{ id: string }>(
      `
      SELECT id
      FROM engicost.projects
      WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
      LIMIT 1
      `,
      [companyId, parsed.projectId],
    );

    if (projectExists.rowCount === 0) {
      res.status(400).json({ message: "Project not found for this document." });
      return;
    }

    const inserted = await db.query(
      `
      INSERT INTO engicost.documents (
        id, company_id, project_id, category, document_name, file_type, file_size,
        file_reference, uploaded_by, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10
      )
      RETURNING
        id,
        project_id,
        category,
        document_name,
        file_type,
        file_size,
        file_reference,
        uploaded_by,
        notes,
        created_at::text
      `,
      [
        makeId("DOC"),
        companyId,
        parsed.projectId,
        parsed.category,
        parsed.documentName,
        parsed.fileType,
        parsed.fileSize,
        parsed.fileReference,
        parsed.uploadedBy,
        parsed.notes,
      ],
    );

    const row = inserted.rows[0];
    res.status(201).json({
      id: row.id,
      projectId: row.project_id,
      category: row.category,
      documentName: row.document_name,
      fileType: row.file_type ?? "",
      fileSize: row.file_size ?? "",
      fileReference: row.file_reference ?? "",
      uploadedBy: row.uploaded_by,
      notes: row.notes ?? "",
      createdAt: row.created_at,
    });
  }),
);

router.delete(
  "/:id",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const deleted = await db.query<{ id: string }>(
      'UPDATE engicost.documents SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = $3, updated_at = NOW() WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE RETURNING id',
      [companyId, req.params.id, req.authUser?.fullName ?? 'System Admin'],
    );

    if (deleted.rowCount === 0) {
      res.status(404).json({ message: "Document not found." });
      return;
    }

    res.json({ message: "Document deleted successfully." });
  }),
);


router.patch(
  '/:id/restore',
  requireSuperAdmin,
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const restored = await db.query<{ id: string }>(
      'UPDATE engicost.documents SET is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL, updated_at = NOW() WHERE company_id = $1 AND id = $2 AND is_deleted = TRUE RETURNING id',
      [companyId, req.params.id],
    );

    if (restored.rowCount === 0) {
      res.status(404).json({ message: 'Deleted document not found.' });
      return;
    }

    res.json({ message: 'Document restored successfully.' });
  }),
);
export default router;

