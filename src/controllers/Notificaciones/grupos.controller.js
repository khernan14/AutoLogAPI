import pool from "../../config/connectionToSql.js";

// Helpers
function toInt(v, d = 0) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
}
function bool(v) {
  return v === true || v === 1 || v === "1" || v === "true";
}

// ===== Grupos =====
export const listGrupos = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 50, activo } = req.query;
    const p = [];
    let where = "1=1";
    if (search) {
      where += " AND g.nombre LIKE ?";
      p.push(`%${search}%`);
    }
    if (typeof activo !== "undefined") {
      where += " AND g.activo = ?";
      p.push(bool(activo) ? 1 : 0);
    }

    const offset = (toInt(page, 1) - 1) * toInt(limit, 50);

    const [rows] = await pool.query(
      `SELECT g.id, g.nombre, g.descripcion, g.activo, g.created_at,
              (SELECT COUNT(*) FROM grupo_notificacion_usuarios u WHERE u.grupo_id = g.id) AS miembros
       FROM grupo_notificacion g
       WHERE ${where}
       ORDER BY g.nombre ASC
       LIMIT ? OFFSET ?`,
      [...p, toInt(limit, 50), offset]
    );

    const [[{ total } = { total: 0 }]] = await pool.query(
      `SELECT COUNT(*) total FROM grupo_notificacion g WHERE ${where}`,
      p
    );

    res.json({ page: toInt(page, 1), limit: toInt(limit, 50), total, rows });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const createGrupo = async (req, res) => {
  try {
    const { nombre, descripcion = "", activo = true } = req.body || {};
    if (!nombre?.trim())
      return res.status(400).json({ message: "nombre es requerido" });

    const [ins] = await pool.query(
      "INSERT INTO grupo_notificacion (nombre, descripcion, activo) VALUES (?, ?, ?)",
      [nombre.trim(), descripcion, bool(activo) ? 1 : 0]
    );
    const [[row]] = await pool.query(
      "SELECT * FROM grupo_notificacion WHERE id=?",
      [ins.insertId]
    );
    res.status(201).json(row);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const getGrupo = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const [[row]] = await pool.query(
      "SELECT * FROM grupo_notificacion WHERE id=?",
      [id]
    );
    if (!row) return res.status(404).json({ message: "Grupo no encontrado" });
    res.json(row);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const updateGrupo = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const { nombre, descripcion, activo } = req.body || {};
    const [[exists]] = await pool.query(
      "SELECT id FROM grupo_notificacion WHERE id=?",
      [id]
    );
    if (!exists)
      return res.status(404).json({ message: "Grupo no encontrado" });

    await pool.query(
      "UPDATE grupo_notificacion SET nombre=COALESCE(?, nombre), descripcion=COALESCE(?, descripcion), activo=COALESCE(?, activo) WHERE id=?",
      [
        nombre ?? null,
        descripcion ?? null,
        typeof activo === "undefined" ? null : bool(activo) ? 1 : 0,
        id,
      ]
    );
    const [[row]] = await pool.query(
      "SELECT * FROM grupo_notificacion WHERE id=?",
      [id]
    );
    res.json(row);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const deleteGrupo = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    // Soft delete: activo = 0
    await pool.query("UPDATE grupo_notificacion SET activo=0 WHERE id=?", [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ===== Miembros =====
export const listMiembros = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const { page = 1, limit = 50 } = req.query;
    const offset = (toInt(page, 1) - 1) * toInt(limit, 50);

    const [rows] = await pool.query(
      ` SELECT 
            gu.id, 
            gu.id_usuario, 
            u.nombre, 
            u.email,
            u.username   -- <-- agrega esto
        FROM grupo_notificacion_usuarios gu
        JOIN usuarios u ON u.id_usuario = gu.id_usuario
        WHERE gu.grupo_id = ?
        ORDER BY u.nombre
        LIMIT ? OFFSET ?
        `,
      [id, toInt(limit, 50), offset]
    );

    const [[{ total } = { total: 0 }]] = await pool.query(
      "SELECT COUNT(*) total FROM grupo_notificacion_usuarios WHERE grupo_id=?",
      [id]
    );

    res.json({ page: toInt(page), limit: toInt(limit), total, rows });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const addMiembros = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const { ids_usuario = [] } = req.body || {};
    const ids = (Array.isArray(ids_usuario) ? ids_usuario : [])
      .map((n) => toInt(n))
      .filter(Boolean);
    if (!ids.length)
      return res.status(400).json({ message: "ids_usuario requerido" });

    // evita duplicados existentes
    const [exist] = await pool.query(
      "SELECT id_usuario FROM grupo_notificacion_usuarios WHERE grupo_id=? AND id_usuario IN (?)",
      [id, ids]
    );
    const existsSet = new Set(exist.map((r) => r.id_usuario));
    const toInsert = ids.filter((x) => !existsSet.has(x));
    if (toInsert.length) {
      const values = toInsert.map((uid) => [id, uid]);
      await pool.query(
        "INSERT INTO grupo_notificacion_usuarios (grupo_id, id_usuario) VALUES ?",
        [values]
      );
    }
    res
      .status(201)
      .json({ added: toInsert.length, skipped: ids.length - toInsert.length });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const removeMiembro = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const id_usuario = toInt(req.params.id_usuario);
    await pool.query(
      "DELETE FROM grupo_notificacion_usuarios WHERE grupo_id=? AND id_usuario=?",
      [id, id_usuario]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ===== Canales =====
export const getCanales = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const [rows] = await pool.query(
      "SELECT canal, habilitado, severidad_min, quiet_inicio, quiet_fin FROM grupo_canales WHERE grupo_id=?",
      [id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const saveCanales = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const { canales = [] } = req.body || {};
    // Estrategia simple: reemplazar por completo
    await pool.query("DELETE FROM grupo_canales WHERE grupo_id=?", [id]);

    if (Array.isArray(canales) && canales.length) {
      const vals = canales.map((c) => [
        id,
        c.canal || "email",
        bool(c.habilitado) ? 1 : 0,
        c.severidad_min || "low",
        c.quiet_inicio || null,
        c.quiet_fin || null,
      ]);
      await pool.query(
        "INSERT INTO grupo_canales (grupo_id, canal, habilitado, severidad_min, quiet_inicio, quiet_fin) VALUES ?",
        [vals]
      );
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
