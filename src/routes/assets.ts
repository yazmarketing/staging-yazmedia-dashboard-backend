import { Router } from 'express';
import {
  getAssets,
  getAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
  assignAssetToEmployee,
  unassignAssetFromEmployee,
  getAssetStats,
} from '../controllers/assetController';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get asset statistics
router.get('/stats', getAssetStats);

// Get all assets with pagination and filters (all authenticated users)
router.get('/', getAssets);

// Get single asset by ID (all authenticated users)
router.get('/:id', getAssetById);

// Create new asset (all authenticated users)
router.post('/', createAsset);

// Update asset (only HR and MANAGEMENT)
router.put('/:id', requireRole('HR', 'MANAGEMENT'), updateAsset);

// Delete asset (only HR and MANAGEMENT)
router.delete('/:id', requireRole('HR', 'MANAGEMENT'), deleteAsset);

// Assign asset to employee (all authenticated users, but employees can only assign to themselves)
router.post('/:id/assign', assignAssetToEmployee);

// Unassign asset from employee (all authenticated users, but employees can only unassign from themselves)
router.post('/:id/unassign', unassignAssetFromEmployee);

export default router;

