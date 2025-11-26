import express from 'express';
import {
  getAllEmployeesForManagement,
  toggleEmployeeStatus,
  manageEmployeeRole,
} from '../controllers/userManagementController';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = express.Router();

/**
 * Employee Management Routes (for role and status management)
 * All routes require authentication and admin/hr role
 */

// Get all employees for management (Management/HR only)
router.get('/management', authMiddleware, requireRole('MANAGEMENT', 'HR'), getAllEmployeesForManagement);

// Toggle employee status - ACTIVE <-> INACTIVE (Management/HR only)
router.patch('/:id/toggle-status', authMiddleware, requireRole('MANAGEMENT', 'HR'), toggleEmployeeStatus);

// Manage employee role (Management/HR only)
router.patch('/:id/role', authMiddleware, requireRole('MANAGEMENT', 'HR'), manageEmployeeRole);

export default router;

