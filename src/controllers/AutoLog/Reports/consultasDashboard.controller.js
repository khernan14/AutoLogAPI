// controllers/AutoLog/dashboard.controller.js
import pool from "../../../config/connectionToSql.js";
import logger from "../../../utils/logger.js"; // ajusta la ruta si aplica

// Lista blanca de acciones válidas (en minúsculas)
const ACCIONES = new Set([
  "registros_hoy",
  "registros_semana",
  "registros_mes",
  "top_empleados",
  "top_vehiculos",
  "registros_por_hora",
  "estado_vehiculos",
  "km_promedio",
  "ranking_combustible",
  "ultimos_registros_foto",
]);

// Extrae el primer result set de un CALL de forma robusta
function firstResultSet(rows) {
  // Para mysql2 con CALL: rows suele ser [ [arrayDeFilas], OkPacket | meta ... ]
  if (Array.isArray(rows) && Array.isArray(rows[0])) return rows[0];
  // Fallback: si el SP devuelve directamente un array
  if (Array.isArray(rows)) return rows;
  return [];
}

// Función genérica para invocar el SP
async function llamarSPDashboard(accion) {
  const [rows] = await pool.execute("CALL sp_dashboard(?)", [accion]);
  return firstResultSet(rows);
}

// Manejador general
export const obtenerDatosDashboard = async (req, res) => {
  // Normaliza en minúsculas para comparar
  const accionRaw = String(req.params?.accion || "").toLowerCase();

  if (!ACCIONES.has(accionRaw)) {
    return res.status(400).json({ error: "Acción no válida." });
  }

  try {
    const data = await llamarSPDashboard(accionRaw);
    return res.json(data);
  } catch (err) {
    logger.error({ err, accion: accionRaw }, "sp_dashboard fallo");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
};
