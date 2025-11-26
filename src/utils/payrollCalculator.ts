/**
 * Payroll Calculator Utility
 * Centralized calculation engine for all financial formulas
 * Compliant with UAE Federal Decree-Law No. 33 of 2021 (MOHRE)
 * Ensures consistency across the system
 */

/**
 * Calculate hourly rate based on basic salary
 * Formula: Basic Salary ÷ 30 ÷ 8 = Basic Salary ÷ 240
 * MOHRE standard for hourly rate calculation
 * Reference: Federal Decree-Law No. 33 of 2021
 */
export const calculateHourlyRate = (baseSalary: number): number => {
  // MOHRE formula: Basic Salary ÷ 30 days ÷ 8 hours per day
  return baseSalary / 30 / 8;
};

/**
 * Check if time falls within night hours (10:00 PM - 4:00 AM)
 * MOHRE: Night work is 10:00 PM to 4:00 AM
 */
export const isNightHours = (startTime?: Date, endTime?: Date): boolean => {
  if (!startTime || !endTime) return false;
  
  const startHour = startTime.getHours();
  const endHour = endTime.getHours();
  
  // Check if any part of the work period falls in night hours (22:00-04:00)
  // Night hours: 22, 23, 0, 1, 2, 3
  const nightHours = [22, 23, 0, 1, 2, 3];
  return nightHours.includes(startHour) || nightHours.includes(endHour);
};

/**
 * Calculate overtime pay for a given number of hours
 * MOHRE Federal Decree-Law No. 33 of 2021 compliance:
 * - Regular OT: 1.25x basic hourly rate
 * - Night OT (10:00 PM - 4:00 AM): 1.5x basic hourly rate
 * - Rest day/Public holiday: Compensatory day off OR normal day wage + ≥50%
 * - OT is calculated on BASIC salary only (not total salary)
 * - Caps: ≤2 hours/day, ≤144 hours per 3 weeks
 * 
 * @param baseSalary - Basic salary (not total salary)
 * @param overtimeHours - Hours of overtime worked
 * @param isRestDayOrHoliday - Whether work is on rest day or public holiday
 * @param isNightWork - Whether work falls in night hours (10pm-4am)
 * @param useCompensatoryDay - Whether to use compensatory day off instead of payment (for rest day/holiday)
 */
export const calculateOvertimePay = (
  baseSalary: number,
  overtimeHours: number,
  isRestDayOrHoliday: boolean = false,
  isNightWork: boolean = false,
  useCompensatoryDay: boolean = false
): number => {
  if (overtimeHours <= 0) return 0;

  // MOHRE caps: Maximum 2 hours per day
  const cappedHours = Math.min(overtimeHours, 2);

  // If using compensatory day off for rest day/holiday, return 0 (day off is tracked separately)
  if (isRestDayOrHoliday && useCompensatoryDay) {
    return 0;
  }

  const hourlyRate = calculateHourlyRate(baseSalary);
  
  let rate: number;
  
  if (isRestDayOrHoliday) {
    // Rest day or public holiday: Normal day wage + at least 50%
    // Normal day wage = baseSalary / 30
    // Plus 50% = 1.5x
    rate = 1.5;
  } else if (isNightWork) {
    // Night work (10pm-4am): 1.5x
    rate = 1.5;
  } else {
    // Regular overtime: 1.25x
    rate = 1.25;
  }

  return Math.round(cappedHours * hourlyRate * rate * 100) / 100;
};

/**
 * Validate overtime hours against MOHRE caps
 * Caps: ≤2 hours/day, ≤144 hours per 3 weeks
 * Returns validation result with warnings
 */
export const validateOvertimeCaps = (
  dailyHours: number,
  threeWeekHours: number
): { valid: boolean; warnings: string[] } => {
  const warnings: string[] = [];
  
  if (dailyHours > 2) {
    warnings.push(`Daily overtime exceeds MOHRE cap: ${dailyHours}h > 2h limit`);
  }
  
  if (threeWeekHours > 144) {
    warnings.push(`Three-week overtime exceeds MOHRE cap: ${threeWeekHours}h > 144h limit`);
  }
  
  return {
    valid: warnings.length === 0,
    warnings,
  };
};

/**
 * Calculate daily rate for absence/unpaid leave deduction
 * MOHRE-compliant formula: Monthly Component ÷ 30
 * This is the standard MOHRE formula for daily rate calculation
 * Reference: Federal Decree-Law No. 33 of 2021
 * 
 * @param monthlyComponent - Monthly salary component (usually total salary, unless policy specifies basic only)
 * @param useCalendarDays - Whether to use 30 calendar days (MOHRE standard) or working days
 * @param workingDaysInMonth - Optional: working days if not using calendar days (for internal policy)
 */
export const calculateDailyRate = (
  monthlyComponent: number,
  useCalendarDays: boolean = true,
  workingDaysInMonth?: number
): number => {
  if (useCalendarDays) {
    // MOHRE standard: ÷ 30 (calendar days)
    return Math.round((monthlyComponent / 30) * 100) / 100;
  } else {
    // Alternative: ÷ working days (if company policy allows, but must be documented)
    if (!workingDaysInMonth || workingDaysInMonth <= 0) {
      // Fallback to MOHRE standard if working days not provided
      return Math.round((monthlyComponent / 30) * 100) / 100;
    }
    return Math.round((monthlyComponent / workingDaysInMonth) * 100) / 100;
  }
};

/**
 * Calculate absence deduction
 * MOHRE-compliant formula: Daily Rate × Number of Absence Days
 * Daily Rate = Monthly Component ÷ 30 (MOHRE standard)
 * 
 * @param monthlyComponent - Monthly salary component (usually total salary)
 * @param absenceDays - Number of absence days
 * @param useCalendarDays - Whether to use 30 calendar days (MOHRE standard, default: true)
 */
export const calculateAbsenceDeduction = (
  monthlyComponent: number,
  absenceDays: number,
  useCalendarDays: boolean = true
): number => {
  if (absenceDays <= 0) return 0;
  const dailyRate = calculateDailyRate(monthlyComponent, useCalendarDays);
  return Math.round(dailyRate * absenceDays * 100) / 100;
};

/**
 * Calculate net payroll
 * Formula: Total Salary + Adjustments - Deductions
 * Adjustments = Overtime + Reimbursements + Bonuses
 * Note: Deductions and bonuses are applied to totalSalary, not baseSalary
 */
export const calculateNetPayroll = (
  totalSalary: number,
  overtime: number = 0,
  reimbursements: number = 0,
  bonuses: number = 0,
  deductions: number = 0,
  taxDeduction: number = 0
): number => {
  const totalAdjustments = overtime + reimbursements + bonuses;
  const netSalary = totalSalary + totalAdjustments - deductions - taxDeduction;

  // Ensure net salary is never negative
  return Math.max(0, Math.round(netSalary * 100) / 100);
};

/**
 * Calculate prorated salary for mid-month joiners/leavers
 * MOHRE-compliant formula: (Daily Rate × Days Worked) + Adjustments - Deductions
 * Daily Rate = Monthly Component ÷ 30 (MOHRE standard uses calendar days)
 * 
 * @param monthlyComponent - Monthly salary component (usually total salary)
 * @param calendarDaysWorked - Number of calendar days worked (not working days)
 * @param overtime - Overtime pay (calculated on basic salary)
 * @param reimbursements - Reimbursements
 * @param bonuses - Bonuses
 * @param deductions - Deductions
 * @param taxDeduction - Tax deduction (usually 0 in UAE)
 */
export const calculateProratedSalary = (
  monthlyComponent: number,
  calendarDaysWorked: number,
  overtime: number = 0,
  reimbursements: number = 0,
  bonuses: number = 0,
  deductions: number = 0,
  taxDeduction: number = 0
): number => {
  if (calendarDaysWorked <= 0) return 0;

  // MOHRE standard: ÷ 30 (calendar days)
  const dailyRate = monthlyComponent / 30;
  const proratedSalary = dailyRate * calendarDaysWorked;
  const totalAdjustments = overtime + reimbursements + bonuses;
  const netSalary = proratedSalary + totalAdjustments - deductions - taxDeduction;

  return Math.max(0, Math.round(netSalary * 100) / 100);
};

/**
 * Check if a date is a weekend (Saturday or Sunday)
 * UAE standard: Saturday-Sunday
 */
export const isWeekend = (date: Date): boolean => {
  const day = date.getDay();
  return day === 5 || day === 6; // 5 = Saturday, 6 = Sunday
};

/**
 * Get working days in a month (Monday-Friday only)
 * Excludes weekends and holidays
 */
export const getWorkingDaysInMonth = (
  year: number,
  month: number,
  holidays: Date[] = []
): number => {
  let workingDays = 0;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const isHoliday = holidays.some(
      (h) => h.getDate() === day && h.getMonth() === month && h.getFullYear() === year
    );

    if (!isWeekend(date) && !isHoliday) {
      workingDays++;
    }
  }

  return workingDays;
};

/**
 * Format currency to 2 decimal places
 */
export const formatCurrency = (amount: number): number => {
  return Math.round(amount * 100) / 100;
};

/**
 * Validate payroll data
 */
export const validatePayrollData = (data: {
  baseSalary: number;
  overtime?: number;
  reimbursements?: number;
  bonuses?: number;
  deductions?: number;
  taxDeduction?: number;
}): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.baseSalary || data.baseSalary < 0) {
    errors.push('Base salary must be a positive number');
  }

  if (data.overtime && data.overtime < 0) {
    errors.push('Overtime cannot be negative');
  }

  if (data.reimbursements && data.reimbursements < 0) {
    errors.push('Reimbursements cannot be negative');
  }

  if (data.bonuses && data.bonuses < 0) {
    errors.push('Bonuses cannot be negative');
  }

  if (data.deductions && data.deductions < 0) {
    errors.push('Deductions cannot be negative');
  }

  if (data.taxDeduction && data.taxDeduction < 0) {
    errors.push('Tax deduction cannot be negative');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Calculate total adjustments
 */
export const calculateTotalAdjustments = (
  overtime: number = 0,
  reimbursements: number = 0,
  bonuses: number = 0
): number => {
  return formatCurrency(overtime + reimbursements + bonuses);
};

/**
 * Calculate total deductions
 */
export const calculateTotalDeductions = (
  deductions: number = 0,
  taxDeduction: number = 0
): number => {
  return formatCurrency(deductions + taxDeduction);
};

/**
 * Get holidays for a specific month
 * Returns array of dates that are holidays
 */
export const getHolidaysForMonth = async (
  prisma: any,
  year: number,
  month: number
): Promise<Date[]> => {
  try {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const holidays = await prisma.holiday.findMany({
      where: {
        OR: [
          {
            // Holiday starts before or during the month and ends during or after
            startDate: { lte: endOfMonth },
            endDate: { gte: startOfMonth },
          },
        ],
      },
      include: {
        holidayType: true,
      },
    });

    const holidayDates: Date[] = [];
    holidays.forEach((holiday: any) => {
      const start = new Date(holiday.startDate);
      const end = new Date(holiday.endDate);
      const current = new Date(start);

      // Clamp to month boundaries
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0);

      while (current <= end && current <= monthEnd) {
        if (current >= monthStart && current <= monthEnd) {
          holidayDates.push(new Date(current));
        }
        current.setDate(current.getDate() + 1);
      }
    });

    return holidayDates;
  } catch (error) {
    console.error('Error fetching holidays:', error);
    return [];
  }
};

/**
 * Get employee active period for a payroll month
 * Returns: { startDate, endDate, isFullMonth }
 */
export const getEmployeeActivePeriod = (
  joinDate: Date,
  terminationDate: Date | null,
  year: number,
  month: number
): { startDate: Date; endDate: Date; isFullMonth: boolean } => {
  const monthStart = new Date(year, month - 1, 1);
  monthStart.setHours(0, 0, 0, 0);
  const monthEnd = new Date(year, month, 0); // Last day of month
  monthEnd.setHours(23, 59, 59, 999);

  // Determine start date: max of joinDate and monthStart
  let effectiveStart = joinDate > monthStart ? joinDate : monthStart;
  effectiveStart = new Date(effectiveStart.getFullYear(), effectiveStart.getMonth(), effectiveStart.getDate());
  effectiveStart.setHours(0, 0, 0, 0);

  // Determine end date: min of terminationDate (if exists) and monthEnd
  // For termination, include the termination date (inclusive)
  let effectiveEnd: Date;
  if (terminationDate) {
    const termDateOnly = new Date(terminationDate.getFullYear(), terminationDate.getMonth(), terminationDate.getDate());
    termDateOnly.setHours(23, 59, 59, 999);
    effectiveEnd = termDateOnly < monthEnd ? termDateOnly : monthEnd;
  } else {
    effectiveEnd = monthEnd;
  }

  const isFullMonth = effectiveStart.getTime() === monthStart.getTime() && 
                      effectiveEnd.getTime() === monthEnd.getTime();

  return {
    startDate: effectiveStart,
    endDate: effectiveEnd,
    isFullMonth,
  };
};

/**
 * Calculate working days in a date range (inclusive)
 * Excludes weekends and holidays
 */
export const getWorkingDaysInRange = (
  startDate: Date,
  endDate: Date,
  holidays: Date[] = []
): number => {
  let workingDays = 0;
  const current = new Date(startDate);
  const end = new Date(endDate);

  // Normalize to start of day for comparison
  current.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  while (current <= end) {
    const isHoliday = holidays.some((h) => {
      const holidayDate = new Date(h);
      holidayDate.setHours(0, 0, 0, 0);
      const currentDate = new Date(current);
      currentDate.setHours(0, 0, 0, 0);
      return holidayDate.getTime() === currentDate.getTime();
    });

    if (!isWeekend(current) && !isHoliday) {
      workingDays++;
    }
    current.setDate(current.getDate() + 1);
  }

  return workingDays;
};

/**
 * Get salary changes for an employee in a specific month
 * Returns array of salary changes ordered by effectiveDate
 */
export const getSalaryChangesForMonth = async (
  prisma: any,
  employeeId: string,
  year: number,
  month: number
): Promise<any[]> => {
  try {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const salaryChanges = await prisma.salaryChange.findMany({
      where: {
        employeeId,
        status: 'APPROVED',
        effectiveDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      orderBy: {
        effectiveDate: 'asc',
      },
    });

    return salaryChanges;
  } catch (error) {
    console.error('Error fetching salary changes:', error);
    return [];
  }
};

/**
 * Get unpaid leave days for an employee in a specific month
 * Returns: { unpaidLeaveDays: number, unpaidLeaveDetails: Array }
 */
export const getUnpaidLeaveDays = async (
  prisma: any,
  employeeId: string,
  year: number,
  month: number
): Promise<{ unpaidLeaveDays: number; unpaidLeaveDetails: any[] }> => {
  try {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    // Get all approved leave requests that overlap with the month
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: 'APPROVED',
        AND: [
          {
            startDate: { lte: endOfMonth },
          },
          {
            endDate: { gte: startOfMonth },
          },
        ],
      },
    });

    let totalUnpaidDays = 0;
    const unpaidLeaveDetails: any[] = [];

    leaveRequests.forEach((leave: any) => {
      // Check if this is an unpaid leave
      // EMERGENCY with compensationMethod = 'unpaid'
      // Other leave types that might be unpaid (based on policy)
      const isUnpaid =
        (leave.leaveType === 'EMERGENCY' && leave.compensationMethod === 'unpaid') ||
        leave.leaveType === 'UNPAID'; // If there's an UNPAID leave type

      if (isUnpaid) {
        // Count working days in the overlap period
        // For now, use numberOfDays from leave request, but we should calculate properly
        // If it's a half day, count as 0.5
        const daysInOverlap = leave.isHalfDay ? 0.5 : leave.numberOfDays;

        // Adjust if the overlap is partial
        // For simplicity, we'll use the numberOfDays from the leave request
        // In a more sophisticated system, we'd calculate working days in the overlap
        totalUnpaidDays += daysInOverlap;

        unpaidLeaveDetails.push({
          leaveId: leave.id,
          leaveType: leave.leaveType,
          startDate: leave.startDate,
          endDate: leave.endDate,
          days: daysInOverlap,
          reason: leave.reason,
        });
      }
    });

    return {
      unpaidLeaveDays: totalUnpaidDays,
      unpaidLeaveDetails,
    };
  } catch (error) {
    console.error('Error fetching unpaid leave days:', error);
    return { unpaidLeaveDays: 0, unpaidLeaveDetails: [] };
  }
};

/**
 * Calculate accurate payroll with prorata, salary changes, and unpaid leaves
 * This is the main function that orchestrates all payroll calculations
 */
export interface AccuratePayrollCalculation {
  baseSalary: number;
  totalSalary: number;
  proratedBaseSalary: number;
  proratedTotalSalary: number;
  workingDaysInMonth: number; // For reference (working days)
  calendarDaysInMonth: number; // MOHRE standard: calendar days (28-31)
  calendarDaysWorked: number; // Calendar days worked (MOHRE standard)
  daysWorked: number; // Effective working days (for reference)
  unpaidLeaveDays: number;
  prorataFactor: number;
  salaryPeriods: Array<{
    fromDate: Date;
    toDate: Date;
    baseSalary: number;
    totalSalary: number;
    calendarDays: number;
    workingDays: number;
  }>;
  calculationBreakdown: {
    isFullMonth: boolean;
    joinedMidMonth: boolean;
    terminatedMidMonth: boolean;
    salaryChangedMidMonth: boolean;
    hasUnpaidLeave: boolean;
    usesMOHREStandard: boolean; // Flag indicating MOHRE-compliant calculation
  };
}

export const calculateAccuratePayroll = async (
  prisma: any,
  employee: any,
  year: number,
  month: number
): Promise<AccuratePayrollCalculation> => {
  // Get holidays for the month
  const holidays = await getHolidaysForMonth(prisma, year, month);
  
  // Calculate total working days in the month
  const workingDaysInMonth = getWorkingDaysInMonth(year, month - 1, holidays);

  // Get employee active period
  const activePeriod = getEmployeeActivePeriod(
    employee.joinDate,
    employee.terminationDate,
    year,
    month
  );

  // Calculate working days the employee was active
  const daysWorked = getWorkingDaysInRange(
    activePeriod.startDate,
    activePeriod.endDate,
    holidays
  );

  // Get salary changes for the month
  const salaryChanges = await getSalaryChangesForMonth(
    prisma,
    employee.id,
    year,
    month
  );

  // Get unpaid leave days
  const { unpaidLeaveDays } = await getUnpaidLeaveDays(
    prisma,
    employee.id,
    year,
    month
  );

  // Calculate effective working days (days worked minus unpaid leave)
  const effectiveWorkingDays = Math.max(0, daysWorked - unpaidLeaveDays);

  // Get the salary that was in effect at the start of the month
  // Check for the most recent salary change before the month start
  let salaryAtMonthStart = {
    baseSalary: employee.baseSalary,
    totalSalary: employee.totalSalary,
  };

  try {
    const monthStart = new Date(year, month - 1, 1);
    const previousSalaryChange = await prisma.salaryChange.findFirst({
      where: {
        employeeId: employee.id,
        status: 'APPROVED',
        effectiveDate: { lt: monthStart },
      },
      orderBy: {
        effectiveDate: 'desc',
      },
    });

    if (previousSalaryChange) {
      salaryAtMonthStart = {
        baseSalary: previousSalaryChange.newBaseSalary,
        totalSalary: previousSalaryChange.newTotalSalary,
      };
    }
    // If no prior change but there are changes this month, use the first change's old values
    else if (salaryChanges.length > 0) {
      const firstChange = salaryChanges[0];
      if (firstChange?.oldBaseSalary !== undefined && firstChange?.oldTotalSalary !== undefined) {
        salaryAtMonthStart = {
          baseSalary: firstChange.oldBaseSalary,
          totalSalary: firstChange.oldTotalSalary,
        };
      }
    }
  } catch (error) {
    // If error, use current employee salary
    console.error('Error fetching previous salary change:', error);
  }

  // Determine salary periods
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
  const salaryPeriods: Array<{
    fromDate: Date;
    toDate: Date;
    baseSalary: number;
    totalSalary: number;
    workingDays: number;
    calendarDays: number;
  }> = [];

  if (salaryChanges.length === 0) {
    // No salary changes - single period with salary at month start
    const periodWorkingDays = getWorkingDaysInRange(
      activePeriod.startDate,
      activePeriod.endDate,
      holidays
    );
    salaryPeriods.push({
      fromDate: activePeriod.startDate,
      toDate: activePeriod.endDate,
      baseSalary: salaryAtMonthStart.baseSalary,
      totalSalary: salaryAtMonthStart.totalSalary,
      workingDays: periodWorkingDays,
      calendarDays: 0,
    });
  } else {
    // Multiple periods due to salary changes
    let currentStart = activePeriod.startDate;
    let currentSalary = salaryAtMonthStart;
    
    for (let i = 0; i < salaryChanges.length; i++) {
      const change = salaryChanges[i];
      const changeDate = new Date(change.effectiveDate);
      changeDate.setHours(0, 0, 0, 0);

      // Period before this salary change
      if (currentStart < changeDate) {
        const periodEnd = new Date(changeDate);
        periodEnd.setDate(periodEnd.getDate() - 1);
        periodEnd.setHours(23, 59, 59, 999);

        salaryPeriods.push({
          fromDate: new Date(currentStart),
          toDate: periodEnd,
          baseSalary: currentSalary.baseSalary,
          totalSalary: currentSalary.totalSalary,
          workingDays: 0, // placeholder, will be replaced later
          calendarDays: 0,
        });

        currentStart = changeDate;
      }

      // Update current salary to the new salary after this change
      currentSalary = {
        baseSalary: change.newBaseSalary,
        totalSalary: change.newTotalSalary,
      };
    }

    // Final period from last salary change to end
    const finalPeriodEnd = activePeriod.endDate;
    salaryPeriods.push({
      fromDate: new Date(currentStart),
      toDate: finalPeriodEnd,
      baseSalary: currentSalary.baseSalary,
      totalSalary: currentSalary.totalSalary,
      workingDays: 0, // placeholder, will be replaced later
      calendarDays: 0,
    });
  }

  // Calculate calendar days for each period
  // IMPORTANT: MOHRE standard ALWAYS uses ÷ 30 for daily rate calculation, regardless of actual calendar days in month
  // This means:
  // - Daily Rate = Monthly Salary ÷ 30 (always 30, never 31/30/29/28)
  // - Prorated Salary = Daily Rate × Calendar Days Worked
  // Example: October (31 days), employee works full month (31 days):
  //   Daily Rate = 10,000 ÷ 30 = 333.33
  //   Prorated = 333.33 × 31 = 10,333.33 (slightly more than monthly salary for 31-day months)
  // This is the MOHRE standard and is compliant with UAE labor law
  const totalCalendarDaysInMonth = new Date(year, month, 0).getDate(); // 28, 29, 30, or 31 (for reference only)
  
  // Calculate calendar days worked (inclusive of both start and end dates)
  // For termination: Oct 1 to Oct 10 = 10 days (1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
  const startDateOnly = new Date(activePeriod.startDate.getFullYear(), activePeriod.startDate.getMonth(), activePeriod.startDate.getDate());
  const endDateOnly = new Date(activePeriod.endDate.getFullYear(), activePeriod.endDate.getMonth(), activePeriod.endDate.getDate());
  const calendarDaysWorked = Math.floor(
    (endDateOnly.getTime() - startDateOnly.getTime()) / (1000 * 60 * 60 * 24)
  ) + 1; // +1 to include both start and end dates (inclusive)
  
  // Calculate calendar days for each salary period (inclusive of both start and end dates)
  const salaryPeriodsWithCalendarDays = salaryPeriods.map((period) => {
    const periodStart = new Date(period.fromDate);
    const periodEnd = new Date(period.toDate);
    // Use date-only calculation to avoid time-of-day issues
    const startDateOnly = new Date(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate());
    const endDateOnly = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), periodEnd.getDate());
    const periodCalendarDays = Math.floor(
      (endDateOnly.getTime() - startDateOnly.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1; // +1 to include both start and end dates (inclusive)

    // Working days (excluding weekends/holidays)
    const workingDays = getWorkingDaysInRange(periodStart, periodEnd, holidays);
    
    return {
      ...period,
      calendarDays: periodCalendarDays,
      workingDays,
    };
  });

  // Calculate prorated salary for each period
  // IMPORTANT: For FULL months, use full monthly salary (no proration based on calendar days)
  // For PARTIAL months (joined mid-month, left mid-month), use MOHRE standard proration (÷ 30)
  let proratedBaseSalary = 0;
  let proratedTotalSalary = 0;

  // Check if this is a full month (employee worked entire month)
  const isFullMonth = activePeriod.isFullMonth;
  
  if (isFullMonth && salaryPeriods.length === 1) {
    // Full month - use full monthly salary (no proration)
    // Monthly salary is fixed regardless of calendar days (30/31/28/29)
    proratedBaseSalary = salaryAtMonthStart.baseSalary;
    proratedTotalSalary = salaryAtMonthStart.totalSalary;
  } else {
    // Partial month - use MOHRE standard proration (÷ 30)
    // MOHRE standard: ALWAYS ÷ 30 (never actual calendar days in month)
    // Formula: Daily Rate = Monthly Salary ÷ 30, then Prorated = Daily Rate × Days Worked
    salaryPeriodsWithCalendarDays.forEach((period) => {
      const dailyRateBase = period.baseSalary / 30;
      const dailyRateTotal = period.totalSalary / 30;
      
      // Multiply daily rate by actual calendar days worked (not by 30)
      proratedBaseSalary += dailyRateBase * period.calendarDays;
      proratedTotalSalary += dailyRateTotal * period.calendarDays;
    });
  }

  // Apply unpaid leave deduction using MOHRE standard (÷ 30)
  // Daily Rate = Monthly Component ÷ 30
  // For unpaid leave, we use the weighted average of the salary periods
  let weightedTotalSalary = 0;
  let weightedBaseSalary = 0;
  let totalCalendarDays = 0;
  
  salaryPeriodsWithCalendarDays.forEach((period) => {
    totalCalendarDays += period.calendarDays;
    // Weight by calendar days
    const periodWeight = period.calendarDays / totalCalendarDaysInMonth;
    weightedTotalSalary += period.totalSalary * periodWeight;
    weightedBaseSalary += period.baseSalary * periodWeight;
  });

  // MOHRE standard daily rate: Monthly Component ÷ 30
  const dailyRate = weightedTotalSalary / 30;
  
  // Unpaid leave deduction: Daily Rate × Unpaid Leave Days
  const unpaidLeaveDeduction = dailyRate * unpaidLeaveDays;
  
  // Final prorated amounts (after unpaid leave deduction)
  // Calculate base salary proportionally
  const baseSalaryRatio = proratedTotalSalary > 0 
    ? proratedBaseSalary / proratedTotalSalary 
    : 1;
  const unpaidLeaveBaseDeduction = unpaidLeaveDeduction * baseSalaryRatio;
  
  const finalProratedTotalSalary = Math.max(0, proratedTotalSalary - unpaidLeaveDeduction);
  const finalProratedBaseSalary = Math.max(0, proratedBaseSalary - unpaidLeaveBaseDeduction);

  // Prorata factor: calendar days worked / total calendar days in month
  const prorataFactor = totalCalendarDaysInMonth > 0 
    ? calendarDaysWorked / totalCalendarDaysInMonth 
    : 0;

  // Get original salary from first period (or salaryAtMonthStart if no periods)
  const originalSalary = {
    baseSalary: salaryAtMonthStart.baseSalary,
    totalSalary: salaryAtMonthStart.totalSalary,
  };

  return {
    baseSalary: originalSalary.baseSalary,
    totalSalary: originalSalary.totalSalary,
    proratedBaseSalary: formatCurrency(finalProratedBaseSalary),
    proratedTotalSalary: formatCurrency(finalProratedTotalSalary),
    workingDaysInMonth, // Kept for reference, but proration uses calendar days
    calendarDaysInMonth: totalCalendarDaysInMonth, // MOHRE standard: calendar days
    calendarDaysWorked, // Calendar days worked (MOHRE standard)
    daysWorked: effectiveWorkingDays, // Effective working days (for reference)
    unpaidLeaveDays,
    prorataFactor,
    salaryPeriods: salaryPeriodsWithCalendarDays.map((p) => ({
      ...p,
      baseSalary: formatCurrency(p.baseSalary),
      totalSalary: formatCurrency(p.totalSalary),
    })),
    calculationBreakdown: {
      isFullMonth: activePeriod.isFullMonth && unpaidLeaveDays === 0,
      joinedMidMonth: employee.joinDate > monthStart,
      terminatedMidMonth: employee.terminationDate !== null && employee.terminationDate < monthEnd,
      salaryChangedMidMonth: salaryChanges.length > 0,
      hasUnpaidLeave: unpaidLeaveDays > 0,
      usesMOHREStandard: true, // Flag indicating MOHRE-compliant calculation
    },
  };
};

