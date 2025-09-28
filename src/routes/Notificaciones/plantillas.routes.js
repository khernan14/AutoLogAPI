import { Router } from "express";
import {
  listPlantillas,
  createPlantilla,
  updatePlantilla,
  deletePlantilla,
  publishPlantilla,
  previewPlantilla,
  testPlantilla,
  setPlantillaEstado,
} from "../../controllers/Notificaciones/plantillas.controller.js";
import {
  authenticate,
  authorizeByPermisos,
} from "../../middleware/auth.middleware.js";

const router = Router();
router.use(authenticate);

// CRUD
router.get("/", authorizeByPermisos("notif_plantillas_ver"), listPlantillas);
router.post(
  "/",
  authorizeByPermisos("notif_plantillas_editar"),
  createPlantilla
);
router.put(
  "/:id",
  authorizeByPermisos("notif_plantillas_editar"),
  updatePlantilla
);

router.patch(
  "/:id/estado",
  authenticate,
  authorizeByPermisos("notif_plantillas_editar"),
  setPlantillaEstado
);

router.delete(
  "/:id",
  authorizeByPermisos("notif_plantillas_eliminar"),
  deletePlantilla
);

// Publicar como default
router.post(
  "/:id/publicar",
  authorizeByPermisos("notif_plantillas_editar"),
  publishPlantilla
);

// Herramientas
router.post(
  "/preview",
  authorizeByPermisos("notif_plantillas_ver"),
  previewPlantilla
);
router.post(
  "/:id/test",
  authorizeByPermisos("notif_plantillas_editar"),
  testPlantilla
);

export default router;
