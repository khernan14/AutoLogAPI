import pool from "../../config/connectionToSql.js";

export default {
  async get(clave) {
    const conn = await pool.getConnection();
    try {
      const [[ev]] = await conn.query(
        "SELECT id, clave, nombre, severidad_def, activo FROM eventos_catalogo WHERE clave=? LIMIT 1",
        [clave]
      );
      if (!ev) return null;

      const [grps] = await conn.query(
        `SELECT g.id, g.nombre
         FROM eventos_grupos eg
         JOIN grupo_notificacion g ON g.id = eg.grupo_id
         WHERE eg.evento_id=? AND eg.activo=1
         ORDER BY g.nombre`,
        [ev.id]
      );

      return {
        clave: ev.clave,
        nombre: ev.nombre,
        enabled: ev.activo === 1,
        severidad_def: ev.severidad_def,
        grupos: grps.map((g) => ({ id: g.id, nombre: g.nombre })),
        grupo_ids: grps.map((g) => g.id),
      };
    } finally {
      conn.release();
    }
  },

  async save({ clave, enabled, grupos = [], severidad_def = null }) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [[ev]] = await conn.query(
        "SELECT id FROM eventos_catalogo WHERE clave=? LIMIT 1",
        [clave]
      );
      if (!ev) throw new Error("Evento no encontrado");

      if (severidad_def) {
        await conn.query(
          "UPDATE eventos_catalogo SET activo=?, severidad_def=? WHERE id=?",
          [enabled ? 1 : 0, severidad_def, ev.id]
        );
      } else {
        await conn.query("UPDATE eventos_catalogo SET activo=? WHERE id=?", [
          enabled ? 1 : 0,
          ev.id,
        ]);
      }

      await conn.query("DELETE FROM eventos_grupos WHERE evento_id=?", [ev.id]);

      if (grupos.length) {
        const values = grupos.map((gid) => [ev.id, gid, 1, 1]); // obligatorio=1, activo=1
        await conn.query(
          "INSERT INTO eventos_grupos (evento_id, grupo_id, obligatorio, activo) VALUES ?",
          [values]
        );
      }

      await conn.commit();
      return { ok: true, updated: true };
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      throw e;
    } finally {
      conn.release();
    }
  },

  async isEnabled(clave) {
    const [[row]] = await pool.query(
      "SELECT activo FROM eventos_catalogo WHERE clave=? LIMIT 1",
      [clave]
    );
    return !!row?.activo;
  },
};
