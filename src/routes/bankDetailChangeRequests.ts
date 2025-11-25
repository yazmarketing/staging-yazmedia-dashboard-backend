import express from 'express';
import {
  createBankDetailChangeRequest,
  getBankDetailChangeRequests,
  getBankDetailChangeRequestById,
  financeReviewBankDetailChangeRequest,
  managementReviewBankDetailChangeRequest,
} from '../controllers/bankDetailChangeRequestController';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = express.Router();

router.get('/', authMiddleware, getBankDetailChangeRequests);
router.get('/:id', authMiddleware, getBankDetailChangeRequestById);
router.post('/', authMiddleware, createBankDetailChangeRequest);
router.post(
  '/:id/finance-review',
  authMiddleware,
  requireRole('FINANCE', 'MANAGEMENT'),
  financeReviewBankDetailChangeRequest
);
router.post(
  '/:id/management-review',
  authMiddleware,
  requireRole('MANAGEMENT'),
  managementReviewBankDetailChangeRequest
);

export default router;






