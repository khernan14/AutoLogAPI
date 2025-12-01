import pool from "../../../config/connectionToSql.js";

export const getUsers = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "CALL gestion_usuarios('ListarUsuariosActivos', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)"
    );
    return res.json(rows[0]);
  } catch (error) {
    console.error("getUsers error:", error);
    return res.status(500).json({ error: error.message });
  }
};

// Asignar permisos a un usuario
export const asignarPermisos = async (req, res) => {
  const { id_usuario, permisos } = req.body ?? {};

  if (!id_usuario || Number.isNaN(Number(id_usuario))) {
    return res
      .status(400)
      .json({ error: "id_usuario es requerido y debe ser numérico." });
  }

  if (!Array.isArray(permisos)) {
    return res
      .status(400)
      .json({ error: "La lista de permisos debe ser un arreglo." });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) Eliminar permisos existentes del usuario
    await conn.query("DELETE FROM usuario_permisos WHERE id_usuario = ?", [
      id_usuario,
    ]);

    // 2) Si no hay permisos nuevos, sólo commit y seguir
    if (permisos.length > 0) {
      // Obtener los IDs de todos los permisos enviados (evita inserción de nombres no existentes)
      const [rows] = await conn.query(
        `SELECT id, nombre FROM permisos WHERE nombre IN (?)`,
        [permisos]
      );

      // Armar valores para inserción masiva: [ [id_usuario, permiso_id], ... ]
      const valores = rows.map((permiso) => [id_usuario, permiso.id]);

      if (valores.length > 0) {
        await conn.query(
          "INSERT INTO usuario_permisos (id_usuario, permiso_id) VALUES ?",
          [valores]
        );
      }
      // Si algunos permisos enviados no existen en tabla 'permisos', quedan ignorados.
    }

    // 3) Incrementar token_version del usuario para invalidar tokens antiguos
    await conn.query(
      "UPDATE usuarios SET token_version = token_version + 1 WHERE id_usuario = ?",
      [id_usuario]
    );

    // 4) Obtener token_version actualizado para devolverlo en la respuesta
    const [uRows] = await conn.query(
      "SELECT token_version FROM usuarios WHERE id_usuario = ?",
      [id_usuario]
    );
    const tokenVersion = uRows?.[0]?.token_version ?? null;

    await conn.commit();

    return res.json({
      mensaje: "Permisos actualizados correctamente.",
      tokenVersion,
    });
  } catch (error) {
    await conn.rollback();
    console.error("Error al actualizar permisos:", error);
    return res.status(500).json({ error: "Error al actualizar permisos." });
  } finally {
    conn.release();
  }
};

export const obtenerPermisosUsuario = async (req, res) => {
  const { id } = req.params;

  if (!id || Number.isNaN(Number(id))) {
    return res.status(400).json({ error: "ID inválido." });
  }

  try {
    const [permisosAsignados] = await pool.execute(
      `SELECT permiso_id FROM usuario_permisos WHERE id_usuario = ?`,
      [id]
    );
    const permisosAsignadosIds = new Set(
      permisosAsignados.map((p) => p.permiso_id)
    );

    const [todosLosPermisos] = await pool.execute(
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

    return res.json({
      usuario: parseInt(id, 10),
      permisos: agrupados,
    });
  } catch (error) {
    console.error("Error al obtener permisos:", error);
    return res
      .status(500)
      .json({ error: "Error al obtener permisos del usuario." });
  }
};
