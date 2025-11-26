import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface SupabaseManufacturer {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  created_at: string;
  updated_at: string;
}

function parseManufacturers(): SupabaseManufacturer[] {
  const filePath = path.join(__dirname, "../supabase_sqls/manufacturers_rows.sql");
  const content = fs.readFileSync(filePath, "utf-8");

  const valuesMatch = content.match(/VALUES\s*\((.*)\);?$/s);
  if (!valuesMatch) throw new Error("Could not parse manufacturers SQL");

  const valuesStr = valuesMatch[1];
  const records: SupabaseManufacturer[] = [];
  const recordStrings = valuesStr.split(/\),\s*\(/);

  for (let i = 0; i < recordStrings.length; i++) {
    let recordStr = recordStrings[i];
    if (i === 0) recordStr = recordStr.replace(/^\(/, "");
    if (i === recordStrings.length - 1) recordStr = recordStr.replace(/\)$/, "");

    const values = recordStr.split(/,\s*(?=(?:[^']*'[^']*')*[^']*$)/);
    const cleanValues = values.map((v) => {
      v = v.trim();
      if (v === "null" || v === "") return null;
      if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
      return v;
    });

    records.push({
      id: cleanValues[0] as string,
      name: cleanValues[1] as string,
      contact_person: cleanValues[2] as string | null,
      email: cleanValues[3] as string | null,
      phone: cleanValues[4] as string | null,
      website: cleanValues[5] as string | null,
      created_at: cleanValues[6] as string,
      updated_at: cleanValues[7] as string,
    });
  }

  return records;
}

async function migrateManufacturers() {
  try {
    console.log("🔄 Starting manufacturers migration...");
    const records = parseManufacturers();
    console.log(`📊 Found ${records.length} manufacturer records to migrate`);

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

        await prisma.manufacturer.create({
          data: {
            id: record.id,
            name: record.name.trim(),
            contactPerson: record.contact_person || undefined,
            email: record.email || undefined,
            phone: record.phone || undefined,
            website: record.website || undefined,
            createdAt,
            updatedAt,
          },
        });

        migrated++;
        if (migrated % 5 === 0) console.log(`  ✅ ${migrated}/${records.length}`);
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

migrateManufacturers();

