import pool from "../../config/connectionToSql.js";

export const getAdendas = async (_req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT ad.*, co.codigo AS contrato_codigo, c.nombre AS cliente_nombre
       FROM adendas ad
       JOIN contratos co ON ad.id_contrato = co.id
       JOIN clientes c  ON co.id_cliente = c.id
       ORDER BY ad.fecha_inicio DESC, ad.id DESC`
        );
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

export const getAdendaById = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            `SELECT ad.*, co.codigo AS contrato_codigo, c.nombre AS cliente_nombre
       FROM adendas ad
       JOIN contratos co ON ad.id_contrato = co.id
       JOIN clientes c  ON co.id_cliente = c.id
       WHERE ad.id = ?`, [id]
        );
        if (!rows.length) return res.status(404).json({ message: "Adenda no encontrada" });
        res.json(rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

export const getAdendasByContrato = async (req, res) => {
    try {
        const { id_contrato } = req.params;
        const [rows] = await pool.query(
            `SELECT ad.* FROM adendas ad WHERE ad.id_contrato = ? ORDER BY ad.fecha_inicio DESC`, [id_contrato]
        );
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

export const createAdenda = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { id_contrato, codigo, descripcion = null, fecha_inicio, fecha_fin = null, estatus = "Activo" } = req.body;

        const [co] = await conn.query("SELECT id FROM contratos WHERE id = ? LIMIT 1", [id_contrato]);
        if (!co.length) { conn.release(); return res.status(400).json({ message: "id_contrato no existe." }); }

        const [dup] = await conn.query("SELECT id FROM adendas WHERE codigo = ? LIMIT 1", [codigo]);
        if (dup.length) { conn.release(); return res.status(409).json({ message: "El código de adenda ya existe." }); }

        const [ins] = await conn.query(
            `INSERT INTO adendas (id_contrato, codigo, descripcion, fecha_inicio, fecha_fin, estatus)
       VALUES (?, ?, ?, ?, ?, ?)`,
            [id_contrato, codigo.trim(), descripcion, fecha_inicio, fecha_fin, estatus]
        );

        const [row] = await conn.query(`SELECT * FROM adendas WHERE id = ?`, [ins.insertId]);
        res.status(201).json(row[0]);
    } catch (e) {
        if (e.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Entrada duplicada." });
        res.status(500).json({ error: e.message });
    } finally { conn.release(); }
};

export const updateAdenda = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { id } = req.params;
        const { id_contrato, codigo, descripcion = null, fecha_inicio, fecha_fin = null, estatus = "Activo" } = req.body;

        const [exists] = await conn.query("SELECT id FROM adendas WHERE id = ?", [id]);
        if (!exists.length) { conn.release(); return res.status(404).json({ message: "Adenda no encontrada" }); }

        const [co] = await conn.query("SELECT id FROM contratos WHERE id = ? LIMIT 1", [id_contrato]);
        if (!co.length) { conn.release(); return res.status(400).json({ message: "id_contrato no existe." }); }

        const [dup] = await conn.query("SELECT id FROM adendas WHERE codigo = ? AND id <> ? LIMIT 1", [codigo, id]);
        if (dup.length) { conn.release(); return res.status(409).json({ message: "El código de adenda ya existe." }); }

        await conn.query(
            `UPDATE adendas SET id_contrato=?, codigo=?, descripcion=?, fecha_inicio=?, fecha_fin=?, estatus=? WHERE id=?`,
            [id_contrato, codigo.trim(), descripcion, fecha_inicio, fecha_fin, estatus, id]
        );

        const [row] = await conn.query(`SELECT * FROM adendas WHERE id = ?`, [id]);
        res.json(row[0]);
    } catch (e) {
        if (e.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Entrada duplicada." });
        res.status(500).json({ error: e.message });
    } finally { conn.release(); }
};
