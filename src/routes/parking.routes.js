import express from "express";
import {
  getParkings,
  addParking,
  updateParking,
  deleteParking,
} from "../controllers/parkings.controller.js";
import {
  authenticate,
  authorizeByPermisos,
} from "../middleware/auth.middleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Estacionamientos
 *     description: Gestión de estacionamientos
 */

/**
 * @swagger
 * /parkings:
 *   get:
 *     summary: Obtener todos los estacionamientos.
 *     tags: [Estacionamientos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de estacionamientos obtenida correctamente.
 *       401:
 *         description: No autorizado.
 *       500:
 *         description: Error interno del servidor.
 */
router.get(
  "/",
  authenticate,
  authorizeByPermisos("ver_estacionamientos"),
  getParkings
);

/**
 * @swagger
 * /parkings:
 *   post:
 *     summary: Agregar un nuevo estacionamiento.
 *     tags: [Estacionamientos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: Estacionamiento Norte
 *               ubicacion:
 *                 type: string
 *                 example: Calle 5, Zona Industrial
 *     responses:
 *       201:
 *         description: Estacionamiento creado correctamente.
 *       400:
 *         description: Datos inválidos.
 *       401:
 *         description: No autorizado.
 *       500:
 *         description: Error del servidor.
 */
router.post(
  "/",
  authenticate,
  authorizeByPermisos("crear_estacionamientos"),
  addParking
);

/**
 * @swagger
 * /parkings/{id}:
 *   put:
 *     summary: Actualizar un estacionamiento por ID.
 *     tags: [Estacionamientos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID del estacionamiento a actualizar.
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: Estacionamiento Actualizado
 *               ubicacion:
 *                 type: string
 *                 example: Calle Nueva 123
 *     responses:
 *       200:
 *         description: Estacionamiento actualizado correctamente.
 *       400:
 *         description: Datos inválidos.
 *       401:
 *         description: No autorizado.
 *       404:
 *         description: Estacionamiento no encontrado.
 *       500:
 *         description: Error del servidor.
 */
router.put(
  "/:id",
  authenticate,
  authorizeByPermisos("editar_estacionamientos"),
  updateParking
);

/**
 * @swagger
 * /parkings/{id}:
 *   delete:
 *     summary: Eliminar un estacionamiento por ID.
 *     tags: [Estacionamientos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID del estacionamiento a eliminar.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Estacionamiento eliminado correctamente.
 *       401:
 *         description: No autorizado.
 *       404:
 *         description: Estacionamiento no encontrado.
 *       500:
 *         description: Error del servidor.
 */
router.delete(
  "/:id",
  authenticate,
  authorizeByPermisos("eliminar_estacionamientos"),
  deleteParking
);

export default router;
