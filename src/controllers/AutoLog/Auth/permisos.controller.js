import pool from "../../../config/connectionToSql.js";

export const getUsers = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "CALL gestion_usuarios('ListarUsuariosActivos', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)"
    );
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Asignar permisos a un usuario
export const asignarPermisos = async (req, res) => {
  const { id_usuario, permisos } = req.body;

  if (!Array.isArray(permisos)) {
    return res
      .status(400)
      .json({ error: "La lista de permisos debe ser un arreglo." });
  }

  try {
    await pool.query("DELETE FROM usuario_permisos WHERE id_usuario = ?", [
      id_usuario,
    ]);

    if (permisos.length === 0) {
      return res.json({
        mensaje: "Permisos actualizados correctamente (vacío).",
      });
    }

    // Obtener los IDs de todos los permisos enviados
    const [rows] = await pool.query(
      `SELECT id, nombre FROM permisos WHERE nombre IN (?)`,
      [permisos]
    );

    // Armar valores para inserción masiva
    const valores = rows.map((permiso) => [id_usuario, permiso.id]);

    if (valores.length > 0) {
      await pool.query(
        "INSERT INTO usuario_permisos (id_usuario, permiso_id) VALUES ?",
        [valores]
      );
    }

    res.json({ mensaje: "Permisos actualizados correctamente." });
  } catch (error) {
    console.error("Error al actualizar permisos:", error);
    res.status(500).json({ error: "Error al actualizar permisos." });
  }
};

export const obtenerPermisosUsuario = async (req, res) => {
  const { id } = req.params;

  try {
    const [permisosAsignados] = await pool.query(
      `SELECT permiso_id FROM usuario_permisos WHERE id_usuario = ?`,
      [id]
    );
    const permisosAsignadosIds = new Set(
      permisosAsignados.map((p) => p.permiso_id)
    );

    const [todosLosPermisos] = await pool.query(
      `SELECT id, nombre, grupo, descripcion FROM permisos`
    );

    const agrupados = {};

    for (const permiso of todosLosPermisos) {
      const grupo = permiso.grupo || "Sin grupo";
      if (!agrupados[grupo]) agrupados[grupo] = [];

      agrupados[grupo].push({
        id: permiso.id,
        nombre: permiso.nombre,
        asignado: permisosAsignadosIds.has(permiso.id),
        descripcion: permiso.descripcion,
      });
    }

    res.json({
      usuario: parseInt(id),
      permisos: agrupados,
    });
  } catch (error) {
    console.error("Error al obtener permisos:", error);
    res.status(500).json({ error: "Error al obtener permisos del usuario." });
  }
};
