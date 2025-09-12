import { Router } from "express";
import { getPublicActivoByCodigo, getQRImageByCodigo } from "../../controllers/Public/publicActivos.controller.js";

const router = Router();

// JSON público del activo por código
router.get("/activos/:codigo", getPublicActivoByCodigo);

// PNG del QR (opcional)
router.get("/activos/:codigo/qr", getQRImageByCodigo);

export default router;
