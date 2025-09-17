import pool from "../../../config/connectionToSql.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { getPagination } from "../../../utils/pagination.js";
import { slugify } from "../../../utils/slug.js";

/* ========== helpers ========== */

function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// "public"/"internal" o booleans alternativos → string normalizado
function normVisibilityFrom(body = {}, fallback) {
  const lower = (s) => String(s).trim().toLowerCase();

  if ("visibility" in body) {
    const v = body.visibility;
    if (typeof v === "string") {
      const s = lower(v);
      if (s === "public" || s === "internal") return s;
      if (s === "true" || s === "1") return "public";
      if (s === "false" || s === "0") return "internal";
    }
    if (typeof v === "boolean" || typeof v === "number") {
      return v ? "public" : "internal";
    }
  }
  if (typeof body.is_public !== "undefined")
    return body.is_public ? "public" : "internal";
  if (typeof body.isPublic !== "undefined")
    return body.isPublic ? "public" : "internal";
  if (typeof body.public !== "undefined")
    return body.public ? "public" : "internal";
  return fallback;
}

// publishedDate/published_at/published_date o published (bool) → 'YYYY-MM-DD' | null | undefined
// mode: "create" (default a null) o "update" (undefined = no cambia)
function normPublishedDateFrom(body = {}, mode = "update") {
  const hasExplicitDate =
    "publishedDate" in body ||
    "published_at" in body ||
    "published_date" in body;
  const raw = body.publishedDate ?? body.published_at ?? body.published_date;
  let date = toDateOrNull(raw);
  const hasBool = "published" in body;

  if (!hasExplicitDate && hasBool) {
    date = body.published ? todayISO() : null;
  } else if (hasExplicitDate && hasBool && body.published && !date) {
    // Si mandan published=true pero la fecha es vacía/invalid → hoy
    date = todayISO();
  }

  if (!hasExplicitDate && !hasBool) {
    return mode === "create" ? null : undefined; // en update: no tocar
  }
  return date; // puede ser null (despublicar)
}

function toTagArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((t) => String(t).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return [];
    // ¿vino como JSON string?
    if (s.startsWith("[") || s.startsWith("{")) {
      try {
        const j = JSON.parse(s);
        return Array.isArray(j)
          ? j.map((t) => String(t).trim()).filter(Boolean)
          : [];
      } catch {
        // cae a CSV
      }
    }
    // CSV
    return s
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

// undefined -> null (no cambiar en UPDATE), array -> JSON string (incluye "[]")
function jsonOrNullForTags(tags) {
  if (typeof tags === "undefined") return null;
  return JSON.stringify(toTagArray(tags));
}

function toIntOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toDateOrNull(v) {
  if (!v) return null;
  try {
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const d = new Date(v);
    if (isNaN(d)) return null;
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  } catch {
    return null;
  }
}

/** Público: listar tutorials */
export const listTutorials = asyncHandler(async (req, res) => {
  const { q, category, visibility = "public", tag } = req.query;
  const { limit, offset } = getPagination(req, { defaultLimit: 12 });

  const where = [];
  const params = [];

  if (visibility) {
    where.push("visibility = ?");
    params.push(visibility);
  }
  if (category) {
    where.push("category = ?");
    params.push(category);
  }
  if (q) {
    where.push("(title LIKE ? OR description LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }
  if (tag) {
    // Requiere que 'tags' sea columna JSON
    where.push("JSON_SEARCH(tags, 'one', ?) IS NOT NULL");
    params.push(tag);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM tutorials ${whereSql}`,
    params
  );
  const [items] = await pool.query(
    `SELECT id, slug, title, description, imageUrl, videoUrl, category,
          duration_seconds, visibility, tags, publishedDate
     FROM tutorials ${whereSql}
     ORDER BY publishedDate DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  res.set("Cache-Control", "public, max-age=120");
  res.json({ total, pageSize: limit, items });
});

/** Público: detalle tutorial (con pasos y adjuntos) */
export const getTutorialBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const [[t]] = await pool.query(
    "SELECT * FROM tutorials WHERE slug = ? LIMIT 1",
    [slug]
  );
  if (!t) return res.status(404).json({ message: "Tutorial no encontrado" });

  const [steps] = await pool.query(
    "SELECT id, step_no, title, body, imageUrl FROM tutorial_steps WHERE tutorial_id = ? ORDER BY step_no ASC, id ASC",
    [t.id]
  );
  const [attachments] = await pool.query(
    "SELECT id, name, url, mime_type, size_kb FROM tutorial_attachments WHERE tutorial_id = ? ORDER BY id ASC",
    [t.id]
  );

  res.set("Cache-Control", "public, max-age=300");
  res.json({ ...t, steps, attachments });
});

/** Admin: crear tutorial (solo cabecera) */
export const createTutorial = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    videoUrl,
    imageUrl,
    category,
    tags,
    duration_seconds,
    owner_user_id,
    slug,
  } = req.body;

  if (!title || !videoUrl) {
    return res
      .status(400)
      .json({ message: "Campos obligatorios: title, videoUrl" });
  }

  const finalSlug = (slug && slug.trim()) || slugify(title);
  const [dup] = await pool.query(
    "SELECT id FROM tutorials WHERE slug = ? LIMIT 1",
    [finalSlug]
  );
  if (dup.length) return res.status(409).json({ message: "Slug ya existe" });

  const visibility = normVisibilityFrom(req.body, "public");
  const tagsJson = JSON.stringify(toTagArray(tags)); // "[]", "[...]" o "[]"
  const dur = toIntOrNull(duration_seconds); // number o null
  const pubDate = normPublishedDateFrom(req.body, "create"); // 'YYYY-MM-DD' o null

  const [r] = await pool.query(
    `INSERT INTO tutorials
      (slug, title, description, videoUrl, imageUrl, category, visibility, tags, duration_seconds, publishedDate, owner_user_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      finalSlug,
      title,
      description ?? null,
      videoUrl,
      imageUrl ?? null,
      category ?? null,
      visibility ?? "public",
      tagsJson,
      dur,
      pubDate,
      typeof owner_user_id === "undefined" ? null : owner_user_id,
    ]
  );

  const [[row]] = await pool.query("SELECT * FROM tutorials WHERE id = ?", [
    r.insertId,
  ]);
  res.status(201).json(row);
});

/** Admin: actualizar tutorial (cabecera) */
export const updateTutorial = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    title,
    description,
    videoUrl,
    imageUrl,
    category,
    tags,
    duration_seconds,
    owner_user_id,
    slug,
  } = req.body;

  const [[exists]] = await pool.query(
    "SELECT id FROM tutorials WHERE id = ? LIMIT 1",
    [id]
  );
  if (!exists)
    return res.status(404).json({ message: "Tutorial no encontrado" });

  // slug (solo si lo mandan)
  let nextSlug;
  if (typeof slug !== "undefined") {
    const s = (slug || "").trim();
    if (!s) return res.status(400).json({ message: "Slug inválido" });
    nextSlug = slugify(s);
    const [dup] = await pool.query(
      "SELECT id FROM tutorials WHERE slug = ? AND id <> ? LIMIT 1",
      [nextSlug, id]
    );
    if (dup.length) return res.status(409).json({ message: "Slug ya existe" });
  }

  // Normalizaciones
  const vis = normVisibilityFrom(req.body, undefined); // undefined => no tocar
  const pubDate = normPublishedDateFrom(req.body, "update"); // undefined|date|null
  const dur =
    "duration_seconds" in req.body ? toIntOrNull(duration_seconds) : undefined;

  // Build SET dinámico (permite setear NULL cuando aplique)
  const sets = [];
  const params = [];
  const add = (col, val) => {
    sets.push(`${col} = ?`);
    params.push(val);
  };

  if (typeof nextSlug !== "undefined") add("slug", nextSlug);
  if (typeof title !== "undefined") add("title", title);
  if (typeof description !== "undefined") add("description", description);
  if (typeof videoUrl !== "undefined") add("videoUrl", videoUrl);
  if (typeof imageUrl !== "undefined") add("imageUrl", imageUrl);
  if (typeof category !== "undefined") add("category", category);
  if (vis !== undefined) add("visibility", vis);
  if ("tags" in req.body) add("tags", JSON.stringify(toTagArray(tags))); // setea "[]" si vacío
  if (dur !== undefined) add("duration_seconds", dur);
  if (pubDate !== undefined) add("publishedDate", pubDate); // puede ser null (despublicar)
  if ("owner_user_id" in req.body) add("owner_user_id", owner_user_id);

  if (!sets.length)
    return res.status(400).json({ message: "Nada para actualizar" });

  const sql = `UPDATE tutorials SET ${sets.join(
    ", "
  )}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`;
  params.push(id);
  await pool.query(sql, params);

  const [[row]] = await pool.query("SELECT * FROM tutorials WHERE id = ?", [
    id,
  ]);
  res.json(row);
});

/** Admin: eliminar tutorial (y dependientes) */
export const deleteTutorial = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await pool.query("DELETE FROM tutorial_attachments WHERE tutorial_id = ?", [
    id,
  ]);
  await pool.query("DELETE FROM tutorial_steps WHERE tutorial_id = ?", [id]);
  const [r] = await pool.query("DELETE FROM tutorials WHERE id = ?", [id]);
  if (!r.affectedRows)
    return res.status(404).json({ message: "Tutorial no encontrado" });
  res.status(204).end();
});

/** Admin: reemplazar pasos (bulk) */
export const replaceTutorialSteps = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { steps = [] } = req.body;

  const [[exists]] = await pool.query(
    "SELECT id FROM tutorials WHERE id = ? LIMIT 1",
    [id]
  );
  if (!exists)
    return res.status(404).json({ message: "Tutorial no encontrado" });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM tutorial_steps WHERE tutorial_id = ?", [id]);

    if (Array.isArray(steps) && steps.length) {
      const values = steps.map((s) => [
        id,
        Number(s.step_no) || 1,
        s.title || null,
        s.body || null,
        s.imageUrl || null,
      ]);
      await conn.query(
        "INSERT INTO tutorial_steps (tutorial_id, step_no, title, body, imageUrl) VALUES ?",
        [values]
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  const [rows] = await pool.query(
    "SELECT id, step_no, title, body, imageUrl FROM tutorial_steps WHERE tutorial_id = ? ORDER BY step_no ASC, id ASC",
    [id]
  );
  res.json({ tutorial_id: id, steps: rows });
});

/** Admin: reemplazar adjuntos (bulk) */
export const replaceTutorialAttachments = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { attachments = [] } = req.body;

  const [[exists]] = await pool.query(
    "SELECT id FROM tutorials WHERE id = ? LIMIT 1",
    [id]
  );
  if (!exists)
    return res.status(404).json({ message: "Tutorial no encontrado" });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM tutorial_attachments WHERE tutorial_id = ?", [
      id,
    ]);

    if (Array.isArray(attachments) && attachments.length) {
      const values = attachments.map((a) => [
        id,
        a.name || null,
        a.url || null,
        a.mime_type || null,
        toIntOrNull(a.size_kb),
      ]);
      await conn.query(
        "INSERT INTO tutorial_attachments (tutorial_id, name, url, mime_type, size_kb) VALUES ?",
        [values]
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  const [rows] = await pool.query(
    "SELECT id, name, url, mime_type, size_kb FROM tutorial_attachments WHERE tutorial_id = ? ORDER BY id ASC",
    [id]
  );
  res.json({ tutorial_id: id, attachments: rows });
});
