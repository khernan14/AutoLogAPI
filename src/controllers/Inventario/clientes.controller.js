import pool from "../../config/connectionToSql.js";

// Helper para guardar imagen en tabla `images`
async function saveImage(file, conn) {
  if (!file) return null;
  const baseUrl =
    process.env.HOST?.replace(/\/$/, "") || "http://localhost:3000";
  const url = `${baseUrl}/uploads/registros/${file.filename}`;

  const [imageResult] = await conn.query(
    "INSERT INTO images (type, url) VALUES (?, ?)",
    [file.mimetype, url]
  );

  return imageResult.insertId;
}

// Obtener todos los clientes
export const getClientes = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.*, img.url AS logo_url
      FROM clientes c
      LEFT JOIN images img ON c.logo_image_id = img.id_image
    `);
    res.json(rows);
  } catch (error) {
    console.error("❌ Error en getClientes:", error);
    res.status(500).json({ error: error.message });
  }
};

// Obtener un cliente por ID
export const getClienteById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT c.*, img.url AS logo_url
       FROM clientes c
       LEFT JOIN images img ON c.logo_image_id = img.id_image
       WHERE c.id = ?`,
      [id]
    );
    if (rows.length === 0)
      return res.status(404).json({ message: "Cliente no encontrado" });
    res.json(rows[0]);
  } catch (error) {
    console.error("❌ Error en getClienteById:", error);
    res.status(500).json({ error: error.message });
  }
};

// Crear cliente
export const createCliente = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { codigo, nombre, descripcion, estatus } = req.body;
    const file = req.file;

    await conn.beginTransaction();

    let logo_image_id = null;
    if (file) {
      logo_image_id = await saveImage(file, conn);
    }

    const [result] = await conn.query(
      "INSERT INTO clientes (codigo, nombre, descripcion, estatus, logo_image_id) VALUES (?, ?, ?, ?, ?)",
      [codigo, nombre, descripcion || null, estatus || "Activo", logo_image_id]
    );

    await conn.commit();

    res.status(201).json({
      id: result.insertId,
      codigo,
      nombre,
      descripcion,
      estatus,
      logo_image_id,
    });
  } catch (error) {
    await conn.rollback();
    if (error.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ message: "El código ya existe, ingrese uno diferente." });
    }
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
};

// Actualizar cliente
export const updateCliente = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const { codigo, nombre, descripcion, estatus } = req.body;
    const file = req.file;

    await conn.beginTransaction();

    let logo_image_id = null;
    if (file) {
      logo_image_id = await saveImage(file, conn);
    }

    const [result] = await conn.query(
      `UPDATE clientes 
       SET codigo=?, nombre=?, descripcion=?, estatus=?, logo_image_id = COALESCE(?, logo_image_id)
       WHERE id=?`,
      [
        codigo,
        nombre,
        descripcion || null,
        estatus || "Activo",
        logo_image_id,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    await conn.commit();

    res.json({
      message: "Cliente actualizado correctamente",
      logo_image_id,
    });
  } catch (err) {
    let msg = err.message;
    if (msg.includes("Duplicate entry") && msg.includes("codigo")) {
      msg = "El código ya existe, por favor usa otro.";
    }
    setSnackbar({ open: true, message: msg, color: "danger" });
  } finally {
    conn.release();
  }
};
