import { Router } from "express";
import {
  getRegistros,
  getReporteEmpleadosMasSalidas,
  getReporteKilometrajePorEmpleado,
  getReporteVehiculosMasUtilizados,
  getReporteRegistrosPorUbicacion,
  getReporteConsumoCombustibleVehiculo,
  getTotalEmpleados,
  getTotalVehiculos,
  getVehiculosEnUso,
  getVehiculosEnMantenimiento,
} from "../controllers/Reports/registerReport.controller.js"; // Asegúrate que todas las funciones están exportadas desde aquí
import {
  authenticate,
  authorizeByPermisos,
} from "../middleware/auth.middleware.js";

const router = Router();

// Ruta para obtener todos los registros (ya existente)
router.get(
  "/registros",
  authenticate,
  authorizeByPermisos("ver_reportes"),
  getRegistros
);

// Nuevas rutas para los reportes específicos
// Reporte: Empleados con más salidas
router.get(
  "/reportes/empleados-mas-salidas",
  authenticate,
  authorizeByPermisos("ver_reportes"), // Asumo que el permiso para ver reportes es el mismo
  getReporteEmpleadosMasSalidas
);

// Reporte: Kilometraje total recorrido por empleado
router.get(
  "/reportes/kilometraje-por-empleado",
  authenticate,
  authorizeByPermisos("ver_reportes"),
  getReporteKilometrajePorEmpleado
);

// Reporte: Vehículos más utilizados
router.get(
  "/reportes/vehiculos-mas-utilizados",
  authenticate,
  authorizeByPermisos("ver_reportes"),
  getReporteVehiculosMasUtilizados
);

// Reporte: Registros por ubicación
router.get(
  "/reportes/registros-por-ubicacion",
  authenticate,
  authorizeByPermisos("ver_reportes"),
  getReporteRegistrosPorUbicacion
);

// Reporte: Consumo promedio de combustible por vehículo
router.get(
  "/reportes/consumo-combustible-vehiculo",
  authenticate,
  authorizeByPermisos("ver_reportes"),
  getReporteConsumoCombustibleVehiculo
);

// Nuevas rutas para las métricas del Home
router.get(
  "/reportes/total-empleados",
  authenticate,
  authorizeByPermisos("gestionar_home"), // O un permiso más específico si lo tienes
  getTotalEmpleados
);
router.get(
  "/reportes/total-vehiculos",
  authenticate,
  authorizeByPermisos("gestionar_home"),
  getTotalVehiculos
);
router.get(
  "/reportes/vehiculos-en-uso",
  authenticate,
  authorizeByPermisos("gestionar_home"),
  getVehiculosEnUso
);
router.get(
  "/reportes/vehiculos-en-mantenimiento",
  authenticate,
  authorizeByPermisos("gestionar_home"),
  getVehiculosEnMantenimiento
);

export default router;
