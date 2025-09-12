import { Router } from "express";
import {
    getSites,
    getSitesByCliente,
    getSiteById,
    createSite,
    updateSite
} from "../../controllers/Inventario/sites.controller.js";

const router = Router();

router.get("/", getSites);                 // Todos los sites
router.get("/company/:idCliente", getSitesByCliente); // Sites por cliente
router.get("/:id", getSiteById);           // Un site específico
router.post("/", createSite);              // Crear site
router.put("/:id", updateSite);            // Actualizar site

export default router;
