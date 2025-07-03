// routes/grupoUsuarios.routes.js
import express from "express";
import {
  getGrupoUsuarios,
  getGrupoUsuarioById,
  addGrupoUsuario,
  updateGrupoUsuario,
  deleteGrupoUsuario,
} from "../controllers/grupoUsuarios.controller.js";
import {
  authenticate,
  authorizeByPermisos,
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorizeByPermisos("ver_grupo_usuarios"),
  getGrupoUsuarios
);
router.get(
  "/:id",
  authenticate,
  authorizeByPermisos("ver_grupo_usuarios"),
  getGrupoUsuarioById
);
router.post(
  "/",
  authenticate,
  authorizeByPermisos("crear_grupo_usuarios"),
  addGrupoUsuario
);
router.put(
  "/:id",
  authenticate,
  authorizeByPermisos("editar_grupo_usuarios"),
  updateGrupoUsuario
);
router.delete(
  "/:id",
  authenticate,
  authorizeByPermisos("eliminar_grupo_usuarios"),
  deleteGrupoUsuario
);

export default router;
