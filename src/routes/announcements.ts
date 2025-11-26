import express from 'express';
import {
  getAnnouncements,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  publishAnnouncement,
  getRecipientsData,
} from '../controllers/announcementController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

/**
 * Announcement Routes
 * All routes require authentication
 */

// Get recipients data (departments with employees + all employees list)
router.get('/recipients/data', authMiddleware, getRecipientsData);

// Get all announcements with filters
router.get('/', authMiddleware, getAnnouncements);

// Get single announcement by ID
router.get('/:id', authMiddleware, getAnnouncementById);

// Create new announcement
router.post('/', authMiddleware, createAnnouncement);

// Update announcement
router.put('/:id', authMiddleware, updateAnnouncement);

// Delete announcement
router.delete('/:id', authMiddleware, deleteAnnouncement);

// Publish announcement
router.patch('/:id/publish', authMiddleware, publishAnnouncement);

export default router;

