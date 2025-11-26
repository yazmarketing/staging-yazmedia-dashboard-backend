import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  getClients,
  createClient,
  getProjectsByClient,
  createProject,
  getClientsAndProjectsForSelection,
} from '../controllers/clientProjectController';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /clients-projects/for-selection
 * Get all active clients and projects for dropdown selection
 * Accessible to all authenticated users
 */
router.get('/for-selection', getClientsAndProjectsForSelection);

/**
 * GET /clients
 * Get all clients with pagination and filters
 * Query: page, pageSize, search, isActive
 */
router.get('/clients', getClients);

/**
 * POST /clients
 * Create a new client (Admin/HR only)
 * Body: { name, email?, phone?, address?, city?, country?, description? }
 */
router.post('/clients', requireRole('MANAGEMENT', 'HR'), createClient);

/**
 * GET /clients/:clientId/projects
 * Get all projects for a specific client
 * Query: page, pageSize, isActive
 */
router.get('/clients/:clientId/projects', getProjectsByClient);

/**
 * POST /projects
 * Create a new project (Admin/HR only)
 * Body: { name, clientId, description?, startDate?, endDate? }
 */
router.post('/projects', requireRole('MANAGEMENT', 'HR'), createProject);

export default router;

