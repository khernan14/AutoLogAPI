// controllers/Finanzas/Viaticos/viaticos.controller.js
import pool from "../../../config/connectionToSql.js";
import logger from "../../../utils/logger.js";
import NotificationConfigServices from "../../../services/notifications/NotificationConfigService.js";
import NotificationService from "../../../services/notifications/NotificationService.js";

/* =========================
   Helpers
========================= */
const toInt = (v) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
};
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};
const isNonEmptyStr = (s) => typeof s === "string" && s.trim().length > 0;
const onlyDate = (d) => new Date(d).toISOString().slice(0, 10);

function diffDaysInclusive(a, b) {
  const d1 = new Date(onlyDate(a));
  const d2 = new Date(onlyDate(b));
  return Math.max(1, Math.round((d2 - d1) / 86400000) + 1);
}
function calcNoches(a, b) {
  return Math.max(0, diffDaysInclusive(a, b) - 1);
}

/* =========================
   Utils de dominio
========================= */

// lee un parámetro por cualquiera de varias claves (compatibilidad)
async function getParametroAny(conn, claves, def = 0) {
  const keys = Array.isArray(claves) ? claves : [claves];
  const [r] = await conn.execute(
    `SELECT valor_decimal 
       FROM viaticos_parametros 
      WHERE clave IN (${keys.map(() => "?").join(",")}) AND activo=1 
      ORDER BY FIELD(clave, ${keys.map(() => "?").join(",")}) 
      LIMIT 1`,
    [...keys, ...keys]
  );
  return r.length ? Number(r[0].valor_decimal) : def;
}

async function getTarifaHospedaje(
  conn,
  destino_ciudad_id,
  categoria = "Normal"
) {
  const [r] = await conn.execute(
    `SELECT tarifa 
       FROM viaticos_hospedaje_ciudad 
      WHERE id_ciudad=? AND categoria=? AND activo=1 
      LIMIT 1`,
    [destino_ciudad_id, categoria]
  );
  return r.length ? Number(r[0].tarifa) : 0;
}

async function getTotalEstimado(conn, solicitudId) {
  const [[{ total } = { total: 0 }]] = await conn.execute(
    `SELECT COALESCE(SUM(importe),0) AS total 
       FROM viaticos_solicitud_items 
      WHERE solicitud_id=?`,
    [solicitudId]
  );
  return Number(total || 0);
}

async function recalcTotalesLiquidacion(conn, liquidacionId) {
  const [[{ gastado } = { gastado: 0 }]] = await conn.execute(
    `SELECT COALESCE(SUM(monto),0) AS gastado
       FROM viaticos_comprobantes
      WHERE liquidacion_id=?`,
    [liquidacionId]
  );
  const [[liq]] = await conn.execute(
    `SELECT total_asignado FROM viaticos_liquidaciones WHERE id=?`,
    [liquidacionId]
  );
  const total_asignado = Number(liq?.total_asignado || 0);
  const total_gastado = Number(gastado || 0);
  const diferencia = Number((total_asignado - total_gastado).toFixed(2));

  await conn.execute(
    `UPDATE viaticos_liquidaciones 
        SET total_gastado=?, diferencia=? 
      WHERE id=?`,
    [total_gastado, diferencia, liquidacionId]
  );
  return { total_asignado, total_gastado, diferencia };
}

/* =========================
   Endpoints
========================= */

// 📌 Crear Solicitud (Supervisor) + autogenerar ítems base
// Acepta dos estilos de payload:
//  (A) legacy: { gasolina_estimado, peajes_estimados, imprevistos_estimado, hospedaje_categoria, ... }
//  (B) nuevo:  { motivo, opciones: { comidas:{desayuno|almuerzo|cena:{aplica,dias}}, hospedaje:{aplica,categoria,noches}, peajes:{yojoa|comayagua|siguatepeque:{ida,regreso}}, combustible:{monto}, movilizacion:{monto}, imprevistos:{monto} } }
export const crearSolicitud = async (req, res) => {
  const solicitante_usuario_id = toInt(req.user?.id);
  const empleado_id = toInt(req.body?.empleado_id);
  const origen_ciudad_id = toInt(req.body?.origen_ciudad_id);
  const destino_ciudad_id = toInt(req.body?.destino_ciudad_id);
  const fecha_salida = req.body?.fecha_salida; // ISO string
  const fecha_regreso = req.body?.fecha_regreso; // ISO string
  const moneda = isNonEmptyStr(req.body?.moneda) ? req.body.moneda : "HNL";
  const motivo = isNonEmptyStr(req.body?.motivo)
    ? req.body.motivo.trim()
    : null;

  // legacy
  const hospedaje_categoria_legacy = isNonEmptyStr(
    req.body?.hospedaje_categoria
  )
    ? req.body.hospedaje_categoria
    : "Normal";
  const gasolina_estimado = toNum(req.body?.gasolina_estimado);
  const peajes_estimados = toNum(req.body?.peajes_estimados);
  const imprevistos_estimado = toNum(req.body?.imprevistos_estimado);

  // nuevo
  const opciones = req.body?.opciones || {};

  if (
    [
      solicitante_usuario_id,
      empleado_id,
      origen_ciudad_id,
      destino_ciudad_id,
    ].some(Number.isNaN)
  ) {
    return res.status(400).json({ error: "IDs inválidos" });
  }
  if (!isNonEmptyStr(fecha_salida) || !isNonEmptyStr(fecha_regreso)) {
    return res.status(400).json({ error: "Fechas requeridas" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) Insert encabezado
    const [ins] = await conn.execute(
      `INSERT INTO viaticos_solicitudes
       (solicitante_usuario_id, empleado_id, origen_ciudad_id, destino_ciudad_id, 
        fecha_salida, fecha_regreso, moneda, estado, comentarios)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Borrador', ?)`,
      [
        solicitante_usuario_id,
        empleado_id,
        origen_ciudad_id,
        destino_ciudad_id,
        fecha_salida,
        fecha_regreso,
        moneda,
        motivo,
      ]
    );
    const solicitudId = ins.insertId;

    // 2) Parametrías (acepta claves nuevas y antiguas)
    const desayuno = await getParametroAny(
      conn,
      ["ALI_DESAYUNO", "desayuno"],
      150
    );
    const almuerzo = await getParametroAny(
      conn,
      ["ALI_ALMUERZO", "almuerzo"],
      200
    );
    const cena = await getParametroAny(conn, ["ALI_CENA", "cena"], 200);

    // ⚠️ cada caseta ida o regreso = 22 (no 44)
    const P_YOJ = await getParametroAny(
      conn,
      ["PEAJE_YOJOA", "peaje_yojoa"],
      22
    );
    const P_COM = await getParametroAny(
      conn,
      ["PEAJE_COMAYAGUA", "peaje_comayagua"],
      22
    );
    const P_SIG = await getParametroAny(
      conn,
      ["PEAJE_SIGUA", "peaje_sigua"],
      22
    );

    const diasViaje = diffDaysInclusive(fecha_salida, fecha_regreso);
    const clampDias = (x) =>
      Math.max(0, Math.min(diasViaje, Math.floor(Number(x || 0))));

    // hospedaje
    const nochesUI =
      opciones?.hospedaje?.noches ?? calcNoches(fecha_salida, fecha_regreso);
    const noches = Math.max(
      0,
      Math.min(Math.max(0, diasViaje - 1), Math.floor(Number(nochesUI || 0)))
    );
    const hotel_aplica = opciones?.hospedaje?.aplica ?? noches > 0;
    const hotel_categoria =
      opciones?.hospedaje?.categoria || hospedaje_categoria_legacy || "Normal";
    const tarifaHosp = hotel_aplica
      ? await getTarifaHospedaje(conn, destino_ciudad_id, hotel_categoria)
      : 0;

    // 3) Armar items
    const items = [];

    // Comidas (nuevo: según aplica; legacy: incluye las 3 por día si no hay opciones)
    const comidas = opciones?.comidas || {
      desayuno: { aplica: true, dias: diasViaje },
      almuerzo: { aplica: true, dias: diasViaje },
      cena: { aplica: true, dias: diasViaje },
    };

    const dDes = comidas?.desayuno?.aplica
      ? clampDias(comidas?.desayuno?.dias ?? diasViaje)
      : 0;
    const dAlm = comidas?.almuerzo?.aplica
      ? clampDias(comidas?.almuerzo?.dias ?? diasViaje)
      : 0;
    const dCen = comidas?.cena?.aplica
      ? clampDias(comidas?.cena?.dias ?? diasViaje)
      : 0;

    if (dDes > 0 && desayuno > 0)
      items.push(["Desayuno", null, null, dDes, desayuno, null, null]);
    if (dAlm > 0 && almuerzo > 0)
      items.push(["Almuerzo", null, null, dAlm, almuerzo, null, null]);
    if (dCen > 0 && cena > 0)
      items.push(["Cena", null, null, dCen, cena, null, null]);

    // Hospedaje por noche
    if (hotel_aplica && tarifaHosp > 0 && noches > 0) {
      items.push([
        "Hospedaje",
        null,
        destino_ciudad_id,
        noches,
        tarifaHosp,
        `Cat: ${hotel_categoria}`,
        null,
      ]);
    }

    // Peajes por caseta ida/regreso (nuevo). Si no mandan opciones, cae al legacy "peajes_estimados".
    const peajes = opciones?.peajes || null;
    const pushPeaje = (flag, subtipo, unit) => {
      if (flag) items.push(["Peaje", null, null, 1, unit, "Estimado", subtipo]);
    };
    if (peajes) {
      pushPeaje(peajes?.yojoa?.ida, "Yojoa ida", P_YOJ);
      pushPeaje(peajes?.yojoa?.regreso, "Yojoa regreso", P_YOJ);
      pushPeaje(peajes?.comayagua?.ida, "Comayagua ida", P_COM);
      pushPeaje(peajes?.comayagua?.regreso, "Comayagua regreso", P_COM);
      pushPeaje(peajes?.siguatepeque?.ida, "Siguatepeque ida", P_SIG);
      pushPeaje(peajes?.siguatepeque?.regreso, "Siguatepeque regreso", P_SIG);
    } else if (!Number.isNaN(peajes_estimados) && peajes_estimados > 0) {
      items.push(["Peaje", null, null, 1, peajes_estimados, "Estimado", null]);
    }

    // Libres: combustible / movilización / imprevistos
    const combustibleMonto =
      toNum(opciones?.combustible?.monto) ??
      (Number.isNaN(gasolina_estimado) ? 0 : gasolina_estimado);
    if (!Number.isNaN(combustibleMonto) && combustibleMonto > 0) {
      items.push([
        "Gasolina",
        null,
        null,
        1,
        combustibleMonto,
        "Estimado",
        null,
      ]);
    }

    const movilizacionMonto = toNum(opciones?.movilizacion?.monto) ?? 0;
    if (!Number.isNaN(movilizacionMonto) && movilizacionMonto > 0) {
      // Asegúrate de tener "Movilizacion" en el ENUM de la tabla (lo agregamos en las migraciones).
      items.push([
        "Movilizacion",
        null,
        null,
        1,
        movilizacionMonto,
        "Estimado",
        null,
      ]);
    }

    const imprevMonto =
      toNum(opciones?.imprevistos?.monto) ??
      (Number.isNaN(imprevistos_estimado) ? 0 : imprevistos_estimado);
    if (!Number.isNaN(imprevMonto) && imprevMonto > 0) {
      items.push(["Imprevisto", null, null, 1, imprevMonto, "Estimado", null]);
    }

    if (items.length) {
      // inserta con columna SUBTIPO (si existe, gracias a la migración)
      await conn.query(
        `INSERT INTO viaticos_solicitud_items
         (solicitud_id, tipo, fecha, ciudad_id, cantidad, monto_unitario, nota, subtipo)
         VALUES ${items.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(",")}`,
        items.flatMap((it) => [solicitudId, ...it])
      );
    }

    const totalEstimado = await getTotalEstimado(conn, solicitudId);
    await conn.execute(
      "UPDATE viaticos_solicitudes SET total_estimado=? WHERE id=?",
      [totalEstimado, solicitudId]
    );

    await conn.commit();
    return res.status(201).json({
      message: "Solicitud creada",
      id: solicitudId,
      total_estimado: totalEstimado,
    });
  } catch (err) {
    await conn.rollback();
    logger.error({ err }, "crearSolicitud failed");
    return res.status(500).json({ error: "Error creando solicitud." });
  } finally {
    conn.release();
  }
};

// 📝 Actualizar encabezado (solo Borrador)
export const actualizarSolicitud = async (req, res) => {
  const id = toInt(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const fields = [];
  const vals = [];

  const map = {
    empleado_id: (v) => ["empleado_id", toInt(v)],
    origen_ciudad_id: (v) => ["origen_ciudad_id", toInt(v)],
    destino_ciudad_id: (v) => ["destino_ciudad_id", toInt(v)],
    fecha_salida: (v) => ["fecha_salida", v],
    fecha_regreso: (v) => ["fecha_regreso", v],
    moneda: (v) => ["moneda", isNonEmptyStr(v) ? v : null],
    motivo: (v) => ["comentarios", isNonEmptyStr(v) ? v.trim() : null],
  };

  for (const [k, fn] of Object.entries(map)) {
    if (k in req.body) {
      const [col, val] = fn(req.body[k]);
      if (col && (val || val === null)) {
        fields.push(`${col}=?`);
        vals.push(val);
      }
    }
  }
  if (!fields.length)
    return res.status(400).json({ error: "Nada para actualizar" });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[row]] = await conn.execute(
      "SELECT estado FROM viaticos_solicitudes WHERE id=? LIMIT 1",
      [id]
    );
    if (!row) {
      await conn.rollback();
      return res.status(404).json({ error: "Solicitud no encontrada" });
    }
    if (row.estado !== "Borrador") {
      await conn.rollback();
      return res
        .status(409)
        .json({ error: "Solo se puede editar en Borrador" });
    }

    await conn.execute(
      `UPDATE viaticos_solicitudes SET ${fields.join(", ")} WHERE id=?`,
      [...vals, id]
    );

    await conn.commit();
    return res.json({ message: "Solicitud actualizada" });
  } catch (err) {
    await conn.rollback();
    logger.error({ err }, "actualizarSolicitud failed");
    return res.status(500).json({ error: "Error actualizando solicitud." });
  } finally {
    conn.release();
  }
};

// 🧩 Actualizar ítem de solicitud (solo Borrador y es_editable=1)
export const actualizarItem = async (req, res) => {
  const itemId = toInt(req.params.itemId);
  if (Number.isNaN(itemId))
    return res.status(400).json({ error: "itemId inválido" });

  const allowedCols = {
    cantidad: (v) => toNum(v),
    monto_unitario: (v) => toNum(v),
    nota: (v) => (isNonEmptyStr(v) ? v.trim() : null),
    subtipo: (v) => (isNonEmptyStr(v) ? v.trim() : null),
    fecha: (v) => (isNonEmptyStr(v) ? v : null),
    ciudad_id: (v) => toInt(v),
  };

  const set = [];
  const vals = [];
  for (const [k, conv] of Object.entries(allowedCols)) {
    if (k in req.body) {
      const val = conv(req.body[k]);
      if (Number.isNaN(val)) {
        if (["cantidad", "monto_unitario", "ciudad_id"].includes(k)) {
          return res.status(400).json({ error: `Valor inválido para ${k}` });
        }
      }
      set.push(`${k}=?`);
      vals.push(val);
    }
  }
  if (!set.length)
    return res.status(400).json({ error: "Nada para actualizar" });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[it]] = await conn.execute(
      `SELECT vsi.id, vsi.solicitud_id, vsi.es_editable, vs.estado
         FROM viaticos_solicitud_items vsi
         JOIN viaticos_solicitudes vs ON vs.id = vsi.solicitud_id
        WHERE vsi.id=? LIMIT 1`,
      [itemId]
    );
    if (!it) {
      await conn.rollback();
      return res.status(404).json({ error: "Ítem no encontrado" });
    }
    if (it.estado !== "Borrador" || it.es_editable !== 1) {
      await conn.rollback();
      return res
        .status(409)
        .json({ error: "Solo se puede editar en Borrador y si es_editable=1" });
    }

    await conn.execute(
      `UPDATE viaticos_solicitud_items 
          SET ${set.join(", ")} 
        WHERE id=?`,
      [...vals, itemId]
    );

    // recalcular total estimado
    const total = await getTotalEstimado(conn, it.solicitud_id);
    await conn.execute(
      "UPDATE viaticos_solicitudes SET total_estimado=? WHERE id=?",
      [total, it.solicitud_id]
    );

    await conn.commit();
    return res.json({ message: "Ítem actualizado", total_estimado: total });
  } catch (err) {
    await conn.rollback();
    logger.error({ err }, "actualizarItem failed");
    return res.status(500).json({ error: "Error actualizando ítem." });
  } finally {
    conn.release();
  }
};

// 🗑️ Eliminar ítem de solicitud (solo Borrador y es_editable=1)
export const eliminarItem = async (req, res) => {
  const itemId = toInt(req.params.itemId);
  if (Number.isNaN(itemId))
    return res.status(400).json({ error: "itemId inválido" });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[it]] = await conn.execute(
      `SELECT vsi.id, vsi.solicitud_id, vsi.es_editable, vs.estado
         FROM viaticos_solicitud_items vsi
         JOIN viaticos_solicitudes vs ON vs.id = vsi.solicitud_id
        WHERE vsi.id=? LIMIT 1`,
      [itemId]
    );
    if (!it) {
      await conn.rollback();
      return res.status(404).json({ error: "Ítem no encontrado" });
    }
    if (it.estado !== "Borrador" || it.es_editable !== 1) {
      await conn.rollback();
      return res.status(409).json({
        error: "Solo se puede eliminar en Borrador y si es_editable=1",
      });
    }

    await conn.execute("DELETE FROM viaticos_solicitud_items WHERE id=?", [
      itemId,
    ]);

    const total = await getTotalEstimado(conn, it.solicitud_id);
    await conn.execute(
      "UPDATE viaticos_solicitudes SET total_estimado=? WHERE id=?",
      [total, it.solicitud_id]
    );

    await conn.commit();
    return res.json({ message: "Ítem eliminado", total_estimado: total });
  } catch (err) {
    await conn.rollback();
    logger.error({ err }, "eliminarItem failed");
    return res.status(500).json({ error: "Error eliminando ítem." });
  } finally {
    conn.release();
  }
};

// 📨 Enviar (Borrador -> Enviado) + notificación a caja chica/supervisor
export const enviarSolicitud = async (req, res) => {
  const id = toInt(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const total = await getTotalEstimado(conn, id);
    const [upd] = await conn.execute(
      `UPDATE viaticos_solicitudes
          SET estado='Enviado', total_estimado=?
        WHERE id=? AND estado='Borrador'`,
      [total, id]
    );
    if (upd.affectedRows === 0) {
      await conn.rollback();
      return res.status(409).json({
        error: "No se puede enviar (no está en Borrador o no existe).",
      });
    }
    await conn.commit();

    (async () => {
      try {
        const enabled = await NotificationConfigServices.isEnabled(
          "VIATICOS_SOLICITUD_ENVIADA"
        );
        if (!enabled) return;

        const [[info]] = await pool.execute(
          `SELECT vs.id, vs.total_estimado, vs.moneda, vs.fecha_salida, vs.fecha_regreso,
                  u.nombre AS supervisor, uv.nombre AS viajero
             FROM viaticos_solicitudes vs
             JOIN usuarios u  ON u.id_usuario = vs.solicitante_usuario_id
             JOIN empleados e ON e.id = vs.empleado_id
             JOIN usuarios uv ON uv.id_usuario = e.id_usuario
            WHERE vs.id=? LIMIT 1`,
          [id]
        );

        await NotificationService.createAndSend({
          clave: "VIATICOS_SOLICITUD_ENVIADA",
          payload: {
            solicitudId: id,
            supervisor: info?.supervisor || "",
            viajero: info?.viajero || "",
            periodo: `${new Date(info?.fecha_salida).toLocaleDateString(
              "es-HN"
            )} - ${new Date(info?.fecha_regreso).toLocaleDateString("es-HN")}`,
            totalEstimado: info?.total_estimado ?? 0,
            moneda: info?.moneda || "HNL",
            link_detalle: `${(process.env.APP_URL || "").replace(
              /\/$/,
              ""
            )}/viaticos/solicitudes/${id}`,
          },
          creado_por: req.user?.id || null,
        });
      } catch (err) {
        logger.warn({ err }, "Notificación VIATICOS_SOLICITUD_ENVIADA falló");
      }
    })().catch(() => {});

    return res.json({
      message: "Solicitud enviada",
      id,
      total_estimado: total,
    });
  } catch (err) {
    await conn.rollback();
    logger.error({ err }, "enviarSolicitud failed");
    return res.status(500).json({ error: "Error al enviar solicitud." });
  } finally {
    conn.release();
  }
};

// ✅ Aprobar/Rechazar
export const aprobarSolicitud = async (req, res) => {
  const id = toInt(req.params.id);
  const monto_autorizado = toNum(req.body?.monto_autorizado);
  const aprobar = req.body?.aprobar === true || req.body?.aprobar === "true";
  const motivo = isNonEmptyStr(req.body?.motivo)
    ? req.body.motivo.trim()
    : null;

  if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[sol]] = await conn.execute(
      `SELECT id, estado, total_estimado FROM viaticos_solicitudes WHERE id=? LIMIT 1`,
      [id]
    );
    if (!sol) {
      await conn.rollback();
      return res.status(404).json({ error: "Solicitud no encontrada." });
    }
    if (sol.estado !== "Enviado") {
      await conn.rollback();
      return res.status(409).json({ error: "Solo cuando está 'Enviado'." });
    }

    if (!aprobar) {
      await conn.execute(
        `UPDATE viaticos_solicitudes 
            SET estado='Rechazado', aprobado_por_usuario_id=?, aprobado_en=NOW(), monto_autorizado=NULL, comentarios=CONCAT(IFNULL(comentarios,''), ?)
          WHERE id=?`,
        [req.user?.id || null, motivo ? `\n[RECHAZO] ${motivo}` : "", id]
      );
      await conn.commit();

      (async () => {
        try {
          const enabled = await NotificationConfigServices.isEnabled(
            "VIATICOS_SOLICITUD_RECHAZADA"
          );
          if (!enabled) return;
          await NotificationService.createAndSend({
            clave: "VIATICOS_SOLICITUD_RECHAZADA",
            payload: {
              solicitudId: id,
              motivo: motivo || undefined,
              link_detalle: `${(process.env.APP_URL || "").replace(
                /\/$/,
                ""
              )}/viaticos/solicitudes/${id}`,
            },
            creado_por: req.user?.id || null,
          });
        } catch (err) {
          logger.warn(
            { err },
            "Notificación VIATICOS_SOLICITUD_RECHAZADA falló"
          );
        }
      })().catch(() => {});
      return res.json({ message: "Solicitud rechazada", id });
    }

    if (Number.isNaN(monto_autorizado) || monto_autorizado < 0) {
      await conn.rollback();
      return res.status(400).json({ error: "monto_autorizado inválido" });
    }

    await conn.execute(
      `UPDATE viaticos_solicitudes 
          SET estado='Aprobado', aprobado_por_usuario_id=?, aprobado_en=NOW(), monto_autorizado=? 
        WHERE id=?`,
      [req.user?.id || null, monto_autorizado, id]
    );

    await conn.execute(
      `INSERT INTO viaticos_liquidaciones
       (solicitud_id, liquidada_por_usuario_id, total_asignado, total_gastado, diferencia, estado)
       VALUES (?, ?, ?, 0, ?, 'Abierta')`,
      [id, req.user?.id || null, monto_autorizado, monto_autorizado]
    );

    await conn.commit();

    (async () => {
      try {
        const enabled = await NotificationConfigServices.isEnabled(
          "VIATICOS_SOLICITUD_APROBADA"
        );
        if (!enabled) return;
        await NotificationService.createAndSend({
          clave: "VIATICOS_SOLICITUD_APROBADA",
          payload: {
            solicitudId: id,
            montoAutorizado: monto_autorizado,
            link_detalle: `${(process.env.APP_URL || "").replace(
              /\/$/,
              ""
            )}/viaticos/solicitudes/${id}`,
          },
          creado_por: req.user?.id || null,
        });
      } catch (err) {
        logger.warn({ err }, "Notificación VIATICOS_SOLICITUD_APROBADA falló");
      }
    })().catch(() => {});
    return res.json({ message: "Solicitud aprobada", id, monto_autorizado });
  } catch (err) {
    await conn.rollback();
    logger.error({ err }, "aprobarSolicitud failed");
    return res.status(500).json({ error: "Error al aprobar/rechazar." });
  } finally {
    conn.release();
  }
};

// 📄 Obtener solicitud + items
// 📄 Obtener solicitud + items  (Ajuste: trae liquidacion_id)
export const obtenerSolicitud = async (req, res) => {
  const id = toInt(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  try {
    const [[head]] = await pool.execute(
      `SELECT 
          vs.*,
          vl.id AS liquidacion_id,         -- 👈 NUEVO
          u.nombre  AS supervisor, 
          uv.nombre AS viajero
        FROM viaticos_solicitudes vs
        LEFT JOIN viaticos_liquidaciones vl ON vl.solicitud_id = vs.id  -- 👈 NUEVO
        JOIN usuarios u  ON u.id_usuario = vs.solicitante_usuario_id
        JOIN empleados e ON e.id = vs.empleado_id
        JOIN usuarios uv ON uv.id_usuario = e.id_usuario
        WHERE vs.id=? 
        LIMIT 1`,
      [id]
    );
    if (!head) return res.status(404).json({ error: "No existe la solicitud" });

    const [items] = await pool.execute(
      `SELECT id, tipo, fecha, ciudad_id, cantidad, monto_unitario, importe, nota, es_editable, subtipo
         FROM viaticos_solicitud_items 
        WHERE solicitud_id=? 
        ORDER BY tipo, fecha`,
      [id]
    );

    return res.json({ solicitud: head, items });
  } catch (err) {
    logger.error({ err }, "obtenerSolicitud failed");
    return res.status(500).json({ error: "Error obteniendo solicitud." });
  }
};

// 🧾 Crear liquidación manual (si hiciera falta)
export const crearLiquidacion = async (req, res) => {
  const solicitud_id = toInt(req.body?.solicitud_id);
  const usuario_id = toInt(req.user?.id);
  if ([solicitud_id, usuario_id].some(Number.isNaN)) {
    return res.status(400).json({ error: "Datos inválidos" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[sol]] = await conn.execute(
      `SELECT id, estado, monto_autorizado 
         FROM viaticos_solicitudes WHERE id=? LIMIT 1`,
      [solicitud_id]
    );
    if (!sol) {
      await conn.rollback();
      return res.status(404).json({ error: "Solicitud no encontrada." });
    }
    if (sol.estado !== "Aprobado") {
      await conn.rollback();
      return res
        .status(409)
        .json({ error: "La solicitud debe estar 'Aprobado'." });
    }

    const [[exists]] = await conn.execute(
      `SELECT id FROM viaticos_liquidaciones WHERE solicitud_id=? LIMIT 1`,
      [solicitud_id]
    );
    if (exists) {
      await conn.rollback();
      return res
        .status(409)
        .json({ error: "Ya existe una liquidación para esta solicitud." });
    }

    await conn.execute(
      `INSERT INTO viaticos_liquidaciones
         (solicitud_id, liquidada_por_usuario_id, total_asignado, total_gastado, diferencia, estado)
       VALUES (?, ?, ?, 0, ?, 'Abierta')`,
      [
        solicitud_id,
        usuario_id,
        sol.monto_autorizado || 0,
        sol.monto_autorizado || 0,
      ]
    );

    await conn.commit();
    return res.status(201).json({ message: "Liquidación creada." });
  } catch (err) {
    await conn.rollback();
    logger.error({ err }, "crearLiquidacion failed");
    return res.status(500).json({ error: "Error creando liquidación." });
  } finally {
    conn.release();
  }
};

// 📄 Obtener liquidación + comprobantes
export const obtenerLiquidacion = async (req, res) => {
  const id = toInt(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  try {
    const [[liq]] = await pool.execute(
      `SELECT id, solicitud_id, total_asignado, total_gastado, diferencia, estado, created_at, updated_at
         FROM viaticos_liquidaciones WHERE id=? LIMIT 1`,
      [id]
    );
    if (!liq)
      return res.status(404).json({ error: "Liquidación no encontrada" });

    const [comprobantes] = await pool.execute(
      `SELECT id, tipo, subtipo, fecha, proveedor, num_factura, monto, moneda, observaciones, created_at
         FROM viaticos_comprobantes 
        WHERE liquidacion_id=?
        ORDER BY fecha, id`,
      [id]
    );

    return res.json({ liquidacion: liq, comprobantes });
  } catch (err) {
    logger.error({ err }, "obtenerLiquidacion failed");
    return res.status(500).json({ error: "Error obteniendo liquidación." });
  }
};

// 📚 Listar liquidaciones (filtros: estado?, solicitud_id?)
export const listarLiquidaciones = async (req, res) => {
  const estado = isNonEmptyStr(req.query?.estado) ? req.query.estado : null;
  const solicitud_id = toInt(req.query?.solicitud_id);

  const params = [];
  let where = "1=1";
  if (estado) {
    where += " AND vl.estado=?";
    params.push(estado);
  }
  if (!Number.isNaN(solicitud_id)) {
    where += " AND vl.solicitud_id=?";
    params.push(solicitud_id);
  }

  try {
    const [rows] = await pool.execute(
      `SELECT 
          vl.id,
          vl.solicitud_id,
          vl.total_asignado,
          vl.total_gastado,
          vl.diferencia,
          vl.estado,
          vl.created_at,
          vl.updated_at,
          vs.fecha_salida,
          vs.fecha_regreso,
          vs.moneda,
          u.nombre  AS supervisor,
          uv.nombre AS viajero
        FROM viaticos_liquidaciones vl
        JOIN viaticos_solicitudes vs ON vs.id = vl.solicitud_id
        JOIN usuarios u  ON u.id_usuario = vs.solicitante_usuario_id
        JOIN empleados e ON e.id = vs.empleado_id
        JOIN usuarios uv ON uv.id_usuario = e.id_usuario
        WHERE ${where}
        ORDER BY vl.created_at DESC
        LIMIT 300`,
      params
    );
    return res.json(rows);
  } catch (err) {
    logger.error({ err }, "listarLiquidaciones failed");
    return res.status(500).json({ error: "Error listando liquidaciones." });
  }
};

// 📎 Agregar comprobante(s) (JSON, SIN archivos) + recalcular totales + notificación
export const agregarComprobante = async (req, res) => {
  const liquidacion_id = toInt(req.body?.liquidacion_id);
  if (Number.isNaN(liquidacion_id))
    return res.status(400).json({ error: "liquidacion_id inválido" });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const comprobantes = Array.isArray(req.body?.comprobantes)
      ? req.body.comprobantes
      : [req.body];

    const valores = [];
    for (const c of comprobantes) {
      const tipo = c?.tipo;
      const fecha = c?.fecha;
      const monto = toNum(c?.monto);
      const moneda = isNonEmptyStr(c?.moneda) ? c.moneda : "HNL";
      const proveedor = isNonEmptyStr(c?.proveedor) ? c.proveedor.trim() : null;
      const num_factura = isNonEmptyStr(c?.num_factura)
        ? c.num_factura.trim()
        : null;
      const observaciones = isNonEmptyStr(c?.observaciones)
        ? c.observaciones.trim()
        : null;
      const subtipo = isNonEmptyStr(c?.subtipo) ? c.subtipo.trim() : null;

      if (
        !isNonEmptyStr(tipo) ||
        !isNonEmptyStr(fecha) ||
        Number.isNaN(monto)
      ) {
        await conn.rollback();
        return res.status(400).json({
          error: "Cada comprobante requiere tipo/fecha/monto válidos",
        });
      }
      valores.push([
        liquidacion_id,
        tipo,
        subtipo,
        fecha,
        proveedor,
        num_factura,
        monto,
        moneda,
        observaciones,
      ]);
    }

    await conn.query(
      `INSERT INTO viaticos_comprobantes
         (liquidacion_id, tipo, subtipo, fecha, proveedor, num_factura, monto, moneda, observaciones)
       VALUES ${valores.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?)").join(",")}`,
      valores.flat()
    );

    const totales = await recalcTotalesLiquidacion(conn, liquidacion_id);
    await conn.commit();

    // Notificación (último comprobante)
    (async () => {
      try {
        const enabled = await NotificationConfigServices.isEnabled(
          "VIATICOS_COMPROBANTE_AGREGADO"
        );
        if (!enabled) return;

        const [[row]] = await pool.execute(
          `SELECT vc.id, vc.monto, vc.tipo, vl.solicitud_id
             FROM viaticos_comprobantes vc
             JOIN viaticos_liquidaciones vl ON vl.id = vc.liquidacion_id
            WHERE vc.liquidacion_id = ?
            ORDER BY vc.id DESC LIMIT 1`,
          [liquidacion_id]
        );

        await NotificationService.createAndSend({
          clave: "VIATICOS_COMPROBANTE_AGREGADO",
          payload: {
            liquidacionId: liquidacion_id,
            solicitudId: row?.solicitud_id || null,
            comprobanteId: row?.id || null,
            tipo: row?.tipo || "",
            monto: row?.monto || 0,
            link_detalle: `${(process.env.APP_URL || "").replace(
              /\/$/,
              ""
            )}/viaticos/liquidaciones/${liquidacion_id}`,
          },
          creado_por: req.user?.id || null,
        });
      } catch (err) {
        logger.warn(
          { err },
          "Notificación VIATICOS_COMPROBANTE_AGREGADO falló"
        );
      }
    })().catch(() => {});

    return res
      .status(201)
      .json({ message: "Comprobante(s) agregado(s).", totales });
  } catch (err) {
    await conn.rollback();
    logger.error({ err }, "agregarComprobante failed");
    return res.status(500).json({ error: "Error agregando comprobante." });
  } finally {
    conn.release();
  }
};

// ✅ Cerrar liquidación (recalcula y cierra) + notificación
export const cerrarLiquidacion = async (req, res) => {
  const id = toInt(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const totals = await recalcTotalesLiquidacion(conn, id);

    await conn.execute(
      `UPDATE viaticos_liquidaciones 
          SET estado='Cerrada', updated_at=NOW()
        WHERE id=?`,
      [id]
    );

    await conn.commit();

    (async () => {
      try {
        const enabled = await NotificationConfigServices.isEnabled(
          "VIATICOS_LIQUIDACION_CERRADA"
        );
        if (!enabled) return;
        await NotificationService.createAndSend({
          clave: "VIATICOS_LIQUIDACION_CERRADA",
          payload: {
            liquidacionId: id,
            totalAsignado: totals.total_asignado,
            totalGastado: totals.total_gastado,
            diferencia: totals.diferencia,
            link_detalle: `${(process.env.APP_URL || "").replace(
              /\/$/,
              ""
            )}/viaticos/liquidaciones/${id}`,
          },
          creado_por: req.user?.id || null,
        });
      } catch (err) {
        logger.warn({ err }, "Notificación VIATICOS_LIQUIDACION_CERRADA falló");
      }
    })().catch(() => {});

    return res.json({
      message: "Liquidación cerrada",
      totales: totals,
    });
  } catch (err) {
    await conn.rollback();
    logger.error({ err }, "cerrarLiquidacion failed");
    return res.status(500).json({ error: "Error al cerrar la liquidación." });
  } finally {
    conn.release();
  }
};

// 📜 Listar solicitudes
export const listarSolicitudes = async (req, res) => {
  const estado = isNonEmptyStr(req.query?.estado) ? req.query.estado : null;
  const empleado_id = toInt(req.query?.empleado_id);
  const desde = isNonEmptyStr(req.query?.desde) ? req.query.desde : null;
  const hasta = isNonEmptyStr(req.query?.hasta) ? req.query.hasta : null;

  const params = [];
  let where = "1=1";
  if (estado) {
    where += " AND vs.estado=?";
    params.push(estado);
  }
  if (!Number.isNaN(empleado_id)) {
    where += " AND vs.empleado_id=?";
    params.push(empleado_id);
  }
  if (desde) {
    where += " AND vs.fecha_salida >= ?";
    params.push(desde);
  }
  if (hasta) {
    where += " AND vs.fecha_regreso <= ?";
    params.push(hasta);
  }

  try {
    const [rows] = await pool.execute(
      `SELECT vs.id, vs.estado, vs.total_estimado, vs.moneda, 
              vs.fecha_salida, vs.fecha_regreso,
              uv.nombre AS viajero, u.nombre AS supervisor
         FROM viaticos_solicitudes vs
         JOIN usuarios u  ON u.id_usuario = vs.solicitante_usuario_id
         JOIN empleados e ON e.id = vs.empleado_id
         JOIN usuarios uv ON uv.id_usuario = e.id_usuario
        WHERE ${where}
        ORDER BY vs.created_at DESC
        LIMIT 200`,
      params
    );
    return res.json(rows);
  } catch (err) {
    logger.error({ err }, "listarSolicitudes failed");
    return res.status(500).json({ error: "Error listando solicitudes." });
  }
};

// Utilidad: Ciudades
export const getCiudades = async (_req, res) => {
  try {
    const [result] = await pool.execute(
      "SELECT * FROM ciudades ORDER BY nombre ASC"
    );
    return res.json(result);
  } catch (err) {
    logger.error({ err }, "getCiudades failed");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
};
