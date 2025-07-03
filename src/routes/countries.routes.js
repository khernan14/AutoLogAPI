import express from "express";
import {
  getCountries,
  addCountry,
  updateCountry,
  deleteCountry,
} from "../controllers/countries.controller.js";
import {
  authenticate,
  authorize,
  authorizeByPermisos,
} from "../middleware/auth.middleware.js";

const router = express.Router();

// Routes
router.get("/", authenticate, authorizeByPermisos("ver_paises"), getCountries);
router.post("/", authenticate, authorizeByPermisos("crear_paises"), addCountry);
router.put(
  "/:id",
  authenticate,
  authorizeByPermisos("editar_paises"),
  updateCountry
);
router.delete("/:id", authenticate, authorize("Admin"), deleteCountry);

export default router;
