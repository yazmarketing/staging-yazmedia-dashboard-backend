import { Router } from 'express';
import {
  submitReimbursement,
  getReimbursements,
  financeApproveReimbursement,
  managementApproveReimbursement,
  uploadReimbursementToBank,
  markReimbursementPaid,
  putReimbursementOnHold,
  rejectReimbursement,
} from '../controllers/reimbursementController';
import {
  getReimbursementTypes,
  createReimbursementType,
  updateReimbursementType,
  deleteReimbursementType,
  toggleReimbursementTypeStatus,
} from '../controllers/reimbursementTypeController';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();

// ============================================
// REIMBURSEMENT TYPE ENDPOINTS (Admin/HR only)
// ============================================

/**
 * @route   GET /reimbursement-types
 * @desc    Get all reimbursement types
 * @access  All authenticated users
 * @query   includeInactive (optional, default: false)
 */
router.get('/types', authMiddleware, getReimbursementTypes);

/**
 * @route   POST /reimbursement-types
 * @desc    Create a new reimbursement type
 * @access  Admin, HR
 * @body    { name, description? }
 */
router.post(
  '/types',
  authMiddleware,
  requireRole('MANAGEMENT', 'HR'),
  createReimbursementType
);

/**
 * @route   PATCH /reimbursement-types/:id
 * @desc    Update a reimbursement type
 * @access  Admin, HR
 * @body    { name?, description?, isActive? }
 */
router.patch(
  '/types/:id',
  authMiddleware,
  requireRole('MANAGEMENT', 'HR'),
  updateReimbursementType
);

/**
 * @route   PATCH /reimbursement-types/:id/toggle
 * @desc    Toggle reimbursement type active status
 * @access  Admin, HR
 */
router.patch(
  '/types/:id/toggle',
  authMiddleware,
  requireRole('MANAGEMENT', 'HR'),
  toggleReimbursementTypeStatus
);

/**
 * @route   DELETE /reimbursement-types/:id
 * @desc    Delete a reimbursement type
 * @access  Admin, HR
 */
router.delete(
  '/types/:id',
  authMiddleware,
  requireRole('MANAGEMENT', 'HR'),
  deleteReimbursementType
);

// ============================================
// REIMBURSEMENT CLAIM ENDPOINTS
// ============================================

/**
 * @route   POST /reimbursements
 * @desc    Submit a new reimbursement claim
 * @access  All authenticated users
 * @body    { amount, reimbursementTypeId, description, receiptUrl? }
 */
router.post('/', authMiddleware, submitReimbursement);

/**
 * @route   GET /reimbursements
 * @desc    Get all reimbursement claims with filters (EMPLOYEE can only see their own)
 * @access  All authenticated (EMPLOYEE sees own only)
 * @query   page, pageSize, status, employeeId, reimbursementTypeId, startDate, endDate
 */
router.get(
  '/',
  authMiddleware,
  getReimbursements
);

router.post(
  '/:id/finance-approve',
  authMiddleware,
  requireRole('FINANCE'),
  financeApproveReimbursement
);

router.post(
  '/:id/management-approve',
  authMiddleware,
  requireRole('MANAGEMENT'),
  managementApproveReimbursement
);

router.post(
  '/:id/upload-to-bank',
  authMiddleware,
  requireRole('FINANCE'),
  uploadReimbursementToBank
);

router.post(
  '/:id/mark-paid',
  authMiddleware,
  requireRole('MANAGEMENT'),
  markReimbursementPaid
);

router.post(
  '/:id/on-hold',
  authMiddleware,
  requireRole('FINANCE', 'MANAGEMENT'),
  putReimbursementOnHold
);

router.post(
  '/:id/reject',
  authMiddleware,
  requireRole('FINANCE', 'MANAGEMENT'),
  rejectReimbursement
);

export default router;

