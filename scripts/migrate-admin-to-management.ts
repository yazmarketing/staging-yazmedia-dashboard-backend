/**
 * Migration Script: Convert ADMIN role to MANAGEMENT
 * 
 * This script converts all users with ADMIN role to MANAGEMENT role
 * as part of the RBAC consolidation effort.
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// Load environment variables from .env file if it exists
dotenv.config();

const prisma = new PrismaClient();

async function migrateAdminToManagement() {
  try {
    console.log('🔄 Starting ADMIN to MANAGEMENT migration...');

    // First, update all ADMIN users to MANAGEMENT
    const result = await prisma.employee.updateMany({
      where: {
        role: 'ADMIN' as any, // Type assertion since ADMIN is being removed
      },
      data: {
        role: 'MANAGEMENT',
      },
    });

    console.log(`✅ Successfully migrated ${result.count} ADMIN users to MANAGEMENT`);

    // Verify no ADMIN users remain
    const adminCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM "Employee"
      WHERE role = 'ADMIN'
    `;

    if (adminCount[0]?.count === BigInt(0)) {
      console.log('✅ Verification passed: No ADMIN users remain');
    } else {
      console.warn(`⚠️  Warning: ${adminCount[0]?.count} ADMIN users still exist`);
    }

    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateAdminToManagement()
  .then(() => {
    console.log('Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });

