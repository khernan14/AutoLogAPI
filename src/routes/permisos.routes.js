import express from "express";
import {
  asignarPermisos,
  getUsers,
  obtenerPermisosUsuario,
} from "../controllers/permisos.controller.js";
import {
  authenticate,
  authorizeByPermisos,
} from "../middleware/auth.middleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Permisos
 *     description: Gestión de permisos de usuarios
 */

/**
 * @swagger
 * /permisos/usuarios:
 *   get:
 *     summary: Obtener la lista de usuarios para asignar permisos
 *     tags: [Permisos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuarios obtenida exitosamente
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error en el servidor
 */
router.get(
  "/usuarios",
  authenticate,
  authorizeByPermisos("asignar_permisos"),
  getUsers
);

/**
 * @swagger
 * /permisos/asignar:
 *   put:
 *     summary: Asignar una lista de permisos a un usuario
 *     tags: [Permisos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - permisos
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID del usuario al que se le asignarán permisos
 *                 example: "64a8f5b6a7d3e5a1c4e1b9a2"
 *               permisos:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Lista de permisos a asignar
 *                 example: ["ver_usuarios", "crear_usuarios"]
 *     responses:
 *       200:
 *         description: Permisos asignados exitosamente
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error en el servidor
 */
router.put(
  "/asignar",
  authenticate,
  authorizeByPermisos("asignar_permisos"),
  asignarPermisos
);

/**
 * @swagger
 * /permisos/{id}:
 *   get:
 *     summary: Obtener los permisos asignados a un usuario
 *     tags: [Permisos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID del usuario
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Permisos del usuario obtenidos exitosamente
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Usuario no encontrado
 *       500:
 *         description: Error del servidor
 */
router.get(
  "/:id",
  authenticate,
  authorizeByPermisos("asignar_permisos"),
  obtenerPermisosUsuario
);

export default router;
