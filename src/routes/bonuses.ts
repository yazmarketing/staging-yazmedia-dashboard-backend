import { Router } from 'express';
import {
  createBonus,
  getBonuses,
  updateBonus,
  deleteBonus,
  financeApproveBonus,
  managementApproveBonus,
  readyBonusForPayroll,
  applyBonusToPayroll,
  putBonusOnHold,
  rejectBonus,
} from '../controllers/bonusController';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @route   POST /bonuses
 * @desc    Create a new bonus
 * @access  HR, Management, Admin
 * @body    { employeeId, amount, reason, month, year }
 */
router.post(
  '/',
  requireRole('HR', 'MANAGEMENT'),
  createBonus
);

/**
 * @route   GET /bonuses
 * @desc    Get all bonuses with filters (EMPLOYEE can only see their own)
 * @access  All authenticated (EMPLOYEE sees own only)
 * @query   page, pageSize, employeeId, month, year
 */
router.get(
  '/',
  getBonuses
);

/**
 * @route   PATCH /bonuses/:id
 * @desc    Update a bonus (only MANAGEMENT can update approved bonuses)
 * @access  MANAGEMENT only (Finance, HR, Employees cannot edit approved records)
 * @body    { amount?, reason? }
 */
router.patch(
  '/:id',
  requireRole('MANAGEMENT'),
  updateBonus
);

/**
 * @route   DELETE /bonuses/:id
 * @desc    Delete a bonus (only MANAGEMENT can delete approved bonuses)
 * @access  MANAGEMENT only (Finance, HR, Employees cannot delete approved records)
 */
router.delete(
  '/:id',
  requireRole('MANAGEMENT'),
  deleteBonus
);

router.post(
  '/:id/finance-approve',
  requireRole('FINANCE', 'MANAGEMENT'),
  financeApproveBonus
);

router.post(
  '/:id/management-approve',
  requireRole('MANAGEMENT'),
  managementApproveBonus
);

router.post(
  '/:id/ready-for-payroll',
  requireRole('FINANCE'),
  readyBonusForPayroll
);

router.post(
  '/:id/apply-to-payroll',
  requireRole('MANAGEMENT'),
  applyBonusToPayroll
);

router.post(
  '/:id/on-hold',
  requireRole('FINANCE', 'MANAGEMENT'),
  putBonusOnHold
);

router.post(
  '/:id/reject',
  requireRole('FINANCE', 'MANAGEMENT'),
  rejectBonus
);

export default router;

