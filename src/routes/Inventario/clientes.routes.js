import { Router } from "express";
import {
  getClientes,
  getClienteById,
  createCliente,
  updateCliente,
} from "../../controllers/Inventario/clientes.controller.js";
import {
  authenticate,
  authorizeByPermisos,
} from "../../middleware/auth.middleware.js";

// 🆕 usa el uploader pro (lee UPLOADS_PATH y crea carpetas si faltan)
import { makeUploader } from "../../middleware/upload.middleware.js";

const router = Router();

// Subcarpeta específica para logos de clientes
const uploadClientes = makeUploader("clientes");

// Endpoints
router.get(
  "/",
  authenticate,
  authorizeByPermisos("ver_companias"),
  getClientes
);
router.get(
  "/:id",
  authenticate,
  authorizeByPermisos("ver_companias"),
  getClienteById
);

router.post(
  "/",
  authenticate,
  authorizeByPermisos("crear_companias"),
  uploadClientes.single("logo"),
  createCliente
);

router.put(
  "/:id",
  authenticate,
  authorizeByPermisos("editar_companias"),
  uploadClientes.single("logo"),
  updateCliente
);

export default router;
