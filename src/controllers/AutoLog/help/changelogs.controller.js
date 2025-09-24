import pool from "../../../config/connectionToSql.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { getPagination } from "../../../utils/pagination.js";
import { slugify } from "../../../utils/slug.js";

/** Enums básicos (ajusta a tu negocio) */
const ALLOWED_TYPES = new Set([
  "Added",
  "Changed",
  "Fixed",
  "Removed",
  "Performance",
  "Security",
  "Deprecated",
]);
const ALLOWED_AUDIENCE = new Set(["all", "admins", "customers", "internal"]);

/** Helpers */
const isValidDate = (d) => {
  // admite 'YYYY-MM-DD' o ISO (Date parseable)
  if (!d) return false;
  const dt = new Date(d);
  return !Number.isNaN(dt.getTime());
};

const normalizeRow = (row) => ({
  id: row.id,
  date:
    row.date instanceof Date ? row.date.toISOString().slice(0, 10) : row.date,
  type: row.type,
  title: row.title,
  slug: row.slug,
  description: row.description,
  pinned: row.pinned === 1 || row.pinned === true,
  audience: row.audience,
});

/** Público: listar changelogs */
/** Público: listar changelogs */
export const listChangelogs = asyncHandler(async (req, res) => {
  const { q, type, audience, pinned } = req.query;
  const { limit, offset } = getPagination(req, {
    defaultLimit: 10,
    maxLimit: 50,
  });

  // Validaciones ligeras de filtros
  if (type && !ALLOWED_TYPES.has(type)) {
    return res.status(400).json({ message: "type inválido" });
  }
  if (audience && !ALLOWED_AUDIENCE.has(audience)) {
    return res.status(400).json({ message: "audience inválido" });
  }

  // Permite forzar no-caché desde el admin (query o header)
  const noCache = req.query._ts || req.headers["x-no-cache"];

  const where = [];
  const params = [];
  if (type) {
    where.push("type = ?");
    params.push(type);
  }
  if (audience) {
    where.push("audience = ?");
    params.push(audience);
  }
  if (typeof pinned !== "undefined") {
    where.push("pinned = ?");
    params.push(Number(pinned) ? 1 : 0);
  }
  if (q) {
    where.push("(title LIKE ? OR description LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // Meta para ETag fuerte (cambia si cambia algo del contenido)
  const [[meta]] = await pool.query(
    `
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(pinned), 0) AS pinnedSum,
      UNIX_TIMESTAMP(MAX(COALESCE(updatedAt, date))) AS lastModUnix
    FROM changelogs
    ${whereSql}
    `,
    params
  );
  const total = Number(meta?.total || 0);
  const pinnedSum = Number(meta?.pinnedSum || 0);
  const lastModUnix = Number(meta?.lastModUnix || 0);

  // Items
  const [rawItems] = await pool.query(
    `SELECT id, date, type, title, slug, description, pinned, audience
     FROM changelogs
     ${whereSql}
     ORDER BY date DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const items = rawItems.map(normalizeRow);

  // ETag que considera cambios reales (total + pinnedSum + lastMod + filtros + paginación)
  const etagBase = `cl:${total}:${pinnedSum}:${lastModUnix}:${limit}:${offset}:${
    q || ""
  }:${type || ""}:${audience || ""}:${pinned ?? ""}`;
  const etag = `"${Buffer.from(etagBase).toString("base64")}"`;

  // Si NO pediste no-caché y el ETag coincide, regresamos 304
  if (!noCache && req.headers["if-none-match"] === etag) {
    res.status(304).end();
    return;
  }

  res.set("ETag", etag);

  if (noCache) {
    // El admin puede forzar no usar caché
    res.set("Cache-Control", "no-store");
  } else {
    res.set("Cache-Control", "public, max-age=120, must-revalidate");
  }

  res.json({ total, pageSize: limit, items });
});

/** Público: obtener changelog por slug */
export const getChangelogBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const [[row]] = await pool.query(
    `SELECT id, date, type, title, slug, description, pinned, audience, updatedAt
     FROM changelogs
     WHERE slug = ? LIMIT 1`,
    [slug]
  );
  if (!row) return res.status(404).json({ message: "Changelog no encontrado" });

  // Last-Modified para condicional
  const lastMod = row.updatedAt || row.date;
  if (lastMod) {
    const lm = new Date(lastMod).toUTCString();
    if (
      req.headers["if-modified-since"] &&
      new Date(req.headers["if-modified-since"]).getTime() >=
        new Date(lastMod).getTime()
    ) {
      res.status(304).end();
      return;
    }
    res.set("Last-Modified", lm);
  }
  res.set("Cache-Control", "public, max-age=300");

  const payload = normalizeRow(row);
  res.json(payload);
});

/** Admin: crear changelog */
export const createChangelog = asyncHandler(async (req, res) => {
  let {
    date,
    type,
    title,
    description,
    pinned = 0,
    audience = "all",
    slug,
  } = req.body;

  if (!date || !type || !title) {
    return res
      .status(400)
      .json({ message: "Campos obligatorios: date, type, title" });
  }
  if (!isValidDate(date)) {
    return res.status(400).json({ message: "date inválida" });
  }
  if (!ALLOWED_TYPES.has(type)) {
    return res.status(400).json({ message: "type inválido" });
  }
  if (audience && !ALLOWED_AUDIENCE.has(audience)) {
    return res.status(400).json({ message: "audience inválido" });
  }

  const finalSlug = slug?.trim() || slugify(title);

  // Unicidad de slug
  const [dup] = await pool.query(
    "SELECT id FROM changelogs WHERE slug = ? LIMIT 1",
    [finalSlug]
  );
  if (dup.length) return res.status(409).json({ message: "Slug ya existe" });

  const pinnedValue = pinned ? 1 : 0;

  const [r] = await pool.query(
    `INSERT INTO changelogs (date, type, title, slug, description, pinned, audience)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      date,
      type,
      title,
      finalSlug,
      description || null,
      pinnedValue,
      audience || "all",
    ]
  );

  const [[created]] = await pool.query(
    "SELECT id, date, type, title, slug, description, pinned, audience FROM changelogs WHERE id = ?",
    [r.insertId]
  );

  res.status(201).json(normalizeRow(created));
});

/** Admin: actualizar changelog */
export const updateChangelog = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { date, type, title, description, pinned, audience, slug } = req.body;

  const [[exists]] = await pool.query(
    "SELECT * FROM changelogs WHERE id = ? LIMIT 1",
    [id]
  );
  if (!exists)
    return res.status(404).json({ message: "Changelog no encontrado" });

  // Validaciones suaves (solo si vienen)
  if (date !== undefined && !isValidDate(date)) {
    return res.status(400).json({ message: "date inválida" });
  }
  if (type !== undefined && !ALLOWED_TYPES.has(type)) {
    return res.status(400).json({ message: "type inválido" });
  }
  if (audience !== undefined && !ALLOWED_AUDIENCE.has(audience)) {
    return res.status(400).json({ message: "audience inválido" });
  }

  const nextSlug =
    slug?.trim() || exists.slug || (title ? slugify(title) : null);
  if (nextSlug && nextSlug !== exists.slug) {
    const [dup] = await pool.query(
      "SELECT id FROM changelogs WHERE slug = ? AND id <> ? LIMIT 1",
      [nextSlug, id]
    );
    if (dup.length) return res.status(409).json({ message: "Slug ya existe" });
  }

  const pinnedValue = pinned === undefined ? null : pinned ? 1 : 0;

  await pool.query(
    `UPDATE changelogs SET
      date = COALESCE(?, date),
      type = COALESCE(?, type),
      title = COALESCE(?, title),
      slug = COALESCE(?, slug),
      description = COALESCE(?, description),
      pinned = COALESCE(?, pinned),
      audience = COALESCE(?, audience),
      updatedAt = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      date ?? null,
      type ?? null,
      title ?? null,
      nextSlug ?? null,
      description ?? null,
      pinnedValue,
      audience ?? null,
      id,
    ]
  );

  const [[row]] = await pool.query(
    "SELECT id, date, type, title, slug, description, pinned, audience FROM changelogs WHERE id = ?",
    [id]
  );

  res.json(normalizeRow(row));
});

/** Admin: eliminar changelog */
export const deleteChangelog = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [r] = await pool.query("DELETE FROM changelogs WHERE id = ?", [id]);
  if (!r.affectedRows)
    return res.status(404).json({ message: "Changelog no encontrado" });
  res.status(204).end();
});

export const getPinnedChangelogs = asyncHandler(async (req, res) => {
  const n = parseInt(req.query.limit, 10);
  const limit = Number.isFinite(n) ? Math.min(Math.max(n, 1), 12) : 6;

  // 1) pinned primero
  const [pinned] = await pool.query(
    `SELECT id, slug, title, type, DATE_FORMAT(date, '%Y-%m-%d') AS day
     FROM changelogs
     WHERE pinned = 1
     ORDER BY date DESC
     LIMIT ?`,
    [limit]
  );

  if (pinned.length > 0) {
    return res.json(pinned);
  }

  // 2) fallback: últimas (no pinned)
  const [latest] = await pool.query(
    `SELECT id, slug, title, type, DATE_FORMAT(date, '%Y-%m-%d') AS day
     FROM changelogs
     ORDER BY date DESC
     LIMIT ?`,
    [limit]
  );
  return res.json(latest);
});
