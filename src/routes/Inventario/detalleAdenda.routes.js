import { Router } from "express";
import { getDetallesByAdenda, createDetalle, updateDetalle } from "../../controllers/Inventario/detalleAdenda.controller.js";
import { validateCreateDetalle, validateUpdateDetalle } from "../../middleware/validateDetalleAdenda.js";

const router = Router();

router.get("/adenda/:id_adenda", getDetallesByAdenda);
router.post("/", validateCreateDetalle, createDetalle);
router.put("/:id", validateUpdateDetalle, updateDetalle);

export default router;
