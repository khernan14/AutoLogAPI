import pool from "../../config/connectionToSql.js";

export const getDetallesByAdenda = async (req, res) => {
    try {
        const { id_adenda } = req.params;
        const [rows] = await pool.query(`SELECT * FROM detalle_adenda WHERE id_adenda = ?`, [id_adenda]);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

export const createDetalle = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { id_adenda, modelo, precio_arrendamiento, costo_impresion_bn = 0, costo_impresion_color = 0, cantidad } = req.body;

        const [ad] = await conn.query("SELECT id FROM adendas WHERE id = ? LIMIT 1", [id_adenda]);
        if (!ad.length) { conn.release(); return res.status(400).json({ message: "id_adenda no existe." }); }

        const [ins] = await conn.query(
            `INSERT INTO detalle_adenda (id_adenda, modelo, precio_arrendamiento, costo_impresion_bn, costo_impresion_color, cantidad)
       VALUES (?, ?, ?, ?, ?, ?)`,
            [id_adenda, modelo.trim(), precio_arrendamiento, costo_impresion_bn, costo_impresion_color, cantidad]
        );

        const [row] = await conn.query(`SELECT * FROM detalle_adenda WHERE id = ?`, [ins.insertId]);
        res.status(201).json(row[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally { conn.release(); }
};

export const updateDetalle = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { id } = req.params;
        const { id_adenda, modelo, precio_arrendamiento, costo_impresion_bn = 0, costo_impresion_color = 0, cantidad } = req.body;

        const [exists] = await conn.query("SELECT id FROM detalle_adenda WHERE id = ?", [id]);
        if (!exists.length) { conn.release(); return res.status(404).json({ message: "Detalle no encontrado" }); }

        const [ad] = await conn.query("SELECT id FROM adendas WHERE id = ? LIMIT 1", [id_adenda]);
        if (!ad.length) { conn.release(); return res.status(400).json({ message: "id_adenda no existe." }); }

        await conn.query(
            `UPDATE detalle_adenda SET id_adenda=?, modelo=?, precio_arrendamiento=?, costo_impresion_bn=?, costo_impresion_color=?, cantidad=?
       WHERE id=?`,
            [id_adenda, modelo.trim(), precio_arrendamiento, costo_impresion_bn, costo_impresion_color, cantidad, id]
        );

        const [row] = await conn.query(`SELECT * FROM detalle_adenda WHERE id = ?`, [id]);
        res.json(row[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally { conn.release(); }
};
