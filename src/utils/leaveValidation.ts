import { PrismaClient } from '@prisma/client';
import { differenceInCalendarDays, differenceInMonths } from 'date-fns';

export interface LeaveBalance {
  available: number;
  used: number;
  entitlement: number;
  carriedOver?: number;
}

export interface LeaveValidationResult {
  valid: boolean;
  message?: string;
  balance?: LeaveBalance;
  projectedBalance?: number;
}

/**
 * Calculate annual leave entitlement based on MOHRE UAE law:
 * - 30 days/year for employees who have completed 1 year of service
 * - 2 days × (number of completed months AFTER the first 6 months of service)
 * - 0 days for employees with less than 6 months
 * 
 * Important: Only full months after the first 6 months count. No decimals.
 */
function calculateAnnualLeaveEntitlement(joinDate: Date, year: number): number {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
  
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

/**
 * Get leave summary for employee and year (create if doesn't exist)
 */
export async function getOrCreateLeaveSummary(employeeId: string, year: number, prisma: PrismaClient) {
  // Get employee to access join date
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { joinDate: true },
  });

  if (!employee) {
    throw new Error(`Employee with ID ${employeeId} not found`);
  }

  let summary = await prisma.leaveSummary.findUnique({
    where: {
      employeeId_year: {
        employeeId,
        year,
      },
    },
  });

  // Calculate correct annual leave entitlement
  const annualLeaveEntitlement = calculateAnnualLeaveEntitlement(employee.joinDate, year);

  if (!summary) {
    summary = await prisma.leaveSummary.create({
      data: {
        employeeId,
        year,
        annualLeaveEntitlement,
      },
    });
  } else if (summary.annualLeaveEntitlement !== annualLeaveEntitlement) {
    // Update entitlement if it's incorrect
    summary = await prisma.leaveSummary.update({
      where: { id: summary.id },
      data: { annualLeaveEntitlement },
    });
  }

  return summary;
}

/**
 * Validate Annual Leave request
 */
export async function validateAnnualLeave(
  employeeId: string,
  requestedDays: number,
  year: number,
  prisma: PrismaClient
): Promise<LeaveValidationResult> {
  const summary = await getOrCreateLeaveSummary(employeeId, year, prisma);
  
  const available = (summary.annualLeaveEntitlement + summary.annualLeaveCarriedOver) - summary.annualLeaveUsed;
  
  if (requestedDays > available) {
    return {
      valid: false,
      message: `Insufficient annual leave balance. Available: ${available.toFixed(1)} days, Requesting: ${requestedDays} days.`,
      balance: {
        available,
        used: summary.annualLeaveUsed,
        entitlement: summary.annualLeaveEntitlement,
        carriedOver: summary.annualLeaveCarriedOver,
      },
    };
  }

  return {
    valid: true,
    balance: {
      available,
      used: summary.annualLeaveUsed,
      entitlement: summary.annualLeaveEntitlement,
      carriedOver: summary.annualLeaveCarriedOver,
    },
    projectedBalance: available - requestedDays,
  };
}

/**
 * Validate WFH request (weekly and monthly limits)
 */
export async function validateWFH(
  employeeId: string,
  requestedDate: Date,
  year: number,
  prisma: PrismaClient
): Promise<LeaveValidationResult> {
  const summary = await getOrCreateLeaveSummary(employeeId, year, prisma);

  // Normalize requested date to UTC to match how dates are stored in database
  // Dates are stored at UTC midnight, so we need to calculate week boundaries in UTC
  const requestedDateUTC = new Date(Date.UTC(
    requestedDate.getUTCFullYear(),
    requestedDate.getUTCMonth(),
    requestedDate.getUTCDate(),
    0, 0, 0, 0
  ));

  // Get week start (Sunday) and end in UTC
  // Calculate week boundaries manually to ensure UTC consistency
  const dayOfWeek = requestedDateUTC.getUTCDay(); // 0 = Sunday, 6 = Saturday
  const daysFromSunday = dayOfWeek === 0 ? 0 : dayOfWeek;
  const weekStart = new Date(Date.UTC(
    requestedDateUTC.getUTCFullYear(),
    requestedDateUTC.getUTCMonth(),
    requestedDateUTC.getUTCDate() - daysFromSunday,
    0, 0, 0, 0
  ));
  const weekEnd = new Date(Date.UTC(
    weekStart.getUTCFullYear(),
    weekStart.getUTCMonth(),
    weekStart.getUTCDate() + 6,
    23, 59, 59, 999
  ));

  // Get month boundaries in UTC
  const monthStart = new Date(Date.UTC(
    requestedDateUTC.getUTCFullYear(),
    requestedDateUTC.getUTCMonth(),
    1,
    0, 0, 0, 0
  ));
  const monthEnd = new Date(Date.UTC(
    requestedDateUTC.getUTCFullYear(),
    requestedDateUTC.getUTCMonth() + 1,
    0, // Last day of the month
    23, 59, 59, 999
  ));

  // Check existing WFH requests for this employee in the same week
  // Only count PENDING and APPROVED requests (not REJECTED or CANCELLED)
  const weekWFH = await prisma.leaveRequest.findMany({
    where: {
      employeeId,
      leaveType: 'WFH',
      status: { in: ['PENDING', 'APPROVED'] },
      startDate: {
        gte: weekStart,
        lte: weekEnd,
      },
    },
  });

  // Check existing WFH requests for this employee in the same month
  const monthWFH = await prisma.leaveRequest.findMany({
    where: {
      employeeId,
      leaveType: 'WFH',
      status: { in: ['PENDING', 'APPROVED'] },
      startDate: {
        gte: monthStart,
        lte: monthEnd,
      },
    },
  });

  const weekCount = weekWFH.length;
  const monthCount = monthWFH.length;

  // Console log WFH week count for debugging
  console.log('🔍 WFH Validation Debug:', {
    employeeId,
    requestedDate: requestedDateUTC.toISOString().split('T')[0],
    weekStart: weekStart.toISOString().split('T')[0],
    weekEnd: weekEnd.toISOString().split('T')[0],
    weekCount,
    weekLimit: summary.wfhWeeklyLimit,
    monthCount,
    monthLimit: summary.wfhMonthlyLimit,
    existingWeekWFH: weekWFH.map(lr => ({
      id: lr.id,
      startDate: lr.startDate.toISOString().split('T')[0],
      status: lr.status
    }))
  });

  // Enforce weekly limit: 1 WFH per week per employee
  if (weekCount >= summary.wfhWeeklyLimit) {
    const existingDates = weekWFH.map(lr => {
      const date = new Date(lr.startDate);
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
    }).join(', ');
    return {
      valid: false,
      message: `Weekly WFH limit reached. You already have ${weekCount} WFH request(s) this week (${existingDates}). Maximum allowed: ${summary.wfhWeeklyLimit} day(s) per week. You cannot apply for another WFH in the same week.`,
    };
  }

  // Enforce monthly limit: 4 WFH per month per employee
  if (monthCount >= summary.wfhMonthlyLimit) {
    return {
      valid: false,
      message: `Monthly WFH limit reached. You have ${monthCount} WFH request(s) this month. Maximum allowed: ${summary.wfhMonthlyLimit} day(s) per month.`,
    };
  }

  return {
    valid: true,
    balance: {
      available: summary.wfhMonthlyLimit - monthCount,
      used: monthCount,
      entitlement: summary.wfhMonthlyLimit,
    },
    projectedBalance: summary.wfhMonthlyLimit - monthCount - 1,
  };
}

/**
 * Validate Emergency Leave (with compensation method)
 */
export async function validateEmergencyLeave(
  employeeId: string,
  requestedDays: number,
  compensationMethod: string | null,
  year: number,
  prisma: PrismaClient
): Promise<LeaveValidationResult> {
  const summary = await getOrCreateLeaveSummary(employeeId, year, prisma);

  // If compensation is annual leave, validate annual balance
  if (compensationMethod === 'annual_leave') {
    const annualValidation = await validateAnnualLeave(employeeId, requestedDays, year, prisma);
    if (!annualValidation.valid) {
      return {
        ...annualValidation,
        message: `Emergency leave with annual leave compensation: ${annualValidation.message}`,
      };
    }
    return annualValidation;
  }

  // Unpaid or makeup hours - no balance check needed
  return {
    valid: true,
    balance: {
      available: summary.emergencyLeaveEntitlement - summary.emergencyLeaveUsed,
      used: summary.emergencyLeaveUsed,
      entitlement: summary.emergencyLeaveEntitlement,
    },
    projectedBalance: (summary.emergencyLeaveEntitlement - summary.emergencyLeaveUsed) - requestedDays,
  };
}

/**
 * Validate TOIL (Time Off In Lieu) - check minimum 8 hours
 */
export async function validateTOIL(
  employeeId: string,
  overtimeRequestIds: string[],
  prisma: PrismaClient
): Promise<LeaveValidationResult> {
  if (!overtimeRequestIds || overtimeRequestIds.length === 0) {
    return {
      valid: false,
      message: 'Please select at least one approved overtime request. Minimum 8 hours required.',
    };
  }

  // Get approved overtime requests
  const overtimeRequests = await prisma.overtimeRequest.findMany({
    where: {
      id: { in: overtimeRequestIds },
      employeeId,
      status: 'APPROVED',
    },
    select: {
      requestedHours: true,
    },
  });

  if (overtimeRequests.length !== overtimeRequestIds.length) {
    return {
      valid: false,
      message: 'One or more selected overtime requests are not approved or do not belong to you.',
    };
  }

  const totalHours = overtimeRequests.reduce((sum, req) => sum + req.requestedHours, 0);

  if (totalHours < 8) {
    return {
      valid: false,
      message: `Minimum 8 hours required for TOIL. Selected: ${totalHours} hours.`,
    };
  }

  const daysFromHours = Math.floor(totalHours / 8);

  return {
    valid: true,
    message: `Approved: ${daysFromHours} day(s) based on ${totalHours} hours of overtime.`,
  };
}

/**
 * Validate Bereavement Leave - check relationship for entitlement
 */
export function validateBereavement(
  relationship: string | null
): LeaveValidationResult {
  if (!relationship) {
    return {
      valid: false,
      message: 'Please select the relationship to the deceased.',
    };
  }

  // MOHRE: 5 days for spouse, 3 days for others
  const entitlement = relationship === 'spouse' ? 5 : 3;

  return {
    valid: true,
    message: `Entitlement: ${entitlement} days (${relationship}).`,
    balance: {
      available: entitlement,
      used: 0,
      entitlement,
    },
  };
}

/**
 * Calculate number of days between dates (including half-day support)
 */
export function calculateNumberOfDays(startDate: Date, endDate: Date, isHalfDay: boolean): number {
  if (isHalfDay) {
    return 0.5;
  }
  
  // Calculate calendar days (inclusive)
  const days = differenceInCalendarDays(endDate, startDate) + 1;
  return days;
}

/**
 * Auto-adjust end date based on leave type
 */
export function adjustEndDateForLeaveType(
  startDate: Date,
  leaveType: string,
  isHalfDay: boolean
): Date {
  const endDate = new Date(startDate);
  
  // WFH and half-day: same day
  if (leaveType === 'WFH' || isHalfDay) {
    return endDate;
  }
  
  // Default: same as start date (user can change if needed)
  return endDate;
}

