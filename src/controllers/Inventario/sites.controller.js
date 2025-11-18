import pool from "../../config/connectionToSql.js";

// Obtener todos los sites
export const getSites = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT cs.*, c.nombre AS cliente, ci.nombre AS ciudad
       FROM clientes_sites cs
       JOIN clientes c ON cs.id_cliente = c.id
       LEFT JOIN ciudades ci ON cs.id_ciudad = ci.id
       WHERE cs.activo = 1
       ORDER BY cs.nombre`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener sites por cliente
export const getSitesByCliente = async (req, res) => {
  try {
    const { idCliente } = req.params;
    const soloActivos = req.query.soloActivos === "1";

    const [rows] = await pool.query(
      `SELECT cs.*, ci.nombre AS ciudad
       FROM clientes_sites cs
       LEFT JOIN ciudades ci ON cs.id_ciudad = ci.id
       WHERE cs.id_cliente = ?
         ${soloActivos ? "AND cs.activo = 1" : ""}
       ORDER BY cs.nombre`,
      [idCliente]
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener site por ID
export const getSiteById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT cs.*, c.nombre AS cliente, ci.nombre AS ciudad
       FROM clientes_sites cs
       JOIN clientes c ON cs.id_cliente = c.id
       LEFT JOIN ciudades ci ON cs.id_ciudad = ci.id
       WHERE cs.id = ?`,
      [id]
    );
    if (rows.length === 0)
      return res.status(404).json({ message: "Site no encontrado" });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Crear site
export const createSite = async (req, res) => {
  try {
    const { id_cliente, nombre, descripcion, id_ciudad, activo } = req.body;

    const [result] = await pool.query(
      "INSERT INTO clientes_sites (id_cliente, nombre, descripcion, id_ciudad, activo) VALUES (?, ?, ?, ?, ?)",
      [
        id_cliente,
        nombre,
        descripcion || null,
        id_ciudad || null,
        activo ?? 1, // si no mandas nada, queda activo
      ]
    );

    res.json({
      id: result.insertId,
      id_cliente,
      nombre,
      descripcion,
      id_ciudad,
      activo: activo ?? 1,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Actualizar site
export const updateSite = async (req, res) => {
  try {
    const { id } = req.params;
    const { id_cliente, nombre, descripcion, id_ciudad, activo } = req.body;

    const [result] = await pool.query(
      "UPDATE clientes_sites SET id_cliente=?, nombre=?, descripcion=?, id_ciudad=?, activo=? WHERE id=?",
      [
        id_cliente,
        nombre,
        descripcion || null,
        id_ciudad || null,
        activo ?? 1,
        id,
      ]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Site no encontrado" });

    res.json({ message: "Site actualizado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
