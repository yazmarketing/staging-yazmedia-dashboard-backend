import { spawn } from "child_process";
import * as path from "path";

const scripts = [
  "migrate-attendance.ts",
  "migrate-leave-requests.ts",
  "migrate-payroll.ts",
  "migrate-reimbursements.ts",
  "migrate-bonuses.ts",
  "migrate-deductions.ts",
  "migrate-salary-changes.ts",
  "migrate-employee-documents.ts",
  "migrate-holidays-and-inventory.ts",
  "migrate-inventory-categories.ts",
  "migrate-assets.ts",
  "migrate-overtime.ts",
  "migrate-announcements.ts",
];

async function runScript(scriptName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\n📊 Running: ${scriptName}`);
    console.log("─".repeat(60));

    const child = spawn("npx", ["ts-node", `scripts/${scriptName}`], {
      cwd: process.cwd(),
      stdio: "inherit",
      env: process.env,
    });

    child.on("close", (code) => {
      if (code === 0) {
        console.log(`✅ ${scriptName} completed\n`);
        resolve();
      } else {
        console.error(`❌ ${scriptName} failed with code ${code}\n`);
        reject(new Error(`Script ${scriptName} failed`));
      }
    });

    child.on("error", (err) => {
      console.error(`❌ Error running ${scriptName}:`, err);
      reject(err);
    });
  });
}

async function main() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║     🚀 PRODUCTION DATA MIGRATION STARTED                  ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  let completed = 0;
  let failed = 0;

  for (const script of scripts) {
    try {
      await runScript(script);
      completed++;
    } catch (error) {
      console.error(`Failed to run ${script}`);
      failed++;
    }
  }

  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║     ✅ PRODUCTION MIGRATION COMPLETE                      ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");
  console.log(`Completed: ${completed}/${scripts.length}`);
  if (failed > 0) {
    console.log(`Failed: ${failed}/${scripts.length}`);
  }
}

main().catch(console.error);

