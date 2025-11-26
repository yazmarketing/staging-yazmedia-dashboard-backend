import { Router } from 'express';
import { getDeductionTypes } from '../controllers/deductionTypeController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @route   GET /deduction-types
 * @desc    Get all deduction types
 * @access  All Authenticated
 */
router.get('/', getDeductionTypes);

export default router;

