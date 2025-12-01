// src/routes/AutoLog/permisos.routes.js
import express from "express";
import {
  asignarPermisos,
  getUsers,
  obtenerPermisosUsuario,
} from "../../controllers/AutoLog/Auth/permisos.controller.js";
import {
  authenticate,
  authorizeByPermisos,
} from "../../middleware/auth.middleware.js";

const router = express.Router();

router.get(
  "/usuarios",
  authenticate,
  authorizeByPermisos("asignar_permisos"),
  getUsers
);
router.put(
  "/asignar",
  authenticate,
  authorizeByPermisos("asignar_permisos"),
  asignarPermisos
);
router.get(
  "/:id",
  authenticate,
  authorizeByPermisos("asignar_permisos"),
  obtenerPermisosUsuario
);

export default router;
