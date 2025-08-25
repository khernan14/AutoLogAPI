import express from "express";
import {
  getEmployees,
  AddEmployees,
  updateEmployee,
  deleteEmployee,
  getEmployeesBoss,
} from "../../controllers/AutoLog/Registros/empleados.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const router = express.Router();

// Rutas
router.get("/", authenticate, getEmployees);
router.get("/supervisor", authenticate, getEmployeesBoss);
router.post("/", authenticate, AddEmployees);
router.put("/:id", authenticate, updateEmployee);
router.delete("/:id", authenticate, deleteEmployee);

export default router;
