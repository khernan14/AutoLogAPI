import pool from "../../config/connectionToSql.js";

// Listar contratos (con nombre de cliente)
export const getContratos = async (_req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT co.*, c.nombre AS cliente_nombre
       FROM contratos co
       JOIN clientes c ON co.id_cliente = c.id
       ORDER BY co.fecha_inicio DESC, co.id DESC`
        );
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

export const getContratoById = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            `SELECT co.*, c.nombre AS cliente_nombre
       FROM contratos co
       JOIN clientes c ON co.id_cliente = c.id
       WHERE co.id = ?`,
            [id]
        );
        if (rows.length === 0) return res.status(404).json({ message: "Contrato no encontrado" });
        res.json(rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

export const createContrato = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { id_cliente, codigo, descripcion = null, fecha_inicio, fecha_fin = null, estatus = "Activo" } = req.body;

        // FK cliente existe
        const [cli] = await conn.query("SELECT id FROM clientes WHERE id = ? LIMIT 1", [id_cliente]);
        if (cli.length === 0) { conn.release(); return res.status(400).json({ message: "id_cliente no existe." }); }

        // código único
        const [dup] = await conn.query("SELECT id FROM contratos WHERE codigo = ? LIMIT 1", [codigo]);
        if (dup.length) { conn.release(); return res.status(409).json({ message: "El código de contrato ya existe." }); }

        const [ins] = await conn.query(
            `INSERT INTO contratos (id_cliente, codigo, descripcion, fecha_inicio, fecha_fin, estatus)
       VALUES (?, ?, ?, ?, ?, ?)`,
            [id_cliente, codigo.trim(), descripcion, fecha_inicio, fecha_fin, estatus]
        );

        const [row] = await conn.query(
            `SELECT co.*, c.nombre AS cliente_nombre
       FROM contratos co
       JOIN clientes c ON co.id_cliente = c.id
       WHERE co.id = ?`, [ins.insertId]
        );

        res.status(201).json(row[0]);
    } catch (e) {
        if (e.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Entrada duplicada." });
        res.status(500).json({ error: e.message });
    } finally { conn.release(); }
};

export const updateContrato = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { id } = req.params;
        const { id_cliente, codigo, descripcion = null, fecha_inicio, fecha_fin = null, estatus = "Activo" } = req.body;

        const [exists] = await conn.query("SELECT id FROM contratos WHERE id = ?", [id]);
        if (!exists.length) { conn.release(); return res.status(404).json({ message: "Contrato no encontrado" }); }

        const [cli] = await conn.query("SELECT id FROM clientes WHERE id = ? LIMIT 1", [id_cliente]);
        if (!cli.length) { conn.release(); return res.status(400).json({ message: "id_cliente no existe." }); }

        const [dup] = await conn.query("SELECT id FROM contratos WHERE codigo = ? AND id <> ? LIMIT 1", [codigo, id]);
        if (dup.length) { conn.release(); return res.status(409).json({ message: "El código de contrato ya existe." }); }

        await conn.query(
            `UPDATE contratos SET id_cliente=?, codigo=?, descripcion=?, fecha_inicio=?, fecha_fin=?, estatus=? WHERE id=?`,
            [id_cliente, codigo.trim(), descripcion, fecha_inicio, fecha_fin, estatus, id]
        );

        const [row] = await conn.query(
            `SELECT co.*, c.nombre AS cliente_nombre
       FROM contratos co
       JOIN clientes c ON co.id_cliente = c.id
       WHERE co.id = ?`, [id]
        );
        res.json(row[0]);
    } catch (e) {
        if (e.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Entrada duplicada." });
        res.status(500).json({ error: e.message });
    } finally { conn.release(); }
};
