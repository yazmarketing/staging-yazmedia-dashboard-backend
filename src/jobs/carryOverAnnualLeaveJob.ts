/**
 * Annual Leave Carry-Over Job
 * 
 * This job should run at the beginning of each year (e.g., January 1st)
 * to automatically carry over unused annual leave from the previous year.
 * 
 * MOHRE UAE Law allows carrying over annual leave, typically up to a certain limit
 * (commonly 5 days, but this should be configurable per company policy).
 * 
 * Usage:
 * 1. Schedule this to run annually using a cron job or task scheduler
 * 2. Or run manually: npx ts-node src/jobs/carryOverAnnualLeaveJob.ts
 */

import { PrismaClient } from '@prisma/client';
import { getOrCreateLeaveSummary } from '../utils/leaveValidation';

const prisma = new PrismaClient();

// Company policy: Maximum days that can be carried over
const MAX_CARRY_OVER_DAYS = 5;

interface CarryOverResult {
  employeeId: string;
  employeeName: string;
  previousYear: number;
  unusedDays: number;
  carriedOverDays: number;
  newYear: number;
}

/**
 * Public API for carry-over - delegates to internal function with default prisma instance
 * @param previousYear - The year to carry over from (defaults to last year)
 * @param currentYear - The year to carry over to (defaults to current year)
 */
export async function carryOverAnnualLeave(
  previousYear?: number,
  currentYear?: number
): Promise<CarryOverResult[]> {
  const now = new Date();
  const prevYear = previousYear || now.getFullYear() - 1;
  const currYear = currentYear || now.getFullYear();
  
  return carryOverAnnualLeaveForJob(prevYear, currYear, prisma);
}

/**
 * Start the annual leave carry-over cron job
 * Runs on January 1st at 12:00 AM (00:00) every year
 * @param prismaInstance - Optional PrismaClient instance (uses internal instance if not provided)
 */
export const startCarryOverAnnualLeaveJob = (prismaInstance?: PrismaClient) => {
  const cron = require('node-cron');
  const prismaClient = prismaInstance || prisma;
  
  // Run on January 1st at 00:00 (midnight) every year
  // Cron format: minute hour day month dayOfWeek
  // "0 0 1 1 *" = January 1st at 00:00
  cron.schedule('0 0 1 1 *', async () => {
    try {
      // Create a temporary function that uses the provided prisma instance
      const now = new Date();
      const prevYear = now.getFullYear() - 1;
      const currYear = now.getFullYear();
      await carryOverAnnualLeaveForJob(prevYear, currYear, prismaClient);
    } catch (error) {
      console.error('❌ Error in annual leave carry-over job:', error);
    }
  });

};

/**
 * Internal function for carry-over that accepts prisma instance
 * Used by both the cron job and manual execution
 */
async function carryOverAnnualLeaveForJob(
  prevYear: number,
  currYear: number,
  prismaClient: PrismaClient
): Promise<CarryOverResult[]> {
  // Get all employees who had a leave summary in the previous year
  const previousYearSummaries = await prismaClient.leaveSummary.findMany({
    where: {
      year: prevYear,
    },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  const results: CarryOverResult[] = [];

  for (const prevSummary of previousYearSummaries) {
    const employee = prevSummary.employee;
    const annualAllowance = prevSummary.annualLeaveEntitlement;
    const annualUsed = prevSummary.annualLeaveUsed;
    const annualCarriedOver = prevSummary.annualLeaveCarriedOver;
    
    // Total available = entitlement + previously carried over
    const totalAvailable = annualAllowance + annualCarriedOver;
    const unusedDays = Math.max(0, totalAvailable - annualUsed);

    // Only carry over if there are unused days
    if (unusedDays > 0) {
      // Cap at maximum carry-over limit
      const daysToCarryOver = Math.min(unusedDays, MAX_CARRY_OVER_DAYS);

      // Get or create leave summary for current year
      const currentSummary = await getOrCreateLeaveSummary(
        employee.id,
        currYear,
        prismaClient
      );

      // Update the current year's summary with carried over days
      await prismaClient.leaveSummary.update({
        where: { id: currentSummary.id },
        data: {
          annualLeaveCarriedOver: daysToCarryOver,
        },
      });

      results.push({
        employeeId: employee.id,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        previousYear: prevYear,
        unusedDays: unusedDays,
        carriedOverDays: daysToCarryOver,
        newYear: currYear,
      });
    }
  }

  return results;
}

/**
 * Main function to run the job manually
 * Can be called directly: npx ts-node src/jobs/carryOverAnnualLeaveJob.ts
 */
async function main() {
  try {
    await carryOverAnnualLeave();
  } catch (error) {
    console.error('❌ Error running carry-over job:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export default carryOverAnnualLeave;

