import express from "express";
import {
  createReserva,
  getReservas,
  getReservaById,
  cancelarReserva,
  finalizarReserva,
  updateReserva,
  getReservasEmpleado, // <-- Agregado
} from "../controllers/reservas.controller.js";

const router = express.Router();

router.post("/", createReserva);
router.get("/", getReservas);
router.get("/:id", getReservaById);
router.get("/empleado/:id_empleado", getReservasEmpleado);
router.put("/cancelar/:id", cancelarReserva);
router.put("/finalizar/:id", finalizarReserva);
router.put("/actualizar/:id", updateReserva); // <-- Esta es nueva

export default router;
