import { Router } from "express";
import { getAdendas, getAdendaById, getAdendasByContrato, createAdenda, updateAdenda } from "../../controllers/Inventario/adendas.controller.js";
import { validateCreateAdenda, validateUpdateAdenda } from "../../middleware/validateAdenda.js";

const router = Router();

router.get("/", getAdendas);
router.get("/:id", getAdendaById);
router.get("/contrato/:id_contrato", getAdendasByContrato);
router.post("/", validateCreateAdenda, createAdenda);
router.put("/:id", validateUpdateAdenda, updateAdenda);

export default router;
