import { prisma } from '../index';
import { generateAssetTag, generateQRCodeUrl, calculateDepreciatedValue } from '../utils/assetHelpers';

/**
 * Map old condition values to new simplified ones
 */
const mapCondition = (condition?: string): 'NEW' | 'USED' | 'DAMAGED' => {
  if (!condition) return 'NEW';
  
  // Map old values to new simplified values
  if (condition === 'EXCELLENT' || condition === 'GOOD' || condition === 'FAIR' || condition === 'POOR') {
    return 'USED';
  }
  
  if (condition === 'NEW' || condition === 'USED' || condition === 'DAMAGED') {
    return condition as 'NEW' | 'USED' | 'DAMAGED';
  }
  
  return 'NEW';
};

export interface CreateAssetData {
  name: string;
  assetTag?: string;
  serialNumber?: string;
  model?: string;
  assetType: 'MAIN_ASSET' | 'ACCESSORY' | 'SOFTWARE' | 'FURNITURE';
  category: string;
  manufacturerId?: string;
  supplierId?: string;
  purchaseDate?: Date;
  purchaseCost?: number;
  currency?: string;
  depreciationMonths?: number;
  warrantyExpiry?: Date;
  location?: string;
  condition?: 'NEW' | 'USED' | 'DAMAGED';
  description?: string;
  notes?: string;
  status?: 'AVAILABLE' | 'ASSIGNED' | 'IN_USE' | 'MAINTENANCE' | 'RETIRED' | 'LOST' | 'DAMAGED';
  imageUrl?: string;
  invoiceUrl?: string;
  createdBy?: string;
}

export interface UpdateAssetData extends Partial<CreateAssetData> {
  updatedBy?: string;
}

export interface AssignAssetData {
  employeeId: string;
  assignedBy: string;
  notes?: string;
  expectedReturnDate?: Date;
}

/**
 * Create a new asset with auto-generated tag and QR code
 */
export const createAsset = async (data: CreateAssetData, maxRetries: number = 3) => {
  let attempts = 0;
  
  while (attempts < maxRetries) {
    try {
      // Generate asset tag if not provided
      let assetTag = data.assetTag;
      if (!assetTag) {
        assetTag = await generateAssetTag();
      }

      // Check if tag already exists before attempting to create
      if (assetTag) {
        const existingAsset = await prisma.asset.findUnique({
          where: { assetTag },
          select: { id: true },
        });

        if (existingAsset) {
          console.warn(`⚠️  Asset tag ${assetTag} already exists, generating new tag...`);
          // Generate a new tag if the provided/existing one is taken
          assetTag = await generateAssetTag();
          attempts++;
          continue;
        }
      }

      // Create asset
      const asset = await prisma.asset.create({
        data: {
          name: data.name,
          assetTag,
          serialNumber: data.serialNumber,
          model: data.model,
          assetType: data.assetType,
          category: data.category as any,
          manufacturerId: data.manufacturerId || null,
          supplierId: data.supplierId || null,
          purchaseDate: data.purchaseDate,
          purchaseCost: data.purchaseCost,
          currency: data.currency || 'AED',
          depreciationMonths: data.depreciationMonths,
          warrantyExpiry: data.warrantyExpiry,
          location: data.location,
          condition: mapCondition(data.condition) as any,
          description: data.description,
          notes: data.notes,
          status: data.status || 'AVAILABLE',
          imageUrl: data.imageUrl,
          invoiceUrl: data.invoiceUrl,
          createdBy: data.createdBy,
          // Generate QR code URL
          qrCode: generateQRCodeUrl(assetTag), // Will be updated with actual asset ID after creation
        },
        include: {
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              employeeId: true,
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
      });

      // Update QR code with actual asset ID
      const updatedAsset = await prisma.asset.update({
        where: { id: asset.id },
        data: {
          qrCode: generateQRCodeUrl(asset.id),
        },
        include: {
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              employeeId: true,
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
      });

      // Calculate current value if purchase data exists
      if (updatedAsset.purchaseCost && updatedAsset.purchaseDate && updatedAsset.depreciationMonths) {
        const currentValue = calculateDepreciatedValue(
          updatedAsset.purchaseCost,
          updatedAsset.purchaseDate,
          updatedAsset.depreciationMonths
        );
        
        await prisma.asset.update({
          where: { id: updatedAsset.id },
          data: { currentValue },
        });
        
        updatedAsset.currentValue = currentValue;
      }

      // Success! Return the created asset
      return updatedAsset;
    } catch (error: any) {
      // Handle unique constraint error on assetTag
      if (error?.code === 'P2002' && error?.meta?.target?.includes('assetTag')) {
        console.warn(`⚠️  Asset tag conflict detected (attempt ${attempts + 1}/${maxRetries}), retrying with new tag...`);
        attempts++;
        if (attempts >= maxRetries) {
          throw new Error(`Failed to create asset after ${maxRetries} attempts due to asset tag conflicts. Please try again.`);
        }
        // Continue to next iteration to retry with new tag
        continue;
      }
      
      // Re-throw other errors
      throw error;
    }
  }
  
  // This should never be reached, but TypeScript needs it
  throw new Error('Failed to create asset: maximum retries exceeded');
};

/**
 * Update an existing asset
 */
export const updateAsset = async (assetId: string, data: UpdateAssetData) => {
  const updateData: any = { ...data };
  
  // Map condition if provided
  if (updateData.condition !== undefined) {
    updateData.condition = mapCondition(updateData.condition) as any;
  }
  
  // Calculate current value if purchase data is being updated
  if (updateData.purchaseCost || updateData.purchaseDate || updateData.depreciationMonths) {
    const existingAsset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: {
        purchaseCost: true,
        purchaseDate: true,
        depreciationMonths: true,
      },
    });

    const purchaseCost = updateData.purchaseCost ?? existingAsset?.purchaseCost;
    const purchaseDate = updateData.purchaseDate ?? existingAsset?.purchaseDate;
    const depreciationMonths = updateData.depreciationMonths ?? existingAsset?.depreciationMonths;

    if (purchaseCost && purchaseDate && depreciationMonths) {
      updateData.currentValue = calculateDepreciatedValue(
        purchaseCost,
        purchaseDate instanceof Date ? purchaseDate : new Date(purchaseDate),
        depreciationMonths
      );
    }
  }

  updateData.updatedBy = data.updatedBy;
  updateData.lastActionDate = new Date();

  const asset = await prisma.asset.update({
    where: { id: assetId },
    data: updateData,
    include: {
      assignedTo: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          employeeId: true,
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
      documents: true,
    },
  });

  return asset;
};

/**
 * Assign asset to employee
 */
export const assignAsset = async (assetId: string, assignmentData: AssignAssetData) => {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: {
      assignedTo: true,
    },
  });

  if (!asset) {
    throw new Error('Asset not found');
  }

  if (asset.status === 'ASSIGNED' && asset.assignedToEmployeeId) {
    throw new Error('Asset is already assigned to another employee');
  }

  // Get employee to validate
  const employee = await prisma.employee.findUnique({
    where: { id: assignmentData.employeeId },
  });

  if (!employee) {
    throw new Error('Employee not found');
  }

  const previousEmployeeId = asset.assignedToEmployeeId;
  const now = new Date();

  // Update asset
  const updatedAsset = await prisma.asset.update({
    where: { id: assetId },
    data: {
      status: 'ASSIGNED',
      assignedToEmployeeId: assignmentData.employeeId,
      assignedDate: now,
      assignedBy: assignmentData.assignedBy,
      lastActionDate: now,
      updatedBy: assignmentData.assignedBy,
    },
    include: {
      assignedTo: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          employeeId: true,
        },
      },
    },
  });

  // Create checkout history record
  await prisma.assetCheckout.create({
    data: {
      assetId,
      action: previousEmployeeId ? 'TRANSFER' : 'CHECKOUT',
      fromEmployeeId: previousEmployeeId,
      toEmployeeId: assignmentData.employeeId,
      performedBy: assignmentData.assignedBy,
      notes: assignmentData.notes,
      checkoutDate: now,
      expectedReturnDate: assignmentData.expectedReturnDate,
    },
  });

  return updatedAsset;
};

/**
 * Unassign asset from employee
 */
export const unassignAsset = async (assetId: string, performedBy: string, notes?: string) => {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
  });

  if (!asset) {
    throw new Error('Asset not found');
  }

  if (!asset.assignedToEmployeeId) {
    throw new Error('Asset is not currently assigned');
  }

  const previousEmployeeId = asset.assignedToEmployeeId;
  const now = new Date();

  // Update asset
  const updatedAsset = await prisma.asset.update({
    where: { id: assetId },
    data: {
      status: 'AVAILABLE',
      assignedToEmployeeId: null,
      assignedDate: null,
      assignedBy: null,
      lastActionDate: now,
      updatedBy: performedBy,
    },
    include: {
      assignedTo: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          employeeId: true,
        },
      },
    },
  });

  // Create checkout history record
  await prisma.assetCheckout.create({
    data: {
      assetId,
      action: 'CHECKIN',
      fromEmployeeId: previousEmployeeId,
      toEmployeeId: null,
      performedBy,
      notes,
      checkoutDate: now,
      actualReturnDate: now,
    },
  });

  return updatedAsset;
};

/**
 * Get asset by ID with all related data
 */
export const getAssetById = async (assetId: string) => {
  return await prisma.asset.findUnique({
    where: { id: assetId },
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
      documents: {
        orderBy: { uploadedAt: 'desc' },
      },
      maintenanceHistory: {
        orderBy: { performedDate: 'desc' },
        take: 10,
      },
      checkoutHistory: {
        orderBy: { checkoutDate: 'desc' },
        take: 20,
        include: {
          asset: {
            select: {
              name: true,
              assetTag: true,
            },
          },
        },
      },
    },
  });
};

