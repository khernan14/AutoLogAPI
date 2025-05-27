import pool from "../config/connectionToSql.js";

// 📅 Reporte de registros por fecha
export const obtenerRegistrosPorFecha = async (req, res) => {
    const { fecha_inicio, fecha_fin } = req.query;

    if (!fecha_inicio || !fecha_fin) {
        return res.status(400).json({ error: "Debes proporcionar fecha_inicio y fecha_fin." });
    }

    try {
        const [result] = await pool.query(`
      SELECT r.*, v.placa, e.nombre AS empleado 
      FROM registros r
      JOIN vehiculos v ON r.id_vehiculo = v.id
      JOIN empleados e ON r.id_empleado = e.id
      WHERE DATE(r.fecha_salida) BETWEEN ? AND ?
    `, [fecha_inicio, fecha_fin]);

        res.json(result);
    } catch (error) {
        console.error("❌ Error al obtener reportes por fecha:", error);
        res.status(500).json({ error: "Error al obtener reportes." });
    }
};

// 👨‍💼 Reporte de registros por empleado
export const obtenerRegistrosPorEmpleado = async (req, res) => {
    const { id_empleado } = req.params;

    try {
        const [result] = await pool.query(`
      SELECT r.*, v.placa 
      FROM registros r
      JOIN vehiculos v ON r.id_vehiculo = v.id
      WHERE r.id_empleado = ?
    `, [id_empleado]);

        res.json(result);
    } catch (error) {
        console.error("❌ Error al obtener reportes por empleado:", error);
        res.status(500).json({ error: "Error al obtener reportes." });
    }
};

// 🚗 Reporte de vehículos disponibles
export const obtenerVehiculosDisponibles = async (req, res) => {
    try {
        const [result] = await pool.query(`
      SELECT * FROM vehiculos WHERE estado = 'Disponible'
    `);

        res.json(result);
    } catch (error) {
        console.error("❌ Error al obtener vehículos disponibles:", error);
        res.status(500).json({ error: "Error al obtener vehículos disponibles." });
    }
};
