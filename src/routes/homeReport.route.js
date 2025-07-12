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
 *   name: Reportes
 *   description: Endpoints para reportes y métricas del sistema
 */

/**
 * @swagger
 * /registros:
 *   get:
 *     summary: Obtener todos los registros
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de registros
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
 *     summary: Obtener reporte de empleados con más salidas
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Reporte empleados con más salidas
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
 *     summary: Obtener reporte de kilometraje por empleado
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Reporte kilometraje por empleado
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
 *     summary: Obtener reporte de vehículos más utilizados
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Reporte vehículos más utilizados
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
 *     summary: Obtener reporte de registros por ubicación
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Reporte registros por ubicación
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
 *     summary: Obtener reporte de consumo de combustible por vehículo
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Reporte consumo de combustible por vehículo
 */
router.get(
  "/reportes/consumo-combustible-vehiculo",
  authenticate,
  authorizeByPermisos("ver_reportes"),
  getReporteConsumoCombustibleVehiculo
);

// Nuevas rutas métricas Dashboard Home

/**
 * @swagger
 * /reportes/total-empleados:
 *   get:
 *     summary: Obtener total de empleados
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Total de empleados
 */
router.get(
  "/reportes/total-empleados",
  authenticate,
  authorizeByPermisos("ver_reportes"),
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
 *     responses:
 *       200:
 *         description: Total de vehículos
 */
router.get(
  "/reportes/total-vehiculos",
  authenticate,
  authorizeByPermisos("ver_reportes"),
  getTotalVehiculos
);

/**
 * @swagger
 * /reportes/vehiculos-en-uso:
 *   get:
 *     summary: Obtener vehículos que están en uso
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Vehículos en uso
 */
router.get(
  "/reportes/vehiculos-en-uso",
  authenticate,
  authorizeByPermisos("ver_reportes"),
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
 *     responses:
 *       200:
 *         description: Vehículos en mantenimiento
 */
router.get(
  "/reportes/vehiculos-en-mantenimiento",
  authenticate,
  authorizeByPermisos("ver_reportes"),
  getVehiculosEnMantenimiento
);

export default router;
