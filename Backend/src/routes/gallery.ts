import { Router } from "express";
import { getSingleTenantCompanyId } from "../db/init";
import { makeId } from "../db/ids";
import { db } from "../db/pool";
import { handleAsync } from "./utils";

const router = Router();

type GalleryRow = {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  image_url: string;
  sort_order: number;
  is_visible: boolean;
  created_at: string;
};

const mapRow = (row: GalleryRow) => ({
  id: row.id,
  title: row.title,
  subtitle: row.subtitle,
  category: row.category,
  imageUrl: row.image_url,
  sortOrder: row.sort_order,
  isVisible: row.is_visible,
  createdAt: row.created_at,
});

// GET /gallery — all visible items + distinct categories (admin sees all)
router.get(
  "/",
  handleAsync(async (_req, res) => {
    const companyId = await getSingleTenantCompanyId();

    const items = await db.query<GalleryRow>(
      `SELECT id, title, subtitle, category, image_url, sort_order, is_visible, created_at::text
       FROM engicost.gallery_items
       WHERE company_id = $1
       ORDER BY sort_order ASC, created_at DESC`,
      [companyId],
    );

    const categories = [...new Set(items.rows.map((r) => r.category))].sort();

    res.json({
      items: items.rows.map(mapRow),
      categories,
    });
  }),
);

// POST /gallery — create item
router.post(
  "/",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const { title, subtitle, category, imageUrl, sortOrder, isVisible } = req.body as {
      title?: string;
      subtitle?: string;
      category?: string;
      imageUrl?: string;
      sortOrder?: number;
      isVisible?: boolean;
    };

    if (!title || title.trim().length < 2) {
      res.status(400).json({ message: "Title is required." });
      return;
    }
    if (!imageUrl || imageUrl.trim().length < 5) {
      res.status(400).json({ message: "Image URL is required." });
      return;
    }

    const id = makeId("GAL");
    const result = await db.query<GalleryRow>(
      `INSERT INTO engicost.gallery_items
         (id, company_id, title, subtitle, category, image_url, sort_order, is_visible)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, title, subtitle, category, image_url, sort_order, is_visible, created_at::text`,
      [
        id,
        companyId,
        title.trim(),
        (subtitle ?? "").trim(),
        (category ?? "General").trim(),
        imageUrl.trim(),
        sortOrder ?? 0,
        isVisible ?? true,
      ],
    );

    res.status(201).json(mapRow(result.rows[0]));
  }),
);

// PUT /gallery/:id — update item
router.put(
  "/:id",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const id = String(req.params.id);
    const { title, subtitle, category, imageUrl, sortOrder, isVisible } = req.body as {
      title?: string;
      subtitle?: string;
      category?: string;
      imageUrl?: string;
      sortOrder?: number;
      isVisible?: boolean;
    };

    const result = await db.query<GalleryRow>(
      `UPDATE engicost.gallery_items
       SET
         title      = COALESCE($3, title),
         subtitle   = COALESCE($4, subtitle),
         category   = COALESCE($5, category),
         image_url  = COALESCE($6, image_url),
         sort_order = COALESCE($7, sort_order),
         is_visible = COALESCE($8, is_visible),
         updated_at = NOW()
       WHERE company_id = $1 AND id = $2
       RETURNING id, title, subtitle, category, image_url, sort_order, is_visible, created_at::text`,
      [
        companyId, id,
        title?.trim() ?? null,
        subtitle?.trim() ?? null,
        category?.trim() ?? null,
        imageUrl?.trim() ?? null,
        sortOrder ?? null,
        isVisible ?? null,
      ],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: "Gallery item not found." });
      return;
    }

    res.json(mapRow(result.rows[0]));
  }),
);

// DELETE /gallery/:id
router.delete(
  "/:id",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const id = String(req.params.id);

    const result = await db.query<{ id: string }>(
      `DELETE FROM engicost.gallery_items WHERE company_id = $1 AND id = $2 RETURNING id`,
      [companyId, id],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: "Gallery item not found." });
      return;
    }

    res.json({ message: "Deleted." });
  }),
);

export default router;
