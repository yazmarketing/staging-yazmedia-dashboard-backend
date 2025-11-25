import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse/sync";

const prisma = new PrismaClient();

interface CsvAssetRow {
  id: string;
  assetType: string;
  category: string;
  serialNumber: string;
  purchaseDate: string;
  purchaseCost: string;
  description: string;
  warrantyExpiration: string;
  location: string;
  assetImageUrl: string;
  invoiceUrl: string;
  assignedToEmployeeId: string;
  assignedDate: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  assetTag: string;
  qrCode: string;
  model: string;
  currency: string;
  currentValue: string;
  depreciationMonths: string;
  warrantyExpiry: string;
  notes: string;
  assignedBy: string;
  imageUrl: string;
  lastMaintenanceDate: string;
  nextMaintenanceDate: string;
  createdBy: string;
  updatedBy: string;
  lastActionDate: string;
  status: string;
  condition: string;
  manufacturerId: string;
  supplierId: string;
}

function parseNullableString(value: string | null | undefined): string | null {
  if (!value || value === "NULL" || value.trim() === "" || value.toLowerCase() === "null") {
    return null;
  }
  return value;
}

function parseDate(value: string | null | undefined): Date | null {
  const parsed = parseNullableString(value);
  if (!parsed) return null;
  try {
    return new Date(parsed);
  } catch {
    return null;
  }
}

function parseFloatValue(value: string | null | undefined): number | null {
  const parsed = parseNullableString(value);
  if (!parsed) return null;
  const num = Number(parsed);
  return isNaN(num) ? null : num;
}

function parseIntValue(value: string | null | undefined): number | null {
  const parsed = parseNullableString(value);
  if (!parsed) return null;
  const num = global.parseInt(parsed, 10);
  return isNaN(num) ? null : num;
}

function mapStatus(status: string | null | undefined): "AVAILABLE" | "ASSIGNED" | "DAMAGED" | "RETIRED" {
  if (!status) return "AVAILABLE";
  const upper = status.toUpperCase();
  if (upper === "ASSIGNED") return "ASSIGNED";
  if (upper === "DAMAGED") return "DAMAGED";
  if (upper === "RETIRED") return "RETIRED";
  return "AVAILABLE";
}

function mapCondition(condition: string | null | undefined): "NEW" | "GOOD" | "FAIR" | "POOR" {
  if (!condition) return "NEW";
  const upper = condition.toUpperCase();
  if (upper === "GOOD") return "GOOD";
  if (upper === "FAIR") return "FAIR";
  if (upper === "POOR") return "POOR";
  return "NEW";
}

function mapAssetType(assetType: string | null | undefined): "MAIN_ASSET" | "ACCESSORY" {
  if (!assetType) return "MAIN_ASSET";
  const upper = assetType.toUpperCase();
  if (upper === "ACCESSORY") return "ACCESSORY";
  return "MAIN_ASSET";
}

function mapCategory(category: string | null | undefined, assetName: string): string {
  // Only use enum values that exist in the database
  // Database enum: 'LAPTOP', 'MOBILE', 'CAMERA', 'MONITOR', 'KEYBOARD', 'MOUSE', 'HEADPHONES', 'CHARGER', 'CABLE', 'STORAGE', 'PRINTER', 'SCANNER', 'OTHER'
  
  if (!category || category.trim() === "") {
    // Try to infer from asset name
    const nameUpper = assetName.toUpperCase();
    if (nameUpper.includes("LAPTOP") || nameUpper.includes("MACBOOK") || nameUpper.includes("MAC STUDIO")) return "LAPTOP";
    if (nameUpper.includes("MOBILE") || nameUpper.includes("IPHONE")) return "MOBILE";
    if (nameUpper.includes("MONITOR")) return "MONITOR";
    if (nameUpper.includes("CAMERA")) return "CAMERA";
    if (nameUpper.includes("STORAGE") || nameUpper.includes("HDD") || nameUpper.includes("SSD")) return "STORAGE";
    if (nameUpper.includes("KEYBOARD")) return "KEYBOARD";
    if (nameUpper.includes("MOUSE")) return "MOUSE";
    if (nameUpper.includes("HEADPHONE")) return "HEADPHONES";
    if (nameUpper.includes("CHARGER")) return "CHARGER";
    if (nameUpper.includes("CABLE")) return "CABLE";
    if (nameUpper.includes("PRINTER")) return "PRINTER";
    if (nameUpper.includes("SCANNER")) return "SCANNER";
    // Map new categories to existing ones
    if (nameUpper.includes("TABLET") || nameUpper.includes("IPAD")) return "MOBILE"; // Map TABLET to MOBILE
    if (nameUpper.includes("LIGHT") || nameUpper.includes("LED")) return "OTHER"; // Map LIGHTING to OTHER
    return "OTHER";
  }
  
  // Map common category names to enum values that exist in database
  const upper = category.toUpperCase();
  const categoryMap: Record<string, string> = {
    "LAPTOP": "LAPTOP",
    "MOBILE": "MOBILE",
    "MONITOR": "MONITOR",
    "CAMERA": "CAMERA",
    "STORAGE": "STORAGE",
    "KEYBOARD": "KEYBOARD",
    "MOUSE": "MOUSE",
    "HEADPHONE": "HEADPHONES",
    "HEADPHONES": "HEADPHONES",
    "CHARGER": "CHARGER",
    "CABLE": "CABLE",
    "PRINTER": "PRINTER",
    "SCANNER": "SCANNER",
    "OTHER": "OTHER",
    // Map new categories to existing ones
    "TABLET": "MOBILE",
    "LIGHTING": "OTHER",
    "AUDIO_EQUIPMENT": "OTHER",
    "NETWORKING": "OTHER",
    "PRINTER_SCANNER": "PRINTER",
    "CABLES_ACCESSORIES": "CABLE",
    "DESK": "OTHER",
    "CHAIR": "OTHER",
    "CABINET": "OTHER",
    "SHELVING": "OTHER",
    "SOFTWARE_LICENSE": "OTHER",
  };
  
  return categoryMap[upper] || "OTHER";
}

async function importAssets() {
  console.log("🚀 STARTING CSV ASSET IMPORT");
  console.log("============================================================");

  try {
    // Read CSV file
    const csvFilePath = path.join(__dirname, "../Asset-o -ready.csv");
    console.log(`📂 Reading CSV from: ${csvFilePath}`);

    if (!fs.existsSync(csvFilePath)) {
      throw new Error(`CSV file not found: ${csvFilePath}`);
    }

    const csvContent = fs.readFileSync(csvFilePath, "utf-8");
    const records: CsvAssetRow[] = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    console.log(`✓ Parsed ${records.length} records from CSV\n`);

    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      try {
        // Validate required fields
        if (!row.id || !row.name) {
          console.log(`⚠️  Row ${i + 2}: Skipping - missing id or name`);
          skippedCount++;
          continue;
        }

        // Check if asset already exists
        const existing = await prisma.asset.findUnique({
          where: { id: row.id },
        });

        // Parse and validate manufacturerId
        let manufacturerId: string | null = parseNullableString(row.manufacturerId);
        if (manufacturerId) {
          const manufacturer = await prisma.manufacturer.findUnique({
            where: { id: manufacturerId },
          });
          if (!manufacturer) {
            console.log(`⚠️  Row ${i + 2}: Manufacturer ${manufacturerId} not found, setting to null`);
            manufacturerId = null;
          }
        }

        // Parse and validate supplierId
        let supplierId: string | null = parseNullableString(row.supplierId);
        if (supplierId) {
          const supplier = await prisma.supplier.findUnique({
            where: { id: supplierId },
          });
          if (!supplier) {
            console.log(`⚠️  Row ${i + 2}: Supplier ${supplierId} not found, setting to null`);
            supplierId = null;
          }
        }

        // Parse and validate assignedToEmployeeId
        let assignedToEmployeeId: string | null = parseNullableString(row.assignedToEmployeeId);
        if (assignedToEmployeeId) {
          const employee = await prisma.employee.findUnique({
            where: { id: assignedToEmployeeId },
          });
          if (!employee) {
            console.log(`⚠️  Row ${i + 2}: Employee ${assignedToEmployeeId} not found, setting to null`);
            assignedToEmployeeId = null;
          }
        }

        // Use imageUrl if available, otherwise assetImageUrl
        const imageUrl = parseNullableString(row.imageUrl) || parseNullableString(row.assetImageUrl);

        // Use warrantyExpiry if available, otherwise warrantyExpiration
        const warrantyExpiry = parseDate(row.warrantyExpiry) || parseDate(row.warrantyExpiration);

        // Handle serialNumber - check if it already exists, if so, set to null to avoid unique constraint
        let serialNumber = parseNullableString(row.serialNumber);
        if (serialNumber) {
          const existingWithSerial = await prisma.asset.findFirst({
            where: { 
              serialNumber: serialNumber,
              NOT: { id: row.id }, // Exclude current asset if updating
            },
          });
          if (existingWithSerial) {
            console.log(`⚠️  Row ${i + 2}: Serial number ${serialNumber} already exists, setting to null`);
            serialNumber = null;
          }
        }
        
        // Validate category before proceeding
        let mappedCategory = mapCategory(row.category, row.name);
        const validCategories = ["LAPTOP", "MOBILE", "CAMERA", "MONITOR", "KEYBOARD", "MOUSE", "HEADPHONES", "CHARGER", "CABLE", "STORAGE", "PRINTER", "SCANNER", "OTHER"];
        if (!validCategories.includes(mappedCategory)) {
          console.log(`⚠️  Row ${i + 2}: Invalid category "${mappedCategory}", using "OTHER"`);
          mappedCategory = "OTHER";
        }
        // Ensure category is exactly one of the valid enum values (no extra whitespace)
        mappedCategory = mappedCategory.trim().toUpperCase() as typeof mappedCategory;
        if (!validCategories.includes(mappedCategory)) {
          mappedCategory = "OTHER";
        }

        // Prepare asset data - use null instead of undefined for nullable fields
        const assetData: any = {
          name: row.name,
          assetTag: parseNullableString(row.assetTag),
          serialNumber: serialNumber,
          model: parseNullableString(row.model),
          qrCode: parseNullableString(row.qrCode),
          assetType: mapAssetType(row.assetType),
          category: mappedCategory,
          manufacturerId: manufacturerId,
          supplierId: supplierId,
          purchaseDate: parseDate(row.purchaseDate),
          purchaseCost: parseFloatValue(row.purchaseCost),
          currency: parseNullableString(row.currency) || "AED",
          currentValue: parseFloatValue(row.currentValue),
          depreciationMonths: parseIntValue(row.depreciationMonths),
          warrantyExpiry: warrantyExpiry,
          location: parseNullableString(row.location),
          condition: mapCondition(row.condition),
          description: parseNullableString(row.description),
          notes: parseNullableString(row.notes),
          status: mapStatus(row.status),
          assignedToEmployeeId: assignedToEmployeeId,
          assignedDate: parseDate(row.assignedDate),
          assignedBy: parseNullableString(row.assignedBy),
          imageUrl: imageUrl,
          invoiceUrl: parseNullableString(row.invoiceUrl),
          lastMaintenanceDate: parseDate(row.lastMaintenanceDate),
          nextMaintenanceDate: parseDate(row.nextMaintenanceDate),
          createdBy: parseNullableString(row.createdBy),
          updatedBy: parseNullableString(row.updatedBy), // Note: Should be employee ID, not date
          lastActionDate: parseDate(row.lastActionDate),
          createdAt: parseDate(row.createdAt) || new Date(),
          updatedAt: parseDate(row.updatedAt) || new Date(),
        };

        if (existing) {
          // Update existing asset
          await prisma.asset.update({
            where: { id: row.id },
            data: assetData,
          });
          updatedCount++;
          if ((i + 1) % 50 === 0) {
            console.log(`  Processed ${i + 1}/${records.length} records...`);
          }
        } else {
          // Create new asset
          await prisma.asset.create({
            data: {
              id: row.id, // Use the ID from CSV
              ...assetData,
            },
          });
          importedCount++;
          if ((i + 1) % 50 === 0) {
            console.log(`  Processed ${i + 1}/${records.length} records...`);
          }
        }
      } catch (error: any) {
        const errorMsg = `Row ${i + 2}: ${error.message}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
        skippedCount++;
      }
    }

    console.log("\n============================================================");
    console.log("✅ CSV IMPORT COMPLETE");
    console.log("============================================================");
    console.log(`\nImport Summary:`);
    console.log(`  ✅ Imported: ${importedCount}`);
    console.log(`  🔄 Updated: ${updatedCount}`);
    console.log(`  ⚠️  Skipped: ${skippedCount}`);
    if (errors.length > 0) {
      console.log(`\n❌ Errors (${errors.length}):`);
      errors.slice(0, 10).forEach((err) => console.log(`  - ${err}`));
      if (errors.length > 10) {
        console.log(`  ... and ${errors.length - 10} more errors`);
      }
    }
  } catch (error) {
    console.error("❌ Import failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

importAssets();

