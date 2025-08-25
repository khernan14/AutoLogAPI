// routes/grupo.routes.js
import express from "express";
import {
  getGrupos,
  getGrupoById,
  addGrupo,
  updateGrupo,
  deleteGrupo,
} from "../../controllers/AutoLog/mails/grupoNotificacion.controller.js";
import {
  authenticate,
  authorizeByPermisos,
} from "../../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", authenticate, authorizeByPermisos("ver_grupos"), getGrupos);
router.get(
  "/:id",
  authenticate,
  authorizeByPermisos("ver_grupos"),
  getGrupoById
);
router.post("/", authenticate, authorizeByPermisos("crear_grupos"), addGrupo);
router.put(
  "/:id",
  authenticate,
  authorizeByPermisos("editar_grupos"),
  updateGrupo
);
router.delete(
  "/:id",
  authenticate,
  authorizeByPermisos("eliminar_grupos"),
  deleteGrupo
);

export default router;
