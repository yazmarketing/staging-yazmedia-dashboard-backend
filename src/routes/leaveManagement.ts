import express from 'express';
import {
  getLeaveRequests,
  getLeaveSummary,
  getYearlyManagement,
  createLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
  uploadLeaveRequestDocument,
  uploadLeaveRequestDocumentFile,
  getLeaveRequestDocuments,
  deleteLeaveRequestDocument,
  getLeaveBalance,
  getApprovedOvertimeRequests,
} from '../controllers/leaveManagementController';
import { authMiddleware, requireRole } from '../middleware/auth';
import { upload } from '../utils/fileUpload';

const router = express.Router();

/**
 * Leave Management Routes
 * All routes require authentication
 */

// Create a leave request (Employee, HR, Management)
router.post('/', authMiddleware, createLeaveRequest);

// Get all leave requests with employee information
router.get('/', authMiddleware, getLeaveRequests);

// Get leave balance for employee (Employee, HR, Management)
router.get('/balance', authMiddleware, getLeaveBalance);

// Get approved overtime requests for TOIL (Employee, HR, Management)
router.get('/overtime-requests', authMiddleware, getApprovedOvertimeRequests);

// Get leave summary for all employees (must come before /:id routes)
router.get('/summary', authMiddleware, getLeaveSummary);

// Get yearly management data for all employees (must come before /:id routes)
router.get('/yearly', authMiddleware, getYearlyManagement);

// Approve a leave request (HR and Management only) - must come before /:id routes
router.patch('/:id/approve', authMiddleware, requireRole('HR', 'MANAGEMENT'), approveLeaveRequest);

// Reject a leave request (HR and Management only) - must come before /:id routes
router.patch('/:id/reject', authMiddleware, requireRole('HR', 'MANAGEMENT'), rejectLeaveRequest);

// Get documents for a leave request
router.get('/:id/documents', authMiddleware, getLeaveRequestDocuments);

// Upload a document for a leave request (file upload)
router.post('/:id/documents/upload', authMiddleware, upload.single('file'), uploadLeaveRequestDocumentFile);

// Upload a document for a leave request (URL-based, legacy)
router.post('/:id/documents', authMiddleware, uploadLeaveRequestDocument);

// Delete a document from a leave request - use full path to avoid conflicts
router.delete('/:id/documents/:documentId', authMiddleware, deleteLeaveRequestDocument);

export default router;

