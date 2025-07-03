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
 * @route PUT /permisos/asignar
 * @desc Asigna una lista de permisos a un usuario
 * @access Protegido - requiere permiso "asignar_permisos"
 */

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

/**
 * @route GET /permisos/:id
 * @desc Obtiene los permisos asignados a un usuario (agrupados)
 * @access Protegido - requiere permiso "asignar_permisos"
 */
router.get(
  "/:id",
  authenticate,
  authorizeByPermisos("asignar_permisos"),
  obtenerPermisosUsuario
);

export default router;
