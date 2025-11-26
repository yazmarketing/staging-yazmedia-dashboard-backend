import express from 'express';
import { getLeaveTypeColors, getCalendarView, createLeaveTypeColor } from '../controllers/calendarViewController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

/**
 * Calendar View Routes
 * All routes require authentication
 */

// Get all leave type colors
router.get('/leave-type-colors', authMiddleware, getLeaveTypeColors);

// Get calendar view for employees
router.get('/view', authMiddleware, getCalendarView);

// Create or update leave type color
router.post('/leave-type-colors', authMiddleware, createLeaveTypeColor);

export default router;

