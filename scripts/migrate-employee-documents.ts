import { PrismaClient, DocumentType } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface SupabaseEmployeeAttachment {
  id: string;
  employee_id: string;
  file_name: string;
  file_path: string;
  uploaded_at: string;
  uploaded_by: string | null;
}

function parseEmployeeAttachments(): SupabaseEmployeeAttachment[] {
  const filePath = path.join(__dirname, "../supabase_sqls/employee_attachments_rows.sql");
  const content = fs.readFileSync(filePath, "utf-8");

  const valuesMatch = content.match(/VALUES\s*\((.*)\);?$/s);
  if (!valuesMatch) throw new Error("Could not parse employee attachments SQL");

  const valuesStr = valuesMatch[1];
  const records: SupabaseEmployeeAttachment[] = [];
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
      file_name: cleanValues[2] as string,
      file_path: cleanValues[3] as string,
      uploaded_at: cleanValues[4] as string,
      uploaded_by: cleanValues[5] as string | null,
    });
  }

  return records;
}

function inferDocumentType(fileName: string): DocumentType {
  const lowerName = fileName.toLowerCase();
  
  if (lowerName.includes("passport")) return "PASSPORT";
  if (lowerName.includes("id") || lowerName.includes("emirates") || lowerName.includes("eid")) return "EMIRATES_ID";
  if (lowerName.includes("certificate") || lowerName.includes("degree") || lowerName.includes("diploma")) return "CERTIFICATE";
  
  return "OTHER";
}

async function migrateEmployeeDocuments() {
  try {
    console.log("🔄 Starting employee documents migration...");
    const records = parseEmployeeAttachments();
    console.log(`📊 Found ${records.length} employee document records to migrate`);

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

        const uploadedAt = new Date(record.uploaded_at);

        if (isNaN(uploadedAt.getTime())) {
          skipped++;
          continue;
        }

        await prisma.employeeDocument.create({
          data: {
            id: record.id,
            employeeId: record.employee_id,
            documentType: inferDocumentType(record.file_name),
            name: record.file_name,
            url: record.file_path,
            uploadedAt,
          },
        });

        migrated++;
        if (migrated % 50 === 0) console.log(`  ✅ ${migrated}/${records.length}`);
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

migrateEmployeeDocuments();

