import { prisma } from '../index';

/**
 * Generate next asset tag in format: YAZ-001, YAZ-002, etc.
 * Handles conflicts by retrying with next available number.
 */
export const generateAssetTag = async (maxRetries: number = 10): Promise<string> => {
  try {
    // Get all assets with YAZ- tags
    const assets = await prisma.asset.findMany({
      where: {
        assetTag: {
          startsWith: 'YAZ-',
          not: null,
        },
      },
      select: {
        assetTag: true,
      },
    });

    // Extract all numbers from tags and find the maximum
    let maxNumber = 0;
    for (const asset of assets) {
      if (asset.assetTag) {
        const match = asset.assetTag.match(/YAZ-(\d+)/);
        if (match) {
          const number = parseInt(match[1], 10);
          if (number > maxNumber) {
            maxNumber = number;
          }
        }
      }
    }

    // Generate next tag and check if it exists
    let nextNumber = maxNumber + 1;
    let attempts = 0;
    
    while (attempts < maxRetries) {
      const newTag = `YAZ-${String(nextNumber).padStart(3, '0')}`;
      
      // Check if tag already exists
      const existing = await prisma.asset.findUnique({
        where: { assetTag: newTag },
        select: { id: true },
      });
      
      if (!existing) {
        return newTag;
      }
      
      // Tag exists, try next number
      nextNumber++;
      attempts++;
    }
    
    // If we exhausted retries, use timestamp-based tag
    console.warn(`⚠️  Could not generate unique tag after ${maxRetries} attempts, using timestamp-based tag`);
    return `YAZ-TMP-${Date.now()}`;
  } catch (error) {
    console.error('Error generating asset tag:', error);
    // Fallback: use timestamp-based tag
    return `YAZ-TMP-${Date.now()}`;
  }
};

/**
 * Generate QR code URL for asset
 * Format: /assets/{assetId}
 */
export const generateQRCodeUrl = (assetId: string): string => {
  return `/assets/${assetId}`;
};

/**
 * Calculate depreciated value of an asset
 * Uses straight-line depreciation
 */
export const calculateDepreciatedValue = (
  purchaseCost: number,
  purchaseDate: Date,
  depreciationMonths: number = 36 // Default 3 years
): number => {
  const now = new Date();
  const monthsSincePurchase = Math.max(
    0,
    (now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
  );

  if (monthsSincePurchase >= depreciationMonths) {
    return 0; // Fully depreciated
  }

  const monthlyDepreciation = purchaseCost / depreciationMonths;
  const depreciatedAmount = monthlyDepreciation * monthsSincePurchase;
  return Math.max(0, purchaseCost - depreciatedAmount);
};

/**
 * Check if warranty is expiring soon (within 30 days)
 */
export const isWarrantyExpiringSoon = (warrantyExpiry: Date | null): boolean => {
  if (!warrantyExpiry) return false;
  
  const now = new Date();
  const daysUntilExpiry = (warrantyExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  
  return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
};

/**
 * Check if maintenance is due
 */
export const isMaintenanceDue = (nextMaintenanceDate: Date | null): boolean => {
  if (!nextMaintenanceDate) return false;
  
  const now = new Date();
  return nextMaintenanceDate <= now;
};










