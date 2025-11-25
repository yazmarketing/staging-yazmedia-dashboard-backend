import { Request, Response } from 'express';
import { prisma } from '../index';
import { IApiResponse } from '../types';
import { getUserInfo, buildOwnershipFilter } from '../utils/ownershipValidation';
import { schedulePayrollSync } from '../services/payrollSyncService';

/**
 * Get all salary change requests with filters
 * GET /salary-changes
 * Query: page, pageSize, status, employeeId, search, month, year
 */
export const getSalaryChanges = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const {
      page = 1,
      pageSize = 10,
      status,
      employeeId,
      search,
      month,
      year,
    } = req.query;

    const { userId, role } = getUserInfo(req);
    const skip = (Number(page) - 1) * Number(pageSize);
    const where: any = {};

    if (status) where.status = status;
    
    // RBAC: EMPLOYEE can only see their own salary changes
    const ownershipFilter = buildOwnershipFilter(userId, role, 'employeeId');
    if (Object.keys(ownershipFilter).length > 0) {
      where.employeeId = ownershipFilter.employeeId;
    } else if (employeeId) {
      // Privileged roles can filter by employeeId if provided
      where.employeeId = employeeId;
    }

    // Support month/year filtering by effectiveDate
    if (month && year) {
      const monthNum = parseInt(month as string);
      const yearNum = parseInt(year as string);
      if (!isNaN(monthNum) && !isNaN(yearNum) && monthNum >= 1 && monthNum <= 12 && yearNum > 0) {
        const startOfMonth = new Date(yearNum, monthNum - 1, 1);
        const endOfMonth = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);
        where.effectiveDate = {
          gte: startOfMonth,
          lte: endOfMonth,
        };
      }
    }

    if (search) {
      where.OR = [
        {
          employee: {
            firstName: { contains: String(search), mode: 'insensitive' },
          },
        },
        {
          employee: {
            lastName: { contains: String(search), mode: 'insensitive' },
          },
        },
        {
          employee: {
            email: { contains: String(search), mode: 'insensitive' },
          },
        },
      ];
    }

    const salaryChanges = await prisma.salaryChange.findMany({
      where,
      skip,
      take: Number(pageSize),
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeId: true,
            designation: true,
            baseSalary: true,
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const total = await prisma.salaryChange.count({ where });

    const response: IApiResponse<any> = {
      success: true,
      data: {
        salaryChanges,
        pagination: {
          page: Number(page),
          pageSize: Number(pageSize),
          total,
          pages: Math.ceil(total / Number(pageSize)),
        },
      },
      message: 'Salary change requests retrieved successfully',
    };

    return res.status(200).json(response);
  } catch (error: any) {
    console.error('Get salary changes error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    } as IApiResponse<null>);
  }
};

/**
 * Create a salary change request
 * POST /salary-changes
 * Body: { employeeId, newBaseSalary, newAccommodationAllowance, newHousingAllowance, newTransportationAllowance, newTotalSalary, changeType, reason, effectiveDate }
 * Access: HR only
 */
export const createSalaryChange = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { 
      employeeId, 
      newBaseSalary, 
      newTelephoneAllowance = 0,
      newHousingAllowance = 0,
      newTransportationAllowance = 0,
      newTotalSalary,
      changeType, 
      reason, 
      effectiveDate 
    } = req.body;

    // Validate required fields
    if (!employeeId || !newBaseSalary || !changeType || !reason || !effectiveDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: employeeId, newBaseSalary, changeType, reason, effectiveDate',
      } as IApiResponse<null>);
    }

    // Get employee
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found',
      } as IApiResponse<null>);
    }

    // Validate new base salary
    if (newBaseSalary <= 0) {
      return res.status(400).json({
        success: false,
        error: 'New base salary must be greater than 0',
      } as IApiResponse<null>);
    }

    // Calculate total salary if not provided
    const calculatedTotal = newBaseSalary + (newTelephoneAllowance || 0) + (newHousingAllowance || 0) + (newTransportationAllowance || 0);
    const finalTotalSalary = newTotalSalary || calculatedTotal;

    if (finalTotalSalary <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Total salary must be greater than 0',
      } as IApiResponse<null>);
    }

    // Create salary change request
    const salaryChange = await prisma.salaryChange.create({
      data: {
        employeeId,
        oldBaseSalary: employee.baseSalary,
        oldTelephoneAllowance: employee.telephoneAllowance,
        oldHousingAllowance: employee.housingAllowance,
        oldTransportationAllowance: employee.transportationAllowance,
        oldTotalSalary: employee.totalSalary,
        newBaseSalary,
        newTelephoneAllowance: newTelephoneAllowance || 0,
        newHousingAllowance: newHousingAllowance || 0,
        newTransportationAllowance: newTransportationAllowance || 0,
        newTotalSalary: finalTotalSalary,
        changeType,
        reason,
        effectiveDate: new Date(effectiveDate),
        status: 'PENDING',
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            baseSalary: true,
            telephoneAllowance: true,
            housingAllowance: true,
            transportationAllowance: true,
            totalSalary: true,
          },
        },
      },
    });

    const response: IApiResponse<any> = {
      success: true,
      data: salaryChange,
      message: 'Salary change request created successfully',
    };

    return res.status(201).json(response);
  } catch (error) {
    console.error('Create salary change error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Approve salary change by Management
 * PATCH /salary-changes/:id/approve
 * Access: Management only
 */
export const approveSalaryChange = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId || (req as any).user?.id;

    const salaryChange = await prisma.salaryChange.findUnique({
      where: { id },
      include: { employee: true },
    });

    if (!salaryChange) {
      return res.status(404).json({
        success: false,
        error: 'Salary change request not found',
      } as IApiResponse<null>);
    }

    if (salaryChange.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: `Cannot approve salary change with status: ${salaryChange.status}. Only PENDING requests can be approved.`,
      } as IApiResponse<null>);
    }

    // Update salary change status
    const updated = await prisma.salaryChange.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: userId,
        approvedDate: new Date(),
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            baseSalary: true,
          },
        },
      },
    });

    // Update employee salary based on effective date
    const effectiveDate = new Date(salaryChange.effectiveDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    effectiveDate.setHours(0, 0, 0, 0);

    // If effective date is today or in the past, update employee salary immediately
    // If effective date is in the future, it will be applied later (could be handled by a scheduled job)
    if (effectiveDate <= today) {
      await prisma.employee.update({
        where: { id: salaryChange.employeeId },
        data: {
          baseSalary: salaryChange.newBaseSalary,
          telephoneAllowance: salaryChange.newTelephoneAllowance,
          housingAllowance: salaryChange.newHousingAllowance,
          transportationAllowance: salaryChange.newTransportationAllowance,
          totalSalary: salaryChange.newTotalSalary,
        },
      });

      schedulePayrollSync(salaryChange.employeeId, {
        month: effectiveDate.getMonth() + 1,
        year: effectiveDate.getFullYear(),
        allowCreate: true,
        meta: {
          type: 'salary-change',
          recordId: salaryChange.id,
        },
      });
    }
    // Note: For future effective dates, you could implement a scheduled job that runs daily
    // to check for approved salary changes with effectiveDate <= today and apply them

    const response: IApiResponse<any> = {
      success: true,
      data: updated,
      message: effectiveDate <= today 
        ? 'Salary change approved and activated immediately'
        : `Salary change approved and will be effective on ${effectiveDate.toLocaleDateString()}`,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Approve salary change error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Reject salary change request
 * PATCH /salary-changes/:id/reject
 * Body: { rejectionReason }
 * Access: Management only
 */
export const rejectSalaryChange = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const userId = (req as any).user?.userId || (req as any).user?.id;

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        error: 'Rejection reason is required',
      } as IApiResponse<null>);
    }

    const salaryChange = await prisma.salaryChange.findUnique({
      where: { id },
    });

    if (!salaryChange) {
      return res.status(404).json({
        success: false,
        error: 'Salary change request not found',
      } as IApiResponse<null>);
    }

    if (salaryChange.status === 'REJECTED' || salaryChange.status === 'APPROVED') {
      return res.status(400).json({
        success: false,
        error: `Cannot reject salary change with status: ${salaryChange.status}`,
      } as IApiResponse<null>);
    }

    const updated = await prisma.salaryChange.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason,
        rejectedBy: userId,
        rejectedDate: new Date(),
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
      data: updated,
      message: 'Salary change request rejected',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Reject salary change error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Get salary history for an employee
 * GET /salary-history/:employeeId
 */
export const getSalaryHistory = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { employeeId } = req.params;
    const { page = 1, pageSize = 10 } = req.query;

    const skip = (Number(page) - 1) * Number(pageSize);

    const salaryChanges = await prisma.salaryChange.findMany({
      where: {
        employeeId,
        status: 'APPROVED',
      },
      skip,
      take: Number(pageSize),
      orderBy: { effectiveDate: 'desc' },
    });

    const total = await prisma.salaryChange.count({
      where: {
        employeeId,
        status: 'APPROVED',
      },
    });

    const response: IApiResponse<any> = {
      success: true,
      data: {
        salaryChanges,
        pagination: {
          page: Number(page),
          pageSize: Number(pageSize),
          total,
          pages: Math.ceil(total / Number(pageSize)),
        },
      },
      message: 'Salary history retrieved successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Get salary history error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * NOTE: Update and Delete endpoints for salary changes are NOT implemented.
 * If they are added in the future, they MUST check the status:
 * - APPROVED salary changes CANNOT be edited or deleted
 * - Only PENDING or REJECTED salary changes can be edited/deleted
 * 
 * Example protection code:
 * if (salaryChange.status === 'APPROVED') {
 *   return res.status(403).json({
 *     success: false,
 *     error: 'Cannot modify salary change: Approved salary changes cannot be edited or deleted.',
 *   });
 * }
 */
