import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

interface SupabaseUserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
  updated_at: string;
  phone_number: string | null;
  department: string | null;
  designation: string | null;
  status: string;
  last_login: string | null;
  avatar_url: string | null;
}

function parseValues(valuesStr: string): SupabaseUserProfile[] {
  const records: SupabaseUserProfile[] = [];
  
  // Split by ), ( pattern to get individual records
  const recordStrings = valuesStr.split(/\), \(/);
  
  for (let i = 0; i < recordStrings.length; i++) {
    let recordStr = recordStrings[i];
    
    // Clean up the record string
    if (i === 0) {
      recordStr = recordStr.replace(/^\(/, ""); // Remove leading (
    }
    if (i === recordStrings.length - 1) {
      recordStr = recordStr.replace(/\)$/, ""); // Remove trailing )
    }
    
    const record = parseRecord(recordStr.trim());
    if (record) records.push(record);
  }

  return records;
}

function parseRecord(recordStr: string): SupabaseUserProfile | null {
  recordStr = recordStr.replace(/^\(|\)$/g, "").trim();
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < recordStr.length; i++) {
    const char = recordStr[i];

    if (char === "'" && (i === 0 || recordStr[i - 1] !== "\\")) {
      inQuotes = !inQuotes;
      current += char;
    } else if (!inQuotes && char === ",") {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  if (current.trim()) values.push(current.trim());

  if (values.length < 12) return null;

  const cleanValue = (val: string) => {
    if (val === "null") return null;
    if (val.startsWith("'") && val.endsWith("'")) {
      return val.slice(1, -1).replace(/\\'/g, "'");
    }
    return val;
  };

  return {
    id: cleanValue(values[0]) as string,
    email: cleanValue(values[1]) as string,
    full_name: cleanValue(values[2]) as string,
    role: cleanValue(values[3]) as string,
    created_at: cleanValue(values[4]) as string,
    updated_at: cleanValue(values[5]) as string,
    phone_number: cleanValue(values[6]) as string | null,
    department: cleanValue(values[7]) as string | null,
    designation: cleanValue(values[8]) as string | null,
    status: cleanValue(values[9]) as string,
    last_login: cleanValue(values[10]) as string | null,
    avatar_url: cleanValue(values[11]) as string | null,
  };
}

async function parseUserProfiles(): Promise<SupabaseUserProfile[]> {
  const filePath = path.join(__dirname, "../supabase_sqls/user_profiles_rows.sql");
  const content = fs.readFileSync(filePath, "utf-8");
  const match = content.match(/VALUES\s*\((.*)\)/s);

  if (!match) {
    console.error("❌ Could not parse user profiles SQL file");
    return [];
  }

  return parseValues(match[1]);
}

async function migrateUserProfiles() {
  try {
    console.log("👥 Starting user profiles migration...\n");

    const profiles = await parseUserProfiles();
    console.log(`📋 Found ${profiles.length} user profiles\n`);

    let migrated = 0;
    let skipped = 0;

    for (const profile of profiles) {
      try {
        // Check if employee with this email already exists
        const existingEmployee = await prisma.employee.findUnique({
          where: { email: profile.email },
        });

        if (existingEmployee) {
          console.log(`⏭️  Skipped: Employee ${profile.email} already exists`);
          skipped++;
          continue;
        }

        // Find or create department
        let departmentId: string;
        if (profile.department) {
          const dept = await prisma.department.findFirst({
            where: { name: profile.department },
          });
          if (dept) {
            departmentId = dept.id;
          } else {
            const newDept = await prisma.department.create({
              data: {
                name: profile.department,
                code: profile.department.substring(0, 3).toUpperCase(),
              },
            });
            departmentId = newDept.id;
          }
        } else {
          // Use default department
          const defaultDept = await prisma.department.findFirst({
            where: { name: "General" },
          });
          if (!defaultDept) {
            const newDept = await prisma.department.create({
              data: {
                name: "General",
                code: "GEN",
              },
            });
            departmentId = newDept.id;
          } else {
            departmentId = defaultDept.id;
          }
        }

        // Generate password hash
        const hashedPassword = await bcrypt.hash("Test@123", 10);

        // Parse full name
        const nameParts = profile.full_name.split(" ");
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(" ") || "User";

        // Create employee
        await prisma.employee.create({
          data: {
            id: profile.id,
            firstName,
            lastName,
            email: profile.email,
            password: hashedPassword,
            phone: profile.phone_number,
            designation: profile.designation || "Employee",
            departmentId,
            employeeId: profile.email.split("@")[0].toUpperCase(),
            baseSalary: 0,
            totalSalary: 0,
            joinDate: new Date(profile.created_at),
            status: profile.status === "active" ? "ACTIVE" : "TERMINATED",
            userStatus: profile.status === "active" ? "ACTIVE" : "INACTIVE",
            createdAt: new Date(profile.created_at),
            updatedAt: new Date(profile.updated_at),
          },
        });

        migrated++;
        if (migrated % 10 === 0) {
          console.log(`✅ Migrated ${migrated} user profiles...`);
        }
      } catch (error: any) {
        console.error(`⚠️  Skipped:`, error.message);
        skipped++;
      }
    }

    console.log(`\n✅ User profiles migration complete!`);
    console.log(`📊 Migrated: ${migrated}`);
    console.log(`⏭️  Skipped: ${skipped}`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateUserProfiles();

