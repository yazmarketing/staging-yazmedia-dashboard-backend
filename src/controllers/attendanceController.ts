import { Request, Response } from 'express';
import { prisma } from '../index';
import { IApiResponse } from '../types';
import {
  getTodayDubai,
  getCurrentDubaiTime,
  getApprovedOvertimeHours,
  calculateMaxAllowedHours,
  calculateCurrentHoursWorked,
  formatHoursWorked,
  getApprovedOvertimeRequestDetails,
} from '../utils/attendanceHelper';



/**
 * Convert a date string (YYYY-MM-DD) to Dubai midnight in UTC
 */
const convertDateToDubaiMidnightUTC = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  // Create date at midnight Dubai time, stored as UTC
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
};

/**
 * Get today's attendance for the logged-in employee
 * GET /attendance/today
 * Returns: attendance data + approved overtime info + max allowed hours + current hours worked + auto-checkout flag
 */
export const getAttendanceToday = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      } as IApiResponse<null>);
    }

    const today = getTodayDubai();
    
    // Helper to get yesterday's date
    const getYesterdayDubai = (): Date => {
      const yesterday = new Date(today);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      return yesterday;
    };

    // @ts-ignore - Prisma attendance model is generated but TypeScript language server has caching issues
    // First, try to find today's attendance
    let attendance = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: userId,
          date: today,
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // If not found today and it's early morning (before 6 AM), check yesterday's attendance
    // This handles cases where someone is still checked in from previous day's work
    let attendanceDate = today;
    const currentDubaiHour = new Date(getCurrentDubaiTime().getTime()).getUTCHours();
    if (!attendance && currentDubaiHour < 6) {
      const yesterday = getYesterdayDubai();
      const yesterdayAttendance = await prisma.attendance.findUnique({
        where: {
          employeeId_date: {
            employeeId: userId,
            date: yesterday,
          },
        },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });
      // If found and not checked out, use yesterday's attendance
      if (yesterdayAttendance && !yesterdayAttendance.checkOutTime) {
        attendance = yesterdayAttendance;
        attendanceDate = yesterday;
      }
    }

    // Get approved overtime hours for the attendance date (today or yesterday)
    const approvedOvertimeHours = await getApprovedOvertimeHours(userId, attendanceDate);
    const maxAllowedHours = await calculateMaxAllowedHours(userId, attendanceDate);

    // Calculate current hours worked if checked in
    let currentHoursWorked = 0;

    if (attendance && attendance.checkInTime && !attendance.checkOutTime) {
      // Calculate current hours worked, excluding actual break time
      // If break exceeds 60 minutes, employee still needs to complete 8 hours of work
      const totalTime = calculateCurrentHoursWorked(attendance.checkInTime);
      const actualBreakHours = (attendance.totalBreakMinutes || 0) / 60; // Use actual break time (not capped)
      currentHoursWorked = totalTime - actualBreakHours;
      
      // If currently on break, don't count the active break time yet
      if (attendance.isOnBreak && attendance.breakStartTime) {
        const activeBreakMinutes = (getCurrentDubaiTime().getTime() - attendance.breakStartTime.getTime()) / (1000 * 60);
        currentHoursWorked -= activeBreakMinutes / 60;
      }
    }

    // Get approved overtime request details for the attendance date
    const overtimeRequestDetails = await getApprovedOvertimeRequestDetails(userId, attendanceDate);

    // Calculate exceeded break minutes for response
    const standardBreakMinutes = 60;
    const exceededBreakMinutes = attendance ? Math.max(0, (attendance.totalBreakMinutes || 0) - standardBreakMinutes) : 0;

    const formattedAttendance = attendance ? {
      ...attendance,
      hoursWorked: formatHoursWorked(attendance.hoursWorked),
      overtime: formatHoursWorked(attendance.overtime),
      totalBreakMinutes: attendance.totalBreakMinutes || 0,
      standardBreakMinutes: 60,
      exceededBreakMinutes: exceededBreakMinutes,
      hasExceededBreak: exceededBreakMinutes > 0,
      isOnBreak: attendance.isOnBreak || false,
      breakStartTime: attendance.breakStartTime || null,
      breakEndTime: attendance.breakEndTime || null,
    } : {
      checkInTime: null,
      checkOutTime: null,
      hoursWorked: '00:00:00',
      overtime: '00:00:00',
      totalBreakMinutes: 0,
      standardBreakMinutes: 60,
      exceededBreakMinutes: 0,
      hasExceededBreak: false,
      isOnBreak: false,
      breakStartTime: null,
      breakEndTime: null,
    };

    const response: IApiResponse<any> = {
      success: true,
      data: {
        attendance: formattedAttendance,
        approvedOvertimeToday: approvedOvertimeHours,
        maxAllowedHours,
        currentHoursWorked: Math.round(currentHoursWorked * 100) / 100,
        overtimeRequestDetails,
      },
      message: 'Today\'s attendance retrieved successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Get attendance today error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Check in for the day
 * POST /attendance/check-in
 * Also stores maxAllowedHours and approvedOvertimeHours for the day
 */
export const checkIn = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      } as IApiResponse<null>);
    }

    const today = getTodayDubai();

    // Check if already checked in
    // @ts-ignore - Prisma attendance model is generated but TypeScript language server has caching issues
    const existingAttendance = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: userId,
          date: today,
        },
      },
    });

    // Check if already checked in (for regular shift)
    if (existingAttendance && existingAttendance.checkInTime && !existingAttendance.checkOutTime) {
      return res.status(400).json({
        success: false,
        error: 'Already checked in',
        message: 'You have already checked in today',
      } as IApiResponse<null>);
    }

    // Check if trying to re-check-in for overtime
    if (existingAttendance && existingAttendance.checkOutTime) {
      const approvedOvertimeHours = await getApprovedOvertimeHours(userId, today);
      if (approvedOvertimeHours === 0) {
        return res.status(400).json({
          success: false,
          error: 'Cannot check in',
          message: 'You have already checked out today. No overtime approved.',
        } as IApiResponse<null>);
      }

      // This is an overtime check-in - set overtimeCheckInTime instead of checkInTime
      const overtimeCheckInTime = getCurrentDubaiTime();

      // @ts-ignore - Prisma attendance model is generated but TypeScript language server has caching issues
      const updatedAttendance = await prisma.attendance.update({
        where: {
          employeeId_date: {
            employeeId: userId,
            date: today,
          },
        },
        data: {
          // @ts-ignore - Prisma attendance model is generated but TypeScript language server has caching issues
          overtimeCheckInTime,
        },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      const response: IApiResponse<any> = {
        success: true,
        data: updatedAttendance,
        message: 'Checked in for overtime successfully',
      };

      return res.status(200).json(response);
    }

    // Regular check-in (first check-in of the day)
    const checkInTime = getCurrentDubaiTime();

    // @ts-ignore - Prisma attendance model is generated but TypeScript language server has caching issues
    const attendance = await prisma.attendance.upsert({
      where: {
        employeeId_date: {
          employeeId: userId,
          date: today,
        },
      },
      update: {
        checkInTime,
      },
      create: {
        employeeId: userId,
        date: today,
        checkInTime,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    const response: IApiResponse<any> = {
      success: true,
      data: attendance,
      message: 'Checked in successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Check in error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Check out for the day
 * POST /attendance/check-out
 * Validates against max allowed hours
 */
export const checkOut = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const userId = (req as any).user?.userId;
    const { notes } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      } as IApiResponse<null>);
    }

    if (!notes || notes.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Missing notes',
        message: 'Notes are mandatory for checkout',
      } as IApiResponse<null>);
    }

    const today = getTodayDubai();
    
    // Helper to get yesterday's date
    const getYesterdayDubai = (): Date => {
      const yesterday = new Date(today);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      return yesterday;
    };

    // @ts-ignore - Prisma attendance model is generated but TypeScript language server has caching issues
    // First, try to find today's attendance
    let existingAttendance = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: userId,
          date: today,
        },
      },
    });

    // If not found today and it's early morning (before 6 AM), check yesterday's attendance
    // This handles cases where someone checks out after midnight (still part of previous day's work)
    const currentDubaiHour = new Date(getCurrentDubaiTime().getTime()).getUTCHours();
    if (!existingAttendance && currentDubaiHour < 6) {
      const yesterday = getYesterdayDubai();
      existingAttendance = await prisma.attendance.findUnique({
        where: {
          employeeId_date: {
            employeeId: userId,
            date: yesterday,
          },
        },
      });
      
      // If found yesterday's attendance, use yesterday's date for the checkout record
      if (existingAttendance) {
        // Update the record using yesterday's date
        const yesterdayDate = yesterday;
        
        // Check if this is an overtime check-out
        if ((existingAttendance as any).overtimeCheckInTime && !(existingAttendance as any).overtimeCheckOutTime) {
          // @ts-ignore
          const attendance = await prisma.attendance.update({
            where: {
              employeeId_date: {
                employeeId: userId,
                date: yesterdayDate,
              },
            },
            data: {
              // @ts-ignore
              overtimeCheckOutTime: getCurrentDubaiTime(),
              notes,
            },
            include: {
              employee: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          });

          const response: IApiResponse<any> = {
            success: true,
            data: attendance,
            message: 'Checked out from overtime successfully',
          };

          return res.status(200).json(response);
        }

        // Regular check-out for yesterday's session
        if (existingAttendance.checkOutTime) {
          return res.status(400).json({
            success: false,
            error: 'Already checked out',
            message: 'You have already checked out for this work session',
          } as IApiResponse<null>);
        }

        if (!existingAttendance.checkInTime) {
          return res.status(400).json({
            success: false,
            error: 'Invalid attendance record',
            message: 'Attendance record found but check-in time is missing',
          } as IApiResponse<null>);
        }
        const totalTime = (getCurrentDubaiTime().getTime() - existingAttendance.checkInTime.getTime()) / (1000 * 60 * 60);
        let hoursWorked = totalTime;
        let overtime = Math.max(0, hoursWorked - 9);

        // Get approved overtime hours for yesterday
        const approvedOvertimeHours = await getApprovedOvertimeHours(userId, yesterdayDate);
        if (approvedOvertimeHours > 0) {
          overtime = Math.max(overtime, approvedOvertimeHours);
        }

        // Check if this is an early checkout
        const minimumRequiredHours = 9;
        const hoursShort = hoursWorked < minimumRequiredHours ? (minimumRequiredHours - hoursWorked) : 0;
        const isEarlyCheckout = hoursShort > 0;
        const showWarningMessage = hoursShort > 0.5;

        // Update yesterday's attendance record
        // @ts-ignore
        const attendance = await prisma.attendance.update({
          where: {
            employeeId_date: {
              employeeId: userId,
              date: yesterdayDate,
            },
          },
          data: {
            checkOutTime: getCurrentDubaiTime(),
            hoursWorked: Math.round(hoursWorked * 100) / 100,
            overtime: Math.round(overtime * 100) / 100,
            notes: notes.trim(),
          },
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        });

        const formattedAttendance = {
          ...attendance,
          hoursWorked: formatHoursWorked(attendance.hoursWorked),
          overtime: formatHoursWorked(attendance.overtime),
        };

        const response: IApiResponse<any> = {
          success: true,
          data: {
            ...formattedAttendance,
            isEarlyCheckout,
            hoursShort: isEarlyCheckout ? Math.round(hoursShort * 100) / 100 : 0,
            minimumRequiredHours,
          },
          message: showWarningMessage
            ? `Early checkout recorded. You worked ${Math.round(hoursWorked * 100) / 100} hours (${Math.round(hoursShort * 100) / 100} hours short of the required ${minimumRequiredHours} hours). This has been flagged for management review.`
            : 'Checked out successfully',
        };

        return res.status(200).json(response);
      }
    }

    if (!existingAttendance || !existingAttendance.checkInTime) {
      return res.status(400).json({
        success: false,
        error: 'Not checked in',
        message: 'You must check in before checking out',
      } as IApiResponse<null>);
    }

    // Get current time in Dubai timezone
    const checkOutTime = getCurrentDubaiTime();

    // Check if this is an overtime check-out (overtimeCheckInTime is set)
    if ((existingAttendance as any).overtimeCheckInTime && !(existingAttendance as any).overtimeCheckOutTime) {
      // This is an overtime check-out
      // @ts-ignore - Prisma attendance model is generated but TypeScript language server has caching issues
      const attendance = await prisma.attendance.update({
        where: {
          employeeId_date: {
            employeeId: userId,
            date: today,
          },
        },
        data: {
          // @ts-ignore - Prisma attendance model is generated but TypeScript language server has caching issues
          overtimeCheckOutTime: checkOutTime,
          notes,
        },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      const response: IApiResponse<any> = {
        success: true,
        data: attendance,
        message: 'Checked out from overtime successfully',
      };

      return res.status(200).json(response);
    }

    // Regular check-out (first check-out of the day)
    if (existingAttendance.checkOutTime) {
      return res.status(400).json({
        success: false,
        error: 'Already checked out',
        message: 'You have already checked out today',
      } as IApiResponse<null>);
    }

    const totalTime = (checkOutTime.getTime() - existingAttendance.checkInTime.getTime()) / (1000 * 60 * 60);
    let hoursWorked = totalTime;
    let overtime = Math.max(0, hoursWorked - 9);

    const approvedOvertimeHours = await getApprovedOvertimeHours(userId, today);
    if (approvedOvertimeHours > 0) {
      overtime = Math.max(overtime, approvedOvertimeHours);
    }

    const minimumRequiredHours = 9;
    const hoursShort = hoursWorked < minimumRequiredHours ? (minimumRequiredHours - hoursWorked) : 0;
    const isEarlyCheckout = hoursShort > 0;
    const showWarningMessage = hoursShort > 0.5;

    // @ts-ignore - Prisma attendance model is generated but TypeScript language server has caching issues
    const attendance = await prisma.attendance.update({
      where: {
        employeeId_date: {
          employeeId: userId,
          date: today,
        },
      },
      data: {
        checkOutTime,
        hoursWorked: Math.round(hoursWorked * 100) / 100,
        overtime: Math.round(overtime * 100) / 100,
        notes: notes.trim(),
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    const formattedAttendance = {
      ...attendance,
      hoursWorked: formatHoursWorked(attendance.hoursWorked),
      overtime: formatHoursWorked(attendance.overtime),
    };

    const response: IApiResponse<any> = {
      success: true,
      data: {
        ...formattedAttendance,
        isEarlyCheckout,
        hoursShort: isEarlyCheckout ? Math.round(hoursShort * 100) / 100 : 0,
        minimumRequiredHours,
      },
      message: showWarningMessage
        ? `Early checkout recorded. You worked ${Math.round(hoursWorked * 100) / 100} hours (${Math.round(hoursShort * 100) / 100} hours short of the required ${minimumRequiredHours} hours). This has been flagged for management review.`
        : 'Checked out successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Check out error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Get attendance history for the logged-in employee
 * GET /attendance/history
 * Query params: page, pageSize, fromDate, toDate, searchNotes, hasCheckIn, hasCheckOut, minHours, maxHours, hasOvertime
 */
export const getAttendanceHistory = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const userId = (req as any).user?.userId;
    const {
      page = 1,
      pageSize = 10,
      fromDate,
      toDate,
      searchNotes,
      hasCheckIn,
      hasCheckOut,
      minHours,
      maxHours,
      hasOvertime
    } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      } as IApiResponse<null>);
    }

    const pageNum = parseInt(page as string) || 1;
    const pageSizeNum = parseInt(pageSize as string) || 10;
    const skip = (pageNum - 1) * pageSizeNum;

    const where: any = {
      employeeId: userId,
    };

    // Date range filtering (Dubai timezone)
    if (fromDate) {
      const from = convertDateToDubaiMidnightUTC(fromDate as string);
      where.date = { ...where.date, gte: from };
    }

    if (toDate) {
      const toDateObj = new Date(toDate as string);
      const to = new Date(Date.UTC(
        toDateObj.getUTCFullYear(),
        toDateObj.getUTCMonth(),
        toDateObj.getUTCDate(),
        23, 59, 59, 999
      ));
      where.date = { ...where.date, lte: to };
    }

    // Search by notes
    if (searchNotes) {
      where.notes = {
        contains: searchNotes as string,
        mode: 'insensitive',
      };
    }

    // Filter by check-in status
    if (hasCheckIn === 'true') {
      where.checkInTime = { not: null };
    } else if (hasCheckIn === 'false') {
      where.checkInTime = null;
    }

    // Filter by check-out status
    if (hasCheckOut === 'true') {
      where.checkOutTime = { not: null };
    } else if (hasCheckOut === 'false') {
      where.checkOutTime = null;
    }

    // Filter by hours worked range
    if (minHours) {
      where.hoursWorked = { ...where.hoursWorked, gte: parseFloat(minHours as string) };
    }

    if (maxHours) {
      where.hoursWorked = { ...where.hoursWorked, lte: parseFloat(maxHours as string) };
    }

    // Filter by overtime
    if (hasOvertime === 'true') {
      where.overtime = { gt: 0 };
    } else if (hasOvertime === 'false') {
      where.overtime = { equals: 0 };
    }

    // @ts-ignore - Prisma attendance model is generated but TypeScript language server has caching issues
    const [attendance, total] = await Promise.all([
      // @ts-ignore - Prisma attendance model is generated but TypeScript language server has caching issues
      prisma.attendance.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { date: 'desc' },
        skip,
        take: pageSizeNum,
      }),
      // @ts-ignore - Prisma attendance model is generated but TypeScript language server has caching issues
      prisma.attendance.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSizeNum);

    const formattedAttendance = attendance.map((record: any) => ({
      ...record,
      hoursWorked: formatHoursWorked(record.hoursWorked),
      overtime: formatHoursWorked(record.overtime),
    }));

    const response: IApiResponse<any> = {
      success: true,
      data: {
        data: formattedAttendance,
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages,
      },
      message: 'Attendance history retrieved successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Get attendance history error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};


/**
 * Start break
 * POST /attendance/start-break
 */
export const startBreak = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      } as IApiResponse<null>);
    }

    const today = getTodayDubai();

    // @ts-ignore
    const existingAttendance = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: userId,
          date: today,
        },
      },
    });

    if (!existingAttendance || !existingAttendance.checkInTime) {
      return res.status(400).json({
        success: false,
        error: 'Not checked in',
        message: 'You must check in before starting a break',
      } as IApiResponse<null>);
    }

    if (existingAttendance.checkOutTime) {
      return res.status(400).json({
        success: false,
        error: 'Already checked out',
        message: 'You have already checked out today',
      } as IApiResponse<null>);
    }

    if (existingAttendance.isOnBreak) {
      return res.status(400).json({
        success: false,
        error: 'Already on break',
        message: 'You are already on break',
      } as IApiResponse<null>);
    }

    const breakStartTime = getCurrentDubaiTime();

    // @ts-ignore
    const attendance = await prisma.attendance.update({
      where: {
        employeeId_date: {
          employeeId: userId,
          date: today,
        },
      },
      data: {
        breakStartTime,
        isOnBreak: true,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    const response: IApiResponse<any> = {
      success: true,
      data: attendance,
      message: 'Break started successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Start break error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * End break
 * POST /attendance/end-break
 */
export const endBreak = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      } as IApiResponse<null>);
    }

    const today = getTodayDubai();

    // @ts-ignore
    const existingAttendance = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: userId,
          date: today,
        },
      },
    });

    if (!existingAttendance || !existingAttendance.checkInTime) {
      return res.status(400).json({
        success: false,
        error: 'Not checked in',
        message: 'You must check in before ending a break',
      } as IApiResponse<null>);
    }

    if (!existingAttendance.isOnBreak || !existingAttendance.breakStartTime) {
      return res.status(400).json({
        success: false,
        error: 'Not on break',
        message: 'You are not currently on break',
      } as IApiResponse<null>);
    }

    const breakEndTime = getCurrentDubaiTime();
    const breakDurationMinutes = (breakEndTime.getTime() - existingAttendance.breakStartTime.getTime()) / (1000 * 60);
    const newTotalBreakMinutes = (existingAttendance.totalBreakMinutes || 0) + breakDurationMinutes;

    // Store actual break time (no cap) - used for accurate hours worked calculation
    // Standard break is 60 minutes, but if exceeded, employee still needs to complete 8 hours of work
    const maxStandardBreakMinutes = 60;
    const exceededBreakMinutes = Math.max(0, newTotalBreakMinutes - maxStandardBreakMinutes);
    const hasExceededBreak = exceededBreakMinutes > 0;

    // @ts-ignore
    const attendance = await prisma.attendance.update({
      where: {
        employeeId_date: {
          employeeId: userId,
          date: today,
        },
      },
      data: {
        breakEndTime,
        totalBreakMinutes: newTotalBreakMinutes, // Store actual break time
        isOnBreak: false,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    const response: IApiResponse<any> = {
      success: true,
      data: {
        ...attendance,
        breakDurationMinutes: Math.round(breakDurationMinutes),
        totalBreakMinutesToday: newTotalBreakMinutes,
        exceededBreakMinutes: hasExceededBreak ? Math.round(exceededBreakMinutes) : 0,
        hasExceededBreak,
      },
      message: hasExceededBreak 
        ? `Break ended. Note: Your break exceeded the standard 60 minutes by ${Math.round(exceededBreakMinutes)} minutes. You will need to complete 8 hours of work, so your total time will be ${(8 + (newTotalBreakMinutes / 60)).toFixed(1)} hours.`
        : 'Break ended successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('End break error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

