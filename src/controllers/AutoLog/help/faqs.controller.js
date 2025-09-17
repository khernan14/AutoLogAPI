import pool from "../../../config/connectionToSql.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { getPagination } from "../../../utils/pagination.js";
import { slugify } from "../../../utils/slug.js";

/** Público: listar FAQs */
export const listFaqs = asyncHandler(async (req, res) => {
  const { q, category, visibility = "public", isActive } = req.query;
  const { limit, offset } = getPagination(req, { defaultLimit: 20 });

  const where = [];
  const params = [];

  if (visibility) {
    where.push("visibility = ?");
    params.push(visibility);
  }
  if (typeof isActive !== "undefined") {
    where.push("isActive = ?");
    params.push(Number(isActive) ? 1 : 0);
  }
  if (category) {
    where.push("category = ?");
    params.push(category);
  }
  if (q) {
    where.push("(question LIKE ? OR answer LIKE ? OR tags LIKE ?)");
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM faqs ${whereSql}`,
    params
  );
  const [rows] = await pool.query(
    `SELECT * FROM faqs ${whereSql} ORDER BY \`order\` ASC, id ASC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  res.set("Cache-Control", "public, max-age=60");
  res.json({ total, pageSize: limit, items: rows });
});

/** Público: obtener FAQ por slug */
export const getFaqBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const [[row]] = await pool.query(
    "SELECT * FROM faqs WHERE slug = ? LIMIT 1",
    [slug]
  );
  if (!row) return res.status(404).json({ message: "FAQ no encontrada" });
  res.set("Cache-Control", "public, max-age=300");
  res.json(row);
});

// utils local para normalizar tags a JSON string
function normalizeTagsToJson(tags) {
  if (tags == null || tags === "") return null;
  if (Array.isArray(tags)) {
    return JSON.stringify(tags.map((t) => String(t).trim()).filter(Boolean));
  }
  const s = String(tags).trim();
  if (!s) return null;
  // si ya viene en JSON lo respetamos
  if (s.startsWith("[") || s.startsWith("{")) {
    try {
      const j = JSON.parse(s);
      return JSON.stringify(
        Array.isArray(j) ? j.map((t) => String(t).trim()).filter(Boolean) : []
      );
    } catch {
      // cae a CSV
    }
  }
  // CSV -> JSON
  const arr = s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return JSON.stringify(arr);
}

/** Admin: crear FAQ */
export const createFaq = asyncHandler(async (req, res) => {
  const {
    question,
    answer,
    category,
    visibility = "public",
    tags = null,
    order = 0,
    isActive = 1,
    owner_user_id = null,
    slug,
  } = req.body;

  if (!question || !answer || !category) {
    return res
      .status(400)
      .json({ message: "Campos obligatorios: question, answer, category" });
  }

  const finalSlug = slug?.trim() || slugify(question);
  const [dup] = await pool.query("SELECT id FROM faqs WHERE slug = ? LIMIT 1", [
    finalSlug,
  ]);
  if (dup.length) return res.status(409).json({ message: "Slug ya existe" });

  const tagsJson = normalizeTagsToJson(tags);

  const [result] = await pool.query(
    `INSERT INTO faqs (slug, question, answer, category, visibility, tags, \`order\`, isActive, owner_user_id)
     VALUES (?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?)`,
    [
      finalSlug,
      question,
      answer,
      category,
      visibility,
      tagsJson,
      order,
      isActive ? 1 : 0,
      owner_user_id,
    ]
  );

  const [[row]] = await pool.query("SELECT * FROM faqs WHERE id = ?", [
    result.insertId,
  ]);
  res.status(201).json(row);
});

/** Admin: actualizar FAQ */
export const updateFaq = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    question,
    answer,
    category,
    visibility,
    tags,
    order,
    isActive,
    owner_user_id,
    slug,
  } = req.body;

  const [[exists]] = await pool.query(
    "SELECT * FROM faqs WHERE id = ? LIMIT 1",
    [id]
  );
  if (!exists) return res.status(404).json({ message: "FAQ no encontrada" });

  const nextSlug =
    slug?.trim() || exists.slug || (question ? slugify(question) : null);

  if (nextSlug && nextSlug !== exists.slug) {
    const [dup] = await pool.query(
      "SELECT id FROM faqs WHERE slug = ? AND id <> ? LIMIT 1",
      [nextSlug, id]
    );
    if (dup.length) return res.status(409).json({ message: "Slug ya existe" });
  }

  const tagsJson =
    typeof tags === "undefined" ? undefined : normalizeTagsToJson(tags);

  // Nota: para `tags`, si viene undefined NO lo tocamos; si viene null borramos; si viene array/string lo guardamos
  await pool.query(
    `UPDATE faqs SET
      slug = COALESCE(?, slug),
      question = COALESCE(?, question),
      answer = COALESCE(?, answer),
      category = COALESCE(?, category),
      visibility = COALESCE(?, visibility),
      tags = CASE
        WHEN ? IS NULL THEN NULL
        WHEN ? IS NOT NULL THEN CAST(? AS JSON)
        ELSE tags
      END,
      \`order\` = COALESCE(?, \`order\`),
      isActive = COALESCE(?, isActive),
      owner_user_id = COALESCE(?, owner_user_id),
      updatedAt = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      nextSlug,
      question,
      answer,
      category,
      visibility,
      tags === null ? null : 0, // disparador de set a NULL
      typeof tags !== "undefined" ? 1 : null, // disparador de set a JSON
      tagsJson, // valor JSON
      order,
      typeof isActive === "undefined" ? null : isActive ? 1 : 0,
      owner_user_id,
      id,
    ]
  );

  const [[row]] = await pool.query("SELECT * FROM faqs WHERE id = ?", [id]);
  res.json(row);
});

/** Admin: eliminar FAQ */
export const deleteFaq = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [result] = await pool.query("DELETE FROM faqs WHERE id = ?", [id]);
  if (!result.affectedRows)
    return res.status(404).json({ message: "FAQ no encontrada" });
  res.status(204).end();
});

/** Público: voto de utilidad (incremental) */
export const voteFaqHelpful = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { up = true } = req.body;

  const field = up ? "helpful_up" : "helpful_down";
  const [result] = await pool.query(
    `UPDATE faqs SET ${field} = ${field} + 1 WHERE id = ?`,
    [id]
  );
  if (!result.affectedRows)
    return res.status(404).json({ message: "FAQ no encontrada" });

  const [[row]] = await pool.query(
    "SELECT helpful_up, helpful_down FROM faqs WHERE id = ?",
    [id]
  );
  res.json(row);
});
