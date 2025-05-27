import express from "express";
import {
  getUsers,
  register,
  login,
  updateUser,
  deleteUser,
  updateOwnProfile,
  getUsersById,
} from "../controllers/auth.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/usuarios", authenticate, authorize("Admin"), getUsers);
router.get(
  "/usuarios/:id",
  authenticate,
  // authorize("Admin, Supervisor"),
  getUsersById
);

// Registro de usuarios
router.post("/register", authenticate, authorize("Admin "), register);

// Inicio de sesión
router.post("/login", login);

router.put("/usuarios/:id", authenticate, authorize("Admin"), updateUser);
router.put("/usuarios/perfil/:id", authenticate, updateOwnProfile);
router.delete("/usuarios/:id", authenticate, authorize("Admin"), deleteUser);

export default router;
