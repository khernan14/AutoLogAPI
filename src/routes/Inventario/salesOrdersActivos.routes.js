import { Router } from "express";
import { createLineaSO, getLineasBySO } from "../../controllers/Inventario/salesOrdersActivos.controller.js";
import { validateLineaSO } from "../../middleware/validateSalesOrderActivo.js";

const router = Router();

router.get("/so/:id_sales_order", getLineasBySO);
router.post("/", validateLineaSO, createLineaSO);

export default router;
