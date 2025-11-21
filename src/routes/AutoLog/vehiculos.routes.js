import express from "express";
import {
  getVehiculos,
  addVehiculo,
  updateVehiculo,
  deleteVehiculo,
  listarVehiculosEmpleado,
  getUbicaciones,
  restoreVehiculo,
} from "../../controllers/AutoLog/Vehiculos/vehiculos.controller.js";
import {
  authenticate,
  authorizeByPermisos,
} from "../../middleware/auth.middleware.js";
import {
  getQRImageForVehiculo,
  issueRegistroLinkForVehiculo,
  resolveVehiculoFromQrToken,
} from "../../controllers/AutoLog/Vehiculos/vehiculosQr.controller.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Vehículos
 *     description: Endpoints para la gestión de vehículos
 */

/**
 * @swagger
 * /vehiculos:
 *   get:
 *     summary: Obtener todos los vehículos
 *     tags: [Vehículos]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/",
  authenticate,
  authorizeByPermisos("ver_vehiculos"),
  getVehiculos
);

router.get(
  "/:id_vehiculo/registro/link",
  authenticate,
  authorizeByPermisos("crear_QR"),
  issueRegistroLinkForVehiculo
);

router.get(
  "/:id_vehiculo/registro/qr.png",
  authenticate,
  authorizeByPermisos("crear_QR"),
  getQRImageForVehiculo
);

router.get(
  "/registro/resolve",
  authenticate,
  authorizeByPermisos("crear_QR"),
  resolveVehiculoFromQrToken
);

/**
 * @swagger
 * /vehiculos/ubicaciones:
 *   get:
 *     summary: Obtener ubicaciones de vehículos
 *     tags: [Vehículos]
 *     security:
 *       - bearerAuth: []
 */
router.get("/ubicaciones", authenticate, getUbicaciones);

/**
 * @swagger
 * /vehiculos/{id}:
 *   get:
 *     summary: Listar los vehículos asignados a un empleado
 *     tags: [Vehículos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del empleado
 *     security:
 *       - bearerAuth: []
 */
router.get("/:id", authenticate, listarVehiculosEmpleado);

/**
 * @swagger
 * /vehiculos:
 *   post:
 *     summary: Crear un nuevo vehículo
 *     tags: [Vehículos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             example:
 *               marca: Toyota
 *               modelo: Corolla
 *               placas: ABC-123
 *               color: Blanco
 */
router.post(
  "/",
  authenticate,
  authorizeByPermisos("crear_vehiculo"),
  addVehiculo
);

/**
 * @swagger
 * /vehiculos/{id}:
 *   put:
 *     summary: Actualizar la información de un vehículo
 *     tags: [Vehículos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 */
router.put(
  "/:id",
  authenticate,
  authorizeByPermisos("editar_vehiculo"),
  updateVehiculo
);

/**
 * @swagger
 * /vehiculos/{id}:
 *   delete:
 *     summary: Eliminar un vehículo
 *     tags: [Vehículos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  "/:id",
  authenticate,
  authorizeByPermisos("eliminar_vehiculo"),
  deleteVehiculo
);

/**
 * @swagger
 * /vehiculos/restaurar/{id}:
 *   put:
 *     summary: Restaurar un vehículo eliminado
 *     tags: [Vehículos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 */
router.put("/restaurar/:id", authenticate, restoreVehiculo);

export default router;
