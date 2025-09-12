// controllers/Inventario/bodegas.controller.js
import pool from "../../config/connectionToSql.js";

// Utilidad común para FK de ciudades
async function cityExists(id_ciudad) {
    if (id_ciudad === undefined || id_ciudad === null) return true; // opcional
    const [rows] = await pool.query("SELECT 1 FROM ciudades WHERE id = ? LIMIT 1", [id_ciudad]);
    return rows.length > 0;
}

// (opcional) Evitar duplicados por nombre + ciudad (no hay UNIQUE, lo controlamos por app)
async function bodegaExistsByNameAndCity(nombre, id_ciudad, excludeId = null) {
    let sql = "SELECT id FROM bodegas WHERE nombre = ? AND ";
    const params = [nombre];

    if (id_ciudad === null || id_ciudad === undefined) {
        sql += "id_ciudad IS NULL";
    } else {
        sql += "id_ciudad = ?";
        params.push(id_ciudad);
    }

    if (excludeId) {
        sql += " AND id <> ?";
        params.push(excludeId);
    }

    const [rows] = await pool.query(sql, params);
    return rows.length > 0;
}

// ==============================
// Listar todas las bodegas
// ==============================
export const getBodegas = async (_req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT b.id, b.nombre, b.descripcion, b.id_ciudad, ci.nombre AS ciudad
       FROM bodegas b
       LEFT JOIN ciudades ci ON b.id_ciudad = ci.id
       ORDER BY b.nombre ASC`
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ==============================
// Obtener bodega por ID
// ==============================
export const getBodegaById = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            `SELECT b.id, b.nombre, b.descripcion, b.id_ciudad, ci.nombre AS ciudad
       FROM bodegas b
       LEFT JOIN ciudades ci ON b.id_ciudad = ci.id
       WHERE b.id = ?`,
            [id]
        );
        if (rows.length === 0) return res.status(404).json({ message: "Bodega no encontrada" });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ==============================
// Crear bodega
// ==============================
export const createBodega = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { nombre, descripcion = null, id_ciudad = null } = req.body;

        // Validar FK ciudad
        if (!(await cityExists(id_ciudad))) {
            connection.release();
            return res.status(400).json({ message: "La ciudad especificada no existe (id_ciudad inválido)." });
        }

        // Regla de negocio: evitar duplicados por (nombre, id_ciudad)
        if (await bodegaExistsByNameAndCity(nombre, id_ciudad)) {
            connection.release();
            return res.status(409).json({ message: "Ya existe una bodega con ese nombre en esa ciudad." });
        }

        const [result] = await connection.query(
            "INSERT INTO bodegas (nombre, descripcion, id_ciudad) VALUES (?, ?, ?)",
            [nombre.trim(), descripcion, id_ciudad]
        );

        const [rows] = await connection.query(
            `SELECT b.id, b.nombre, b.descripcion, b.id_ciudad, ci.nombre AS ciudad
       FROM bodegas b
       LEFT JOIN ciudades ci ON b.id_ciudad = ci.id
       WHERE b.id = ?`,
            [result.insertId]
        );

        res.status(201).json(rows[0]);
    } catch (error) {
        // Si llegara a existir una UNIQUE en DB en el futuro
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Entrada duplicada." });
        }
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
};

// ==============================
// Actualizar bodega (PUT completo)
// ==============================
export const updateBodega = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { id } = req.params;
        const { nombre, descripcion = null, id_ciudad = null } = req.body;

        // Verificar que exista
        const [exists] = await connection.query("SELECT id FROM bodegas WHERE id = ?", [id]);
        if (exists.length === 0) {
            connection.release();
            return res.status(404).json({ message: "Bodega no encontrada" });
        }

        // Validar FK ciudad
        if (!(await cityExists(id_ciudad))) {
            connection.release();
            return res.status(400).json({ message: "La ciudad especificada no existe (id_ciudad inválido)." });
        }

        // Evitar duplicados por (nombre, id_ciudad)
        if (await bodegaExistsByNameAndCity(nombre, id_ciudad, id)) {
            connection.release();
            return res.status(409).json({ message: "Ya existe una bodega con ese nombre en esa ciudad." });
        }

        const [result] = await connection.query(
            "UPDATE bodegas SET nombre = ?, descripcion = ?, id_ciudad = ? WHERE id = ?",
            [nombre.trim(), descripcion, id_ciudad, id]
        );

        if (result.affectedRows === 0) {
            connection.release();
            return res.status(404).json({ message: "Bodega no encontrada" });
        }

        const [rows] = await connection.query(
            `SELECT b.id, b.nombre, b.descripcion, b.id_ciudad, ci.nombre AS ciudad
       FROM bodegas b
       LEFT JOIN ciudades ci ON b.id_ciudad = ci.id
       WHERE b.id = ?`,
            [id]
        );

        res.json(rows[0]);
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Entrada duplicada." });
        }
        // FKs rotas (por si se quita el chequeo anterior)
        if (error.code === "ER_NO_REFERENCED_ROW_2" || error.code === "ER_ROW_IS_REFERENCED_2") {
            return res.status(400).json({ message: "FK inválida (id_ciudad no existe)." });
        }
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
};
