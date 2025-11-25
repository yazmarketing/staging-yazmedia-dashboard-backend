import { Router } from 'express';
import { getBonusTypes } from '../controllers/bonusTypeController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @route   GET /bonus-types
 * @desc    Get all bonus types
 * @access  All Authenticated
 */
router.get('/', getBonusTypes);

export default router;

