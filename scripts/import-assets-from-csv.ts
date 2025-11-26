import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import * as dotenv from 'dotenv';

// Load environment variables - prefer production for this import
dotenv.config({ path: '.env.production' });
dotenv.config({ path: '.env.local' });
dotenv.config();

const prisma = new PrismaClient();

interface CSVAssetRow {
  id: string;
  name: string;
  description: string;
  serial_number: string;
  asset_tag: string;
  qr_code: string;
  category_id: string;
  manufacturer_id: string;
  supplier_id: string;
  location_id: string;
  purchase_date: string;
  purchase_cost: string;
  warranty_end_date: string;
  end_of_life_date: string;
  depreciation_period_months: string;
  current_value: string;
  status: string;
  condition: string;
  image_url: string;
  invoice_url: string;
  assigned_to: string;
  created_at: string;
  updated_at: string;
  checkout_status: string;
  last_checkout_date: string;
  expected_return_date: string;
  asset_type: string;
  parent_asset_id: string;
  quantity: string;
  minimum_quantity: string;
  department: string;
  notes: string;
  deployed_to: string;
  deployed_to_employee_name: string;
  currency: string;
  uid: string;
  product: string;
  asset_id: string;
  order_number: string;
  last_assigned_by: string;
  last_unassigned_by: string;
  last_edited_by: string;
  last_action_date: string;
}

/**
 * Map asset name to category enum
 */
function mapCategory(name: string, description: string = ''): string {
  const lower = (name + ' ' + description).toLowerCase();
  
  if (lower.includes('laptop') || lower.includes('macbook') || lower.includes('mac studio') || lower.includes('asus') || lower.includes('lenovo') || lower.includes('imac')) {
    return 'LAPTOP';
  }
  if (lower.includes('iphone') || lower.includes('mobile') || lower.includes('moto')) {
    return 'MOBILE';
  }
  if (lower.includes('ipad') || lower.includes('tablet')) {
    return 'TABLET';
  }
  if (lower.includes('monitor') || lower.includes('benq') || lower.includes('samsung') && (lower.includes('monitor') || lower.includes('curved')) || lower.includes('lg') && lower.includes('monitor') || lower.includes('philips') && lower.includes('monitor') || lower.includes('dell')) {
    return 'MONITOR';
  }
  if (lower.includes('camera') || lower.includes('red') || lower.includes('komodo') || lower.includes('dji') || lower.includes('gimbal') || lower.includes('lens') || lower.includes('canon') || lower.includes('sony') && (lower.includes('alpha') || lower.includes('camera'))) {
    return 'CAMERA';
  }
  if (lower.includes('microphone') || lower.includes('rode') || lower.includes('headphone') || lower.includes('hd 280') || lower.includes('audio') || lower.includes('zoom') && lower.includes('recorder')) {
    return 'AUDIO_EQUIPMENT';
  }
  if (lower.includes('light') || lower.includes('nanlite') || lower.includes('forza') || lower.includes('godox') && (lower.includes('light') || lower.includes('flash') || lower.includes('ad'))) {
    return 'LIGHTING';
  }
  if (lower.includes('cable') || lower.includes('thunderbolt') || lower.includes('usb') || lower.includes('hdmi') || lower.includes('charger') || lower.includes('adapter') || lower.includes('battery') || lower.includes('stand') || lower.includes('tripod') || lower.includes('mount') || lower.includes('filter') || lower.includes('case') || lower.includes('backpack') || lower.includes('bag')) {
    return 'CABLES_ACCESSORIES';
  }
  if (lower.includes('furniture') || lower.includes('chair') || lower.includes('desk') || lower.includes('shelving') || lower.includes('dispenser') || lower.includes('cooler') || lower.includes('screen') && lower.includes('freestanding')) {
    return 'FURNITURE';
  }
  if (lower.includes('storage') || lower.includes('ssd') || lower.includes('seagate') || lower.includes('exos') || lower.includes('wd') || lower.includes('ultrastar') || lower.includes('sandisk') || lower.includes('extreme') || lower.includes('tb') || lower.includes('memory') || lower.includes('card') || lower.includes('cfexpress') || lower.includes('qnap') || lower.includes('nas')) {
    return 'STORAGE';
  }
  if (lower.includes('printer') || lower.includes('scanner') || lower.includes('cheque machine')) {
    return 'PRINTER_SCANNER';
  }
  if (lower.includes('keyboard') || lower.includes('ornata') || lower.includes('logitech') && (lower.includes('keyboard') || lower.includes('g815'))) {
    return 'KEYBOARD';
  }
  if (lower.includes('mouse') || lower.includes('deathadder') || lower.includes('logitech') && lower.includes('mouse') || lower.includes('g102')) {
    return 'MOUSE';
  }
  if (lower.includes('network') || lower.includes('router') || lower.includes('switch')) {
    return 'NETWORKING';
  }
  
  return 'OTHER';
}

/**
 * Map status from CSV to AssetStatus enum
 */
function mapStatus(status: string, checkoutStatus: string): string {
  if (checkoutStatus === 'out') return 'ASSIGNED';
  
  const statusLower = (status || '').toLowerCase();
  if (statusLower === 'assigned') return 'ASSIGNED';
  if (statusLower === 'available') return 'AVAILABLE';
  if (statusLower === 'damaged') return 'DAMAGED';
  if (statusLower === 'retired') return 'RETIRED';
  if (statusLower === 'lost') return 'LOST';
  if (statusLower === 'maintenance') return 'MAINTENANCE';
  if (statusLower === 'in use') return 'IN_USE';
  
  return 'AVAILABLE';
}

/**
 * Map condition from CSV to AssetCondition enum
 */
function mapCondition(condition: string): string {
  const condLower = (condition || '').toLowerCase();
  if (condLower === 'new') return 'NEW';
  if (condLower === 'excellent') return 'EXCELLENT';
  if (condLower === 'good') return 'GOOD';
  if (condLower === 'fair') return 'FAIR';
  if (condLower === 'poor') return 'POOR';
  if (condLower === 'damaged') return 'DAMAGED';
  
  return 'NEW';
}

/**
 * Map asset type from CSV
 */
function mapAssetType(assetType: string): string {
  const typeLower = (assetType || '').toLowerCase();
  if (typeLower === 'asset' || typeLower === 'main_asset') return 'MAIN_ASSET';
  if (typeLower === 'accessory') return 'ACCESSORY';
  if (typeLower === 'software') return 'SOFTWARE';
  if (typeLower === 'furniture') return 'FURNITURE';
  
  return 'MAIN_ASSET';
}

/**
 * Import assets from CSV file
 */
async function importAssetsFromCSV() {
  try {
    console.log('🚀 Starting CSV asset import...');
    console.log('='.repeat(60));

    const csvPath = path.join(__dirname, '../YAZ Media Assets Rows (1).csv');
    
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV file not found at: ${csvPath}`);
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Parse CSV (skip header row)
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as CSVAssetRow[];

    console.log(`📊 Found ${records.length} assets in CSV\n`);

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of records) {
      try {
        // Skip if no name
        if (!row.name || row.name.trim() === '') {
          skipped++;
          continue;
        }

        // Check if asset already exists (by ID if provided, or by asset_tag)
        let existingAsset = null;
        if (row.id && row.id.trim() !== '') {
          try {
            const result = await prisma.$queryRaw`
              SELECT id FROM "Asset" WHERE id = ${row.id} LIMIT 1
            ` as any[];
            if (result && result.length > 0) {
              existingAsset = result[0];
            }
          } catch (error) {
            // Ignore errors, asset doesn't exist
          }
        }
        
        if (!existingAsset && row.asset_tag && row.asset_tag.trim() !== '') {
          try {
            const result = await prisma.$queryRaw`
              SELECT id FROM "Asset" WHERE "assetTag" = ${row.asset_tag} LIMIT 1
            ` as any[];
            if (result && result.length > 0) {
              existingAsset = result[0];
            }
          } catch (error) {
            // Ignore errors
          }
        }

        if (existingAsset) {
          console.log(`⏭️  Asset already exists: ${row.asset_tag || row.id}, skipping...`);
          skipped++;
          continue;
        }

        // Generate asset tag if missing
        let assetTag = row.asset_tag?.trim() || null;
        if (!assetTag) {
          // Get next tag number
          const lastAsset = await prisma.asset.findFirst({
            where: {
              assetTag: {
                startsWith: 'YAZ-',
              },
            },
            orderBy: {
              assetTag: 'desc',
            },
          });

          let nextNumber = 1;
          if (lastAsset?.assetTag) {
            const match = lastAsset.assetTag.match(/YAZ-(\d+)/);
            if (match) {
              nextNumber = parseInt(match[1], 10) + 1;
            }
          }
          assetTag = `YAZ-${String(nextNumber).padStart(3, '0')}`;
        }

        // Parse dates - use current date as fallback if missing
        const purchaseDate = row.purchase_date ? new Date(row.purchase_date) : (row.created_at ? new Date(row.created_at) : new Date());
        const warrantyExpiry = row.warranty_end_date ? new Date(row.warranty_end_date) : null;
        const createdAt = row.created_at ? new Date(row.created_at) : new Date();
        const updatedAt = row.updated_at ? new Date(row.updated_at) : new Date();
        const lastActionDate = row.last_action_date ? new Date(row.last_action_date) : updatedAt;
        const assignedDate = row.last_checkout_date ? new Date(row.last_checkout_date) : null;

        // Parse numeric values
        const purchaseCost = row.purchase_cost ? parseFloat(row.purchase_cost) : null;
        const currentValue = row.current_value ? parseFloat(row.current_value) : null;
        const depreciationMonths = row.depreciation_period_months ? parseInt(row.depreciation_period_months) : null;

        // Map values
        const category = mapCategory(row.name, row.description);
        const status = mapStatus(row.status, row.checkout_status);
        const condition = mapCondition(row.condition);
        const assetType = mapAssetType(row.asset_type);

        // Get assigned employee if exists
        let assignedToEmployeeId = row.assigned_to?.trim() || null;
        if (assignedToEmployeeId) {
          try {
            const employee = await prisma.$queryRaw`
              SELECT id FROM "Employee" WHERE id = ${assignedToEmployeeId} LIMIT 1
            ` as any[];
            if (!employee || employee.length === 0) {
              assignedToEmployeeId = null;
            }
          } catch (error) {
            assignedToEmployeeId = null;
          }
        }

        // Create asset
        const asset = await prisma.asset.create({
          data: {
            id: row.id && row.id.trim() !== '' ? row.id : undefined, // Use CSV ID if provided
            name: row.name.trim(),
            assetTag,
            qrCode: `/assets/${row.id || assetTag}`, // Will be updated after creation
            serialNumber: row.serial_number?.trim() || `SN-${row.id?.substring(0, 8) || Date.now().toString().slice(-8)}-${Math.random().toString(36).substring(2, 8)}`,
            model: row.product?.trim() || null,
            assetType: assetType as any,
            category: category as any,
            manufacturer: null, // Optional - can be added later
            supplier: null,
            purchaseDate,
            purchaseCost,
            currency: row.currency?.trim().toUpperCase() || 'AED',
            currentValue,
            depreciationMonths,
            warrantyExpiry,
            location: row.department?.trim() || null,
            condition: condition as any,
            description: row.description?.trim() || null,
            notes: row.notes?.trim() || null,
            status: status as any,
            assignedToEmployeeId,
            assignedDate,
            assignedBy: row.last_assigned_by?.trim() || null,
            imageUrl: row.image_url?.trim() || null,
            invoiceUrl: row.invoice_url?.trim() || null,
            createdAt,
            updatedAt,
            createdBy: row.last_edited_by?.trim() || null,
            updatedBy: row.last_edited_by?.trim() || null,
            lastActionDate,
          },
        });

        // Update QR code with actual asset ID
        await prisma.asset.update({
          where: { id: asset.id },
          data: {
            qrCode: `/assets/${asset.id}`,
          },
        });

        // Create checkout history if assigned
        if (assignedToEmployeeId && assignedDate) {
          await prisma.assetCheckout.create({
            data: {
              assetId: asset.id,
              action: 'CHECKOUT',
              toEmployeeId: assignedToEmployeeId,
              performedBy: row.last_assigned_by?.trim() || 'system',
              checkoutDate: assignedDate,
              expectedReturnDate: row.expected_return_date ? new Date(row.expected_return_date) : null,
            },
          });
        }

        imported++;
        if (imported % 10 === 0) {
          console.log(`  ✅ Imported ${imported}/${records.length} assets...`);
        }
      } catch (error: any) {
        console.error(`  ❌ Error importing asset ${row.name}:`, error.message);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ CSV Import Complete!');
    console.log('='.repeat(60));
    console.log(`  Imported: ${imported}`);
    console.log(`  Skipped: ${skipped}`);
    console.log(`  Errors: ${errors}`);
    console.log('='.repeat(60));
  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run import
importAssetsFromCSV();

