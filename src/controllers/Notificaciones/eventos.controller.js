import pool from "../../config/connectionToSql.js";

const SEVERIDADES = new Set(["low", "medium", "high", "critical"]);
const toInt = (v, d = 0) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
};
const bool = (v) => v === true || v === 1 || v === "1" || v === "true";

// ======= LISTAR =======
export const listEventos = async (req, res) => {
  try {
    const { search = "", activo, page = 1, limit = 50 } = req.query;
    const p = [];
    let where = "1=1";
    if (search) {
      where += " AND (e.clave LIKE ? OR e.nombre LIKE ?)";
      p.push(`%${search}%`, `%${search}%`);
    }
    if (typeof activo !== "undefined") {
      where += " AND e.activo = ?";
      p.push(bool(activo) ? 1 : 0);
    }

    const offset = (toInt(page, 1) - 1) * toInt(limit, 50);

    const [rows] = await pool.query(
      `SELECT
         e.id, e.clave, e.nombre, e.descripcion, e.severidad_def, e.activo, e.created_at,
         (SELECT COUNT(*) FROM eventos_grupos eg WHERE eg.evento_id = e.id AND eg.activo=1) AS grupos_asignados
       FROM eventos_catalogo e
       WHERE ${where}
       ORDER BY e.clave ASC
       LIMIT ? OFFSET ?`,
      [...p, toInt(limit, 50), offset]
    );

    const [[{ total } = { total: 0 }]] = await pool.query(
      `SELECT COUNT(*) total FROM eventos_catalogo e WHERE ${where}`,
      p
    );

    res.json({ page: toInt(page, 1), limit: toInt(limit, 50), total, rows });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ======= CREAR =======
export const createEvento = async (req, res) => {
  try {
    let {
      clave,
      nombre,
      descripcion = "",
      severidad_def = "medium",
      activo = 0,
    } = req.body || {};
    if (!clave?.trim() || !nombre?.trim()) {
      return res.status(400).json({ message: "clave y nombre son requeridos" });
    }
    clave = String(clave).trim().toUpperCase();
    if (!SEVERIDADES.has(severidad_def)) severidad_def = "medium";

    const [ins] = await pool.query(
      `INSERT INTO eventos_catalogo (clave, nombre, descripcion, severidad_def, activo)
       VALUES (?, ?, ?, ?, ?)`,
      [clave, nombre.trim(), descripcion, severidad_def, bool(activo) ? 1 : 0]
    );

    const [[row]] = await pool.query(
      "SELECT * FROM eventos_catalogo WHERE id=?",
      [ins.insertId]
    );
    res.status(201).json(row);
  } catch (e) {
    // Duplicado de clave
    if (e?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "La clave de evento ya existe" });
    }
    res.status(500).json({ message: e.message });
  }
};

// ======= DETALLE =======
export const getEvento = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const [[row]] = await pool.query(
      "SELECT * FROM eventos_catalogo WHERE id=?",
      [id]
    );
    if (!row) return res.status(404).json({ message: "Evento no encontrado" });
    res.json(row);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ======= EDITAR =======
export const updateEvento = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const { clave, nombre, descripcion, severidad_def, activo } =
      req.body || {};

    const [[exists]] = await pool.query(
      "SELECT * FROM eventos_catalogo WHERE id=?",
      [id]
    );
    if (!exists)
      return res.status(404).json({ message: "Evento no encontrado" });

    // Normalizar valores
    let newClave =
      typeof clave === "string" ? clave.trim().toUpperCase() : null;
    let newSev = typeof severidad_def === "string" ? severidad_def : null;
    if (newSev && !SEVERIDADES.has(newSev)) newSev = null;

    // Si cambia la clave, verificar que no exista
    if (newClave && newClave !== exists.clave) {
      const [[dup]] = await pool.query(
        "SELECT id FROM eventos_catalogo WHERE clave=? LIMIT 1",
        [newClave]
      );
      if (dup)
        return res
          .status(409)
          .json({ message: "La clave de evento ya existe" });
    }

    await pool.query(
      `UPDATE eventos_catalogo
       SET
         clave = COALESCE(?, clave),
         nombre = COALESCE(?, nombre),
         descripcion = COALESCE(?, descripcion),
         severidad_def = COALESCE(?, severidad_def),
         activo = COALESCE(?, activo)
       WHERE id = ?`,
      [
        newClave,
        typeof nombre === "string" ? nombre : null,
        typeof descripcion === "string" ? descripcion : null,
        newSev,
        typeof activo === "undefined" ? null : bool(activo) ? 1 : 0,
        id,
      ]
    );

    const [[row]] = await pool.query(
      "SELECT * FROM eventos_catalogo WHERE id=?",
      [id]
    );
    res.json(row);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ======= ELIMINAR (soft) =======
export const deleteEvento = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    await pool.query("UPDATE eventos_catalogo SET activo=0 WHERE id=?", [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ======= TOGGLE ESTADO =======
export const setEventoEstado = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const { activo } = req.body || {};
    await pool.query("UPDATE eventos_catalogo SET activo=? WHERE id=?", [
      bool(activo) ? 1 : 0,
      id,
    ]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ======= LISTAR GRUPOS DEL EVENTO =======
export const getEventoGrupos = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const [rows] = await pool.query(
      `SELECT g.id, g.nombre, g.descripcion, g.activo, eg.obligatorio, eg.activo AS asignacion_activa
       FROM eventos_grupos eg
       JOIN grupo_notificacion g ON g.id = eg.grupo_id
       WHERE eg.evento_id = ?
       ORDER BY g.nombre ASC`,
      [id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ======= ASIGNAR GRUPOS (reemplazo completo) =======
export const setEventoGrupos = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const id = toInt(req.params.id);
    const { grupos = [] } = req.body || {};
    // grupos: number[] o [{id: number, obligatorio?: boolean}]
    const parsed = (Array.isArray(grupos) ? grupos : [])
      .map((g) => {
        if (typeof g === "number") return { id: toInt(g), obligatorio: 1 };
        return { id: toInt(g?.id), obligatorio: g?.obligatorio ? 1 : 1 }; // por defecto 1
      })
      .filter((g) => g.id);

    await conn.beginTransaction();

    // limpiar existentes
    await conn.query("DELETE FROM eventos_grupos WHERE evento_id=?", [id]);

    if (parsed.length) {
      const values = parsed.map((g) => [id, g.id, g.obligatorio, 1]); // activo=1
      await conn.query(
        "INSERT INTO eventos_grupos (evento_id, grupo_id, obligatorio, activo) VALUES ?",
        [values]
      );
    }

    await conn.commit();
    res.json({ ok: true, assigned: parsed.length });
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    res.status(500).json({ message: e.message });
  } finally {
    conn.release();
  }
};
