import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../index';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * Get all manufacturers
 * GET /manufacturers
 */
router.get('/', async (_req, res) => {
  try {
    const manufacturers = await prisma.manufacturer.findMany({
      orderBy: { name: 'asc' },
    });

    return res.status(200).json({
      success: true,
      data: manufacturers,
      message: 'Manufacturers retrieved successfully',
    });
  } catch (error: any) {
    console.error('Get manufacturers error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve manufacturers',
    });
  }
});

/**
 * Create new manufacturer
 * POST /manufacturers
 */
router.post('/', async (req, res) => {
  try {
    const { name, description, website } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Manufacturer name is required',
      });
    }

    // Check if manufacturer already exists
    const existing = await prisma.manufacturer.findUnique({
      where: { name: name.trim() },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Manufacturer with this name already exists',
      });
    }

    const manufacturer = await prisma.manufacturer.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        website: website?.trim() || null,
      },
    });

    return res.status(201).json({
      success: true,
      data: manufacturer,
      message: 'Manufacturer created successfully',
    });
  } catch (error: any) {
    console.error('Create manufacturer error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create manufacturer',
    });
  }
});

export default router;

