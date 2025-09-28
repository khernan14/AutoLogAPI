// routes/Notificaciones/grupos.routes.js
import { Router } from "express";
import {
  listGrupos,
  createGrupo,
  getGrupo,
  updateGrupo,
  deleteGrupo,
  listMiembros,
  addMiembros,
  removeMiembro,
  getCanales,
  saveCanales,
} from "../../controllers/Notificaciones/grupos.controller.js";
import {
  authenticate,
  authorizeByPermisos,
} from "../../middleware/auth.middleware.js";

const router = Router();
router.use(authenticate);

// ------- Grupos -------
router.get("/", authorizeByPermisos("notif_grupos_ver"), listGrupos);
router.post("/", authorizeByPermisos("notif_grupos_editar"), createGrupo);
router.get("/:id", authorizeByPermisos("notif_grupos_ver"), getGrupo);
router.put("/:id", authorizeByPermisos("notif_grupos_editar"), updateGrupo);
router.delete(
  "/:id",
  authorizeByPermisos("notif_grupos_eliminar"),
  deleteGrupo
);

// ------- Miembros (alias /usuarios y /miembros) -------
// /usuarios
router.get(
  "/:id/usuarios",
  authorizeByPermisos("notif_grupos_ver"),
  listMiembros
);
router.post(
  "/:id/usuarios",
  authorizeByPermisos("notif_grupos_miembros_editar"),
  addMiembros
);
router.delete(
  "/:id/usuarios/:id_usuario",
  authorizeByPermisos("notif_grupos_miembros_editar"),
  removeMiembro
);

// /miembros (ALIAS para compatibilidad con tu front actual)
router.get(
  "/:id/miembros",
  authorizeByPermisos("notif_grupos_ver"),
  listMiembros
);
router.post(
  "/:id/miembros",
  authorizeByPermisos("notif_grupos_miembros_editar"),
  addMiembros
);
router.delete(
  "/:id/miembros/:id_usuario",
  authorizeByPermisos("notif_grupos_miembros_editar"),
  removeMiembro
);

// ------- Canales -------
router.get("/:id/canales", authorizeByPermisos("notif_grupos_ver"), getCanales);
router.put(
  "/:id/canales",
  authorizeByPermisos("notif_grupos_canales_editar"),
  saveCanales
);

export default router;
