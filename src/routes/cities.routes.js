import express from "express";
import {
  getCities,
  addCity,
  updateCity,
  deleteCity,
} from "../controllers/cities.controller.js";
import {
  authenticate,
  authorizeByPermisos,
} from "../middleware/auth.middleware.js";

const router = express.Router();

// Routes

router.get("/", authenticate, authorizeByPermisos("ver_ciudades"), getCities);
router.post("/", authenticate, authorizeByPermisos("crear_ciudades"), addCity);
router.put("/:id", authorizeByPermisos("editar_ciudades"), updateCity);
router.delete("/:id", authorizeByPermisos("eliminar_ciudades"), deleteCity);

export default router;
