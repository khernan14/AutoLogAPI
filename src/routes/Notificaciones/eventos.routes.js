import { Router } from "express";
import {
  listEventos,
  createEvento,
  getEvento,
  updateEvento,
  deleteEvento,
  getEventoGrupos,
  setEventoGrupos,
  setEventoEstado,
} from "../../controllers/Notificaciones/eventos.controller.js";

import {
  authenticate,
  authorizeByPermisos,
} from "../../middleware/auth.middleware.js";

const router = Router();
router.use(authenticate);

// Eventos
router.get("/", authorizeByPermisos("notif_eventos_ver"), listEventos);
router.post("/", authorizeByPermisos("notif_eventos_editar"), createEvento);
router.get("/:id", authorizeByPermisos("notif_eventos_ver"), getEvento);
router.put("/:id", authorizeByPermisos("notif_eventos_editar"), updateEvento);
router.delete(
  "/:id",
  authorizeByPermisos("notif_eventos_eliminar"),
  deleteEvento
);

// Estado (toggle on/off)
router.patch(
  "/:id/estado",
  authorizeByPermisos("notif_eventos_editar"),
  setEventoEstado
);

// Grupos asignados al evento
router.get(
  "/:id/grupos",
  authorizeByPermisos("notif_eventos_ver"),
  getEventoGrupos
);
router.put(
  "/:id/grupos",
  authorizeByPermisos("notif_eventos_editar"),
  setEventoGrupos
);

export default router;
