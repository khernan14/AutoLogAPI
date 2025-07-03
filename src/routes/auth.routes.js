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
} from "../controllers/auth.controller.js";
import {
  authenticate,
  authorize,
  authorizeByPermisos,
} from "../middleware/auth.middleware.js";

const router = express.Router();

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

// Registro de usuarios
router.post(
  "/register",
  // authenticate,
  // authorizeByPermisos("crear_usuario"),
  register
);

// Inicio de sesión
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

export default router;
