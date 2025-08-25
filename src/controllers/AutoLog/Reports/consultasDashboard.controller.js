import pool from "../../../config/connectionToSql.js";

// Función genérica para llamar al SP con cualquier acción
const llamarSPDashboard = async (accion) => {
  const [result] = await pool.query(`CALL sp_dashboard(?)`, [accion]);
  return result[0]; // retornamos solo el primer set de resultados
};

// Lista de acciones válidas
const accionesDisponibles = [
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
];

// Manejador general
export const obtenerDatosDashboard = async (req, res) => {
  const { accion } = req.params;

  if (!accionesDisponibles.includes(accion)) {
    return res.status(400).json({ error: "Acción no válida." });
  }

  try {
    const result = await llamarSPDashboard(accion);
    res.json(result);
  } catch (error) {
    console.error(`❌ Error al ejecutar acción '${accion}':`, error);
    res
      .status(500)
      .json({ error: "Error interno del servidor.", details: error.message });
  }
};
