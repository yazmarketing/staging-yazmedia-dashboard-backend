import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface SupabaseAsset {
  id: string;
  name: string;
  description: string | null;
  serial_number: string | null;
  asset_tag: string | null;
  qr_code: string | null;
  category_id: string | null;
  manufacturer_id: string | null;
  supplier_id: string | null;
  location_id: string | null;
  purchase_date: string | null;
  purchase_cost: string | null;
  warranty_end_date: string | null;
  end_of_life_date: string | null;
  depreciation_period_months: string | null;
  current_value: string | null;
  status: string;
  condition: string;
  image_url: string | null;
  invoice_url: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  checkout_status: string | null;
  last_checkout_date: string | null;
  expected_return_date: string | null;
  asset_type: string | null;
  parent_asset_id: string | null;
  quantity: string | null;
  minimum_quantity: string | null;
  department: string | null;
  notes: string | null;
  deployed_to: string | null;
  deployed_to_employee_name: string | null;
  currency: string | null;
  uid: string | null;
  product: string | null;
  asset_id: string | null;
  order_number: string | null;
  last_assigned_by: string | null;
  last_unassigned_by: string | null;
  last_edited_by: string | null;
  last_action_date: string | null;
}

function parseValues(str: string): (string | null)[] {
  const values: (string | null)[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < str.length) {
    const char = str[i];

    if (char === "'" && (i === 0 || str[i - 1] !== "\\")) {
      inQuotes = !inQuotes;
      i++;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      i++;
      continue;
    }

    current += char;
    i++;
  }

  if (current) values.push(current.trim());

  return values.map((v) => {
    if (v === "NULL" || v === "null") return null;
    if (v === "true") return "true";
    if (v === "false") return "false";
    if (v === null) return null;
    return v.replace(/^'|'$/g, "");
  });
}

async function parseAssets(): Promise<SupabaseAsset[]> {
  const filePath = path.join(__dirname, "../supabase_sqls/assets_rows.sql");
  const content = fs.readFileSync(filePath, "utf-8");

  const match = content.match(/VALUES\s*\((.*)\)/s);
  if (!match) {
    throw new Error("Could not parse assets SQL file");
  }

  const valuesStr = match[1];
  const records: SupabaseAsset[] = [];

  // Split by '), (' to get individual records
  const recordStrings = valuesStr.split(/\),\s*\(/);

  for (const recordStr of recordStrings) {
    const cleanStr = recordStr.replace(/^\(|\)$/g, "");
    const values = parseValues(cleanStr);

    if (values.length >= 43) {
      records.push({
        id: values[0] || "",
        name: values[1] || "",
        description: values[2],
        serial_number: values[3],
        asset_tag: values[4],
        qr_code: values[5],
        category_id: values[6],
        manufacturer_id: values[7],
        supplier_id: values[8],
        location_id: values[9],
        purchase_date: values[10],
        purchase_cost: values[11],
        warranty_end_date: values[12],
        end_of_life_date: values[13],
        depreciation_period_months: values[14],
        current_value: values[15],
        status: values[16] || "available",
        condition: values[17] || "new",
        image_url: values[18],
        invoice_url: values[19],
        assigned_to: values[20],
        created_at: values[21] || new Date().toISOString(),
        updated_at: values[22] || new Date().toISOString(),
        checkout_status: values[23],
        last_checkout_date: values[24],
        expected_return_date: values[25],
        asset_type: values[26],
        parent_asset_id: values[27],
        quantity: values[28],
        minimum_quantity: values[29],
        department: values[30],
        notes: values[31],
        deployed_to: values[32],
        deployed_to_employee_name: values[33],
        currency: values[34],
        uid: values[35],
        product: values[36],
        asset_id: values[37],
        order_number: values[38],
        last_assigned_by: values[39],
        last_unassigned_by: values[40],
        last_edited_by: values[41],
        last_action_date: values[42],
      });
    }
  }

  return records;
}

function mapAssetCategory(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("laptop") || lower.includes("macbook") || lower.includes("asus")) return "LAPTOP";
  if (lower.includes("iphone") || lower.includes("mobile")) return "MOBILE";
  if (lower.includes("camera") || lower.includes("red") || lower.includes("dji")) return "CAMERA";
  if (lower.includes("monitor") || lower.includes("benq")) return "MONITOR";
  if (lower.includes("keyboard") || lower.includes("ornata")) return "KEYBOARD";
  if (lower.includes("mouse") || lower.includes("deathadder") || lower.includes("logitech")) return "MOUSE";
  if (lower.includes("headphone") || lower.includes("hd 280")) return "HEADPHONES";
  if (lower.includes("charger") || lower.includes("cable")) return "CHARGER";
  if (lower.includes("cable") || lower.includes("thunderbolt")) return "CABLE";
  if (lower.includes("storage") || lower.includes("ssd") || lower.includes("seagate") || lower.includes("wd")) return "STORAGE";
  if (lower.includes("printer")) return "PRINTER";
  if (lower.includes("scanner")) return "SCANNER";
  return "OTHER";
}

async function migrateAssets() {
  console.log("🚀 STARTING ASSETS MIGRATION");
  console.log("============================================================");

  try {
    // Parse assets from SQL
    const assets = await parseAssets();
    console.log(`✓ Parsed ${assets.length} assets\n`);

    console.log("📊 MIGRATING ASSETS...");
    let migratedCount = 0;
    let skippedCount = 0;

    for (const asset of assets) {
      try {
        // Map status
        let status: "AVAILABLE" | "ASSIGNED" | "DAMAGED" | "RETIRED" = "AVAILABLE";
        if (asset.status === "assigned") status = "ASSIGNED";
        else if (asset.status === "damaged") status = "DAMAGED";
        else if (asset.status === "retired") status = "RETIRED";

        // Map asset type
        const assetType = asset.asset_type === "asset" ? "MAIN_ASSET" : "ACCESSORY";

        // Map category
        const category = mapAssetCategory(asset.name);

        // Get manufacturer name (fallback to "Unknown")
        const manufacturer = asset.manufacturer_id ? `Manufacturer-${asset.manufacturer_id.substring(0, 8)}` : "Unknown";

        // Get assigned employee ID
        let assignedToEmployeeId: string | null = null;
        if (asset.assigned_to) {
          assignedToEmployeeId = asset.assigned_to;
          // Verify employee exists
          const emp = await prisma.employee.findUnique({
            where: { id: asset.assigned_to },
          });
          if (!emp) {
            assignedToEmployeeId = null;
          }
        }

        // Create asset
        await prisma.asset.create({
          data: {
            id: asset.id,
            assetName: asset.name,
            assetType: assetType as any,
            category: category as any,
            serialNumber: asset.serial_number || `SN-${asset.id.substring(0, 8)}`,
            manufacturer,
            purchaseDate: asset.purchase_date ? new Date(asset.purchase_date) : new Date(),
            purchaseCost: parseFloat(asset.purchase_cost || "0") || 0,
            description: asset.description,
            warrantyExpiration: asset.warranty_end_date ? new Date(asset.warranty_end_date) : null,
            location: asset.department || null,
            assetImageUrl: asset.image_url,
            invoiceUrl: asset.invoice_url,
            assignedToEmployeeId,
            assignedDate: asset.last_checkout_date ? new Date(asset.last_checkout_date) : null,
            status: status as any,
            createdAt: new Date(asset.created_at),
            updatedAt: new Date(asset.updated_at),
          },
        });

        migratedCount++;
      } catch (error) {
        console.error(`⚠️  Skipped asset ${asset.id}:`, (error as any).message);
        skippedCount++;
      }
    }

    console.log(`✓ Assets: ${migratedCount}`);
    if (skippedCount > 0) {
      console.log(`⚠️  Skipped: ${skippedCount}`);
    }

    console.log("\n============================================================");
    console.log("✅ ASSETS MIGRATION COMPLETE");
    console.log("============================================================");
    console.log(`\nMigration Summary:`);
    console.log(`  assets: ${migratedCount}`);
    console.log(`  skipped: ${skippedCount}`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateAssets();

