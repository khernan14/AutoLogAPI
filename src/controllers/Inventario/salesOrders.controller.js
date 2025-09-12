import pool from "../../config/connectionToSql.js";

// Listar SOs (con nombre del cliente)
export const getSOs = async (_req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT so.*, c.nombre AS cliente_nombre
       FROM sales_orders so
       JOIN clientes c ON so.id_cliente = c.id
       ORDER BY so.fecha DESC, so.id DESC`
        );
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// Obtener SO por ID
export const getSOById = async (req, res) => {
    try {
        const { id } = req.params;

        const [soRows] = await pool.query(
            `SELECT so.*, c.nombre AS cliente_nombre
       FROM sales_orders so
       JOIN clientes c ON so.id_cliente = c.id
       WHERE so.id = ?`, [id]
        );
        if (!soRows.length) return res.status(404).json({ message: "Sales Order no encontrado" });

        const [lineas] = await pool.query(
            `SELECT soa.*, a.codigo AS activo_codigo, a.nombre AS activo_nombre
       FROM sales_orders_activos soa
       JOIN activos a ON soa.id_activo = a.id
       WHERE soa.id_sales_order = ?
       ORDER BY soa.id DESC`, [id]
        );

        res.json({ ...soRows[0], lineas });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// Crear SO
export const createSO = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { codigo, id_cliente, fecha, descripcion = null, estatus = "Pendiente" } = req.body;

        // valida cliente
        const [cli] = await conn.query("SELECT id FROM clientes WHERE id = ? LIMIT 1", [id_cliente]);
        if (!cli.length) { conn.release(); return res.status(400).json({ message: "id_cliente no existe." }); }

        // codigo único
        const [dup] = await conn.query("SELECT id FROM sales_orders WHERE codigo = ? LIMIT 1", [codigo]);
        if (dup.length) { conn.release(); return res.status(409).json({ message: "El código de SO ya existe." }); }

        const [ins] = await conn.query(
            `INSERT INTO sales_orders (codigo, id_cliente, fecha, descripcion, estatus)
       VALUES (?, ?, ?, ?, ?)`,
            [codigo.trim(), id_cliente, fecha, descripcion, estatus]
        );

        const [row] = await conn.query(
            `SELECT so.*, c.nombre AS cliente_nombre
       FROM sales_orders so
       JOIN clientes c ON so.id_cliente = c.id
       WHERE so.id = ?`, [ins.insertId]
        );
        res.status(201).json(row[0]);
    } catch (e) {
        if (e.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Entrada duplicada." });
        res.status(500).json({ error: e.message });
    } finally { conn.release(); }
};

// Actualizar SO (PUT)
export const updateSO = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { id } = req.params;
        const { codigo, id_cliente, fecha, descripcion = null, estatus = "Pendiente" } = req.body;

        const [exists] = await conn.query("SELECT id FROM sales_orders WHERE id = ?", [id]);
        if (!exists.length) { conn.release(); return res.status(404).json({ message: "Sales Order no encontrado" }); }

        // valida cliente
        const [cli] = await conn.query("SELECT id FROM clientes WHERE id = ? LIMIT 1", [id_cliente]);
        if (!cli.length) { conn.release(); return res.status(400).json({ message: "id_cliente no existe." }); }

        // evitar duplicado
        const [dup] = await conn.query("SELECT id FROM sales_orders WHERE codigo = ? AND id <> ? LIMIT 1", [codigo, id]);
        if (dup.length) { conn.release(); return res.status(409).json({ message: "El código de SO ya existe." }); }

        await conn.query(
            `UPDATE sales_orders SET codigo=?, id_cliente=?, fecha=?, descripcion=?, estatus=? WHERE id=?`,
            [codigo.trim(), id_cliente, fecha, descripcion, estatus, id]
        );

        const [row] = await conn.query(
            `SELECT so.*, c.nombre AS cliente_nombre
       FROM sales_orders so
       JOIN clientes c ON so.id_cliente = c.id
       WHERE so.id = ?`, [id]
        );
        res.json(row[0]);
    } catch (e) {
        if (e.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Entrada duplicada." });
        res.status(500).json({ error: e.message });
    } finally { conn.release(); }
};
