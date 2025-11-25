import { Router } from 'express';
import {
  createDeduction,
  getDeductions,
  financeApproveDeduction,
  managementApproveDeduction,
  readyDeductionForPayroll,
  applyDeductionToPayroll,
  putDeductionOnHold,
  rejectDeduction,
  deleteDeduction,
} from '../controllers/deductionController';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @route   POST /deductions
 * @desc    Create a new deduction
 * @access  HR, Management, Finance, Admin
 * @body    { employeeId, type, amount, reason, month, year }
 */
router.post(
  '/',
  requireRole('HR', 'MANAGEMENT', 'FINANCE'),
  createDeduction
);

/**
 * @route   GET /deductions
 * @desc    Get all deductions with filters (EMPLOYEE can only see their own)
 * @access  All authenticated (EMPLOYEE sees own only)
 * @query   page, pageSize, employeeId, type, month, year, status
 */
router.get(
  '/',
  getDeductions
);

router.post(
  '/:id/finance-approve',
  requireRole('FINANCE', 'MANAGEMENT'),
  financeApproveDeduction
);

router.post(
  '/:id/management-approve',
  requireRole('MANAGEMENT'),
  managementApproveDeduction
);

router.post(
  '/:id/ready-for-payroll',
  requireRole('FINANCE'),
  readyDeductionForPayroll
);

router.post(
  '/:id/apply-to-payroll',
  requireRole('MANAGEMENT'),
  applyDeductionToPayroll
);

router.post(
  '/:id/on-hold',
  requireRole('FINANCE', 'MANAGEMENT'),
  putDeductionOnHold
);

router.post(
  '/:id/reject',
  requireRole('FINANCE', 'MANAGEMENT'),
  rejectDeduction
);

/**
 * @route   DELETE /deductions/:id
 * @desc    Delete a deduction (only MANAGEMENT can delete approved deductions)
 * @access  MANAGEMENT only (Finance, HR, Employees cannot delete approved records)
 */
router.delete(
  '/:id',
  requireRole('MANAGEMENT'),
  deleteDeduction
);

export default router;

