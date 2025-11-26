import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import {
  validateAnnualLeave,
  validateWFH,
  validateEmergencyLeave,
  validateTOIL,
  validateBereavement,
  calculateNumberOfDays,
  adjustEndDateForLeaveType,
  getOrCreateLeaveSummary,
} from '../utils/leaveValidation';
import { uploadFileToSpaces } from '../utils/fileUpload';
import { getUserInfo, isPrivilegedRole } from '../utils/ownershipValidation';
import { sendLeaveRequestNotification } from '../utils/leaveEmailNotification';

const prisma = new PrismaClient();

interface IApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Get all leave requests with employee information
 * GET /leave-requests
 * Query params: page, pageSize, status, leaveType, employeeId, search
 */
export const getLeaveRequests = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { userId, role } = getUserInfo(req);
    const {
      page = 1,
      pageSize = 10,
      status,
      leaveType,
      employeeId,
      search,
    } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const pageSizeNum = parseInt(pageSize as string) || 10;
    const skip = (pageNum - 1) * pageSizeNum;

    // Build filter conditions
    const where: any = {};

    // RBAC: EMPLOYEE can only see their own leave requests
    if (!isPrivilegedRole(role)) {
      where.employeeId = userId;
    } else {
      // Privileged roles can filter by employeeId if provided
      if (employeeId) {
        where.employeeId = employeeId;
      }
    }

    if (status) {
      where.status = status;
    }

    if (leaveType) {
      where.leaveType = leaveType;
    }

    // Search by employee name or email
    if (search) {
      where.OR = [
        {
          employee: {
            firstName: {
              contains: search as string,
              mode: 'insensitive',
            },
          },
        },
        {
          employee: {
            lastName: {
              contains: search as string,
              mode: 'insensitive',
            },
          },
        },
        {
          employee: {
            email: {
              contains: search as string,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

    // Get total count
    const total = await prisma.leaveRequest.count({ where });

    // Get leave requests with employee information and documents
    const leaveRequests = await (prisma.leaveRequest.findMany as any)({
      where,
      skip,
      take: pageSizeNum,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        documents: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Fetch approver information for requests that have been approved/rejected
    const approverIds = leaveRequests
      .filter((req: any) => req.approvedBy)
      .map((req: any) => req.approvedBy);

    let approversMap: { [key: string]: any } = {};
    if (approverIds.length > 0) {
      const uniqueApproverIds = Array.from(new Set(approverIds)) as string[]; // Remove duplicates
      const approvers = await prisma.employee.findMany({
        where: {
          id: {
            in: uniqueApproverIds,
          },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      });
      approversMap = approvers.reduce((acc: any, approver: any) => {
        acc[approver.id] = approver;
        return acc;
      }, {});
    }

    // Format response with all required fields
    const formattedRequests = leaveRequests.map((request: any) => {
      const approver = request.approvedBy ? approversMap[request.approvedBy] : null;

      return {
        id: request.id,
        employeeName: `${request.employee.firstName} ${request.employee.lastName}`,
        employeeId: request.employeeId,
        leaveType: request.leaveType,
        absenceCode: getAbsenceCode(request.leaveType),
        startDate: request.startDate,
        endDate: request.endDate,
        totalDays: request.numberOfDays,
        details: request.reason || '-',
        status: request.status,
        createdDate: request.createdAt,
        approvedBy: approver ? {
          id: approver.id,
          name: `${approver.firstName} ${approver.lastName}`,
        } : null,
        approvalDate: request.approvalDate || null,
        rejectionReason: request.rejectionReason || null,
        documents: request.documents,
      };
    });

    const totalPages = Math.ceil(total / pageSizeNum);

    const response: IApiResponse<any> = {
      success: true,
      data: {
        data: formattedRequests,
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages,
      },
      message: 'Leave requests retrieved successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Get leave requests error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Get leave summary for all employees
 * GET /leave-requests/summary
 * Query params: page, pageSize, status, search, year
 * Access: HR, MANAGEMENT, FINANCE only
 */
export const getLeaveSummary = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { role } = getUserInfo(req);
    
    // RBAC: Only privileged roles can see all employees' leave summaries
    if (!isPrivilegedRole(role)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You do not have permission to view leave summaries',
      } as IApiResponse<null>);
    }

    const {
      page = 1,
      pageSize = 10,
      status,
      search,
      departmentId,
      year = new Date().getFullYear(),
    } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const pageSizeNum = parseInt(pageSize as string) || 10;
    const skip = (pageNum - 1) * pageSizeNum;
    const yearNum = parseInt(year as string) || new Date().getFullYear();

    // Build filter conditions for employees
    const where: any = {};

    if (search) {
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

    // Add status filter if provided (filter BEFORE pagination)
    if (status) {
      where.userStatus = status;
    }

    // Add department filter if provided
    if (departmentId) {
      where.departmentId = departmentId as string;
    }

    // Get total count of employees AFTER filtering (for correct pagination)
    const totalCount = await prisma.employee.count({ where });

    // Get employees with their leave summary (include gender for maternity leave filtering)
    const employees = await prisma.employee.findMany({
      where,
      skip,
      take: pageSizeNum,
      orderBy: {
        firstName: 'asc',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        employeeId: true,
        userStatus: true,
        gender: true, // Include gender for maternity leave filtering
      },
    });

    // Get leave requests for calculating used leaves
    let leaveRequests: any[] = [];
    try {
      leaveRequests = await prisma.leaveRequest.findMany({
        where: {
          status: 'APPROVED',
        },
      });
    } catch (dbError: any) {
      console.error('Error fetching leave requests in getLeaveSummary:', dbError);
      // Continue with empty array if query fails
      leaveRequests = [];
    }

    // Format response with leave summary
    // Use a single query to get all leave summaries instead of Promise.all
    const allLeaveSummaries = await prisma.leaveSummary.findMany({
      where: {
        employeeId: { in: employees.map((e: any) => e.id) },
        year: yearNum,
      },
    });
    const leaveSummaryMap = new Map(allLeaveSummaries.map((ls: any) => [ls.employeeId, ls]));

    const summaryData = employees.map((employee: any) => {
      // Get leave summary from map
      const leaveSummary = leaveSummaryMap.get(employee.id);
      
      // Only include maternity leave for female employees
      const isFemaleEmployee = employee.gender?.toLowerCase() === 'female' || employee.gender?.toLowerCase() === 'f';

      // Calculate used leaves from approved requests
      const employeeLeaves = leaveRequests.filter(
        (lr) => lr.employeeId === employee.id
      );

      const annualUsed = employeeLeaves
        .filter((lr) => lr.leaveType === 'ANNUAL')
        .reduce((sum, lr) => sum + lr.numberOfDays, 0);

      const sickUsed = employeeLeaves
        .filter((lr) => lr.leaveType === 'SICK')
        .reduce((sum, lr) => sum + lr.numberOfDays, 0);

      const maternityUsed = employeeLeaves
        .filter((lr) => lr.leaveType === 'MATERNITY')
        .reduce((sum, lr) => sum + lr.numberOfDays, 0);

      const emergencyUsed = employeeLeaves
        .filter((lr) => lr.leaveType === 'EMERGENCY')
        .reduce((sum, lr) => sum + lr.numberOfDays, 0);

      // TOIL and WFH usage is calculated from leaveSummary, not from leave requests

      // Calculate remaining leaves using correct schema fields
      const annualAllowance = leaveSummary?.annualLeaveEntitlement ?? 0;
      const annualCarriedOver = leaveSummary?.annualLeaveCarriedOver ?? 0;
      const annualAvailable = annualAllowance + annualCarriedOver;
      const annualRemaining = annualAvailable - annualUsed;

      // Sick leave: Total is fullPay + halfPay + unpaid (MOHRE: 90 days total)
      const sickAllowance = (leaveSummary?.sickLeaveFullPay ?? 15) + 
                           (leaveSummary?.sickLeaveHalfPay ?? 30) + 
                           (leaveSummary?.sickLeaveUnpaid ?? 45);
      const sickRemaining = sickAllowance - sickUsed;

      // Maternity leave
      const maternityAllowance = leaveSummary?.maternityLeaveEntitlement ?? 60;
      const maternityRemaining = maternityAllowance - maternityUsed;

      // Emergency leave
      const emergencyAllowance = leaveSummary?.emergencyLeaveEntitlement ?? 5;
      const emergencyRemaining = emergencyAllowance - emergencyUsed;

      // TOIL: Calculate from hours (1 day = 8 hours)
      const toilHoursAvailable = leaveSummary?.toilHoursAvailable ?? 0;
      const toilHoursUsed = leaveSummary?.toilHoursUsed ?? 0;
      const toilAllowance = Math.floor(toilHoursAvailable / 8);
      const toilUsedDays = Math.floor(toilHoursUsed / 8);
      const toilRemaining = toilAllowance - toilUsedDays;

      // WFH: Monthly limit
      const wfhAllowance = leaveSummary?.wfhMonthlyLimit ?? 4;
      const wfhRemaining = wfhAllowance - (leaveSummary?.wfhUsedThisMonth ?? 0);

      // Only include maternity leave for female employees (check if already calculated above)
      const effectiveMaternityUsed = isFemaleEmployee ? maternityUsed : 0;
      const effectiveMaternityAllowance = isFemaleEmployee ? maternityAllowance : 0;
      const effectiveMaternityRemaining = isFemaleEmployee ? maternityRemaining : 0;

      const totalUsed = annualUsed + sickUsed + effectiveMaternityUsed + emergencyUsed + toilUsedDays + (leaveSummary?.wfhUsedThisMonth ?? 0);
      const totalAllowance = annualAvailable + sickAllowance + effectiveMaternityAllowance + emergencyAllowance + toilAllowance + wfhAllowance;
      const totalRemaining = totalAllowance - totalUsed;

      return {
        employeeName: `${employee.firstName} ${employee.lastName}`,
        employeeId: employee.employeeId,
        status: employee.userStatus,
        annualLeaveTaken: annualUsed,
        annualLeaveAllowance: annualAvailable, // Include carried over
        annualLeaveRemaining: annualRemaining,
        sickLeaveTaken: sickUsed,
        sickLeaveAllowance: sickAllowance,
        sickLeaveRemaining: sickRemaining,
        maternityLeaveTaken: effectiveMaternityUsed,
        maternityLeaveAllowance: effectiveMaternityAllowance,
        maternityLeaveRemaining: effectiveMaternityRemaining,
        emergencyLeaveTaken: emergencyUsed,
        emergencyLeaveAllowance: emergencyAllowance,
        emergencyLeaveRemaining: emergencyRemaining,
        toilLeaveTaken: toilUsedDays,
        toilLeaveAllowance: toilAllowance,
        toilLeaveRemaining: toilRemaining,
        wfhLeaveTaken: leaveSummary?.wfhUsedThisMonth ?? 0,
        wfhLeaveAllowance: wfhAllowance,
        wfhLeaveRemaining: wfhRemaining,
        totalLeaveTaken: totalUsed,
        totalLeaveAllowance: totalAllowance,
        totalLeaveRemaining: totalRemaining,
        year: yearNum,
      };
    });

    // No need to filter again - already filtered in employee query
    // Calculate pagination based on total count
    const totalPages = Math.ceil(totalCount / pageSizeNum);

    const response: IApiResponse<any> = {
      success: true,
      data: {
        data: summaryData,
        total: totalCount,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages,
      },
      message: 'Leave summary retrieved successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Get leave summary error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Get yearly management data for all employees
 * GET /leave-requests/yearly
 * Query params: page, pageSize, status, search, year
 * Access: HR, MANAGEMENT, FINANCE only
 */
export const getYearlyManagement = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { role } = getUserInfo(req);
    
    // RBAC: Only privileged roles can see yearly management data
    if (!isPrivilegedRole(role)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You do not have permission to view yearly management data',
      } as IApiResponse<null>);
    }

    const {
      page = 1,
      pageSize = 10,
      status,
      search,
      year = new Date().getFullYear(),
    } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const pageSizeNum = parseInt(pageSize as string) || 10;
    const skip = (pageNum - 1) * pageSizeNum;
    const yearNum = parseInt(year as string) || new Date().getFullYear();

    // Build filter conditions for employees
    const where: any = {};

    if (search) {
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

    // Get total count of employees
    await prisma.employee.count({ where });

    // Get employees with their leave data
    const employees = await prisma.employee.findMany({
      where,
      skip,
      take: pageSizeNum,
      orderBy: {
        firstName: 'asc',
      },
    });

    // Get leave requests for calculating used leaves
    let leaveRequests: any[] = [];
    try {
      leaveRequests = await prisma.leaveRequest.findMany({
        where: {
          status: 'APPROVED',
        },
      });
    } catch (dbError: any) {
      console.error('Error fetching leave requests in getYearlyManagement:', dbError);
      // Continue with empty array if query fails
      leaveRequests = [];
    }

    // Format response with yearly management data
    // Use a single query to get all leave summaries instead of Promise.all
    const allLeaveSummaries = await prisma.leaveSummary.findMany({
      where: {
        employeeId: { in: employees.map((e: any) => e.id) },
        year: yearNum,
      },
    });
    const leaveSummaryMap = new Map(allLeaveSummaries.map((ls: any) => [ls.employeeId, ls]));

    const yearlyData = employees.map((employee: any) => {
      // Get leave summary from map
      const leaveSummary = leaveSummaryMap.get(employee.id);

      // Calculate used leaves from approved requests
      const employeeLeaves = leaveRequests.filter(
        (lr) => lr.employeeId === employee.id
      );

      const annualUsed = employeeLeaves
        .filter((lr) => lr.leaveType === 'ANNUAL')
        .reduce((sum, lr) => sum + lr.numberOfDays, 0);

      const sickUsed = employeeLeaves
        .filter((lr) => lr.leaveType === 'SICK')
        .reduce((sum, lr) => sum + lr.numberOfDays, 0);

      // Get allowances using correct schema fields
      const annualAllowance = leaveSummary?.annualLeaveEntitlement ?? 0;
      const annualCarriedOver = leaveSummary?.annualLeaveCarriedOver ?? 0;
      const annualAvailable = annualAllowance + annualCarriedOver;
      const annualRemaining = annualAvailable - annualUsed;

      // Sick leave: Total is fullPay + halfPay + unpaid (MOHRE: 90 days total)
      const sickAllowance = (leaveSummary?.sickLeaveFullPay ?? 15) + 
                           (leaveSummary?.sickLeaveHalfPay ?? 30) + 
                           (leaveSummary?.sickLeaveUnpaid ?? 45);
      const sickRemaining = sickAllowance - sickUsed;

      // WFH: Monthly limit
      const wfhAllowance = leaveSummary?.wfhMonthlyLimit ?? 4;
      const wfhRemaining = wfhAllowance - (leaveSummary?.wfhUsedThisMonth ?? 0);

      // Carried over from previous year
      const carriedOver = annualCarriedOver;

      // Calculate unpaid leaves (for display purposes)
      const unpaidCount = employeeLeaves.filter(
        (lr) => lr.leaveType === 'EMERGENCY' || lr.leaveType === 'MATERNITY'
      ).length;

      return {
        employeeName: `${employee.firstName} ${employee.lastName}`,
        employeeId: employee.employeeId,
        annualLeave: {
          remaining: annualRemaining,
          used: annualUsed,
          total: annualAvailable, // Include carried over
          display: `${annualRemaining} remaining\n${annualUsed}/${annualAvailable} used`,
        },
        carriedOver,
        sickLeave: {
          remaining: sickRemaining,
          used: sickUsed,
          total: sickAllowance,
          display: `${sickRemaining} remaining\n${sickUsed}/${sickAllowance} used`,
        },
        wfhDays: {
          remaining: wfhRemaining,
          used: leaveSummary?.wfhUsedThisMonth ?? 0,
          total: wfhAllowance,
          display: `${wfhRemaining} remaining\n${leaveSummary?.wfhUsedThisMonth ?? 0}/${wfhAllowance} used`,
        },
        unpaid: unpaidCount > 0 ? unpaidCount : '-',
        status: employee.userStatus,
        year: yearNum,
      };
    });

    // Filter by status if provided
    let filteredData = yearlyData;
    if (status) {
      filteredData = yearlyData.filter((item) => item.status === status);
    }

    const totalPages = Math.ceil(filteredData.length / pageSizeNum);

    const response: IApiResponse<any> = {
      success: true,
      data: {
        data: filteredData.slice(skip, skip + pageSizeNum),
        total: filteredData.length,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages,
      },
      message: 'Yearly management data retrieved successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Get yearly management error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Approve a leave request
 * PATCH /leave-requests/:id/approve
 * Body: { approvalNotes?: string }
 * Access: HR and Admin only
 */
export const approveLeaveRequest = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { approvalNotes } = req.body;
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      } as IApiResponse<null>);
    }

    // Find the leave request
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
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

    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        error: 'Leave request not found',
        message: `Leave request with ID '${id}' not found`,
      } as IApiResponse<null>);
    }

    // Check if already processed
    if (leaveRequest.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: 'Invalid operation',
        message: `Cannot approve a leave request with status '${leaveRequest.status}'`,
      } as IApiResponse<null>);
    }

    // Update the leave request
    const updatedRequest = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: userId,
        approvalDate: new Date(),
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

    // Auto-deduct balance based on leave type
    const year = new Date(leaveRequest.startDate).getFullYear();
    const summary = await getOrCreateLeaveSummary(leaveRequest.employeeId, year, prisma);

    switch (leaveRequest.leaveType) {
      case 'ANNUAL':
        await prisma.leaveSummary.update({
          where: { id: summary.id },
          data: {
            annualLeaveUsed: { increment: leaveRequest.numberOfDays },
          },
        });
        break;
      case 'SICK':
        await prisma.leaveSummary.update({
          where: { id: summary.id },
          data: {
            sickLeaveUsed: { increment: leaveRequest.numberOfDays },
          },
        });
        break;
      case 'MATERNITY':
        await prisma.leaveSummary.update({
          where: { id: summary.id },
          data: {
            maternityLeaveUsed: { increment: leaveRequest.numberOfDays },
          },
        });
        break;
      case 'EMERGENCY':
        if (leaveRequest.compensationMethod === 'annual_leave') {
          // Deduct from annual leave instead
          await prisma.leaveSummary.update({
            where: { id: summary.id },
            data: {
              annualLeaveUsed: { increment: leaveRequest.numberOfDays },
            },
          });
        } else {
          await prisma.leaveSummary.update({
            where: { id: summary.id },
            data: {
              emergencyLeaveUsed: { increment: leaveRequest.numberOfDays },
            },
          });
        }
        break;
      case 'WFH':
        // Update WFH counters
        const weekStart = new Date(leaveRequest.startDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        
        // Check if we need to reset weekly counter
        const shouldResetWeek = !summary.wfhLastWeekStart || 
          new Date(summary.wfhLastWeekStart).getTime() !== weekStart.getTime();
        
        await prisma.leaveSummary.update({
          where: { id: summary.id },
          data: {
            wfhUsedThisWeek: shouldResetWeek ? 1 : { increment: 1 },
            wfhUsedThisMonth: { increment: 1 },
            wfhLastWeekStart: weekStart,
          },
        });
        break;
      case 'TOIL':
        // Convert overtime hours to days (1 day = 8 hours)
        const overtimeRequests = await prisma.overtimeRequest.findMany({
          where: {
            id: { in: leaveRequest.overtimeRequestIds },
            employeeId: leaveRequest.employeeId,
            status: 'APPROVED',
          },
          select: { requestedHours: true },
        });
        const totalHours = overtimeRequests.reduce((sum, req) => sum + req.requestedHours, 0);
        
        await prisma.leaveSummary.update({
          where: { id: summary.id },
          data: {
            toilHoursUsed: { increment: totalHours },
          },
        });
        break;
      // BEREAVEMENT - no balance tracking needed (granted case-by-case)
    }

    // Format response
    const response: IApiResponse<any> = {
      success: true,
      data: {
        id: updatedRequest.id,
        employeeName: `${updatedRequest.employee.firstName} ${updatedRequest.employee.lastName}`,
        employeeId: updatedRequest.employeeId,
        leaveType: updatedRequest.leaveType,
        absenceCode: getAbsenceCode(updatedRequest.leaveType),
        startDate: updatedRequest.startDate,
        endDate: updatedRequest.endDate,
        totalDays: updatedRequest.numberOfDays,
        details: updatedRequest.reason || '-',
        status: updatedRequest.status,
        createdDate: updatedRequest.createdAt,
        approvedBy: updatedRequest.approvedBy,
        approvalDate: updatedRequest.approvalDate,
        rejectionReason: null,
        approvalNotes: approvalNotes || null,
      },
      message: `Leave request approved successfully`,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Approve leave request error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Create a leave request
 * POST /leave-requests
 * Body: { leaveType, startDate, endDate, isHalfDay?, employeeId?, reason, compensationMethod?, relationship?, overtimeRequestIds? }
 * Access: Employee (own) or HR/Management (any employee)
 */
export const createLeaveRequest = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      } as IApiResponse<null>);
    }

    const {
      leaveType,
      startDate,
      endDate,
      isHalfDay = false,
      employeeId: requestedEmployeeId,
      reason,
      compensationMethod,
      relationship,
      overtimeRequestIds = [],
    } = req.body;

    // Validate required fields
    if (!leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'leaveType, startDate, endDate, and reason are required',
      } as IApiResponse<null>);
    }

    // Determine employee ID (employees can only request for themselves unless HR/Management)
    let targetEmployeeId = userId;
    if (requestedEmployeeId && (userRole === 'HR' || userRole === 'MANAGEMENT')) {
      targetEmployeeId = requestedEmployeeId;
    } else if (requestedEmployeeId && requestedEmployeeId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You can only create leave requests for yourself',
      } as IApiResponse<null>);
    }

    // Parse dates and normalize to date-only (no time component) to avoid timezone issues
    // Frontend now sends dates as YYYY-MM-DD format (date-only strings)
    // Parse the date string and create a Date at UTC midnight
    let start: Date;
    if (typeof startDate === 'string') {
      // Check if it's a date-only string (YYYY-MM-DD) or ISO string
      const dateMatch = startDate.match(/^(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        const [year, month, day] = dateMatch[1].split('-').map(Number);
        // Create date at UTC midnight using the extracted date components
        start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      } else {
        // Fallback: parse as Date and use UTC components
        const dateObj = new Date(startDate);
        const startYear = dateObj.getUTCFullYear();
        const startMonth = dateObj.getUTCMonth();
        const startDay = dateObj.getUTCDate();
        start = new Date(Date.UTC(startYear, startMonth, startDay, 0, 0, 0, 0));
      }
    } else if (startDate instanceof Date) {
      // If already a Date object, extract UTC components
      const startYear = startDate.getUTCFullYear();
      const startMonth = startDate.getUTCMonth();
      const startDay = startDate.getUTCDate();
      start = new Date(Date.UTC(startYear, startMonth, startDay, 0, 0, 0, 0));
    } else {
      // Fallback: try to parse as date string
      const dateObj = new Date(startDate);
      const startYear = dateObj.getUTCFullYear();
      const startMonth = dateObj.getUTCMonth();
      const startDay = dateObj.getUTCDate();
      start = new Date(Date.UTC(startYear, startMonth, startDay, 0, 0, 0, 0));
    }

    // Auto-adjust end date for specific leave types
    const adjustedEnd = adjustEndDateForLeaveType(start, leaveType, isHalfDay);
    let finalEndDate: Date;
    if (endDate) {
      if (typeof endDate === 'string') {
        // Check if it's a date-only string (YYYY-MM-DD) or ISO string
        const dateMatch = endDate.match(/^(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          const [year, month, day] = dateMatch[1].split('-').map(Number);
          finalEndDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
        } else {
          // Fallback: parse as Date and use UTC components
          const dateObj = new Date(endDate);
          const endYear = dateObj.getUTCFullYear();
          const endMonth = dateObj.getUTCMonth();
          const endDay = dateObj.getUTCDate();
          finalEndDate = new Date(Date.UTC(endYear, endMonth, endDay, 0, 0, 0, 0));
        }
      } else if (endDate instanceof Date) {
        // If already a Date object, extract UTC components
        const endYear = endDate.getUTCFullYear();
        const endMonth = endDate.getUTCMonth();
        const endDay = endDate.getUTCDate();
        finalEndDate = new Date(Date.UTC(endYear, endMonth, endDay, 0, 0, 0, 0));
      } else {
        // Fallback
        const dateObj = new Date(endDate);
        const endYear = dateObj.getUTCFullYear();
        const endMonth = dateObj.getUTCMonth();
        const endDay = dateObj.getUTCDate();
        finalEndDate = new Date(Date.UTC(endYear, endMonth, endDay, 0, 0, 0, 0));
      }
    } else {
      finalEndDate = adjustedEnd;
    }

    // Calculate number of days
    const numberOfDays = calculateNumberOfDays(start, finalEndDate, isHalfDay);

    // Get current year
    const year = start.getFullYear();

    // Validate based on leave type
    let validationResult;
    switch (leaveType) {
      case 'ANNUAL':
        validationResult = await validateAnnualLeave(targetEmployeeId, numberOfDays, year, prisma);
        break;
      case 'WFH':
        validationResult = await validateWFH(targetEmployeeId, start, year, prisma);
        break;
      case 'EMERGENCY':
        validationResult = await validateEmergencyLeave(targetEmployeeId, numberOfDays, compensationMethod || null, year, prisma);
        break;
      case 'TOIL':
        validationResult = await validateTOIL(targetEmployeeId, overtimeRequestIds || [], prisma);
        break;
      case 'BEREAVEMENT':
        validationResult = validateBereavement(relationship || null);
        break;
      case 'SICK':
      case 'MATERNITY':
        // No balance validation needed (unlimited or company policy)
        validationResult = { valid: true };
        break;
      default:
        validationResult = { valid: true };
    }

    if (!validationResult.valid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: validationResult.message || 'Leave request validation failed',
      } as IApiResponse<null>);
    }

    // Auto-calculated metadata
    const autoCalculated: any = {};
    if (leaveType === 'WFH') {
      // Store weekly/monthly counts for reference
      const weekStart = new Date(start);
      weekStart.setDate(start.getDate() - start.getDay()); // Start of week (Sunday)
      const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
      
      const weekWFH = await prisma.leaveRequest.count({
        where: {
          employeeId: targetEmployeeId,
          leaveType: 'WFH',
          status: { in: ['PENDING', 'APPROVED'] },
          startDate: {
            gte: weekStart,
            lte: new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000),
          },
        },
      });

      const monthWFH = await prisma.leaveRequest.count({
        where: {
          employeeId: targetEmployeeId,
          leaveType: 'WFH',
          status: { in: ['PENDING', 'APPROVED'] },
          startDate: {
            gte: monthStart,
            lte: new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0),
          },
        },
      });

      autoCalculated.wfhWeekCount = weekWFH + 1;
      autoCalculated.wfhMonthCount = monthWFH + 1;
    }

    // Create leave request
    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId: targetEmployeeId,
        leaveType,
        startDate: start,
        endDate: finalEndDate,
        isHalfDay: isHalfDay || false,
        numberOfDays,
        reason: reason.trim(),
        status: 'PENDING',
        compensationMethod: compensationMethod || null,
        relationship: relationship || null,
        overtimeRequestIds: overtimeRequestIds || [],
        autoCalculated: autoCalculated || null,
        createdBy: userId,
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

    // Send email notification to HR/Management (non-blocking)
    console.log('📨 Starting email notification process for leave request:', leaveRequest.id);
    console.log('   Employee:', `${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName}`);
    console.log('   Leave Type:', leaveRequest.leaveType);
    console.log('   Dates:', `${leaveRequest.startDate} to ${leaveRequest.endDate}`);
    
    sendLeaveRequestNotification(prisma, {
      employeeName: `${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName}`,
      employeeId: leaveRequest.employeeId,
      employeeEmail: leaveRequest.employee.email,
      leaveType: leaveRequest.leaveType,
      startDate: leaveRequest.startDate,
      endDate: leaveRequest.endDate,
      numberOfDays: leaveRequest.numberOfDays,
      reason: leaveRequest.reason,
      status: leaveRequest.status,
    })
      .then((success) => {
        if (success) {
          console.log('✅ Email notification sent successfully');
        } else {
          console.warn('⚠️  Email notification returned false (check logs above for details)');
        }
      })
      .catch((emailError) => {
        // Log email error but don't fail the request
        console.error('❌ Failed to send leave request notification email:', emailError);
        if (emailError instanceof Error) {
          console.error('   Error message:', emailError.message);
          console.error('   Error stack:', emailError.stack);
        }
      });

    const response: IApiResponse<any> = {
      success: true,
      data: {
        id: leaveRequest.id,
        employeeName: `${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName}`,
        employeeId: leaveRequest.employeeId,
        leaveType: leaveRequest.leaveType,
        absenceCode: getAbsenceCode(leaveRequest.leaveType),
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
        totalDays: leaveRequest.numberOfDays,
        details: leaveRequest.reason,
        status: leaveRequest.status,
        createdDate: leaveRequest.createdAt,
        balance: validationResult.balance || null,
        projectedBalance: validationResult.projectedBalance || null,
      },
      message: 'Leave request created successfully',
    };

    return res.status(201).json(response);
  } catch (error) {
    console.error('Create leave request error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Failed to create leave request',
    } as IApiResponse<null>);
  }
};

/**
 * Reject a leave request
 * PATCH /leave-requests/:id/reject
 * Body: { rejectionReason: string (required) }
 * Access: HR and Admin only
 */
export const rejectLeaveRequest = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      } as IApiResponse<null>);
    }

    // Validate rejection reason
    if (!rejectionReason || typeof rejectionReason !== 'string' || rejectionReason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'Rejection reason is required and must be a non-empty string',
      } as IApiResponse<null>);
    }

    // Find the leave request
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
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

    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        error: 'Leave request not found',
        message: `Leave request with ID '${id}' not found`,
      } as IApiResponse<null>);
    }

    // Check if already processed
    if (leaveRequest.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: 'Invalid operation',
        message: `Cannot reject a leave request with status '${leaveRequest.status}'`,
      } as IApiResponse<null>);
    }

    // Update the leave request
    const updatedRequest = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedBy: userId,
        approvalDate: new Date(),
        rejectionReason: rejectionReason.trim(),
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

    // Format response
    const response: IApiResponse<any> = {
      success: true,
      data: {
        id: updatedRequest.id,
        employeeName: `${updatedRequest.employee.firstName} ${updatedRequest.employee.lastName}`,
        employeeId: updatedRequest.employeeId,
        leaveType: updatedRequest.leaveType,
        absenceCode: getAbsenceCode(updatedRequest.leaveType),
        startDate: updatedRequest.startDate,
        endDate: updatedRequest.endDate,
        totalDays: updatedRequest.numberOfDays,
        details: updatedRequest.reason || '-',
        status: updatedRequest.status,
        createdDate: updatedRequest.createdAt,
        approvedBy: updatedRequest.approvedBy,
        approvalDate: updatedRequest.approvalDate,
        rejectionReason: updatedRequest.rejectionReason,
      },
      message: `Leave request rejected successfully`,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Reject leave request error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Upload a document for a leave request (file upload handler)
 * POST /leave-requests/:id/documents/upload
 * Uses multer middleware for file handling
 * Access: Employee (own request) or HR/Management
 */
export const uploadLeaveRequestDocumentFile = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;
    const file = (req as any).file;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      } as IApiResponse<null>);
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'No file uploaded',
      } as IApiResponse<null>);
    }

    // Find the leave request
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
    });

    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        error: 'Leave request not found',
        message: `Leave request with ID '${id}' not found`,
      } as IApiResponse<null>);
    }

    // Check authorization - employee can only upload to their own requests
    if (userId !== leaveRequest.employeeId && (req as any).user?.role !== 'MANAGEMENT' && (req as any).user?.role !== 'HR') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You do not have permission to upload documents for this leave request',
      } as IApiResponse<null>);
    }

    // Upload file to DigitalOcean Spaces
    const fileUrl = await uploadFileToSpaces(file, 'leave-requests');

    // Create the document with file URL
    const document = await (prisma as any).leaveRequestDocument.create({
      data: {
        leaveRequestId: id,
        fileName: file.originalname,
        fileType: file.mimetype,
        url: fileUrl,
      },
    });

    const response: IApiResponse<any> = {
      success: true,
      data: {
        id: document.id,
        leaveRequestId: document.leaveRequestId,
        fileName: document.fileName,
        fileType: document.fileType,
        url: document.url,
        uploadDate: document.uploadDate,
      },
      message: 'Document uploaded successfully',
    };

    return res.status(201).json(response);
  } catch (error) {
    console.error('Upload leave request document error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Failed to upload document',
    } as IApiResponse<null>);
  }
};

/**
 * Upload a document for a leave request (legacy - accepts URL)
 * POST /leave-requests/:id/documents
 * Body: { fileName: string, fileType: string, url: string }
 * Access: Employee (own request) or HR/Admin
 */
export const uploadLeaveRequestDocument = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { fileName, fileType, url } = req.body;
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      } as IApiResponse<null>);
    }

    // Validate required fields
    if (!fileName || !fileType || !url) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'fileName, fileType, and url are required',
      } as IApiResponse<null>);
    }

    // Find the leave request
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
    });

    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        error: 'Leave request not found',
        message: `Leave request with ID '${id}' not found`,
      } as IApiResponse<null>);
    }

    // Check authorization - employee can only upload to their own requests
    if (userId !== leaveRequest.employeeId && (req as any).user?.role !== 'MANAGEMENT' && (req as any).user?.role !== 'HR') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You do not have permission to upload documents for this leave request',
      } as IApiResponse<null>);
    }

    // Create the document
    const document = await (prisma as any).leaveRequestDocument.create({
      data: {
        leaveRequestId: id,
        fileName: fileName.trim(),
        fileType: fileType.trim(),
        url: url.trim(),
      },
    });

    const response: IApiResponse<any> = {
      success: true,
      data: {
        id: document.id,
        leaveRequestId: document.leaveRequestId,
        fileName: document.fileName,
        fileType: document.fileType,
        url: document.url,
        uploadDate: document.uploadDate,
      },
      message: 'Document uploaded successfully',
    };

    return res.status(201).json(response);
  } catch (error) {
    console.error('Upload leave request document error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Get all documents for a leave request
 * GET /leave-requests/:id/documents
 * Access: Employee (own request) or HR/Admin
 */
export const getLeaveRequestDocuments = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      } as IApiResponse<null>);
    }

    // Find the leave request
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
    });

    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        error: 'Leave request not found',
        message: `Leave request with ID '${id}' not found`,
      } as IApiResponse<null>);
    }

    // Check authorization
    if (userId !== leaveRequest.employeeId && (req as any).user?.role !== 'MANAGEMENT' && (req as any).user?.role !== 'HR') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You do not have permission to view documents for this leave request',
      } as IApiResponse<null>);
    }

    // Get all documents
    const documents = await (prisma as any).leaveRequestDocument.findMany({
      where: { leaveRequestId: id },
      orderBy: { uploadDate: 'desc' },
    });

    const response: IApiResponse<any> = {
      success: true,
      data: {
        leaveRequestId: id,
        documents: documents.map((doc: any) => ({
          id: doc.id,
          fileName: doc.fileName,
          fileType: doc.fileType,
          url: doc.url,
          uploadDate: doc.uploadDate,
        })),
        total: documents.length,
      },
      message: 'Documents retrieved successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Get leave request documents error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Delete a document from a leave request
 * DELETE /leave-requests/documents/:documentId
 * Access: Employee (own request) or HR/Admin
 */
export const deleteLeaveRequestDocument = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { documentId } = req.params;
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      } as IApiResponse<null>);
    }

    // Find the document
    const document = await (prisma as any).leaveRequestDocument.findUnique({
      where: { id: documentId },
      include: {
        leaveRequest: true,
      },
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
        message: `Document with ID '${documentId}' not found`,
      } as IApiResponse<null>);
    }

    // Check authorization
    if (userId !== document.leaveRequest.employeeId && (req as any).user?.role !== 'MANAGEMENT' && (req as any).user?.role !== 'HR') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You do not have permission to delete this document',
      } as IApiResponse<null>);
    }

    // Delete the document
    await (prisma as any).leaveRequestDocument.delete({
      where: { id: documentId },
    });

    const response: IApiResponse<any> = {
      success: true,
      message: 'Document deleted successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Delete leave request document error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Get leave balance for an employee
 * GET /leave-requests/balance
 * Query params: employeeId, year
 * Access: Employee (own) or HR/Management
 */
export const getLeaveBalance = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;
    const { employeeId, year } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      } as IApiResponse<null>);
    }

    // Determine target employee ID
    let targetEmployeeId = userId;
    if (employeeId && (userRole === 'HR' || userRole === 'MANAGEMENT')) {
      targetEmployeeId = employeeId as string;
    } else if (employeeId && employeeId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You can only view your own leave balance',
      } as IApiResponse<null>);
    }

    const yearNum = parseInt(year as string) || new Date().getFullYear();
    const summary = await getOrCreateLeaveSummary(targetEmployeeId, yearNum, prisma);

    // Calculate actual WFH usage from LeaveRequest table (includes PENDING and APPROVED)
    // This ensures the balance matches what validation checks
    const now = new Date();
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 0 });
    const currentWeekEnd = endOfWeek(now, { weekStartsOn: 0 });
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);

    const wfhRequests = await prisma.leaveRequest.findMany({
      where: {
        employeeId: targetEmployeeId,
        leaveType: 'WFH',
        status: { in: ['PENDING', 'APPROVED'] },
      },
    });

    // Count WFH in current week
    const wfhThisWeek = wfhRequests.filter(lr => {
      const requestDate = new Date(lr.startDate);
      return requestDate >= currentWeekStart && requestDate <= currentWeekEnd;
    }).length;

    // Count WFH in current month
    const wfhThisMonth = wfhRequests.filter(lr => {
      const requestDate = new Date(lr.startDate);
      return requestDate >= currentMonthStart && requestDate <= currentMonthEnd;
    }).length;

    const response: IApiResponse<any> = {
      success: true,
      data: {
        employeeId: targetEmployeeId,
        year: yearNum,
        annualLeave: {
          entitlement: summary.annualLeaveEntitlement,
          used: summary.annualLeaveUsed,
          carriedOver: summary.annualLeaveCarriedOver,
          available: (summary.annualLeaveEntitlement + summary.annualLeaveCarriedOver) - summary.annualLeaveUsed,
        },
        sickLeave: {
          fullPay: summary.sickLeaveFullPay,
          halfPay: summary.sickLeaveHalfPay,
          unpaid: summary.sickLeaveUnpaid,
          used: summary.sickLeaveUsed,
          total: summary.sickLeaveFullPay + summary.sickLeaveHalfPay + summary.sickLeaveUnpaid,
        },
        maternityLeave: {
          entitlement: summary.maternityLeaveEntitlement,
          used: summary.maternityLeaveUsed,
          available: summary.maternityLeaveEntitlement - summary.maternityLeaveUsed,
        },
        emergencyLeave: {
          entitlement: summary.emergencyLeaveEntitlement,
          used: summary.emergencyLeaveUsed,
          available: summary.emergencyLeaveEntitlement - summary.emergencyLeaveUsed,
        },
        wfh: {
          monthlyLimit: summary.wfhMonthlyLimit,
          weeklyLimit: summary.wfhWeeklyLimit,
          usedThisMonth: wfhThisMonth, // Use actual count from LeaveRequest
          usedThisWeek: wfhThisWeek, // Use actual count from LeaveRequest
          availableThisMonth: summary.wfhMonthlyLimit - wfhThisMonth,
          availableThisWeek: summary.wfhWeeklyLimit - wfhThisWeek,
        },
        toil: {
          hoursAvailable: summary.toilHoursAvailable,
          hoursUsed: summary.toilHoursUsed,
          hoursRemaining: summary.toilHoursAvailable - summary.toilHoursUsed,
          daysAvailable: Math.floor((summary.toilHoursAvailable - summary.toilHoursUsed) / 8),
        },
      },
      message: 'Leave balance retrieved successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Get leave balance error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Failed to retrieve leave balance',
    } as IApiResponse<null>);
  }
};

/**
 * Get approved overtime requests for TOIL
 * GET /leave-requests/overtime-requests
 * Query params: employeeId
 * Access: Employee (own) or HR/Management
 */
export const getApprovedOvertimeRequests = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;
    const { employeeId } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      } as IApiResponse<null>);
    }

    // Determine target employee ID
    let targetEmployeeId = userId;
    if (employeeId && (userRole === 'HR' || userRole === 'MANAGEMENT')) {
      targetEmployeeId = employeeId as string;
    } else if (employeeId && employeeId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You can only view your own overtime requests',
      } as IApiResponse<null>);
    }

    // Get approved overtime requests that haven't been used for TOIL yet
    const overtimeRequests = await prisma.overtimeRequest.findMany({
      where: {
        employeeId: targetEmployeeId,
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
      orderBy: {
        requestedDate: 'desc',
      },
    });

    // Filter out overtime requests that have already been used in TOIL leave requests
    const usedOvertimeRequestIds = await prisma.leaveRequest.findMany({
      where: {
        employeeId: targetEmployeeId,
        leaveType: 'TOIL',
        status: { in: ['PENDING', 'APPROVED'] },
      },
      select: {
        overtimeRequestIds: true,
      },
    });

    const usedIds = new Set<string>();
    usedOvertimeRequestIds.forEach((lr) => {
      lr.overtimeRequestIds.forEach((id) => usedIds.add(id));
    });

    const availableRequests = overtimeRequests.filter((req) => !usedIds.has(req.id));

    const response: IApiResponse<any> = {
      success: true,
      data: {
        requests: availableRequests.map((req) => ({
          id: req.id,
          requestedDate: req.requestedDate,
          requestedHours: req.requestedHours,
          clientName: req.client?.name || 'N/A',
          projectName: req.project?.name || 'N/A',
          reason: req.reason,
          canDoNextDay: req.canDoNextDay,
          urgencyReason: req.urgencyReason,
          createdAt: req.createdAt,
        })),
        totalHours: availableRequests.reduce((sum, req) => sum + req.requestedHours, 0),
        availableDays: Math.floor(availableRequests.reduce((sum, req) => sum + req.requestedHours, 0) / 8),
      },
      message: 'Approved overtime requests retrieved successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Get approved overtime requests error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Failed to retrieve overtime requests',
    } as IApiResponse<null>);
  }
};

/**
 * Helper function to get absence code from leave type
 */
function getAbsenceCode(leaveType: string): string {
  const codeMap: { [key: string]: string } = {
    ANNUAL: 'AL',
    SICK: 'SL',
    MATERNITY: 'ML',
    EMERGENCY: 'EL',
    TOIL: 'TL',
    WFH: 'WFH',
    BEREAVEMENT: 'BL',
  };
  return codeMap[leaveType] || leaveType;
}

