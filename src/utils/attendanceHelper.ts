import { prisma } from '../index';

const DUBAI_TIMEZONE_OFFSET = 4; // UTC+4
const BASE_WORKING_HOURS = 9; // Base working hours per day

/**
 * Get today's date in Dubai timezone (midnight UTC)
 *
 * This calculates what "today" is in Dubai timezone,
 * then returns it as a UTC date at midnight.
 *
 * Example:
 * - Current UTC time: 2025-10-22 20:00:00 UTC
 * - Dubai time: 2025-10-23 00:00:00 (UTC+4)
 * - Returns: 2025-10-23 00:00:00 UTC (midnight of Dubai's today)
 */
export const getTodayDubai = (): Date => {
  const now = new Date();
  const utcTime = now.getTime();
  // Add 4 hours to get Dubai time
  const dubaiTime = new Date(utcTime + (DUBAI_TIMEZONE_OFFSET * 60 * 60 * 1000));
  // Return midnight of Dubai's today as UTC
  return new Date(Date.UTC(
    dubaiTime.getUTCFullYear(),
    dubaiTime.getUTCMonth(),
    dubaiTime.getUTCDate(),
    0, 0, 0, 0
  ));
};

/**
 * Get current time in Dubai timezone
 *
 * IMPORTANT: This returns the ACTUAL current time in Dubai timezone.
 *
 * The database stores times as ISO 8601 strings with Z suffix (UTC).
 * But we want to store the Dubai time value.
 *
 * Solution: Add 4 hours to current UTC time to get Dubai time,
 * then return that as a Date object. When stored in DB, it will
 * show the Dubai time value.
 *
 * Example:
 * - Current UTC: 17:43:00 UTC (5:43 PM)
 * - Add 4 hours: 21:43:00 (9:43 PM Dubai)
 * - Returns: Date object with timestamp for 21:43:00
 * - Database stores: 2025-10-22T21:43:00.000Z
 * - Frontend displays: 9:43 PM ✅
 */
export const getCurrentDubaiTime = (): Date => {
  const now = new Date();
  // Get current UTC time in milliseconds
  const utcTime = now.getTime();
  // Add 4 hours (in milliseconds) to get Dubai time
  const dubaiTimeMs = utcTime + (DUBAI_TIMEZONE_OFFSET * 60 * 60 * 1000);
  // Return as Date object
  return new Date(dubaiTimeMs);
};

/**
 * Get approved overtime hours for a specific employee on a specific date
 * Returns the total approved overtime hours for that day
 */
export const getApprovedOvertimeHours = async (employeeId: string, date: Date): Promise<number> => {
  try {
    // Create date range for the entire day (start and end of day in UTC)
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const overtimeRequest = await prisma.overtimeRequest.findFirst({
      where: {
        employeeId,
        requestedDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: 'APPROVED',
      },
    });

    return overtimeRequest?.requestedHours || 0;
  } catch (error) {
    console.error('Error fetching approved overtime hours:', error);
    return 0;
  }
};

/**
 * Calculate max allowed hours for a specific employee on a specific date
 * Formula: 9 (base) + approved overtime hours
 */
export const calculateMaxAllowedHours = async (employeeId: string, date: Date): Promise<number> => {
  const approvedOvertimeHours = await getApprovedOvertimeHours(employeeId, date);
  return BASE_WORKING_HOURS + approvedOvertimeHours;
};

/**
 * Calculate current hours worked since check-in
 * Returns hours in decimal format (e.g., 8.5 = 8 hours 30 minutes)
 */
export const calculateCurrentHoursWorked = (checkInTime: Date): number => {
  const now = getCurrentDubaiTime();
  const hoursWorked = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
  return Math.round(hoursWorked * 100) / 100;
};

/**
 * Calculate current overtime hours worked since overtime check-in
 * Returns hours in decimal format (e.g., 1.5 = 1 hour 30 minutes)
 */
export const calculateCurrentOvertimeHoursWorked = (overtimeCheckInTime: Date): number => {
  const now = getCurrentDubaiTime();
  const overtimeHoursWorked = (now.getTime() - overtimeCheckInTime.getTime()) / (1000 * 60 * 60);
  return Math.round(overtimeHoursWorked * 100) / 100;
};

/**
 * Check if employee should be auto-checked out
 * Returns true if current hours >= max allowed hours
 */
export const shouldAutoCheckout = (currentHours: number, maxAllowedHours: number): boolean => {
  return currentHours >= maxAllowedHours;
};

/**
 * Format time remaining in HH:MM format
 * Takes milliseconds and returns formatted string
 */
export const formatTimeRemaining = (milliseconds: number): string => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

/**
 * Convert decimal hours to HH:MM:SS format
 */
export const formatHoursWorked = (decimalHours: number): string => {
  const totalSeconds = Math.round(decimalHours * 3600);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

/**
 * Get approved overtime request details for a specific employee on a specific date
 */
export const getApprovedOvertimeRequestDetails = async (employeeId: string, date: Date) => {
  try {
    // Create date range for the entire day (start and end of day in UTC)
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const overtimeRequest = await prisma.overtimeRequest.findFirst({
      where: {
        employeeId,
        requestedDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: 'APPROVED',
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return overtimeRequest || null;
  } catch (error) {
    console.error('Error fetching approved overtime request details:', error);
    return null;
  }
};

/**
 * Check if an employee should be excluded from attendance tracking
 * Excludes:
 * - Employees with MANAGEMENT role
 * - Specific employee IDs configured for manual exclusions
 */
export const shouldExcludeFromAttendance = async (employeeId: string): Promise<boolean> => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        role: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!employee) return false;

    // Exclude MANAGEMENT role
    if (employee.role === 'MANAGEMENT') {
      return true;
    }

    const excludedEmployeeIds = new Set([
      '5b1125e9-d44e-45f4-a531-cd4de4287b5a',
      'd2b2061f-bad5-4970-af15-1ab604f4901e',
    ]);

    if (excludedEmployeeIds.has(employeeId.toLowerCase())) {
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error checking attendance exclusion:', error);
    return false;
  }
};

/**
 * Calculate button states based on attendance and overtime status
 * Used by WebSocket to send real-time button state updates
 *
 * States:
 * 1. Not checked in: Show Check-In button
 * 2. Checked in (regular): Show Check-Out button
 * 3. Checked out (no overtime): All buttons disabled
 * 4. Checked out (with approved overtime): Show Check-In for Overtime button
 * 5. Overtime in progress: Disable Check-In for Overtime, Enable Check-Out button
 * 6. Overtime completed: All buttons disabled
 */
export const calculateButtonStates = (attendance: any, approvedOvertimeHours: number) => {
  // Regular shift states
  const isCheckedIn = attendance?.checkInTime && !attendance?.checkOutTime;
  const isCheckedOut = attendance?.checkOutTime;

  // Overtime shift states
  const isOvertimeCheckedIn = attendance?.overtimeCheckInTime && !attendance?.overtimeCheckOutTime;
  const isOvertimeCheckedOut = attendance?.overtimeCheckOutTime;

  const hasApprovedOvertime = approvedOvertimeHours > 0;

  return {
    checkInButton: {
      // Enabled only when:
      // 1. Not checked in for regular shift AND not checked out, OR
      // 2. Checked out from regular shift AND has approved overtime AND not in overtime mode
      enabled: !isCheckedIn && (!isCheckedOut || (isCheckedOut && hasApprovedOvertime && !isOvertimeCheckedIn)),
      label: isCheckedOut && hasApprovedOvertime && !isOvertimeCheckedIn ? 'Check-In' : 'Check-In',
      reason: isCheckedIn
        ? 'Already checked in for regular shift'
        : isOvertimeCheckedIn
        ? 'Already checked in for overtime'
        : isCheckedOut && !hasApprovedOvertime
        ? 'Already checked out - no overtime approved'
        : isOvertimeCheckedOut
        ? 'Overtime completed'
        : 'Ready to check in',
    },
    checkOutButton: {
      // Enabled when:
      // 1. Checked in for regular shift, OR
      // 2. Checked in for overtime
      enabled: isCheckedIn || isOvertimeCheckedIn,
      label: isOvertimeCheckedIn ? 'Check-Out from Overtime' : 'Check-Out',
      reason: isCheckedIn
        ? 'Ready to check out from regular shift'
        : isOvertimeCheckedIn
        ? 'Ready to check out from overtime'
        : 'Not checked in',
    },
    acceptOvertimeButton: {
      enabled: isCheckedOut && hasApprovedOvertime && !isOvertimeCheckedIn && !isOvertimeCheckedOut,
      label: 'Accept Approved Hours',
      reason: hasApprovedOvertime ? `${approvedOvertimeHours} hours approved` : 'No overtime approved',
    },
    overtimeCheckInButton: {
      // Enabled only when:
      // 1. Checked out from regular shift AND
      // 2. Has approved overtime AND
      // 3. NOT already checked in for overtime
      enabled: isCheckedOut && hasApprovedOvertime && !isOvertimeCheckedIn && !isOvertimeCheckedOut,
      label: `Check-In for Overtime (${approvedOvertimeHours}h)`,
      reason: isOvertimeCheckedIn
        ? 'Already checked in for overtime'
        : isOvertimeCheckedOut
        ? 'Already checked out from overtime'
        : hasApprovedOvertime
        ? `Resume work for ${approvedOvertimeHours} hours`
        : 'No overtime approved',
    },
  };
};
