/**
 * @swagger
 * tags:
 *   name: Autenticación
 *   description: Rutas relacionadas con login, usuarios y control de acceso
 */

import express from "express";
import {
  getUsers,
  register,
  login,
  updateUser,
  deleteUser,
  updateOwnProfile,
  getUsersById,
  restoreUser,
  resetPassword,
  getEmailSupervisor,
} from "../../controllers/AutoLog/Auth/auth.controller.js";
import {
  authenticate,
  authorize,
  authorizeByPermisos,
} from "../../middleware/auth.middleware.js";

const router = express.Router();

/**
 * @swagger
 * /auth/usuarios:
 *   get:
 *     summary: Obtener todos los usuarios
 *     tags: [Autenticación]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuarios
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 */
router.get(
  "/usuarios",
  authenticate,
  authorizeByPermisos("ver_usuarios"),
  getUsers
);

router.get(
  "/usuarios/:id",
  authenticate,
  authorizeByPermisos("ver_perfil"),
  getUsersById
);

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Registrar un nuevo usuario
 *     tags: [Autenticación]
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
 *               correo:
 *                 type: string
 *               password:
 *                 type: string
 *               rol:
 *                 type: string
 *             example:
 *               nombre: Juan Pérez
 *               correo: juan@empresa.com
 *               password: 123456
 *               rol: Supervisor
 *     responses:
 *       201:
 *         description: Usuario creado
 *       403:
 *         description: No autorizado
 */
router.post(
  "/register",
  authenticate,
  authorizeByPermisos("crear_usuario"),
  register
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: usuario@empresa.com
 *               password:
 *                 type: string
 *                 example: 123456
 *     responses:
 *       200:
 *         description: Sesión iniciada correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *       401:
 *         description: Credenciales inválidas
 */
router.post("/login", login);

router.put(
  "/usuarios/:id",
  authenticate,
  authorizeByPermisos("editar_usuario"),
  updateUser
);
router.put(
  "/usuarios/perfil/:id",
  authenticate,
  authorizeByPermisos("cambiar_password"),
  updateOwnProfile
);
router.delete(
  "/usuarios/:id",
  authenticate,
  authorizeByPermisos("eliminar_usuario"),
  deleteUser
);
router.put(
  "/usuarios/restaurar/:id",
  authenticate,
  authorize("Admin"),
  restoreUser
);

router.post("/reset-password", resetPassword);

router.get("/email-supervisor", getEmailSupervisor);

export default router;
