import { Router } from "express";
import { getSOs, getSOById, createSO, updateSO } from "../../controllers/Inventario/salesOrders.controller.js";
import { validateCreateSO, validateUpdateSO } from "../../middleware/validateSalesOrder.js";

const router = Router();

router.get("/", getSOs);
router.get("/:id", getSOById);
router.post("/", validateCreateSO, createSO);
router.put("/:id", validateUpdateSO, updateSO);

export default router;
