import { Router } from "express";
import {
  getRegistros,
  getReporteEmpleadosMasSalidas,
  getReporteKilometrajePorEmpleado,
  getReporteVehiculosMasUtilizados,
  getReporteRegistrosPorUbicacion,
  getReporteConsumoCombustibleVehiculo,
  // Nuevas importaciones para las métricas del Home
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

// Rutas para los reportes específicos (ya existentes)
router.get(
  "/reportes/empleados-mas-salidas",
  authenticate,
  authorizeByPermisos("ver_reportes"),
  getReporteEmpleadosMasSalidas
);
router.get(
  "/reportes/kilometraje-por-empleado",
  authenticate,
  authorizeByPermisos("ver_reportes"),
  getReporteKilometrajePorEmpleado
);
router.get(
  "/reportes/vehiculos-mas-utilizados",
  authenticate,
  authorizeByPermisos("ver_reportes"),
  getReporteVehiculosMasUtilizados
);
router.get(
  "/reportes/registros-por-ubicacion",
  authenticate,
  authorizeByPermisos("ver_reportes"),
  getReporteRegistrosPorUbicacion
);
router.get(
  "/reportes/consumo-combustible-vehiculo",
  authenticate,
  authorizeByPermisos("ver_reportes"),
  getReporteConsumoCombustibleVehiculo
);

// --- Nuevas Rutas para las Métricas del Dashboard Home ---

export default router;
