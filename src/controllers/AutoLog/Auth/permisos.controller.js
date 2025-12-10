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

export const asignarPermisos = async (req, res) => {
  const { id_usuario, permisos } = req.body ?? {};

  console.log("👉 Payload recibido:", {
    id_usuario,
    cantidadPermisos: permisos?.length,
  });

  if (!id_usuario) {
    return res.status(400).json({ error: "Falta id_usuario" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query("DELETE FROM usuario_permisos WHERE id_usuario = ?", [
      id_usuario,
    ]);

    if (Array.isArray(permisos) && permisos.length > 0) {
      const [permisosEncontrados] = await conn.query(
        `SELECT id FROM permisos WHERE nombre IN (?)`,
        [permisos]
      );

      console.log(
        `🔎 Permisos encontrados en DB: ${permisosEncontrados.length} de ${permisos.length} solicitados`
      );

      if (permisosEncontrados.length > 0) {
        const valoresInsert = permisosEncontrados.map((p) => [
          id_usuario,
          p.id,
        ]);

        await conn.query(
          "INSERT INTO usuario_permisos (id_usuario, permiso_id) VALUES ?",
          [valoresInsert]
        );
      }
    }

    await conn.query(
      "UPDATE usuarios SET token_version = token_version + 1 WHERE id_usuario = ?",
      [id_usuario]
    );

    await conn.commit();
    return res.json({ mensaje: "Permisos actualizados correctamente." });
  } catch (error) {
    await conn.rollback();

    console.error("🔴 ERROR CRÍTICO SQL:", error);
    console.error("Mensaje SQL:", error.sqlMessage);

    return res.status(500).json({
      error: "Falló el guardado",
      detalle: error.message,
      sql: error.sqlMessage,
    });
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
