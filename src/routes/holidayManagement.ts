import express from 'express';
import { getHolidayTypes, getHolidays, createHoliday } from '../controllers/holidayManagementController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

/**
 * Holiday Management Routes
 * All routes require authentication
 */

// Get all holiday types
router.get('/types', authMiddleware, getHolidayTypes);

// Get all holidays with filters
router.get('/', authMiddleware, getHolidays);

// Create a new holiday
router.post('/', authMiddleware, createHoliday);

export default router;

