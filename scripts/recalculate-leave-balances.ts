/**
 * Script to recalculate all employee leave balances from approved leave requests
 * 
 * This script:
 * 1. Fetches all approved leave requests
 * 2. Recalculates used days for each leave type per employee per year
 * 3. Updates LeaveSummary records with correct balances
 * 
 * Usage:
 * cd yazmedia-dashboard-backend
 * npx ts-node scripts/recalculate-leave-balances.ts
 */

import { PrismaClient } from '@prisma/client';
import { startOfYear, endOfYear, startOfWeek, endOfWeek, startOfMonth, endOfMonth, differenceInMonths } from 'date-fns';

const prisma = new PrismaClient();

/**
 * Calculate annual leave entitlement based on MOHRE UAE law:
 * - 30 days/year for employees who have completed 1 year of service
 * - 2 days × (number of completed months AFTER the first 6 months of service)
 * - 0 days for employees with less than 6 months
 * 
 * Important: Only full months after the first 6 months count. No decimals.
 */
function calculateAnnualLeaveEntitlement(joinDate: Date, year: number): number {
  const yearStart = startOfYear(new Date(year, 0, 1));
  const yearEnd = endOfYear(new Date(year, 0, 1));
  
  // Calculate FULL months of service by end of year (using date-fns differenceInMonths)
  // This counts complete month intervals (e.g., May 20 to June 20 = 1 month)
  let fullMonthsOfService: number;
  
  if (joinDate > yearStart) {
    // Employee joined during this year
    // Count full months from join date to year end
    // differenceInMonths counts complete month intervals
    fullMonthsOfService = differenceInMonths(yearEnd, joinDate);
  } else {
    // Employee joined before this year - they'll have 12 full months this year
    fullMonthsOfService = 12;
  }
  
  // MOHRE: 2 days × (number of completed months AFTER the first 6 months)
  // No entitlement before 6 months
  // Only FULL months count (no partial months)
  
  // If less than 6 full months by end of year, no entitlement
  if (fullMonthsOfService < 6) {
    return 0;
  }
  
  // If 12 full months or more (full year), full 30 days entitlement
  if (fullMonthsOfService >= 12) {
    return 30;
  }
  
  // For 6-12 full months: 2 days × (months AFTER the first 6 months)
  // Only full months after 6 count
  const monthsAfterSixMonths = fullMonthsOfService - 6;
  const entitlement = monthsAfterSixMonths * 2;
  
  // Cap at 24 days for prorated year (max 6 months after 6 = 12 days, but cap at 24 as safety)
  return Math.min(entitlement, 24);
}

interface LeaveRequestData {
  employeeId: string;
  leaveType: string;
  numberOfDays: number;
  startDate: Date;
  endDate: Date;
  compensationMethod?: string | null;
  overtimeRequestIds?: string[] | null;
}

async function recalculateLeaveBalances() {
  console.log('🔄 Starting leave balance recalculation...\n');

  try {
    // Get all approved leave requests
    const approvedRequests = await prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
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
      orderBy: {
        startDate: 'asc',
      },
    });

    console.log(`📊 Found ${approvedRequests.length} approved leave requests\n`);

    // Get all employees with join dates
    const employees = await prisma.employee.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        joinDate: true,
      },
    });

    console.log(`👥 Processing ${employees.length} employees\n`);

    // Group requests by employee and year
    const requestsByEmployeeYear = new Map<string, Map<number, LeaveRequestData[]>>();

    for (const request of approvedRequests) {
      const year = new Date(request.startDate).getFullYear();

      if (!requestsByEmployeeYear.has(request.employeeId)) {
        requestsByEmployeeYear.set(request.employeeId, new Map());
      }

      const yearMap = requestsByEmployeeYear.get(request.employeeId)!;
      if (!yearMap.has(year)) {
        yearMap.set(year, []);
      }

      yearMap.get(year)!.push({
        employeeId: request.employeeId,
        leaveType: request.leaveType,
        numberOfDays: request.numberOfDays,
        startDate: request.startDate,
        endDate: request.endDate,
        compensationMethod: request.compensationMethod,
        overtimeRequestIds: request.overtimeRequestIds,
      });
    }

    let updatedCount = 0;
    let createdCount = 0;

    // Process each employee and year combination
    for (const employee of employees) {
      const employeeRequests = requestsByEmployeeYear.get(employee.id);

      if (!employeeRequests || employeeRequests.size === 0) {
        // No leave requests for this employee, but ensure they have a summary for current year
        const currentYear = new Date().getFullYear();
        const existingSummary = await prisma.leaveSummary.findUnique({
          where: {
            employeeId_year: {
              employeeId: employee.id,
              year: currentYear,
            },
          },
        });

        if (!existingSummary) {
          await prisma.leaveSummary.create({
            data: {
              employeeId: employee.id,
              year: currentYear,
            },
          });
          createdCount++;
        }
        continue;
      }

      // Process each year
      for (const [year, requests] of employeeRequests.entries()) {
        const yearNum = parseInt(year.toString());

        // Get or create leave summary
        let summary = await prisma.leaveSummary.findUnique({
          where: {
            employeeId_year: {
              employeeId: employee.id,
              year: yearNum,
            },
          },
        });

        // Calculate annual leave entitlement based on join date and tenure (MOHRE UAE law)
        const annualLeaveEntitlement = calculateAnnualLeaveEntitlement(employee.joinDate, yearNum);

        if (!summary) {
          summary = await prisma.leaveSummary.create({
            data: {
              employeeId: employee.id,
              year: yearNum,
              annualLeaveEntitlement,
            },
          });
          createdCount++;
        } else {
          // Update entitlement if it's incorrect
          if (summary.annualLeaveEntitlement !== annualLeaveEntitlement) {
            await prisma.leaveSummary.update({
              where: { id: summary.id },
              data: { annualLeaveEntitlement },
            });
          }
        }

        // Reset all used counters
        const updates: any = {
          annualLeaveUsed: 0,
          sickLeaveUsed: 0,
          maternityLeaveUsed: 0,
          emergencyLeaveUsed: 0,
          toilHoursUsed: 0,
          wfhUsedThisMonth: 0,
          wfhUsedThisWeek: 0,
          annualLeaveEntitlement, // Ensure entitlement is correct
        };

        // Calculate used days by leave type
        for (const request of requests) {
          switch (request.leaveType) {
            case 'ANNUAL':
              updates.annualLeaveUsed += request.numberOfDays;
              break;

            case 'SICK':
              updates.sickLeaveUsed += request.numberOfDays;
              break;

            case 'MATERNITY':
              updates.maternityLeaveUsed += request.numberOfDays;
              break;

            case 'EMERGENCY':
              if (request.compensationMethod === 'annual_leave') {
                // Deduct from annual leave instead
                updates.annualLeaveUsed += request.numberOfDays;
              } else {
                // Deduct from emergency leave
                updates.emergencyLeaveUsed += request.numberOfDays;
              }
              break;

            case 'TOIL':
              // Get overtime hours from the overtime requests
              if (request.overtimeRequestIds && request.overtimeRequestIds.length > 0) {
                const overtimeRequests = await prisma.overtimeRequest.findMany({
                  where: {
                    id: { in: request.overtimeRequestIds },
                    employeeId: employee.id,
                    status: 'APPROVED',
                  },
                  select: {
                    requestedHours: true,
                  },
                });

                const totalHours = overtimeRequests.reduce(
                  (sum, req) => sum + req.requestedHours,
                  0
                );
                updates.toilHoursUsed += totalHours;
              }
              break;

            case 'WFH':
              // Count WFH usage by month and week
              const requestDate = new Date(request.startDate);
              const requestYear = requestDate.getFullYear();

              // Check if this request is in the same year as the summary
              if (requestYear === yearNum) {
                // Count WFH in this month
                const monthStart = startOfMonth(requestDate);
                const monthEnd = endOfMonth(requestDate);

                const monthWFH = requests.filter((r) => {
                  if (r.leaveType !== 'WFH') return false;
                  const rDate = new Date(r.startDate);
                  return rDate >= monthStart && rDate <= monthEnd;
                }).length;

                // Get the month with most WFH usage (for tracking)
                if (monthWFH > updates.wfhUsedThisMonth) {
                  updates.wfhUsedThisMonth = monthWFH;
                }

                // Count WFH in this week
                const weekStart = startOfWeek(requestDate, { weekStartsOn: 0 });
                const weekEnd = endOfWeek(requestDate, { weekStartsOn: 0 });

                const weekWFH = requests.filter((r) => {
                  if (r.leaveType !== 'WFH') return false;
                  const rDate = new Date(r.startDate);
                  return rDate >= weekStart && rDate <= weekEnd;
                }).length;

                if (weekWFH > updates.wfhUsedThisWeek) {
                  updates.wfhUsedThisWeek = weekWFH;
                  updates.wfhLastWeekStart = weekStart;
                }
              }
              break;
          }
        }

        // Update the summary
        await prisma.leaveSummary.update({
          where: {
            id: summary.id,
          },
          data: updates,
        });

        updatedCount++;

        const employeeName = `${employee.firstName} ${employee.lastName}`;
        console.log(
          `✅ Updated ${employeeName} (${yearNum}): ` +
          `Annual Entitlement: ${updates.annualLeaveEntitlement} days, ` +
          `Used: ${updates.annualLeaveUsed.toFixed(1)}, ` +
          `Remaining: ${(updates.annualLeaveEntitlement - updates.annualLeaveUsed).toFixed(1)}, ` +
          `Sick: ${updates.sickLeaveUsed.toFixed(1)}, ` +
          `Maternity: ${updates.maternityLeaveUsed.toFixed(1)}, ` +
          `Emergency: ${updates.emergencyLeaveUsed.toFixed(1)}, ` +
          `TOIL: ${updates.toilHoursUsed.toFixed(1)}h, ` +
          `WFH: ${updates.wfhUsedThisMonth}/${updates.wfhUsedThisWeek}`
        );
      }
    }

    // Ensure all employees have a summary for the current year (even with 0 usage)
    const currentYear = new Date().getFullYear();
    for (const employee of employees) {
      const existingSummary = await prisma.leaveSummary.findUnique({
        where: {
          employeeId_year: {
            employeeId: employee.id,
            year: currentYear,
          },
        },
      });

      if (!existingSummary) {
        const annualLeaveEntitlement = calculateAnnualLeaveEntitlement(employee.joinDate, currentYear);
        await prisma.leaveSummary.create({
          data: {
            employeeId: employee.id,
            year: currentYear,
            annualLeaveEntitlement,
          },
        });
        createdCount++;
        console.log(
          `📝 Created summary for ${employee.firstName} ${employee.lastName} (${currentYear}): ` +
          `Annual Entitlement: ${annualLeaveEntitlement} days`
        );
      } else {
        // Update entitlement if it's incorrect
        const annualLeaveEntitlement = calculateAnnualLeaveEntitlement(employee.joinDate, currentYear);
        if (existingSummary.annualLeaveEntitlement !== annualLeaveEntitlement) {
          await prisma.leaveSummary.update({
            where: { id: existingSummary.id },
            data: { annualLeaveEntitlement },
          });
          console.log(
            `🔄 Updated entitlement for ${employee.firstName} ${employee.lastName} (${currentYear}): ` +
            `${existingSummary.annualLeaveEntitlement} → ${annualLeaveEntitlement} days`
          );
        }
      }
    }

    console.log(`\n✨ Recalculation complete!`);
    console.log(`   - Updated: ${updatedCount} summaries`);
    console.log(`   - Created: ${createdCount} summaries`);
    console.log(`   - Total processed: ${employees.length} employees\n`);
  } catch (error) {
    console.error('❌ Error recalculating leave balances:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
recalculateLeaveBalances()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

