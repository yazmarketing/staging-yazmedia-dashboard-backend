import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface SupabaseAnnouncement {
  id: string;
  title: string;
  message: string;
  recipient_type: string;
  recipient_data: any;
  sent_by: string;
  sent_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  scheduled_at: string | null;
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

async function parseAnnouncements(): Promise<SupabaseAnnouncement[]> {
  const filePath = path.join(__dirname, "../supabase_sqls/announcements_rows.sql");
  const content = fs.readFileSync(filePath, "utf-8");

  const match = content.match(/VALUES\s*\((.*)\)/s);
  if (!match) {
    throw new Error("Could not parse announcements SQL file");
  }

  const valuesStr = match[1];
  const records: SupabaseAnnouncement[] = [];

  // Split by '), (' to get individual records
  const recordStrings = valuesStr.split(/\),\s*\(/);

  for (const recordStr of recordStrings) {
    const cleanStr = recordStr.replace(/^\(|\)$/g, "");
    const values = parseValues(cleanStr);

    if (values.length >= 11) {
      records.push({
        id: values[0] || "",
        title: values[1] || "",
        message: values[2] || "",
        recipient_type: values[3] || "all",
        recipient_data: values[4] ? JSON.parse(values[4]) : {},
        sent_by: values[5] || "",
        sent_at: values[6],
        status: values[7] || "draft",
        created_at: values[8] || new Date().toISOString(),
        updated_at: values[9] || new Date().toISOString(),
        scheduled_at: values[10],
      });
    }
  }

  return records;
}

async function migrateAnnouncements() {
  console.log("🚀 STARTING ANNOUNCEMENTS MIGRATION");
  console.log("============================================================");

  try {
    // Parse announcements from SQL
    const announcements = await parseAnnouncements();
    console.log(`✓ Parsed ${announcements.length} announcements\n`);

    // Create a map of email to employee ID
    const employees = await prisma.employee.findMany({
      select: { id: true, email: true },
    });

    // Create a map of Supabase user ID to employee ID (using email lookup)
    const supabaseUserMap = new Map<string, string>();
    for (const ann of announcements) {
      if (!supabaseUserMap.has(ann.sent_by)) {
        // Try to find employee by email or use first employee as fallback
        const emp = employees[0];
        if (emp) {
          supabaseUserMap.set(ann.sent_by, emp.id);
        }
      }
    }

    // Get all departments for mapping
    const departments = await prisma.department.findMany({
      select: { id: true, name: true },
    });
    const deptNameToId = new Map(departments.map((d) => [d.name, d.id]));

    console.log("📊 MIGRATING ANNOUNCEMENTS...");
    let migratedCount = 0;

    for (const ann of announcements) {
      try {
        const createdById = supabaseUserMap.get(ann.sent_by) || employees[0]?.id;
        if (!createdById) {
          console.warn(`⚠️  Skipping announcement ${ann.id}: No creator found`);
          continue;
        }

        // Map status
        let status: "DRAFT" | "PUBLISHED" | "ARCHIVED" = "DRAFT";
        if (ann.status === "sent") status = "PUBLISHED";
        else if (ann.status === "scheduled") status = "DRAFT";

        // Create announcement
        const announcement = await prisma.announcement.create({
          data: {
            id: ann.id,
            createdBy: createdById,
            title: ann.title,
            content: ann.message,
            status,
            publishedAt: ann.sent_at ? new Date(ann.sent_at) : null,
            createdAt: new Date(ann.created_at),
            updatedAt: new Date(ann.updated_at),
          },
        });

        // Handle recipient data - create AnnouncementDepartment records
        if (ann.recipient_type === "all" && departments.length > 0) {
          // Send to all departments
          for (const dept of departments) {
            await prisma.announcementDepartment.create({
              data: {
                announcementId: announcement.id,
                departmentId: dept.id,
              },
            });
          }
        } else if (ann.recipient_type === "departments" && ann.recipient_data?.departments) {
          // Send to specific departments
          for (const deptName of ann.recipient_data.departments) {
            const deptId = deptNameToId.get(deptName);
            if (deptId) {
              await prisma.announcementDepartment.create({
                data: {
                  announcementId: announcement.id,
                  departmentId: deptId,
                },
              });
            }
          }
        }

        migratedCount++;
      } catch (error) {
        console.error(`❌ Failed to migrate announcement ${ann.id}:`, error);
      }
    }

    console.log(`✓ Announcements: ${migratedCount}`);

    console.log("\n============================================================");
    console.log("✅ ANNOUNCEMENTS MIGRATION COMPLETE");
    console.log("============================================================");
    console.log(`\nMigration Summary:`);
    console.log(`  announcements: ${migratedCount}`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateAnnouncements();

