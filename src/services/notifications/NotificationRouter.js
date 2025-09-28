// Resuelve destinatarios a partir de los grupos asignados al evento.
// v1: canal 'email' con severidad mínima desde grupo_canales (si existe).

const SEV = { low: 1, medium: 2, high: 3, critical: 4 };

export default {
  async resolveRecipients(
    conn,
    { evento_id, severidad, forzar_grupos = [], omit_grupos = [] }
  ) {
    // 1) Grupos activos del evento
    const [grps] = await conn.query(
      `SELECT g.id
       FROM eventos_grupos eg
       JOIN grupo_notificacion g ON g.id = eg.grupo_id
       WHERE eg.evento_id=? AND eg.activo=1 AND g.activo=1`,
      [evento_id]
    );

    const base = new Set(grps.map((x) => x.id));
    for (const id of forzar_grupos) base.add(+id);
    for (const id of omit_grupos) base.delete(+id);
    const finalGroups = [...base];
    if (!finalGroups.length) return { recipients: [] };

    // 2) Miembros
    const [members] = await conn.query(
      `SELECT gu.id_usuario, gu.grupo_id
       FROM grupo_notificacion_usuarios gu
       WHERE gu.grupo_id IN (?)`,
      [finalGroups]
    );
    if (!members.length) return { recipients: [] };

    // 3) Canales (si tienes tabla grupo_canales). Si no existe, todos por email.
    let channels = [];
    try {
      const [rows] = await conn.query(
        `SELECT grupo_id, canal, habilitado, severidad_min
         FROM grupo_canales
         WHERE grupo_id IN (?)`,
        [finalGroups]
      );
      channels = rows;
    } catch {
      // sin grupo_canales -> default email
      channels = finalGroups.map((id) => ({
        grupo_id: id,
        canal: "email",
        habilitado: 1,
        severidad_min: "low",
      }));
    }

    const recipients = [];
    for (const m of members) {
      const chForGroup = channels.filter(
        (ch) => ch.grupo_id === m.grupo_id && ch.habilitado === 1
      );
      for (const ch of chForGroup) {
        if (SEV[severidad] < SEV[ch.severidad_min || "low"]) continue;
        recipients.push({
          id_usuario: m.id_usuario,
          canal: ch.canal || "email",
          direccion_override: null,
          send_after: null,
        });
      }
    }

    // De-dup por usuario+canal
    const seen = new Set();
    const uniq = [];
    for (const r of recipients) {
      const k = `${r.id_usuario}:${r.canal}`;
      if (!seen.has(k)) {
        seen.add(k);
        uniq.push(r);
      }
    }

    return { recipients: uniq };
  },
};
