import { Request, Response } from 'express';
import { prisma } from '../index';

/**
 * Get all reimbursement types
 * GET /reimbursement-types
 */
export const getReimbursementTypes = async (req: Request, res: Response): Promise<void> => {
  try {
    const { includeInactive } = req.query;

    const where: any = {};
    if (includeInactive !== 'true') {
      where.isActive = true;
    }

    const types = await (prisma as any).reimbursementType.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: types,
      message: 'Reimbursement types retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching reimbursement types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reimbursement types',
    });
  }
};

/**
 * Create a new reimbursement type
 * POST /reimbursement-types
 */
export const createReimbursementType = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body;

    if (!name) {
      res.status(400).json({
        success: false,
        message: 'Name is required',
      });
      return;
    }

    // Check if type already exists
    const existing = await (prisma as any).reimbursementType.findUnique({
      where: { name },
    });

    if (existing) {
      res.status(400).json({
        success: false,
        message: 'Reimbursement type already exists',
      });
      return;
    }

    const type = await (prisma as any).reimbursementType.create({
      data: {
        name,
        description: description || null,
      },
    });

    res.status(201).json({
      success: true,
      data: type,
      message: 'Reimbursement type created successfully',
    });
  } catch (error) {
    console.error('Error creating reimbursement type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create reimbursement type',
    });
  }
};

/**
 * Update a reimbursement type
 * PATCH /reimbursement-types/:id
 */
export const updateReimbursementType = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    // Check if type exists
    const existing = await (prisma as any).reimbursementType.findUnique({
      where: { id },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: 'Reimbursement type not found',
      });
      return;
    }

    // Check if new name already exists (if name is being changed)
    if (name && name !== existing.name) {
      const duplicate = await (prisma as any).reimbursementType.findUnique({
        where: { name },
      });

      if (duplicate) {
        res.status(400).json({
          success: false,
          message: 'Reimbursement type with this name already exists',
        });
        return;
      }
    }

    const updated = await (prisma as any).reimbursementType.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json({
      success: true,
      data: updated,
      message: 'Reimbursement type updated successfully',
    });
  } catch (error) {
    console.error('Error updating reimbursement type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update reimbursement type',
    });
  }
};

/**
 * Delete a reimbursement type
 * DELETE /reimbursement-types/:id
 */
export const deleteReimbursementType = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if type exists
    const existing = await (prisma as any).reimbursementType.findUnique({
      where: { id },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: 'Reimbursement type not found',
      });
      return;
    }

    // Check if type is being used
    const count = await (prisma as any).reimbursement.count({
      where: { reimbursementTypeId: id },
    });

    if (count > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot delete reimbursement type. It is being used by ${count} reimbursement claim(s). Deactivate it instead.`,
      });
      return;
    }

    await (prisma as any).reimbursementType.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Reimbursement type deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting reimbursement type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete reimbursement type',
    });
  }
};

/**
 * Toggle reimbursement type active status
 * PATCH /reimbursement-types/:id/toggle
 */
export const toggleReimbursementTypeStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if type exists
    const existing = await (prisma as any).reimbursementType.findUnique({
      where: { id },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: 'Reimbursement type not found',
      });
      return;
    }

    const updated = await (prisma as any).reimbursementType.update({
      where: { id },
      data: {
        isActive: !existing.isActive,
      },
    });

    res.json({
      success: true,
      data: updated,
      message: `Reimbursement type ${updated.isActive ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error) {
    console.error('Error toggling reimbursement type status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle reimbursement type status',
    });
  }
};

