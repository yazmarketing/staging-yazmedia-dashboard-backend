import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface SupabaseInventoryCategory {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

function parseInventoryCategories(): SupabaseInventoryCategory[] {
  const filePath = path.join(__dirname, "../supabase_sqls/inventory_categories_rows.sql");
  const content = fs.readFileSync(filePath, "utf-8");

  const valuesMatch = content.match(/VALUES\s*\((.*)\);?$/s);
  if (!valuesMatch) throw new Error("Could not parse inventory categories SQL");

  const valuesStr = valuesMatch[1];
  const records: SupabaseInventoryCategory[] = [];
  const recordStrings = valuesStr.split(/\),\s*\(/);

  for (let i = 0; i < recordStrings.length; i++) {
    let recordStr = recordStrings[i];
    if (i === 0) recordStr = recordStr.replace(/^\(/, "");
    if (i === recordStrings.length - 1) recordStr = recordStr.replace(/\)$/, "");

    const values = recordStr.split(/,\s*(?=(?:[^']*'[^']*')*[^']*$)/);
    const cleanValues = values.map((v) => {
      v = v.trim();
      if (v === "null") return null;
      if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
      return v;
    });

    records.push({
      id: cleanValues[0] as string,
      name: cleanValues[1] as string,
      description: cleanValues[2] as string | null,
      created_at: cleanValues[3] as string,
      updated_at: cleanValues[4] as string,
    });
  }

  return records;
}

async function migrateInventoryCategories() {
  try {
    console.log("🔄 Starting inventory categories migration...");
    const records = parseInventoryCategories();
    console.log(`📊 Found ${records.length} inventory category records to migrate`);

    let migrated = 0;
    let skipped = 0;

    for (const record of records) {
      try {
        const createdAt = new Date(record.created_at);
        const updatedAt = new Date(record.updated_at);

        if (isNaN(createdAt.getTime()) || isNaN(updatedAt.getTime())) {
          skipped++;
          continue;
        }

        // Note: InventoryItem model doesn't have createdAt/updatedAt in schema
        // So we'll just create with basic fields
        await prisma.inventoryItem.create({
          data: {
            name: record.name,
            category: record.name,
            serialNumber: `CAT-${record.id.substring(0, 8).toUpperCase()}`,
            purchaseDate: new Date(),
            purchaseCost: 0,
            notes: record.description || undefined,
          },
        });

        migrated++;
        if (migrated % 10 === 0) console.log(`  ✅ ${migrated}/${records.length}`);
      } catch (error: any) {
        if (error.code !== "P2002") {
          console.error(`  ❌ Error:`, error.message);
        }
        skipped++;
      }
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`  Migrated: ${migrated}`);
    console.log(`  Skipped: ${skipped}`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateInventoryCategories();

