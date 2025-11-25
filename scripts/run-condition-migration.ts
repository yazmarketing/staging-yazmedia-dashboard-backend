import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables
const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.local";
dotenv.config({ path: path.join(__dirname, "..", envFile) });
dotenv.config({ path: path.join(__dirname, "..", ".env") }); // Fallback to .env

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log("🔄 Running AssetCondition enum simplification migration...");

    const sqlPath = path.join(__dirname, "../prisma/migrations/20250104000001_simplify_asset_condition/migration.sql");
    const sql = fs.readFileSync(sqlPath, "utf-8");

    // Split SQL into statements, handling DO $$ blocks
    const statements: string[] = [];
    let currentStatement = "";
    let inDoBlock = false;
    let doBlockDepth = 0;

    const lines = sql.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith("DO $$")) {
        inDoBlock = true;
        doBlockDepth = 1;
        currentStatement = line + "\n";
        continue;
      }

      if (inDoBlock) {
        currentStatement += line + "\n";
        if (trimmed.includes("$$")) {
          doBlockDepth += (trimmed.match(/\$\$/g) || []).length;
          if (trimmed.includes("END $$")) {
            inDoBlock = false;
            statements.push(currentStatement.trim());
            currentStatement = "";
          }
        }
      } else if (trimmed && !trimmed.startsWith("--")) {
        if (trimmed.endsWith(";")) {
          currentStatement += trimmed;
          statements.push(currentStatement.trim());
          currentStatement = "";
        } else {
          currentStatement += trimmed + " ";
        }
      }
    }

    // Execute each statement
    for (const stmt of statements) {
      if (stmt.trim()) {
        try {
          await prisma.$executeRawUnsafe(stmt);
          console.log(`✅ Executed: ${stmt.substring(0, 50)}...`);
        } catch (error: any) {
          if (
            error.message?.includes("already exists") ||
            error.message?.includes("does not exist") ||
            error.message?.includes("column") ||
            error.message?.includes("enum")
          ) {
            console.log(`⚠️  Skipped (likely already applied): ${error.message.substring(0, 100)}`);
          } else {
            throw error;
          }
        }
      }
    }

    console.log("\n✅ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();

