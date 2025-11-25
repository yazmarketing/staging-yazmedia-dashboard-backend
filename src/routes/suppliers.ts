import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../index';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * Get all suppliers
 * GET /suppliers
 */
router.get('/', async (_req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: { name: 'asc' },
    });

    return res.status(200).json({
      success: true,
      data: suppliers,
      message: 'Suppliers retrieved successfully',
    });
  } catch (error: any) {
    console.error('Get suppliers error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve suppliers',
    });
  }
});

/**
 * Create new supplier
 * POST /suppliers
 */
router.post('/', async (req, res) => {
  try {
    const { name, contactName, email, phone, address, website } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Supplier name is required',
      });
    }

    // Check if supplier already exists
    const existing = await prisma.supplier.findUnique({
      where: { name: name.trim() },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Supplier with this name already exists',
      });
    }

    const supplier = await prisma.supplier.create({
      data: {
        name: name.trim(),
        contactName: contactName?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        website: website?.trim() || null,
      },
    });

    return res.status(201).json({
      success: true,
      data: supplier,
      message: 'Supplier created successfully',
    });
  } catch (error: any) {
    console.error('Create supplier error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create supplier',
    });
  }
});

export default router;

