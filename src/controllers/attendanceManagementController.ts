import { Request, Response } from 'express';
import { prisma } from '../index';
import { IApiResponse } from '../types';
import { getTodayDubai } from '../utils/attendanceHelper';

const STANDARD_CHECKIN_MINUTES = 9 * 60;

const getDubaiMinutesFromIso = (value: string | Date | null | undefined): number | null => {
  if (!value) return null;
  if (value instanceof Date) {
    return value.getUTCHours() * 60 + value.getUTCMinutes();
  }
  if (typeof value !== 'string') return null;
  const match = value.match(/T(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, hourStr, minuteStr] = match;
  const hours = parseInt(hourStr, 10);
  const minutes = parseInt(minuteStr, 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

/**
 * Get all attendance records with filters (HR, Management, Finance only)
 * GET /attendance-management/all
 * Query params: page, pageSize, employeeId, fromDate, toDate, hasCheckIn, hasCheckOut, lateCheckIn
 */
export const getAllAttendance = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const user = (req as any).user;
    
    // Only HR, MANAGEMENT, FINANCE can access this endpoint
    if (!['HR', 'MANAGEMENT', 'FINANCE'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You do not have permission to view all attendance',
      } as IApiResponse<null>);
    }

    const {
      page = 1,
      pageSize = 50,
      employeeId,
      fromDate,
      toDate,
      hasCheckIn,
      hasCheckOut,
      lateCheckIn, // Filter for late check-ins (more than 1 hour after expected time)
      earlyCheckout, // Filter for early checkouts (less than 8 hours worked)
    } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const pageSizeNum = parseInt(pageSize as string) || 50;
    const skip = (pageNum - 1) * pageSizeNum;

    const where: any = {};

    // Filter by employee
    if (employeeId) {
      where.employeeId = employeeId as string;
    }

    // Date range filtering
    if (fromDate) {
      const from = new Date(fromDate as string);
      from.setHours(0, 0, 0, 0);
      where.date = { ...where.date, gte: from };
    }

    if (toDate) {
      const to = new Date(toDate as string);
      to.setHours(23, 59, 59, 999);
      where.date = { ...where.date, lte: to };
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

    // Filter for late check-ins - will be applied in JavaScript below
    // lateCheckIn can be '1', '2', '3' for >1 hour, >2 hours, >3 hours respectively

    const [attendance, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              employeeId: true,
              department: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { date: 'desc' },
        skip,
        take: pageSizeNum,
      }),
      prisma.attendance.count({ where }),
    ]);

    // Filter for late check-ins if requested
    let filteredAttendance = attendance;
    const lateCheckInStr = typeof lateCheckIn === 'string' ? lateCheckIn : '';
    if (lateCheckInStr && ['1', '2', '3'].includes(lateCheckInStr)) {
      const lateHoursThreshold = parseInt(lateCheckInStr);
      filteredAttendance = attendance.filter((record: any) => {
        if (!record.checkInTime) return false;
        const minutes = getDubaiMinutesFromIso(record.checkInTime);
        if (minutes === null) return false;
        const diffMinutes = minutes - STANDARD_CHECKIN_MINUTES;
        return diffMinutes > lateHoursThreshold * 60; // More than threshold hours late
      });
    }

    // Filter for early checkouts if requested (all early checkouts, regardless of time)
    if (earlyCheckout === 'true') {
      filteredAttendance = filteredAttendance.filter((record: any) => {
        const hoursWorked = record.hoursWorked || 0;
        return hoursWorked > 0 && hoursWorked < 8 && record.checkOutTime !== null;
      });
    }

    const todayDubai = getTodayDubai();
    todayDubai.setUTCHours(0, 0, 0, 0);

    // Format hours worked
    const formattedAttendance = filteredAttendance.map((record: any) => {
      const hoursWorked = record.hoursWorked || 0;
      const minimumRequiredHours = 8;
      const hoursShort = hoursWorked > 0 && hoursWorked < minimumRequiredHours && record.checkOutTime !== null 
        ? (minimumRequiredHours - hoursWorked) 
        : 0;
      // Flag all early checkouts to management
      const isEarlyCheckout = hoursShort > 0;
      const hours = Math.floor(hoursWorked);
      const minutes = Math.floor((hoursWorked - hours) * 60);
      const seconds = Math.floor(((hoursWorked - hours) * 60 - minutes) * 60);
      
      const formattedHours = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      const overtime = record.overtime || 0;
      const overtimeHours = Math.floor(overtime);
      const overtimeMinutes = Math.floor((overtime - overtimeHours) * 60);
      const overtimeSeconds = Math.floor(((overtime - overtimeHours) * 60 - overtimeMinutes) * 60);
      
      const formattedOvertime = `${overtimeHours.toString().padStart(2, '0')}:${overtimeMinutes.toString().padStart(2, '0')}:${overtimeSeconds.toString().padStart(2, '0')}`;

      // Check if check-in was late (more than 1 hour after 9 AM)
      let isLateCheckIn = false;
      if (record.checkInTime) {
        const minutes = getDubaiMinutesFromIso(record.checkInTime);
        if (minutes !== null) {
          const diffMinutes = minutes - STANDARD_CHECKIN_MINUTES;
          isLateCheckIn = diffMinutes > 60;
        }
      }

      const recordDate = new Date(record.date);
      recordDate.setUTCHours(0, 0, 0, 0);
      let attendanceStatus: 'NO_CHECK_IN' | 'MISSED_CHECKOUT' | 'WORKING' | 'COMPLETED' = 'COMPLETED';
      if (!record.checkInTime) {
        attendanceStatus = 'NO_CHECK_IN';
      } else if (!record.checkOutTime) {
        attendanceStatus = recordDate.getTime() === todayDubai.getTime() ? 'WORKING' : 'MISSED_CHECKOUT';
      }

      return {
        ...record,
        hoursWorked: formattedHours,
        isEarlyCheckout,
        hoursShort: isEarlyCheckout ? Math.round(hoursShort * 100) / 100 : 0,
        minimumRequiredHours: minimumRequiredHours,
        overtime: formattedOvertime,
        isLateCheckIn,
        hasCheckIn: !!record.checkInTime,
        hasCheckOut: !!record.checkOutTime,
        breakTimeMinutes: record.totalBreakMinutes || 0,
        notes: record.notes || null,
        attendanceStatus,
      };
    });

    const response: IApiResponse<any> = {
      success: true,
      data: {
        data: formattedAttendance,
        total: filteredAttendance.length !== attendance.length ? filteredAttendance.length : total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages: Math.ceil((filteredAttendance.length !== attendance.length ? filteredAttendance.length : total) / pageSizeNum),
      },
      message: 'Attendance records retrieved successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Get all attendance error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Get attendance reports
 * GET /attendance-management/reports
 * Query params: date (YYYY-MM-DD), fromDate, toDate
 * Returns: noCheckIn, noCheckOut, lateCheckIn reports
 */
export const getAttendanceReports = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const user = (req as any).user;
    
    // Only HR, MANAGEMENT, FINANCE can access this endpoint
    if (!['HR', 'MANAGEMENT', 'FINANCE'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You do not have permission to view attendance reports',
      } as IApiResponse<null>);
    }

    const { date, fromDate, toDate } = req.query;

    // Get today's date (no time component)
    const today = getTodayDubai();
    today.setUTCHours(0, 0, 0, 0);

    let targetDate: Date | null = null;
    let dateRange: { from: Date; to: Date } | null = null;

    if (date) {
      // Single date report
      targetDate = new Date(date as string);
      targetDate.setUTCHours(0, 0, 0, 0);
      
      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format',
          message: 'Date must be in YYYY-MM-DD format',
        } as IApiResponse<null>);
      }

      // Don't allow future dates
      if (targetDate > today) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date',
          message: 'Cannot generate reports for future dates',
        } as IApiResponse<null>);
      }
    } else if (fromDate && toDate) {
      // Date range report
      const from = new Date(fromDate as string);
      from.setUTCHours(0, 0, 0, 0);
      const to = new Date(toDate as string);
      to.setUTCHours(23, 59, 59, 999);
      
      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format',
          message: 'Dates must be in YYYY-MM-DD format',
        } as IApiResponse<null>);
      }

      if (from > to) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date range',
          message: 'From date must be before or equal to to date',
        } as IApiResponse<null>);
      }

      // Don't allow future dates in range
      if (from > today || to > today) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date range',
          message: 'Cannot generate reports for future dates. Range must end on or before today.',
        } as IApiResponse<null>);
      }

      dateRange = { from, to };
    } else {
      // Default to today
      targetDate = today;
    }

    // Get all active employees (include joinDate to filter by employment start)
    const allEmployees = await prisma.employee.findMany({
      where: {
        userStatus: 'ACTIVE',
        status: { not: 'TERMINATED' },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        employeeId: true,
        joinDate: true, // Include joinDate to filter by employment start date
        role: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const excludedEmployeeIds = new Set([
      '5b1125e9-d44e-45f4-a531-cd4de4287b5a',
      'd2b2061f-bad5-4970-af15-1ab604f4901e',
    ]);

    const activeEmployees = allEmployees.filter((employee) => {
      if (employee.role === 'MANAGEMENT') {
        return false;
      }
      if (excludedEmployeeIds.has(employee.id.toLowerCase())) {
        return false;
      }
      return true;
    });
    const activeEmployeeIds = activeEmployees.map((employee) => employee.id);

    let noCheckIn: any[] = [];
    let noCheckOut: any[] = [];
    let lateCheckIn: any[] = [];

    if (dateRange) {
      // Date range: check each date in the range
      const currentDate = new Date(dateRange.from);
      const datesToCheck: Date[] = [];
      
      while (currentDate <= dateRange.to) {
        datesToCheck.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }

      for (const checkDate of datesToCheck) {
        const dateStr = checkDate.toISOString().split('T')[0];
        const checkDateOnly = new Date(checkDate);
        checkDateOnly.setUTCHours(0, 0, 0, 0);
        
        // Skip future dates (shouldn't happen due to validation, but safety check)
        if (checkDateOnly > today) {
          continue;
        }
        
        // Get attendance for this date
        const attendance = await prisma.attendance.findMany({
          where: {
            date: {
              gte: new Date(checkDate.setHours(0, 0, 0, 0)),
              lte: new Date(checkDate.setHours(23, 59, 59, 999)),
            },
            ...(activeEmployeeIds.length > 0 ? { employeeId: { in: activeEmployeeIds } } : {}),
          },
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                employeeId: true,
                joinDate: true,
                role: true,
                department: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        });

        const attendanceMap = new Map(attendance.map((a: any) => [a.employeeId, a]));

        // Get approved leave requests for this date to exclude from no-check-in
        const approvedLeaves = await prisma.leaveRequest.findMany({
          where: {
            status: 'APPROVED',
            startDate: { lte: checkDateOnly },
            endDate: { gte: checkDateOnly },
          },
          select: {
            employeeId: true,
          },
        });
        const employeesOnLeave = new Set(approvedLeaves.map((l: any) => l.employeeId));

        // Check each employee - only include if they were employed on this date
        for (const employee of activeEmployees) {
          // Skip if employee joined after this date
          const employeeJoinDate = new Date(employee.joinDate);
          employeeJoinDate.setUTCHours(0, 0, 0, 0);
          if (checkDateOnly < employeeJoinDate) {
            continue; // Employee wasn't employed yet on this date
          }

          // Skip if employee is on approved leave for this date
          if (employeesOnLeave.has(employee.id)) {
            continue; // Employee is on approved leave, don't count as no check-in
          }

          const record = attendanceMap.get(employee.id);
          
          if (!record || !record.checkInTime) {
            noCheckIn.push({
              ...employee,
              date: dateStr,
            });
          } else {
            // Check for late check-in (categorize by threshold)
            const minutes = getDubaiMinutesFromIso(record.checkInTime);
            const diffMinutes = minutes === null ? null : minutes - STANDARD_CHECKIN_MINUTES;
            
            // Categorize late check-ins
            if (diffMinutes !== null && diffMinutes > 60) { // Report includes all >1 hour late
              const diffHours = diffMinutes / 60;
              lateCheckIn.push({
                ...employee,
                date: dateStr,
                checkInTime: record.checkInTime,
                lateByHours: Math.round(diffHours * 100) / 100,
                lateCategory: diffHours > 3 ? '>3 hours' : diffHours > 2 ? '>2 hours' : '>1 hour',
              });
            }

            // Check for no check-out
          if (record && record.checkInTime && !record.checkOutTime) {
            const recordDay = new Date(record.date);
            recordDay.setUTCHours(0, 0, 0, 0);
            if (recordDay < today) {
              noCheckOut.push({
                ...employee,
                date: dateStr,
                checkInTime: record.checkInTime,
              });
            }
            }
          }
        }
      }
    } else if (targetDate) {
      // Single date report
      const targetDateOnly = new Date(targetDate);
      targetDateOnly.setUTCHours(0, 0, 0, 0);
      
      const attendance = await prisma.attendance.findMany({
        where: {
          date: {
            gte: new Date(targetDateOnly),
            lte: new Date(targetDateOnly.getTime() + 24 * 60 * 60 * 1000 - 1),
          },
          ...(activeEmployeeIds.length > 0 ? { employeeId: { in: activeEmployeeIds } } : {}),
        },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              employeeId: true,
              joinDate: true,
              role: true,
              department: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      const attendanceMap = new Map(attendance.map((a: any) => [a.employeeId, a]));

      // Get approved leave requests for this date to exclude from no-check-in
      const approvedLeaves = await prisma.leaveRequest.findMany({
        where: {
          status: 'APPROVED',
          startDate: { lte: targetDateOnly },
          endDate: { gte: targetDateOnly },
        },
        select: {
          employeeId: true,
        },
      });
      const employeesOnLeave = new Set(approvedLeaves.map((l: any) => l.employeeId));

      // Check each employee - only include if they were employed on this date
      for (const employee of activeEmployees) {
        // Skip if employee joined after this date
        const employeeJoinDate = new Date(employee.joinDate);
        employeeJoinDate.setUTCHours(0, 0, 0, 0);
        if (targetDateOnly < employeeJoinDate) {
          continue; // Employee wasn't employed yet on this date
        }

        // Skip if employee is on approved leave for this date
        if (employeesOnLeave.has(employee.id)) {
          continue; // Employee is on approved leave, don't count as no check-in
        }

        const record = attendanceMap.get(employee.id);
        
        if (!record || !record.checkInTime) {
          noCheckIn.push({
            ...employee,
            date: targetDate.toISOString().split('T')[0],
          });
        } else {
          // Check for late check-in (categorize by threshold)
          const minutes = getDubaiMinutesFromIso(record.checkInTime);
          const diffMinutes = minutes === null ? null : minutes - STANDARD_CHECKIN_MINUTES;
          
          if (diffMinutes !== null && diffMinutes > 60) {
            const diffHours = diffMinutes / 60;
            lateCheckIn.push({
              ...employee,
              date: targetDate.toISOString().split('T')[0],
              checkInTime: record.checkInTime,
              lateByHours: Math.round(diffHours * 100) / 100,
              lateCategory: diffHours > 3 ? '>3 hours' : diffHours > 2 ? '>2 hours' : '>1 hour',
            });
          }

          // Check for no check-out
          if (record.checkInTime && !record.checkOutTime) {
            const recordDay = new Date(record.date);
            recordDay.setUTCHours(0, 0, 0, 0);
            if (recordDay < today) {
              noCheckOut.push({
                ...employee,
                date: targetDate.toISOString().split('T')[0],
                checkInTime: record.checkInTime,
              });
            }
          }
        }
      }
    } else {
      // Fallback: should not happen, but handle gracefully
      return res.status(400).json({
        success: false,
        error: 'Invalid date parameters',
        message: 'Please provide either a date or date range (fromDate and toDate)',
      } as IApiResponse<null>);
    }

    const response: IApiResponse<any> = {
      success: true,
      data: {
        noCheckIn,
        noCheckOut,
        lateCheckIn,
        summary: {
          totalEmployees: activeEmployees.length,
          noCheckInCount: noCheckIn.length,
          noCheckOutCount: noCheckOut.length,
          lateCheckInCount: lateCheckIn.length,
        },
      },
      message: 'Attendance reports retrieved successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Get attendance reports error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

