import express from 'express';
import {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  patchUpdateEmployee,
  deleteEmployee,
} from '../controllers/employeeController';
import { getEmployeeProfile } from '../controllers/employeeProfileController';
import {
  getAllEmployeesForManagement,
  toggleEmployeeStatus,
  manageEmployeeRole,
} from '../controllers/userManagementController';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = express.Router();

/**
 * Employee Routes
 * All routes require authentication
 */

// Get all employees (accessible to all authenticated users)
router.get('/', authMiddleware, getEmployees);

// Get all employees for management (view and manage roles/status) - Management/HR
router.get('/management', authMiddleware, requireRole('MANAGEMENT', 'HR'), getAllEmployeesForManagement);

// Get comprehensive employee profile (all tabs)
router.get('/:id/profile', authMiddleware, getEmployeeProfile);

// Get single employee by ID (accessible to all authenticated users)
router.get('/:id', authMiddleware, getEmployeeById);

// Create employee (HR and Management only)
router.post('/', authMiddleware, requireRole('HR', 'MANAGEMENT'), createEmployee);

// Toggle employee status - ACTIVE <-> INACTIVE (Management/HR only)
router.patch('/:id/toggle-status', authMiddleware, requireRole('MANAGEMENT', 'HR'), toggleEmployeeStatus);

// Manage employee role (Management/HR only)
router.patch('/:id/role', authMiddleware, requireRole('MANAGEMENT', 'HR'), manageEmployeeRole);

// Update employee (HR and Management only) - PATCH for partial updates with nested fields
router.patch('/:id', authMiddleware, requireRole('HR', 'MANAGEMENT'), patchUpdateEmployee);

// Update employee (HR and Management only) - PUT for backward compatibility
router.put('/:id', authMiddleware, requireRole('HR', 'MANAGEMENT'), updateEmployee);

// Delete employee (Management only)
router.delete('/:id', authMiddleware, requireRole('MANAGEMENT'), deleteEmployee);

export default router;

