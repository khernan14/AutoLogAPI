import express from 'express';
import { getEmployees, AddEmployees, updateEmployee, deleteEmployee } from '../controllers/empleados.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// Rutas
router.get('/', authenticate, authorize('Admin', 'Supervisor'), getEmployees);
router.post('/', authenticate, authorize('Admin'), AddEmployees);
router.put('/:id', authenticate, authorize('Admin'), updateEmployee);
router.delete('/:id', authenticate, authorize('Admin'), deleteEmployee);

export default router;
