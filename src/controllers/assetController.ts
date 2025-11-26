import { Request, Response } from 'express';
import { prisma } from '../index';
import { IApiResponse } from '../types';
import {
  createAsset as createAssetService,
  updateAsset as updateAssetService,
  assignAsset,
  unassignAsset,
  getAssetById as getAssetByIdService,
} from '../services/assetService';

/**
 * Get all assets with pagination and filters
 * GET /assets
 */
export const getAssets = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const {
      page = '1',
      pageSize = '10',
      status,
      category,
      assetType,
      search,
      manufacturer,
      location,
      assignedTo,
    } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const pageSizeNum = parseInt(pageSize as string) || 10;
    const skip = (pageNum - 1) * pageSizeNum;

    const where: any = {};

    if (status) where.status = status;
    if (category) where.category = category;
    if (assetType) where.assetType = assetType;
    if (manufacturer) {
      where.manufacturer = { contains: manufacturer as string, mode: 'insensitive' };
    }
    if (location) {
      where.location = { contains: location as string, mode: 'insensitive' };
    }
    if (assignedTo) {
      if (assignedTo === '__unassigned__') {
        where.assignedToEmployeeId = null;
      } else {
        where.assignedToEmployeeId = assignedTo as string;
      }
    }
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { assetTag: { contains: search as string, mode: 'insensitive' } },
        { serialNumber: { contains: search as string, mode: 'insensitive' } },
        { model: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        include: {
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              employeeId: true,
              designation: true,
            },
          },
          manufacturer: {
            select: {
              id: true,
              name: true,
            },
          },
          supplier: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSizeNum,
      }),
      prisma.asset.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSizeNum);

    const response: IApiResponse<any> = {
      success: true,
      data: {
        data: assets,
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages,
      },
      message: 'Assets retrieved successfully',
    };

    return res.status(200).json(response);
  } catch (error: any) {
    console.error('Get assets error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve assets',
    } as IApiResponse<null>);
  }
};

/**
 * Get single asset by ID with full details
 * GET /assets/:id
 */
export const getAssetById = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;

    const asset = await getAssetByIdService(id);

    if (!asset) {
      return res.status(404).json({
        success: false,
        error: 'Asset not found',
      } as IApiResponse<null>);
    }

    return res.status(200).json({
      success: true,
      data: asset,
      message: 'Asset retrieved successfully',
    } as IApiResponse<any>);
  } catch (error: any) {
    console.error('Get asset by ID error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve asset',
    } as IApiResponse<null>);
  }
};

/**
 * Create new asset
 * POST /assets
 */
export const createAsset = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const userId = (req as any).user?.userId;
    const {
      name,
      assetTag,
      serialNumber,
      model,
      assetType = 'MAIN_ASSET',
      category,
      manufacturerId,
      supplierId,
      purchaseDate,
      purchaseCost,
      currency = 'AED',
      depreciationMonths,
      warrantyExpiry,
      location,
      condition = 'NEW',
      description,
      notes,
      status = 'AVAILABLE',
      imageUrl,
      invoiceUrl,
    } = req.body;

    // Validate required fields
    if (!name || !category) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, category',
      } as IApiResponse<null>);
    }

    // Check if asset tag already exists (if provided)
    if (assetTag) {
      const existingTag = await prisma.asset.findUnique({
        where: { assetTag },
      });

      if (existingTag) {
        return res.status(409).json({
          success: false,
          error: 'Asset with this tag already exists',
        } as IApiResponse<null>);
      }
    }

    // Create asset using service
    const asset = await createAssetService({
      name,
      assetTag,
      serialNumber,
      model,
      assetType,
      category,
      manufacturerId,
      supplierId,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
      purchaseCost: purchaseCost ? parseFloat(purchaseCost) : undefined,
      currency,
      depreciationMonths: depreciationMonths ? parseInt(depreciationMonths) : undefined,
      warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : undefined,
      location,
      condition,
      description,
      notes,
      status,
      imageUrl,
      invoiceUrl,
      createdBy: userId,
    });

    return res.status(201).json({
      success: true,
      data: asset,
      message: 'Asset created successfully',
    } as IApiResponse<any>);
  } catch (error: any) {
    console.error('Create asset error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create asset',
    } as IApiResponse<null>);
  }
};

/**
 * Update asset
 * PUT /assets/:id
 */
export const updateAsset = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params;
    const updateData = req.body;

    // Check if asset exists
    const existingAsset = await prisma.asset.findUnique({
      where: { id },
    });

    if (!existingAsset) {
      return res.status(404).json({
        success: false,
        error: 'Asset not found',
      } as IApiResponse<null>);
    }

    // Handle date conversions
    const processedData: any = { ...updateData };
    if (processedData.purchaseDate) {
      processedData.purchaseDate = new Date(processedData.purchaseDate);
    }
    if (processedData.warrantyExpiry) {
      processedData.warrantyExpiry = new Date(processedData.warrantyExpiry);
    }
    if (processedData.purchaseCost !== undefined) {
      processedData.purchaseCost = parseFloat(processedData.purchaseCost);
    }
    if (processedData.depreciationMonths !== undefined) {
      processedData.depreciationMonths = parseInt(processedData.depreciationMonths);
    }

    processedData.updatedBy = userId;

    // Update asset using service
    const asset = await updateAssetService(id, processedData);

    return res.status(200).json({
      success: true,
      data: asset,
      message: 'Asset updated successfully',
    } as IApiResponse<any>);
  } catch (error: any) {
    console.error('Update asset error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update asset',
    } as IApiResponse<null>);
  }
};

/**
 * Delete asset
 * DELETE /assets/:id
 */
export const deleteAsset = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;

    const asset = await prisma.asset.findUnique({
      where: { id },
    });

    if (!asset) {
      return res.status(404).json({
        success: false,
        error: 'Asset not found',
      } as IApiResponse<null>);
    }

    await prisma.asset.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: 'Asset deleted successfully',
    } as IApiResponse<null>);
  } catch (error: any) {
    console.error('Delete asset error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete asset',
    } as IApiResponse<null>);
  }
};

/**
 * Assign asset to employee
 * POST /assets/:id/assign
 * - All authenticated users can assign assets
 * - Employees can only assign assets to themselves
 * - HR and MANAGEMENT can assign to anyone
 */
export const assignAssetToEmployee = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;
    const { id } = req.params;
    const { employeeId, notes, expectedReturnDate } = req.body;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: employeeId',
      } as IApiResponse<null>);
    }

    // All users (EMPLOYEE, FINANCE, HR, MANAGEMENT) can assign assets to themselves
    // Only HR and MANAGEMENT can assign to others
    if (userRole === 'EMPLOYEE' || userRole === 'FINANCE') {
      if (employeeId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'You can only assign assets to yourself',
        } as IApiResponse<null>);
      }
    }

    const asset = await assignAsset(id, {
      employeeId,
      assignedBy: userId,
      notes,
      expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : undefined,
    });

    return res.status(200).json({
      success: true,
      data: asset,
      message: 'Asset assigned successfully',
    } as IApiResponse<any>);
  } catch (error: any) {
    console.error('Assign asset error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to assign asset',
    } as IApiResponse<null>);
  }
};

/**
 * Unassign asset from employee
 * POST /assets/:id/unassign
 * - All authenticated users can unassign assets
 * - Employees can only unassign assets assigned to themselves
 * - HR and MANAGEMENT can unassign from anyone
 */
export const unassignAssetFromEmployee = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;
    const { id } = req.params;
    const { notes } = req.body;

    // Check if asset exists and get current assignment
    const asset = await prisma.asset.findUnique({
      where: { id },
      select: {
        assignedToEmployeeId: true,
      },
    });

    if (!asset) {
      return res.status(404).json({
        success: false,
        error: 'Asset not found',
      } as IApiResponse<null>);
    }

    // All users (EMPLOYEE, FINANCE, HR, MANAGEMENT) can unassign assets assigned to themselves
    // Only HR and MANAGEMENT can unassign from others
    if (userRole === 'EMPLOYEE' || userRole === 'FINANCE') {
      if (asset.assignedToEmployeeId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'You can only unassign assets assigned to yourself',
        } as IApiResponse<null>);
      }
    }

    const unassignedAsset = await unassignAsset(id, userId, notes);

    return res.status(200).json({
      success: true,
      data: unassignedAsset,
      message: 'Asset unassigned successfully',
    } as IApiResponse<any>);
  } catch (error: any) {
    console.error('Unassign asset error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to unassign asset',
    } as IApiResponse<null>);
  }
};

/**
 * Get asset statistics
 * GET /assets/stats
 */
export const getAssetStats = async (_req: Request, res: Response): Promise<Response | void> => {
  try {
    const [totalAssets, assignedAssets, availableAssets, maintenanceAssets, retiredAssets, totalCost] = await Promise.all([
      prisma.asset.count(),
      prisma.asset.count({ where: { status: 'ASSIGNED' } }),
      prisma.asset.count({ where: { status: 'AVAILABLE' } }),
      prisma.asset.count({ where: { status: 'MAINTENANCE' } }),
      prisma.asset.count({ where: { status: 'RETIRED' } }),
      prisma.asset.aggregate({
        _sum: { purchaseCost: true },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        total: totalAssets,
        assigned: assignedAssets,
        available: availableAssets,
        maintenance: maintenanceAssets,
        retired: retiredAssets,
        totalCost: totalCost._sum.purchaseCost || 0,
      },
      message: 'Asset statistics retrieved successfully',
    } as IApiResponse<any>);
  } catch (error: any) {
    console.error('Get asset stats error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve asset statistics',
    } as IApiResponse<null>);
  }
};
