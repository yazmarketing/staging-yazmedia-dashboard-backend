import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

/**
 * Migration script to transform old Asset model to new unified Asset model
 * This handles:
 * - Field name changes (assetName -> name, assetImageUrl -> imageUrl)
 * - Enum value updates (InventoryStatus -> AssetStatus)
 * - Adding new fields (assetTag, qrCode, etc.)
 * - Migrating InventoryItem data to Asset if needed
 */
async function migrateUnifiedInventory() {
  try {
    console.log('🔄 Starting unified inventory migration...');
    console.log('='.repeat(60));

    // Step 1: Get all existing assets
    const existingAssets = await prisma.$queryRaw<any[]>`
      SELECT * FROM "Asset"
    `;

    console.log(`📊 Found ${existingAssets.length} existing assets to migrate`);

    if (existingAssets.length === 0) {
      console.log('✅ No existing assets to migrate');
      return;
    }

    // Step 2: Generate asset tags for assets without tags
    let tagCounter = 1;
    for (const asset of existingAssets) {
      try {
        // Check if asset already has required new fields (already migrated)
        if (asset.name && asset.assetTag) {
          console.log(`⏭️  Asset ${asset.id} already migrated, skipping...`);
          continue;
        }

        // Generate asset tag if missing
        let assetTag = asset.assetTag;
        if (!assetTag) {
          assetTag = `YAZ-${String(tagCounter).padStart(3, '0')}`;
          tagCounter++;
        }

        // Generate QR code if missing
        const qrCode = asset.qrCode || `/assets/${asset.id}`;

        // Map old field names to new ones
        const updateData: any = {
          // Basic info mapping
          name: asset.assetName || asset.name,
          assetTag,
          qrCode,
          serialNumber: asset.serialNumber,
          model: asset.model || null,
          
          // Keep existing values
          assetType: asset.assetType || 'MAIN_ASSET',
          category: asset.category || 'OTHER',
          manufacturer: asset.manufacturer || null,
          supplier: asset.supplier || null,
          
          // Financial
          purchaseDate: asset.purchaseDate,
          purchaseCost: asset.purchaseCost || null,
          currency: asset.currency || 'AED',
          currentValue: asset.currentValue || null,
          depreciationMonths: asset.depreciationMonths || null,
          warrantyExpiry: asset.warrantyExpiration || asset.warrantyExpiry || null,
          
          // Physical
          location: asset.location || null,
          condition: asset.condition || 'NEW',
          description: asset.description || null,
          notes: asset.notes || null,
          
          // Status mapping (old InventoryStatus -> new AssetStatus)
          status: mapStatus(asset.status) || 'AVAILABLE',
          
          // Files
          imageUrl: asset.assetImageUrl || asset.imageUrl || null,
          invoiceUrl: asset.invoiceUrl || null,
          
          // Assignment
          assignedToEmployeeId: asset.assignedToEmployeeId || null,
          assignedDate: asset.assignedDate || null,
          assignedBy: asset.assignedBy || null,
          
          // Timestamps
          createdAt: asset.createdAt || new Date(),
          updatedAt: asset.updatedAt || new Date(),
          createdBy: asset.createdBy || null,
          updatedBy: asset.updatedBy || null,
          lastActionDate: asset.lastActionDate || asset.updatedAt || new Date(),
        };

        // Remove null values that might cause issues
        Object.keys(updateData).forEach(key => {
          if (updateData[key] === null && !['serialNumber', 'model', 'manufacturer', 'supplier', 'location', 'description', 'notes', 'imageUrl', 'invoiceUrl', 'assignedToEmployeeId', 'assignedDate', 'assignedBy', 'createdBy', 'updatedBy', 'warrantyExpiry', 'currentValue', 'depreciationMonths'].includes(key)) {
            delete updateData[key];
          }
        });

        // Update asset using raw query to handle schema changes
        await prisma.$executeRaw`
          UPDATE "Asset"
          SET 
            name = ${updateData.name},
            "assetTag" = ${updateData.assetTag},
            "qrCode" = ${updateData.qrCode},
            "serialNumber" = ${updateData.serialNumber},
            model = ${updateData.model},
            "assetType" = ${updateData.assetType}::"AssetType",
            category = ${updateData.category}::"AssetCategory",
            manufacturer = ${updateData.manufacturer},
            supplier = ${updateData.supplier},
            "purchaseDate" = ${updateData.purchaseDate},
            "purchaseCost" = ${updateData.purchaseCost},
            currency = ${updateData.currency},
            "currentValue" = ${updateData.currentValue},
            "depreciationMonths" = ${updateData.depreciationMonths},
            "warrantyExpiry" = ${updateData.warrantyExpiry},
            location = ${updateData.location},
            condition = ${updateData.condition}::"AssetCondition",
            description = ${updateData.description},
            notes = ${updateData.notes},
            status = ${updateData.status}::"AssetStatus",
            "imageUrl" = ${updateData.imageUrl},
            "invoiceUrl" = ${updateData.invoiceUrl},
            "assignedToEmployeeId" = ${updateData.assignedToEmployeeId},
            "assignedDate" = ${updateData.assignedDate},
            "assignedBy" = ${updateData.assignedBy},
            "createdAt" = ${updateData.createdAt},
            "updatedAt" = ${updateData.updatedAt},
            "createdBy" = ${updateData.createdBy},
            "updatedBy" = ${updateData.updatedBy},
            "lastActionDate" = ${updateData.lastActionDate}
          WHERE id = ${asset.id}
        `;

        console.log(`✅ Migrated asset: ${asset.id} -> ${assetTag}`);
      } catch (error: any) {
        console.error(`❌ Error migrating asset ${asset.id}:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Unified inventory migration complete!');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Map old InventoryStatus to new AssetStatus
 */
function mapStatus(oldStatus: string): string {
  const statusMap: Record<string, string> = {
    AVAILABLE: 'AVAILABLE',
    ASSIGNED: 'ASSIGNED',
    DAMAGED: 'DAMAGED',
    RETIRED: 'RETIRED',
    // Add new statuses with defaults
    IN_USE: 'IN_USE',
    MAINTENANCE: 'MAINTENANCE',
    LOST: 'LOST',
  };
  return statusMap[oldStatus?.toUpperCase()] || 'AVAILABLE';
}

// Run migration
migrateUnifiedInventory();










