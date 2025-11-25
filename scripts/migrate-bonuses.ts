import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface SupabaseBonus {
  id: string;
  employee_id: string;
  bonus_type: string;
  amount: string;
  pay_period: string;
  description: string;
  status: string;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

function parseBonuses(): SupabaseBonus[] {
  const filePath = path.join(__dirname, "../supabase_sqls/bonuses_rows.sql");
  const content = fs.readFileSync(filePath, "utf-8");

  const valuesMatch = content.match(/VALUES\s*\((.*)\);?$/s);
  if (!valuesMatch) throw new Error("Could not parse bonuses SQL");

  const valuesStr = valuesMatch[1];
  const records: SupabaseBonus[] = [];
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
      employee_id: cleanValues[1] as string,
      bonus_type: cleanValues[2] as string,
      amount: cleanValues[3] as string,
      pay_period: cleanValues[4] as string,
      description: cleanValues[5] as string,
      status: cleanValues[6] as string,
      created_at: cleanValues[7] as string,
      created_by: cleanValues[8] as string | null,
      updated_at: cleanValues[9] as string,
      updated_by: cleanValues[10] as string | null,
    });
  }

  return records;
}

async function migrateBonuses() {
  try {
    console.log("🔄 Starting bonuses migration...");
    const records = parseBonuses();
    console.log(`📊 Found ${records.length} bonus records to migrate`);

    let migrated = 0;
    let skipped = 0;

    for (const record of records) {
      try {
        const employee = await prisma.employee.findUnique({
          where: { id: record.employee_id },
        });

        if (!employee) {
          skipped++;
          continue;
        }

        const payPeriod = new Date(record.pay_period);
        const createdAt = new Date(record.created_at);
        const updatedAt = new Date(record.updated_at);

        if (isNaN(payPeriod.getTime()) || isNaN(createdAt.getTime()) || isNaN(updatedAt.getTime())) {
          skipped++;
          continue;
        }

        const month = payPeriod.getMonth() + 1; // getMonth() is 0-indexed
        const year = payPeriod.getFullYear();

        await prisma.bonus.create({
          data: {
            id: record.id,
            employeeId: record.employee_id,
            amount: parseFloat(record.amount) || 0,
            reason: record.description || "",
            month,
            year,
            createdAt,
            updatedAt,
            createdBy: record.created_by,
            updatedBy: record.updated_by,
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

migrateBonuses();

