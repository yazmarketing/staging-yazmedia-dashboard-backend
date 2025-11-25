import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.production' });

const prisma = new PrismaClient();

async function fixAssetColumns() {
  try {
    // Check if assetName column exists and copy data to name if needed
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        -- Check if assetName column exists
        IF EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name = 'Asset' AND column_name = 'assetName'
        ) THEN
          -- Copy data from assetName to name if name is null
          UPDATE "Asset" 
          SET "name" = "assetName" 
          WHERE "name" IS NULL AND "assetName" IS NOT NULL;
          
          -- Make name NOT NULL if it's currently nullable
          ALTER TABLE "Asset" ALTER COLUMN "name" SET NOT NULL;
          
          -- Drop the old assetName column
          ALTER TABLE "Asset" DROP COLUMN IF EXISTS "assetName";
          
          RAISE NOTICE 'Fixed assetName -> name migration';
        END IF;
      END $$;
    `);
    
    // Also ensure manufacturer, supplier, and serialNumber columns are nullable
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        -- Make manufacturerId nullable if it exists
        IF EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name = 'Asset' AND column_name = 'manufacturerId'
        ) THEN
          ALTER TABLE "Asset" ALTER COLUMN "manufacturerId" DROP NOT NULL;
        END IF;
        
        -- Make supplierId nullable if it exists
        IF EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name = 'Asset' AND column_name = 'supplierId'
        ) THEN
          ALTER TABLE "Asset" ALTER COLUMN "supplierId" DROP NOT NULL;
        END IF;
        
        -- Make serialNumber nullable if it exists (it should be optional)
        IF EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name = 'Asset' AND column_name = 'serialNumber'
        ) THEN
          ALTER TABLE "Asset" ALTER COLUMN "serialNumber" DROP NOT NULL;
        END IF;
        
        -- Make purchaseDate nullable if it exists (it should be optional)
        IF EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name = 'Asset' AND column_name = 'purchaseDate'
        ) THEN
          ALTER TABLE "Asset" ALTER COLUMN "purchaseDate" DROP NOT NULL;
        END IF;
        
        -- Make purchaseCost nullable if it exists (it should be optional)
        IF EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name = 'Asset' AND column_name = 'purchaseCost'
        ) THEN
          ALTER TABLE "Asset" ALTER COLUMN "purchaseCost" DROP NOT NULL;
        END IF;
        
        -- Drop old manufacturer string column (data should already be migrated to Manufacturer table)
        IF EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name = 'Asset' AND column_name = 'manufacturer' AND data_type = 'text'
        ) THEN
          -- First make it nullable to avoid constraint issues
          ALTER TABLE "Asset" ALTER COLUMN "manufacturer" DROP NOT NULL;
          -- Then drop it (data already migrated via the migration script)
          ALTER TABLE "Asset" DROP COLUMN IF EXISTS "manufacturer";
          RAISE NOTICE 'Dropped old manufacturer column';
        END IF;
        
        -- Drop old supplier string column (data should already be migrated to Supplier table)
        IF EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name = 'Asset' AND column_name = 'supplier' AND data_type = 'text'
        ) THEN
          -- First make it nullable to avoid constraint issues
          ALTER TABLE "Asset" ALTER COLUMN "supplier" DROP NOT NULL;
          -- Then drop it (data already migrated via the migration script)
          ALTER TABLE "Asset" DROP COLUMN IF EXISTS "supplier";
          RAISE NOTICE 'Dropped old supplier column';
        END IF;
      END $$;
    `);
    
    console.log('✅ Asset columns fixed successfully!');
  } catch (error: any) {
    console.error('❌ Error fixing columns:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixAssetColumns();

