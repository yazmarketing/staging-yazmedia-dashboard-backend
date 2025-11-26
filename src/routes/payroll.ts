import express from 'express';
import {
  getPayroll,
  getPayrollById,
  generatePayroll,
  financeApprove,
  managementApprove,
  uploadToBank,
  approveBankPayment,
  rejectPayroll,
  putOnHold,
} from '../controllers/payrollController';
import {
  getSalaryChanges,
  createSalaryChange,
  approveSalaryChange,
  rejectSalaryChange,
  getSalaryHistory,
} from '../controllers/salaryChangeController';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = express.Router();

/**
 * Payroll Routes
 * All routes require authentication
 */

// ============================================
// SALARY CHANGE ENDPOINTS (Must be before :id routes)
// ============================================

/**
 * @route   GET /payroll/salary-changes
 * @desc    Get all salary change requests
 * @access  HR, Finance, Management
 * @query   page, pageSize, status, employeeId, search
 */
router.get(
  '/salary-changes',
  authMiddleware,
  requireRole('HR', 'FINANCE', 'MANAGEMENT', 'EMPLOYEE'),
  getSalaryChanges
);

/**
 * @route   POST /payroll/salary-changes
 * @desc    Create a salary change request
 * @access  HR, Management
 * @body    { employeeId, newBaseSalary, newAccommodationAllowance, newHousingAllowance, newTransportationAllowance, newTotalSalary, changeType, reason, effectiveDate }
 */
router.post(
  '/salary-changes',
  authMiddleware,
  requireRole('HR', 'MANAGEMENT'),
  createSalaryChange
);

/**
 * @route   GET /payroll/salary-history/:employeeId
 * @desc    Get salary history for an employee
 * @access  HR, Finance, Management (EMPLOYEE can only view own history via controller check)
 * @query   page, pageSize
 */
router.get(
  '/salary-history/:employeeId',
  authMiddleware,
  requireRole('HR', 'FINANCE', 'MANAGEMENT', 'EMPLOYEE'),
  getSalaryHistory
);

/**
 * @route   PATCH /payroll/salary-changes/:id/approve
 * @desc    Approve salary change (final approval)
 * @access  FINANCE, MANAGEMENT (HR can create but not approve)
 */
router.patch(
  '/salary-changes/:id/approve',
  authMiddleware,
  requireRole('FINANCE', 'MANAGEMENT'),
  approveSalaryChange
);

/**
 * @route   PATCH /payroll/salary-changes/:id/reject
 * @desc    Reject salary change request
 * @access  FINANCE, MANAGEMENT
 * @body    { rejectionReason }
 */
router.patch(
  '/salary-changes/:id/reject',
  authMiddleware,
  requireRole('FINANCE', 'MANAGEMENT'),
  rejectSalaryChange
);

// ============================================
// PAYROLL ENDPOINTS
// ============================================

/**
 * @route   POST /payroll/generate
 * @desc    Generate payroll for a specific month
 * @access  Finance, Management
 * @body    { month, year, employeeIds? }
 */
router.post('/generate', authMiddleware, requireRole('FINANCE', 'MANAGEMENT'), generatePayroll);

/**
 * @route   GET /payroll
 * @desc    Get all payroll records with filters (EMPLOYEE can only see their own)
 * @access  All authenticated (EMPLOYEE sees own only)
 * @query   page, pageSize, status, employeeId, month, year
 */
router.get('/', authMiddleware, getPayroll);

/**
 * @route   POST /payroll/:id/finance-approve
 * @desc    Finance approval (Stage 1)
 * @access  FINANCE role only
 * @body    { approvalNotes?: string }
 */
router.post(
  '/:id/finance-approve',
  authMiddleware,
  requireRole('FINANCE'),
  financeApprove
);

/**
 * @route   POST /payroll/:id/management-approve
 * @desc    Management approval (Stage 2)
 * @access  MANAGEMENT role only
 * @body    { approvalNotes?: string }
 */
router.post(
  '/:id/management-approve',
  authMiddleware,
  requireRole('MANAGEMENT'),
  managementApprove
);

/**
 * @route   POST /payroll/:id/upload-to-bank
 * @desc    Upload to bank (Stage 3)
 * @access  FINANCE role only
 * @body    { bankReference?: string, uploadNotes?: string }
 */
router.post(
  '/:id/upload-to-bank',
  authMiddleware,
  requireRole('FINANCE'),
  uploadToBank
);

/**
 * @route   POST /payroll/:id/approve-bank-payment
 * @desc    Approve bank payment (Stage 4 - Final)
 * @access  MANAGEMENT role only
 * @body    { paymentReference?: string, paymentNotes?: string }
 */
router.post(
  '/:id/approve-bank-payment',
  authMiddleware,
  requireRole('MANAGEMENT'),
  approveBankPayment
);

/**
 * @route   POST /payroll/:id/reject
 * @desc    Reject payroll - returns to PENDING for Finance to fix
 * @access  MANAGEMENT role only (Finance uses "On Hold" instead)
 * @body    { rejectionReason: string }
 */
router.post(
  '/:id/reject',
  authMiddleware,
  requireRole('MANAGEMENT'),
  rejectPayroll
);

/**
 * @route   POST /payroll/:id/on-hold
 * @desc    Put payroll on hold (Finance or Management can use)
 * @access  FINANCE, MANAGEMENT roles
 * @body    { onHoldReason: string }
 */
router.post(
  '/:id/on-hold',
  authMiddleware,
  requireRole('FINANCE', 'MANAGEMENT'),
  putOnHold
);

/**
 * @route   GET /payroll/:id
 * @desc    Get single payroll record by ID
 * @access  Finance, Management
 */
router.get('/:id', authMiddleware, requireRole('FINANCE', 'MANAGEMENT'), getPayrollById);

export default router;

