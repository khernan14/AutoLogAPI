import { Router } from "express";
import { upload } from "../../middleware/upload.middleware.js";
import { asociarImagenes } from "../../controllers/AutoLog/Registros/registros.controller.js";

const router = Router();

// Ruta solo para subida de imágenes (sin express.json)
router.post("/:id/upload", upload.array("imagenes", 10), asociarImagenes);

export default router;
