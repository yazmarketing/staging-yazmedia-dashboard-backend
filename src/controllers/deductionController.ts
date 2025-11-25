import { Request, Response } from 'express';
import { DeductionStatus } from '@prisma/client';
import { prisma } from '../index';
import { IApiResponse } from '../types';
import { getUserInfo, buildOwnershipFilter } from '../utils/ownershipValidation';
import { schedulePayrollSyncForDeduction } from '../services/payrollSyncService';

const deductionInclude = {
  employee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      designation: true,
      employeeId: true,
    },
  },
  deductionType: {
    select: {
      id: true,
      name: true,
    },
  },
};

/**
 * Create a new deduction
 * POST /deductions
 */
export const createDeduction = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { employeeId, deductionTypeId, amount, reason, deductionDate } = req.body;

    // Validation
    if (!employeeId || !deductionTypeId || amount === undefined || !reason || !deductionDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: employeeId, deductionTypeId, amount, reason, deductionDate',
      });
    }

    // Validate amount
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be a positive number',
      });
    }

    // Validate deductionDate
    const date = new Date(deductionDate);
    if (isNaN(date.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid deductionDate format. Use YYYY-MM-DD',
      });
    }

    // Check if employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found',
      });
    }

    // Find or create deduction type (accepts either ID or name)
    let deductionType = await prisma.deductionType.findFirst({
      where: {
        OR: [
          { id: deductionTypeId },
          { name: { equals: deductionTypeId, mode: 'insensitive' } }
        ]
      }
    });

    if (!deductionType) {
      // Create new deduction type if it doesn't exist
      deductionType = await prisma.deductionType.create({
        data: { name: deductionTypeId }
      });
    }

    const finalDeductionTypeId = deductionType.id;

    // Create deduction
    const deduction = await prisma.deduction.create({
      data: {
        employeeId,
        deductionTypeId: finalDeductionTypeId,
        amount,
        reason,
        deductionDate: date,
        status: 'PENDING',
      },
      include: deductionInclude,
    });

    return res.status(201).json({
      success: true,
      data: deduction,
      message: 'Deduction created successfully',
    } as IApiResponse<any>);
  } catch (error) {
    console.error('Error creating deduction:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create deduction',
    });
  }
};

/**
 * Get all deductions with filters and pagination
 * GET /deductions
 */
export const getDeductions = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { userId, role } = getUserInfo(req);
    const { page = 1, pageSize = 10, employeeId, deductionTypeId, startDate, endDate, month, year, status } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const pageSizeNum = Math.max(1, Math.min(100, parseInt(pageSize as string) || 10));
    const skip = (pageNum - 1) * pageSizeNum;

    // Build filter
    const where: any = {};
    
    // RBAC: EMPLOYEE can only see their own deductions
    const ownershipFilter = buildOwnershipFilter(userId, role, 'employeeId');
    if (Object.keys(ownershipFilter).length > 0) {
      where.employeeId = ownershipFilter.employeeId;
    } else if (employeeId) {
      // Privileged roles can filter by employeeId if provided
      where.employeeId = employeeId;
    }
    
    if (deductionTypeId) where.deductionTypeId = deductionTypeId;
    if (status) where.status = status;

    // Support date range filtering
    if (startDate || endDate) {
      where.deductionDate = {};
      if (startDate) {
        where.deductionDate.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.deductionDate.lte = new Date(endDate as string);
      }
    }

    // Support legacy month/year filtering for backward compatibility
    if (month && year) {
      const monthNum = parseInt(month as string);
      const yearNum = parseInt(year as string);
      if (!isNaN(monthNum) && !isNaN(yearNum) && monthNum >= 1 && monthNum <= 12 && yearNum > 0) {
        const startOfMonth = new Date(yearNum, monthNum - 1, 1);
        const endOfMonth = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);
        where.deductionDate = {
          gte: startOfMonth,
          lte: endOfMonth,
        };
      }
    }

    // Get total count
    const total = await prisma.deduction.count({ where });

    // Get deductions
    const deductions = await prisma.deduction.findMany({
      where,
      include: deductionInclude,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSizeNum,
    });

    const totalPages = Math.ceil(total / pageSizeNum);

    return res.status(200).json({
      success: true,
      data: {
        deductions,
        pagination: {
          page: pageNum,
          pageSize: pageSizeNum,
          total,
          totalPages,
        },
      },
      message: 'Deductions retrieved successfully',
    } as IApiResponse<any>);
  } catch (error) {
    console.error('Error fetching deductions:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch deductions',
    });
  }
};

/**
 * Finance approval for deduction
 */
export const financeApproveDeduction = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { userId } = getUserInfo(req);
    const actorId = userId || (req as any).user?.id || (req as any).user?.email;

    const deduction = await prisma.deduction.findUnique({
      where: { id },
      include: deductionInclude,
    });

    if (!deduction) {
      return res.status(404).json({
        success: false,
        error: 'Deduction not found',
      });
    }

    const financeApprovableStatuses: DeductionStatus[] = [
      DeductionStatus.PENDING,
      DeductionStatus.ON_HOLD,
    ];

    if (!financeApprovableStatuses.includes(deduction.status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot finance-approve deduction in status: ${deduction.status}`,
      } as IApiResponse<null>);
    }

    const updated = await prisma.deduction.update({
      where: { id },
      data: {
        status: DeductionStatus.FINANCE_APPROVED,
        financeApprovedAt: new Date(),
        financeApprovedBy: actorId,
        onHoldAt: null,
        onHoldBy: null,
        onHoldReason: null,
      },
      include: deductionInclude,
    });

    schedulePayrollSyncForDeduction(updated);

    return res.status(200).json({
      success: true,
      data: updated,
      message: 'Deduction approved by Finance',
    } as IApiResponse<any>);
  } catch (error) {
    console.error('Error approving deduction:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to approve deduction by Finance',
    });
  }
};

/**
 * Management approval for deduction
 */
export const managementApproveDeduction = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { userId } = getUserInfo(req);
    const actorId = userId || (req as any).user?.id || (req as any).user?.email;

    const deduction = await prisma.deduction.findUnique({
      where: { id },
      include: deductionInclude,
    });

    if (!deduction) {
      return res.status(404).json({
        success: false,
        error: 'Deduction not found',
      } as IApiResponse<null>);
    }

    if (deduction.status !== DeductionStatus.FINANCE_APPROVED) {
      return res.status(400).json({
        success: false,
        error: `Cannot management-approve deduction in status: ${deduction.status}`,
      } as IApiResponse<null>);
    }

    const updated = await prisma.deduction.update({
      where: { id },
      data: {
        status: DeductionStatus.MANAGEMENT_APPROVED,
        managementApprovedAt: new Date(),
        managementApprovedBy: actorId,
      },
      include: deductionInclude,
    });

    schedulePayrollSyncForDeduction(updated);

    return res.status(200).json({
      success: true,
      data: updated,
      message: 'Deduction approved by Management',
    } as IApiResponse<any>);
  } catch (error) {
    console.error('Management approve deduction error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to approve deduction by Management',
    });
  }
};

/**
 * Mark deduction ready for payroll
 */
export const readyDeductionForPayroll = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { payrollReference } = req.body;
    const { userId } = getUserInfo(req);
    const actorId = userId || (req as any).user?.id || (req as any).user?.email;

    const deduction = await prisma.deduction.findUnique({
      where: { id },
      include: deductionInclude,
    });

    if (!deduction) {
      return res.status(404).json({
        success: false,
        error: 'Deduction not found',
      } as IApiResponse<null>);
    }

    if (deduction.status !== DeductionStatus.MANAGEMENT_APPROVED) {
      return res.status(400).json({
        success: false,
        error: `Cannot mark deduction ready for payroll in status: ${deduction.status}`,
      } as IApiResponse<null>);
    }

    const updated = await prisma.deduction.update({
      where: { id },
      data: {
        status: DeductionStatus.READY_FOR_PAYROLL,
        readyForPayrollAt: new Date(),
        readyForPayrollBy: actorId,
        payrollReference: payrollReference || null,
      },
      include: deductionInclude,
    });

    schedulePayrollSyncForDeduction(updated);

    return res.status(200).json({
      success: true,
      data: updated,
      message: 'Deduction marked as ready for payroll',
    } as IApiResponse<any>);
  } catch (error) {
    console.error('Ready deduction for payroll error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to mark deduction ready for payroll',
    });
  }
};

/**
 * Apply deduction to payroll (final stage)
 */
export const applyDeductionToPayroll = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { payrollReference } = req.body;
    const { userId } = getUserInfo(req);
    const actorId = userId || (req as any).user?.id || (req as any).user?.email;

    const deduction = await prisma.deduction.findUnique({
      where: { id },
      include: deductionInclude,
    });

    if (!deduction) {
      return res.status(404).json({
        success: false,
        error: 'Deduction not found',
      } as IApiResponse<null>);
    }

    if (deduction.status !== DeductionStatus.READY_FOR_PAYROLL) {
      return res.status(400).json({
        success: false,
        error: `Cannot apply deduction to payroll in status: ${deduction.status}`,
      } as IApiResponse<null>);
    }

    const updated = await prisma.deduction.update({
      where: { id },
      data: {
        status: DeductionStatus.APPLIED_TO_PAYROLL,
        appliedToPayrollAt: new Date(),
        appliedToPayrollBy: actorId,
        payrollReference: payrollReference || deduction.payrollReference,
      },
      include: deductionInclude,
    });

    schedulePayrollSyncForDeduction(updated);

    return res.status(200).json({
      success: true,
      data: updated,
      message: 'Deduction applied to payroll',
    } as IApiResponse<any>);
  } catch (error) {
    console.error('Apply deduction to payroll error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to apply deduction to payroll',
    });
  }
};

/**
 * Put deduction on hold
 */
export const putDeductionOnHold = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { onHoldReason } = req.body;
    const { userId } = getUserInfo(req);
    const actorId = userId || (req as any).user?.id || (req as any).user?.email;

    if (!onHoldReason || !onHoldReason.trim()) {
      return res.status(400).json({
        success: false,
        error: 'On hold reason is required',
      } as IApiResponse<null>);
    }

    const deduction = await prisma.deduction.findUnique({
      where: { id },
      include: deductionInclude,
    });

    if (!deduction) {
      return res.status(404).json({
        success: false,
        error: 'Deduction not found',
      } as IApiResponse<null>);
    }

    if (deduction.status === DeductionStatus.APPLIED_TO_PAYROLL || deduction.status === DeductionStatus.REJECTED) {
      return res.status(400).json({
        success: false,
        error: `Cannot put deduction on hold in status: ${deduction.status}`,
      } as IApiResponse<null>);
    }

    const updated = await prisma.deduction.update({
      where: { id },
      data: {
        status: DeductionStatus.ON_HOLD,
        onHoldAt: new Date(),
        onHoldBy: actorId,
        onHoldReason: onHoldReason.trim(),
      },
      include: deductionInclude,
    });

    schedulePayrollSyncForDeduction(updated);

    return res.status(200).json({
      success: true,
      data: updated,
      message: 'Deduction placed on hold',
    } as IApiResponse<any>);
  } catch (error) {
    console.error('Put deduction on hold error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to put deduction on hold',
    });
  }
};

/**
 * Reject a deduction
 */
export const rejectDeduction = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const { userId } = getUserInfo(req);
    const actorId = userId || (req as any).user?.id || (req as any).user?.email;

    // Validation
    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        error: 'Rejection reason is required',
      });
    }

    // Check if deduction exists
    const deduction = await prisma.deduction.findUnique({
      where: { id },
      include: deductionInclude,
    });

    if (!deduction) {
      return res.status(404).json({
        success: false,
        error: 'Deduction not found',
      } as IApiResponse<null>);
    }

    if (deduction.status === DeductionStatus.APPLIED_TO_PAYROLL) {
      return res.status(400).json({
        success: false,
        error: 'Cannot reject a deduction that has been applied to payroll',
      } as IApiResponse<null>);
    }

    const updated = await prisma.deduction.update({
      where: { id },
      data: {
        status: DeductionStatus.REJECTED,
        rejectedAt: new Date(),
        rejectedBy: actorId,
        rejectionReason: rejectionReason.trim(),
      },
      include: deductionInclude,
    });

    schedulePayrollSyncForDeduction(updated);

    return res.status(200).json({
      success: true,
      data: updated,
      message: 'Deduction rejected successfully',
    } as IApiResponse<any>);
  } catch (error) {
    console.error('Error rejecting deduction:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to reject deduction',
    });
  }
};

/**
 * Delete a deduction
 * DELETE /deductions/:id
 * Note: Approved deductions cannot be deleted
 */
export const deleteDeduction = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;

    // Check if deduction exists
    const deduction = await prisma.deduction.findUnique({
      where: { id },
    });

    if (!deduction) {
      return res.status(404).json({
        success: false,
        error: 'Deduction not found',
      });
    }

    // Approved deductions cannot be deleted
    const deletableStatuses: DeductionStatus[] = [
      DeductionStatus.PENDING,
      DeductionStatus.ON_HOLD,
      DeductionStatus.REJECTED,
    ];

    if (!deletableStatuses.includes(deduction.status)) {
      return res.status(403).json({
        success: false,
        error: 'Cannot delete deduction once it has progressed beyond pending/on-hold/rejected.',
      });
    }

    // Delete deduction
    await prisma.deduction.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: 'Deduction deleted successfully',
    } as IApiResponse<any>);
  } catch (error) {
    console.error('Error deleting deduction:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete deduction',
    });
  }
};

