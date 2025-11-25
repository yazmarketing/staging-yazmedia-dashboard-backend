import express from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  createOvertimeRequest,
  getMyOvertimeRequests,
  getPendingOvertimeRequests,
  approveOvertimeRequest,
  rejectOvertimeRequest,
} from '../controllers/overtimeRequestController';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * POST /overtime-requests
 * Create a new overtime request
 * Body: { clientId, projectId, reason, canDoNextDay, urgencyReason?, requestedHours, requestedDate }
 */
router.post('/', createOvertimeRequest);

/**
 * GET /overtime-requests/my-requests
 * Get all overtime requests for the logged-in employee
 * Query: page, pageSize, status
 */
router.get('/my-requests', getMyOvertimeRequests);

/**
 * GET /overtime-requests/pending-approvals
 * Get pending overtime requests for the logged-in line manager
 * Query: page, pageSize
 */
router.get('/pending-approvals', getPendingOvertimeRequests);

/**
 * PATCH /overtime-requests/:id/approve
 * Approve an overtime request (line manager only)
 */
router.patch('/:id/approve', approveOvertimeRequest);

/**
 * PATCH /overtime-requests/:id/reject
 * Reject an overtime request (line manager only)
 * Body: { rejectionReason }
 */
router.patch('/:id/reject', rejectOvertimeRequest);

export default router;

