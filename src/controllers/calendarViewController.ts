import { Request, Response } from 'express';
import { prisma } from '../index';
import { IApiResponse } from '../types';
import { getUserInfo, isPrivilegedRole } from '../utils/ownershipValidation';

/**
 * Get all leave type colors
 * GET /calendar/leave-type-colors
 */
export const getLeaveTypeColors = async (_req: Request, res: Response): Promise<Response | void> => {
  try {
    const leaveTypeColors = await (prisma as any).leaveTypeColor.findMany({
      orderBy: {
        leaveType: 'asc',
      },
    });

    // Add holiday color information
    const holidayColor = {
      id: 'holiday_color',
      leaveType: 'HOLIDAY',
      name: 'Holiday',
      hexColor: '#E0E0E0',
      shortcut: 'H',
      description: 'Official holidays and public holidays',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const response: IApiResponse<any> = {
      success: true,
      data: [...leaveTypeColors, holidayColor],
      message: 'Leave type colors retrieved successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Get leave type colors error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Get calendar view for employees
 * GET /calendar/view
 * Query params: month, year, departmentId, search
 */
export const getCalendarView = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { userId, role } = getUserInfo(req);
    const { month = new Date().getMonth() + 1, year = new Date().getFullYear(), departmentId, search, includeInactive } = req.query;

    const monthNum = parseInt(month as string) || new Date().getMonth() + 1;
    const yearNum = parseInt(year as string) || new Date().getFullYear();

    // Build filter for employees
    const where: any = {};

    // RBAC: EMPLOYEE and FINANCE can only see their own data in calendar
    if (role === 'EMPLOYEE' || role === 'FINANCE') {
      where.id = userId;
    } else {
      // Only show active users by default unless includeInactive is true
      if (includeInactive !== 'true') {
        where.userStatus = 'ACTIVE';
      }

      if (departmentId && isPrivilegedRole(role)) {
        // Only privileged roles can filter by department
        where.departmentId = departmentId as string;
      }

      if (search && isPrivilegedRole(role)) {
        // Only privileged roles can search across all employees
        where.OR = [
          {
            firstName: {
              contains: search as string,
              mode: 'insensitive',
            },
          },
          {
            lastName: {
              contains: search as string,
              mode: 'insensitive',
            },
          },
          {
            email: {
              contains: search as string,
              mode: 'insensitive',
            },
          },
        ];
      }
    }

    // Get employees
    const employees = await prisma.employee.findMany({
      where,
      orderBy: {
        firstName: 'asc',
      },
    });

    // Get leave type colors
    const leaveTypeColors = await (prisma as any).leaveTypeColor.findMany();
    const colorMap = new Map(leaveTypeColors.map((ltc: any) => [ltc.leaveType, ltc]));

    // Add holiday color information
    const holidayColor = {
      id: 'holiday_color',
      leaveType: 'HOLIDAY',
      name: 'Holiday',
      hexColor: '#E0E0E0',
      shortcut: 'H',
      description: 'Official holidays and public holidays',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Get approved leave requests for the month
    // Start: First day of the month at 00:00:00
    // End: Last day of the month at 23:59:59
    const startDate = new Date(yearNum, monthNum - 1, 1);
    startDate.setUTCHours(0, 0, 0, 0);
    // Last day of the month: monthNum - 1 + 1 = monthNum gives us the last day of monthNum - 1
    const endDate = new Date(yearNum, monthNum, 0); // Last day of monthNum-1 (the target month)
    endDate.setUTCHours(23, 59, 59, 999);

    // Query for leaves that overlap with the month
    // A leave overlaps if: leave.startDate <= month.endDate AND leave.endDate >= month.startDate
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        AND: [
          {
            startDate: {
              lte: endDate,
            },
          },
          {
            endDate: {
              gte: startDate,
            },
          },
        ],
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


    // Get holidays for the month
    const holidays = await prisma.holiday.findMany({
      where: {
        startDate: {
          lte: endDate,
        },
        endDate: {
          gte: startDate,
        },
      },
      include: {
        holidayType: true,
      },
    } as any);

    // Build calendar data for each employee
    const calendarData = employees.map((employee) => {
      const employeeLeaves = leaveRequests.filter((lr: any) => lr.employeeId === employee.id);

      // Create day entries for the month
      const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
      const days: any[] = [];

      for (let day = 1; day <= daysInMonth; day++) {
        // Create date in UTC to avoid timezone issues
        const currentDate = new Date(Date.UTC(yearNum, monthNum - 1, day));
        const dayOfWeek = currentDate.toLocaleDateString('en-US', { weekday: 'short' });

        // Check if it's a holiday
        const isHoliday = holidays.some(
          (h: any) => {
            // Normalize dates to compare only date part (ignore time)
            const startDate = new Date(h.startDate);
            startDate.setUTCHours(0, 0, 0, 0);

            const endDate = new Date(h.endDate);
            endDate.setUTCHours(23, 59, 59, 999);

            // Create date in UTC to avoid timezone issues
            const currentDateCheck = new Date(Date.UTC(yearNum, monthNum - 1, day, 12, 0, 0, 0));

            // Check if current date falls within the holiday period
            return currentDateCheck >= startDate && currentDateCheck <= endDate;
          }
        );

        // Check if employee has leave on this day
        const leaveOnDay = employeeLeaves.find(
          (lr: any) => {
            // Create current date (year, month (0-indexed), day)
            const currentDateCheck = new Date(yearNum, monthNum - 1, day);
            
            // Normalize leave dates - convert to Date and reset time to compare only dates
            const leaveStart = new Date(lr.startDate);
            leaveStart.setHours(0, 0, 0, 0);
            
            const leaveEnd = new Date(lr.endDate);
            leaveEnd.setHours(23, 59, 59, 999);

            // Normalize current date for comparison
            const currentDateNormalized = new Date(currentDateCheck);
            currentDateNormalized.setHours(0, 0, 0, 0);

            // Check if current date falls within the leave period
            return currentDateNormalized >= leaveStart && currentDateNormalized <= leaveEnd;
          }
        );

        const leaveTypeColor = leaveOnDay ? colorMap.get(leaveOnDay.leaveType) : null;

        // Default colors for leave types if not found in colorMap
        const defaultColors: { [key: string]: { shortcut: string; hexColor: string; name: string } } = {
          ANNUAL: { shortcut: 'AL', hexColor: '#FFD700', name: 'Annual Leave' },
          SICK: { shortcut: 'SL', hexColor: '#FF6B6B', name: 'Sick Leave' },
          MATERNITY: { shortcut: 'ML', hexColor: '#4ECDC4', name: 'Maternity Leave' },
          EMERGENCY: { shortcut: 'EL', hexColor: '#FFA500', name: 'Emergency Leave' },
          TOIL: { shortcut: 'TL', hexColor: '#95E1D3', name: 'TOIL' },
          WFH: { shortcut: 'WFH', hexColor: '#A8DADC', name: 'Work From Home' },
          BEREAVEMENT: { shortcut: 'BL', hexColor: '#9B9B9B', name: 'Bereavement Leave' },
        };

        // Determine the effective color/shortcut/name to use
        let effectiveColor: { shortcut: string; hexColor: string; name: string } | null = null;
        if (leaveOnDay) {
          if (leaveTypeColor) {
            effectiveColor = {
              shortcut: (leaveTypeColor as any).shortcut || leaveOnDay.leaveType,
              hexColor: (leaveTypeColor as any).hexColor || '#FFFFFF',
              name: (leaveTypeColor as any).name || leaveOnDay.leaveType,
            };
          } else if (defaultColors[leaveOnDay.leaveType]) {
            effectiveColor = defaultColors[leaveOnDay.leaveType];
          } else {
            // Fallback if no color found
            effectiveColor = {
              shortcut: leaveOnDay.leaveType,
              hexColor: '#CCCCCC',
              name: leaveOnDay.leaveType,
            };
          }
        }

        days.push({
          day,
          dayOfWeek,
          status: isHoliday ? 'HOLIDAY' : leaveOnDay ? 'LEAVE' : '-',
          shortcut: isHoliday ? 'H' : effectiveColor?.shortcut || (leaveOnDay ? leaveOnDay.leaveType : '-'),
          hexColor: isHoliday ? '#E0E0E0' : effectiveColor?.hexColor || '#FFFFFF',
          leaveType: leaveOnDay?.leaveType || null,
          leaveTypeName: effectiveColor?.name || leaveOnDay?.leaveType || null,
        });
      }

      return {
        employeeName: `${employee.firstName} ${employee.lastName}`,
        employeeId: employee.employeeId,
        status: employee.userStatus,
        days,
      };
    });

    const response: IApiResponse<any> = {
      success: true,
      data: {
        month: monthNum,
        year: yearNum,
        monthName: new Date(yearNum, monthNum - 1).toLocaleDateString('en-US', { month: 'long' }),
        employees: calendarData,
        leaveTypeColors: [...leaveTypeColors, holidayColor],
      },
      message: 'Calendar view retrieved successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Get calendar view error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Create or update leave type color
 * POST /calendar/leave-type-colors
 */
export const createLeaveTypeColor = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { leaveType, name, hexColor, shortcut, description } = req.body;

    // Validate required fields
    if (!leaveType || !name || !hexColor || !shortcut) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: leaveType, name, hexColor, shortcut',
      } as IApiResponse<null>);
    }

    // Check if already exists
    const existing = await (prisma as any).leaveTypeColor.findUnique({
      where: { leaveType },
    });

    let leaveTypeColor;

    if (existing) {
      // Update existing
      leaveTypeColor = await (prisma as any).leaveTypeColor.update({
        where: { leaveType },
        data: {
          name,
          hexColor,
          shortcut,
          description,
        },
      });
    } else {
      // Create new
      leaveTypeColor = await (prisma as any).leaveTypeColor.create({
        data: {
          leaveType,
          name,
          hexColor,
          shortcut,
          description,
        },
      });
    }

    const response: IApiResponse<any> = {
      success: true,
      data: leaveTypeColor,
      message: existing ? 'Leave type color updated successfully' : 'Leave type color created successfully',
    };

    return res.status(existing ? 200 : 201).json(response);
  } catch (error) {
    console.error('Create/update leave type color error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

