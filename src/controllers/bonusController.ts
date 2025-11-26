import { Request, Response } from 'express';
import { prisma } from '../index';
import { BonusStatus, PayrollStatus } from '@prisma/client';
import { IApiResponse } from '../types';
import { getUserInfo, buildOwnershipFilter } from '../utils/ownershipValidation';
import { schedulePayrollSyncForBonus } from '../services/payrollSyncService';

const bonusInclude = {
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
  bonusType: {
    select: {
      id: true,
      name: true,
    },
  },
};

/**
 * Create a new bonus
 * POST /bonuses
 */
export const createBonus = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { employeeId, bonusTypeId, amount, reason, bonusDate } = req.body;

    // Validate required fields
    if (!employeeId || !bonusTypeId || !amount || !reason || !bonusDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: employeeId, bonusTypeId, amount, reason, bonusDate',
      } as IApiResponse<null>);
    }

    // Validate amount
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be greater than 0',
      } as IApiResponse<null>);
    }

    // Validate bonusDate
    const date = new Date(bonusDate);
    if (isNaN(date.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid bonusDate format. Use YYYY-MM-DD',
      } as IApiResponse<null>);
    }

    // Check if employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found',
      } as IApiResponse<null>);
    }

    // Find or create bonus type (accepts either ID or name)
    let bonusType = await prisma.bonusType.findFirst({
      where: {
        OR: [
          { id: bonusTypeId },
          { name: { equals: bonusTypeId, mode: 'insensitive' } }
        ]
      }
    });

    if (!bonusType) {
      // Create new bonus type if it doesn't exist
      bonusType = await prisma.bonusType.create({
        data: { name: bonusTypeId }
      });
    }

    const finalBonusTypeId = bonusType.id;

    // Create bonus
    const bonus = await prisma.bonus.create({
      data: {
        employeeId,
        bonusTypeId: finalBonusTypeId,
        amount,
        reason,
        bonusDate: date,
      },
      include: bonusInclude,
    });

    return res.status(201).json({
      success: true,
      data: bonus,
      message: 'Bonus created successfully',
    } as IApiResponse<any>);
  } catch (error) {
    console.error('Error creating bonus:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Get all bonuses with filters
 * GET /bonuses
 */
export const getBonuses = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { userId, role } = getUserInfo(req);
    const { page = 1, pageSize = 10, employeeId, startDate, endDate, month, year } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const pageSizeNum = parseInt(pageSize as string) || 10;
    const skip = (pageNum - 1) * pageSizeNum;

    // Build filter
    const where: any = {};

    // RBAC: EMPLOYEE can only see their own bonuses
    const ownershipFilter = buildOwnershipFilter(userId, role, 'employeeId');
    if (Object.keys(ownershipFilter).length > 0) {
      where.employeeId = ownershipFilter.employeeId;
    } else if (employeeId) {
      // Privileged roles can filter by employeeId if provided
      where.employeeId = employeeId;
    }

    // Support date range filtering
    if (startDate || endDate) {
      where.bonusDate = {};
      if (startDate) {
        where.bonusDate.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.bonusDate.lte = new Date(endDate as string);
      }
    }

    // Support legacy month/year filtering for backward compatibility
    if (month && year) {
      const monthNum = parseInt(month as string);
      const yearNum = parseInt(year as string);
      if (!isNaN(monthNum) && !isNaN(yearNum) && monthNum >= 1 && monthNum <= 12 && yearNum > 0) {
        const startOfMonth = new Date(yearNum, monthNum - 1, 1);
        const endOfMonth = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);
        where.bonusDate = {
          gte: startOfMonth,
          lte: endOfMonth,
        };
      }
    }

    // Get total count
    const total = await prisma.bonus.count({ where });

    // Get bonuses
    const bonuses = await prisma.bonus.findMany({
      where,
      include: bonusInclude,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSizeNum,
    });

    return res.status(200).json({
      success: true,
      data: {
        bonuses,
        pagination: {
          page: pageNum,
          pageSize: pageSizeNum,
          total,
          totalPages: Math.ceil(total / pageSizeNum),
        },
      },
      message: 'Bonuses retrieved successfully',
    } as IApiResponse<any>);
  } catch (error) {
    console.error('Error fetching bonuses:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Update a bonus
 * PATCH /bonuses/:id
 * Note: Approved bonuses (processed in payroll) cannot be edited
 */
export const updateBonus = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body;

    // Check if bonus exists
    const bonus = await prisma.bonus.findUnique({
      where: { id },
    });

    if (!bonus) {
      return res.status(404).json({
        success: false,
        error: 'Bonus not found',
      } as IApiResponse<null>);
    }

    // Check if bonus has been processed in payroll (considered "approved")
    // If bonus date is in a processed payroll, it cannot be edited
    const bonusDate = new Date(bonus.bonusDate);
    const processedPayroll = await prisma.payroll.findFirst({
      where: {
        employeeId: bonus.employeeId,
        month: bonusDate.getMonth() + 1,
        year: bonusDate.getFullYear(),
        status: { 
          in: [
            PayrollStatus.MANAGEMENT_APPROVED, 
            PayrollStatus.UPLOADED_TO_BANK, 
            PayrollStatus.BANK_PAYMENT_APPROVED
          ] 
        },
      },
    });

    if (processedPayroll) {
      return res.status(403).json({
        success: false,
        error: 'Cannot edit bonus: This bonus has already been processed in payroll. Only pending bonuses can be edited.',
      } as IApiResponse<null>);
    }
    
    // Validate amount if provided
    if (amount !== undefined && amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be greater than 0',
      } as IApiResponse<null>);
    }

    const editableStatuses: BonusStatus[] = [
      BonusStatus.PENDING,
      BonusStatus.ON_HOLD,
    ];

    if (!editableStatuses.includes(bonus.status)) {
      return res.status(403).json({
        success: false,
        error: 'Only pending or on-hold bonuses can be edited.',
      } as IApiResponse<null>);
    }

    const updated = await prisma.bonus.update({
      where: { id },
      data: {
        ...(amount !== undefined && { amount }),
        ...(reason && { reason }),
      },
      include: bonusInclude,
    });

    return res.status(200).json({
      success: true,
      data: updated,
      message: 'Bonus updated successfully',
    } as IApiResponse<any>);
  } catch (error) {
    console.error('Error updating bonus:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Delete a bonus
 * DELETE /bonuses/:id
 * Note: Approved bonuses (processed in payroll) cannot be deleted
 */
export const deleteBonus = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;

    const bonus = await prisma.bonus.findUnique({
      where: { id },
    });

    if (!bonus) {
      return res.status(404).json({
        success: false,
        error: 'Bonus not found',
      } as IApiResponse<null>);
    }

    const deletableStatuses: BonusStatus[] = [
      BonusStatus.PENDING,
      BonusStatus.ON_HOLD,
      BonusStatus.REJECTED,
    ];

    if (!deletableStatuses.includes(bonus.status)) {
      return res.status(403).json({
        success: false,
        error: 'Only pending, on hold, or rejected bonuses can be deleted.',
      } as IApiResponse<null>);
    }

    // Check if bonus has been processed in payroll (considered "approved")
    // If bonus date is in a processed payroll, it cannot be deleted
    const bonusDate = new Date(bonus.bonusDate);
    const processedPayroll = await prisma.payroll.findFirst({
      where: {
        employeeId: bonus.employeeId,
        month: bonusDate.getMonth() + 1,
        year: bonusDate.getFullYear(),
        status: { 
          in: [
            PayrollStatus.MANAGEMENT_APPROVED, 
            PayrollStatus.UPLOADED_TO_BANK, 
            PayrollStatus.BANK_PAYMENT_APPROVED
          ] 
        },
      },
    });

    if (processedPayroll) {
      return res.status(403).json({
        success: false,
        error: 'Cannot delete bonus: This bonus has already been processed in payroll. Only pending bonuses can be deleted.',
      } as IApiResponse<null>);
    }

    // Delete bonus
    await prisma.bonus.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: 'Bonus deleted successfully',
    } as IApiResponse<null>);
  } catch (error) {
    console.error('Error deleting bonus:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Finance approval for bonus
 */
export const financeApproveBonus = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { userId } = getUserInfo(req);
    const actorId = userId || (req as any).user?.id || (req as any).user?.email;

    const bonus = await prisma.bonus.findUnique({
      where: { id },
      include: bonusInclude,
    });

    if (!bonus) {
      return res.status(404).json({
        success: false,
        error: 'Bonus not found',
      } as IApiResponse<null>);
    }

    const financeApprovableStatuses: BonusStatus[] = [
      BonusStatus.PENDING,
      BonusStatus.ON_HOLD,
    ];

    if (!financeApprovableStatuses.includes(bonus.status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot finance-approve bonus in status: ${bonus.status}`,
      } as IApiResponse<null>);
    }

    const updated = await prisma.bonus.update({
      where: { id },
      data: {
        status: BonusStatus.FINANCE_APPROVED,
        financeApprovedAt: new Date(),
        financeApprovedBy: actorId,
        onHoldAt: null,
        onHoldBy: null,
        onHoldReason: null,
      },
      include: bonusInclude,
    });

    schedulePayrollSyncForBonus(updated);

    return res.status(200).json({
      success: true,
      data: updated,
      message: 'Bonus approved by Finance',
    } as IApiResponse<any>);
  } catch (error) {
    console.error('Finance approve bonus error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to approve bonus by Finance',
    } as IApiResponse<null>);
  }
};

/**
 * Management approval for bonus
 */
export const managementApproveBonus = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { userId } = getUserInfo(req);
    const actorId = userId || (req as any).user?.id || (req as any).user?.email;

    const bonus = await prisma.bonus.findUnique({
      where: { id },
      include: bonusInclude,
    });

    if (!bonus) {
      return res.status(404).json({
        success: false,
        error: 'Bonus not found',
      } as IApiResponse<null>);
    }

    if (bonus.status !== BonusStatus.FINANCE_APPROVED) {
      return res.status(400).json({
        success: false,
        error: `Cannot management-approve bonus in status: ${bonus.status}`,
      } as IApiResponse<null>);
    }

    const updated = await prisma.bonus.update({
      where: { id },
      data: {
        status: BonusStatus.MANAGEMENT_APPROVED,
        managementApprovedAt: new Date(),
        managementApprovedBy: actorId,
      },
      include: bonusInclude,
    });

    schedulePayrollSyncForBonus(updated);

    return res.status(200).json({
      success: true,
      data: updated,
      message: 'Bonus approved by Management',
    } as IApiResponse<any>);
  } catch (error) {
    console.error('Management approve bonus error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to approve bonus by Management',
    } as IApiResponse<null>);
  }
};

/**
 * Mark bonus ready for payroll
 */
export const readyBonusForPayroll = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { payrollReference } = req.body;
    const { userId } = getUserInfo(req);
    const actorId = userId || (req as any).user?.id || (req as any).user?.email;

    const bonus = await prisma.bonus.findUnique({
      where: { id },
      include: bonusInclude,
    });

    if (!bonus) {
      return res.status(404).json({
        success: false,
        error: 'Bonus not found',
      } as IApiResponse<null>);
    }

    if (bonus.status !== BonusStatus.MANAGEMENT_APPROVED) {
      return res.status(400).json({
        success: false,
        error: `Cannot mark bonus ready for payroll in status: ${bonus.status}`,
      } as IApiResponse<null>);
    }

    const updated = await prisma.bonus.update({
      where: { id },
      data: {
        status: BonusStatus.READY_FOR_PAYROLL,
        readyForPayrollAt: new Date(),
        readyForPayrollBy: actorId,
        payrollReference: payrollReference || null,
      },
      include: bonusInclude,
    });

    schedulePayrollSyncForBonus(updated);

    return res.status(200).json({
      success: true,
      data: updated,
      message: 'Bonus marked as ready for payroll',
    } as IApiResponse<any>);
  } catch (error) {
    console.error('Ready bonus for payroll error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to mark bonus ready for payroll',
    } as IApiResponse<null>);
  }
};

/**
 * Apply bonus to payroll (final stage)
 */
export const applyBonusToPayroll = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { payrollReference } = req.body;
    const { userId } = getUserInfo(req);
    const actorId = userId || (req as any).user?.id || (req as any).user?.email;

    const bonus = await prisma.bonus.findUnique({
      where: { id },
      include: bonusInclude,
    });

    if (!bonus) {
      return res.status(404).json({
        success: false,
        error: 'Bonus not found',
      } as IApiResponse<null>);
    }

    if (bonus.status !== BonusStatus.READY_FOR_PAYROLL) {
      return res.status(400).json({
        success: false,
        error: `Cannot apply bonus to payroll in status: ${bonus.status}`,
      } as IApiResponse<null>);
    }

    const updated = await prisma.bonus.update({
      where: { id },
      data: {
        status: BonusStatus.APPLIED_TO_PAYROLL,
        appliedToPayrollAt: new Date(),
        appliedToPayrollBy: actorId,
        payrollReference: payrollReference || bonus.payrollReference,
      },
      include: bonusInclude,
    });

    schedulePayrollSyncForBonus(updated);

    return res.status(200).json({
      success: true,
      data: updated,
      message: 'Bonus applied to payroll',
    } as IApiResponse<any>);
  } catch (error) {
    console.error('Apply bonus to payroll error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to apply bonus to payroll',
    } as IApiResponse<null>);
  }
};

/**
 * Put bonus on hold
 */
export const putBonusOnHold = async (req: Request, res: Response): Promise<Response | void> => {
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

    const bonus = await prisma.bonus.findUnique({
      where: { id },
      include: bonusInclude,
    });

    if (!bonus) {
      return res.status(404).json({
        success: false,
        error: 'Bonus not found',
      } as IApiResponse<null>);
    }

    if (bonus.status === BonusStatus.APPLIED_TO_PAYROLL || bonus.status === BonusStatus.REJECTED) {
      return res.status(400).json({
        success: false,
        error: `Cannot put bonus on hold in status: ${bonus.status}`,
      } as IApiResponse<null>);
    }

    const updated = await prisma.bonus.update({
      where: { id },
      data: {
        status: BonusStatus.ON_HOLD,
        onHoldAt: new Date(),
        onHoldBy: actorId,
        onHoldReason: onHoldReason.trim(),
      },
      include: bonusInclude,
    });

    schedulePayrollSyncForBonus(updated);

    return res.status(200).json({
      success: true,
      data: updated,
      message: 'Bonus placed on hold',
    } as IApiResponse<any>);
  } catch (error) {
    console.error('Put bonus on hold error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to put bonus on hold',
    } as IApiResponse<null>);
  }
};

/**
 * Reject bonus
 */
export const rejectBonus = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const { userId } = getUserInfo(req);
    const actorId = userId || (req as any).user?.id || (req as any).user?.email;

    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Rejection reason is required',
      } as IApiResponse<null>);
    }

    const bonus = await prisma.bonus.findUnique({
      where: { id },
      include: bonusInclude,
    });

    if (!bonus) {
      return res.status(404).json({
        success: false,
        error: 'Bonus not found',
      } as IApiResponse<null>);
    }

    if (bonus.status === BonusStatus.APPLIED_TO_PAYROLL) {
      return res.status(400).json({
        success: false,
        error: 'Cannot reject a bonus that has been applied to payroll',
      } as IApiResponse<null>);
    }

    const updated = await prisma.bonus.update({
      where: { id },
      data: {
        status: BonusStatus.REJECTED,
        rejectedAt: new Date(),
        rejectedBy: actorId,
        rejectionReason: rejectionReason.trim(),
      },
      include: bonusInclude,
    });

    schedulePayrollSyncForBonus(updated);

    return res.status(200).json({
      success: true,
      data: updated,
      message: 'Bonus rejected',
    } as IApiResponse<any>);
  } catch (error) {
    console.error('Reject bonus error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to reject bonus',
    } as IApiResponse<null>);
  }
};

