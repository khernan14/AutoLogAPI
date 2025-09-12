import { Router } from "express";
import { getContratos, getContratoById, createContrato, updateContrato } from "../../controllers/Inventario/contratos.controller.js";
import { validateCreateContrato, validateUpdateContrato } from "../../middleware/validateContrato.js";

const router = Router();

router.get("/", getContratos);
router.get("/:id", getContratoById);
router.post("/", validateCreateContrato, createContrato);
router.put("/:id", validateUpdateContrato, updateContrato);

export default router;
