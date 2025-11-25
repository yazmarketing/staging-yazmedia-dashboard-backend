import express from 'express';
import {
  getAttendanceToday,
  checkIn,
  checkOut,
  getAttendanceHistory,
  startBreak,
  endBreak,
} from '../controllers/attendanceController';
import {
  getAllAttendance,
  getAttendanceReports,
} from '../controllers/attendanceManagementController';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = express.Router();

/**
 * Attendance Routes
 * All routes require authentication
 */

// Get today's attendance
router.get('/today', authMiddleware, getAttendanceToday);

// Get attendance history
router.get('/history', authMiddleware, getAttendanceHistory);

// Check in
router.post('/check-in', authMiddleware, checkIn);

// Check out
router.post('/check-out', authMiddleware, checkOut);

// Break management
router.post('/start-break', authMiddleware, startBreak);
router.post('/end-break', authMiddleware, endBreak);

// Management routes (HR, Management, Finance only)
router.get('/management/all', authMiddleware, requireRole('HR', 'MANAGEMENT', 'FINANCE'), getAllAttendance);
router.get('/management/reports', authMiddleware, requireRole('HR', 'MANAGEMENT', 'FINANCE'), getAttendanceReports);

export default router;

