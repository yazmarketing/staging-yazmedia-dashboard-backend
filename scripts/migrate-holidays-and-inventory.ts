import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface SupabaseHoliday {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  holiday_type: string;
  created_at: string;
  updated_at: string;
}

function parseHolidays(): SupabaseHoliday[] {
  const filePath = path.join(__dirname, "../supabase_sqls/holidays_rows.sql");
  const content = fs.readFileSync(filePath, "utf-8");

  const valuesMatch = content.match(/VALUES\s*\((.*)\);?$/s);
  if (!valuesMatch) throw new Error("Could not parse holidays SQL");

  const valuesStr = valuesMatch[1];
  const records: SupabaseHoliday[] = [];
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
      start_date: cleanValues[3] as string,
      end_date: cleanValues[4] as string,
      holiday_type: cleanValues[5] as string,
      created_at: cleanValues[7] as string,
      updated_at: cleanValues[8] as string,
    });
  }

  return records;
}

async function migrateHolidays() {
  try {
    console.log("🔄 Starting holidays migration...");
    const records = parseHolidays();
    console.log(`📊 Found ${records.length} holiday records to migrate`);

    // Ensure holiday type exists
    let holidayType = await prisma.holidayType.findFirst({
      where: { type: "PUBLIC_HOLIDAY" },
    });

    if (!holidayType) {
      holidayType = await prisma.holidayType.create({
        data: {
          name: "Public Holiday",
          type: "PUBLIC_HOLIDAY",
        },
      });
    }

    let migrated = 0;
    let skipped = 0;

    for (const record of records) {
      try {
        const startDate = new Date(record.start_date);
        const endDate = new Date(record.end_date);
        const createdAt = new Date(record.created_at);
        const updatedAt = new Date(record.updated_at);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          skipped++;
          continue;
        }

        const duration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        await prisma.holiday.create({
          data: {
            id: record.id,
            name: record.name.trim(),
            description: record.description || undefined,
            startDate,
            endDate,
            holidayTypeId: holidayType.id,
            duration,
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

    console.log(`\n✅ Holidays migration complete!`);
    console.log(`  Migrated: ${migrated}`);
    console.log(`  Skipped: ${skipped}`);
  } catch (error) {
    console.error("❌ Holidays migration failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateHolidays();

