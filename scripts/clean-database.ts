import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function cleanDatabase() {
  console.log("🗑️  CLEANING DATABASE - DELETING ALL DATA\n");

  try {
    // Delete in order of dependencies (reverse of creation order)
    console.log("Deleting Announcement...");
    await prisma.announcement.deleteMany({});

    console.log("Deleting AnnouncementDepartment...");
    await prisma.announcementDepartment.deleteMany({});

    console.log("Deleting Attendance...");
    await prisma.attendance.deleteMany({});

    console.log("Deleting LeaveRequest...");
    await prisma.leaveRequest.deleteMany({});

    console.log("Deleting LeaveRequestDocument...");
    await prisma.leaveRequestDocument.deleteMany({});

    console.log("Deleting OvertimeApproval...");
    await prisma.overtimeApproval.deleteMany({});

    console.log("Deleting OvertimeRequest...");
    await prisma.overtimeRequest.deleteMany({});

    console.log("Deleting Reimbursement...");
    await prisma.reimbursement.deleteMany({});

    console.log("Deleting Deduction...");
    await prisma.deduction.deleteMany({});

    console.log("Deleting Bonus...");
    await prisma.bonus.deleteMany({});

    console.log("Deleting SalaryChange...");
    await prisma.salaryChange.deleteMany({});

    console.log("Deleting Payroll...");
    await prisma.payroll.deleteMany({});

    console.log("Deleting Project...");
    await prisma.project.deleteMany({});

    console.log("Deleting LeaveSummary...");
    await prisma.leaveSummary.deleteMany({});

    console.log("Deleting EmployeeBank...");
    await prisma.employeeBank.deleteMany({});

    console.log("Deleting EmployeeDocument...");
    await prisma.employeeDocument.deleteMany({});

    console.log("Deleting Employee...");
    await prisma.employee.deleteMany({});

    console.log("Deleting Department...");
    await prisma.department.deleteMany({});

    console.log("Deleting LeaveTypeColor...");
    await prisma.leaveTypeColor.deleteMany({});

    console.log("Deleting HolidayType...");
    await prisma.holidayType.deleteMany({});

    console.log("Deleting ReimbursementType...");
    await prisma.reimbursementType.deleteMany({});

    console.log("Deleting Client...");
    await prisma.client.deleteMany({});

    console.log("Deleting InventoryItem...");
    await prisma.inventoryItem.deleteMany({});

    console.log("Deleting Asset...");
    await prisma.asset.deleteMany({});

    console.log("\n✅ ALL DATA DELETED\n");

    // Verify database is empty
    console.log("🔍 VERIFYING DATABASE IS EMPTY...\n");

    const employees = await prisma.employee.count();
    const departments = await prisma.department.count();
    const leaveTypeColors = await prisma.leaveTypeColor.count();
    const holidayTypes = await prisma.holidayType.count();
    const reimbursementTypes = await prisma.reimbursementType.count();
    const clients = await prisma.client.count();
    const employeeBank = await prisma.employeeBank.count();
    const leaveSummary = await prisma.leaveSummary.count();
    const attendance = await prisma.attendance.count();
    const leaveRequest = await prisma.leaveRequest.count();
    const projects = await prisma.project.count();
    const announcements = await prisma.announcement.count();

    console.log("📊 TABLE RECORD COUNTS:");
    console.log(`  Employee: ${employees}`);
    console.log(`  Department: ${departments}`);
    console.log(`  LeaveTypeColor: ${leaveTypeColors}`);
    console.log(`  HolidayType: ${holidayTypes}`);
    console.log(`  ReimbursementType: ${reimbursementTypes}`);
    console.log(`  Client: ${clients}`);
    console.log(`  EmployeeBank: ${employeeBank}`);
    console.log(`  LeaveSummary: ${leaveSummary}`);
    console.log(`  Attendance: ${attendance}`);
    console.log(`  LeaveRequest: ${leaveRequest}`);
    console.log(`  Project: ${projects}`);
    console.log(`  Announcement: ${announcements}`);

    const total =
      employees +
      departments +
      leaveTypeColors +
      holidayTypes +
      reimbursementTypes +
      clients +
      employeeBank +
      leaveSummary +
      attendance +
      leaveRequest +
      projects +
      announcements;

    console.log(`\n✅ TOTAL RECORDS: ${total}`);

    if (total === 0) {
      console.log("✅ DATABASE IS COMPLETELY EMPTY - READY FOR MIGRATION\n");
    } else {
      console.log("⚠️  DATABASE STILL HAS DATA\n");
    }
  } catch (error) {
    console.error("Error cleaning database:", error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanDatabase();

