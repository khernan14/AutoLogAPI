import { Router } from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuración de Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, "../../uploads/clientes");
        // crear carpeta si no existe
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + "-" + file.originalname.replace(/\s+/g, "_");
        cb(null, unique);
    },
});

function fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith("image/")) {
        return cb(new Error("Tipo de archivo no permitido, solo imágenes"), false);
    }
    cb(null, true);
}

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 2 * 1024 * 1024 }, // máx 2MB
});

const router = Router();

router.get("/", authenticate, authorizeByPermisos("ver_companias"), getClientes);
router.get("/:id", authenticate, authorizeByPermisos("ver_companias"), getClienteById);
router.post("/", authenticate, authorizeByPermisos("crear_companias"), upload.single("logo"), createCliente);
router.put("/:id", authenticate, authorizeByPermisos("editar_companias"), upload.single("logo"), updateCliente);

export default router;
