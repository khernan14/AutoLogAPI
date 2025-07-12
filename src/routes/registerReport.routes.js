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
} from "../controllers/Reports/registerReport.controller.js";
import {
  authenticate,
  authorizeByPermisos,
} from "../middleware/auth.middleware.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Reportes
 *     description: Rutas para obtener reportes generales y métricas del dashboard
 */

/**
 * @swagger
 * /reportes/registros:
 *   get:
 *     summary: Obtener todos los registros
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Registros obtenidos correctamente
 */
router.get(
  "/registros",
  authenticate,
  authorizeByPermisos("ver_reportes"),
  getRegistros
);

/**
 * @swagger
 * /reportes/empleados-mas-salidas:
 *   get:
 *     summary: Obtener empleados con más salidas
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/reportes/empleados-mas-salidas",
  authenticate,
  authorizeByPermisos("ver_reportes"),
  getReporteEmpleadosMasSalidas
);

/**
 * @swagger
 * /reportes/kilometraje-por-empleado:
 *   get:
 *     summary: Obtener kilometraje por empleado
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/reportes/kilometraje-por-empleado",
  authenticate,
  authorizeByPermisos("ver_reportes"),
  getReporteKilometrajePorEmpleado
);

/**
 * @swagger
 * /reportes/vehiculos-mas-utilizados:
 *   get:
 *     summary: Obtener vehículos más utilizados
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/reportes/vehiculos-mas-utilizados",
  authenticate,
  authorizeByPermisos("ver_reportes"),
  getReporteVehiculosMasUtilizados
);

/**
 * @swagger
 * /reportes/registros-por-ubicacion:
 *   get:
 *     summary: Obtener registros por ubicación
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/reportes/registros-por-ubicacion",
  authenticate,
  authorizeByPermisos("ver_reportes"),
  getReporteRegistrosPorUbicacion
);

/**
 * @swagger
 * /reportes/consumo-combustible-vehiculo:
 *   get:
 *     summary: Obtener consumo de combustible por vehículo
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/reportes/consumo-combustible-vehiculo",
  authenticate,
  authorizeByPermisos("ver_reportes"),
  getReporteConsumoCombustibleVehiculo
);

// --- MÉTRICAS DEL DASHBOARD ---

/**
 * @swagger
 * /reportes/total-empleados:
 *   get:
 *     summary: Obtener total de empleados
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/reportes/total-empleados",
  authenticate,
  authorizeByPermisos("gestionar_home"),
  getTotalEmpleados
);

/**
 * @swagger
 * /reportes/total-vehiculos:
 *   get:
 *     summary: Obtener total de vehículos
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/reportes/total-vehiculos",
  authenticate,
  authorizeByPermisos("gestionar_home"),
  getTotalVehiculos
);

/**
 * @swagger
 * /reportes/vehiculos-en-uso:
 *   get:
 *     summary: Obtener vehículos actualmente en uso
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/reportes/vehiculos-en-uso",
  authenticate,
  authorizeByPermisos("gestionar_home"),
  getVehiculosEnUso
);

/**
 * @swagger
 * /reportes/vehiculos-en-mantenimiento:
 *   get:
 *     summary: Obtener vehículos en mantenimiento
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/reportes/vehiculos-en-mantenimiento",
  authenticate,
  authorizeByPermisos("gestionar_home"),
  getVehiculosEnMantenimiento
);

export default router;
