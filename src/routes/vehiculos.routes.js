import express from "express";
import {
  getVehiculos,
  addVehiculo,
  updateVehiculo,
  deleteVehiculo,
  listarVehiculosEmpleado,
  getUbicaciones,
} from "../controllers/vehiculos.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const router = express.Router();

// Routes
router.get("/", getVehiculos);
router.get("/ubicaciones", authenticate, getUbicaciones);
router.get("/:id", listarVehiculosEmpleado);
router.post("/", authenticate, authorize("Admin", "Supervisor"), addVehiculo);
router.put("/:id", authenticate, updateVehiculo);
router.delete("/:id", authenticate, authorize("Admin"), deleteVehiculo);

export default router;
