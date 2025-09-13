// src/routes/Public/publicActivos.routes.js
import { Router } from "express";
import {
  getPublicActivoByCodigo,
  getQRImageByCodigo,
  issuePublicLinkForActivo, // 🔹 nuevo
} from "../../controllers/Public/publicActivos.controller.js";

// Si usas middleware de auth/permiso:
import {
  authenticate,
  authorizeByPermisos,
} from "../../middleware/auth.middleware.js";

const router = Router();

// 🔒 privado: genera URL firmada para QR
router.get(
  "/activos/:id/public-link",
  authenticate,
  authorizeByPermisos(["crear_QR"]), // o el permiso que uses
  issuePublicLinkForActivo
);

// 🌐 público: JSON del activo (valida token si PUBLIC_REQUIRE_TOKEN=true)
router.get("/activos/:codigo", getPublicActivoByCodigo);

// 🌐 público/útil: QR PNG con URL firmada embebida
router.get("/activos/:codigo/qr", getQRImageByCodigo);

export default router;
