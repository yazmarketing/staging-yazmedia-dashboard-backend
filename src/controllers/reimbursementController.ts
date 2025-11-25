import { Request, Response } from 'express';
import { ReimbursementStatus } from '@prisma/client';
import { prisma } from '../index';
import { getUserInfo, buildOwnershipFilter } from '../utils/ownershipValidation';
import { schedulePayrollSyncForReimbursement } from '../services/payrollSyncService';

const reimbursementInclude = {
  employee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      employeeId: true,
      designation: true,
    },
  },
  reimbursementType: true,
};

/**
 * Submit a new reimbursement claim
 * POST /reimbursements
 */
export const submitReimbursement = async (req: Request, res: Response) => {
  try {
    const { employeeId: bodyEmployeeId, amount, reimbursementTypeId, description, receiptUrl, expenseDate } = req.body;
    const { userId, role } = getUserInfo(req);
    
    // Use employeeId from body if provided (for HR/Management), otherwise use logged-in user's ID
    // HR, MANAGEMENT, and FINANCE can submit for other employees
    const canSubmitForOthers = ['HR', 'MANAGEMENT', 'FINANCE'].includes(role);
    const employeeId = (canSubmitForOthers && bodyEmployeeId) ? bodyEmployeeId : userId;

    // Validate required fields
    if (!amount || !reimbursementTypeId || !description || !expenseDate || !employeeId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: amount, reimbursementTypeId, description, expenseDate, employeeId',
      });
    }

    // Validate amount
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0',
      });
    }

    // Check if reimbursement type exists and is active
    const reimbursementType = await (prisma as any).reimbursementType.findUnique({
      where: { id: reimbursementTypeId },
    });

    if (!reimbursementType) {
      return res.status(404).json({
        success: false,
        message: 'Reimbursement type not found',
      });
    }

    if (!reimbursementType.isActive) {
      return res.status(400).json({
        success: false,
        message: 'This reimbursement type is no longer available',
      });
    }

    // Create reimbursement
    const reimbursement = await prisma.reimbursement.create({
      data: {
        employeeId,
        reimbursementTypeId,
        amount,
        description,
        receiptUrl: receiptUrl || null,
        expenseDate: new Date(expenseDate),
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeId: true,
            designation: true,
          },
        },
        reimbursementType: true,
      },
    });

    return res.status(201).json({
      success: true,
      data: reimbursement,
      message: 'Reimbursement claim submitted successfully',
    });
  } catch (error) {
    console.error('Error submitting reimbursement:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit reimbursement claim',
    });
  }
};

/**
 * Get all reimbursement claims with filters
 * GET /reimbursements
 */
export const getReimbursements = async (req: Request, res: Response) => {
  try {
    const { userId, role } = getUserInfo(req);
    const { page = 1, pageSize = 10, status, employeeId, reimbursementTypeId, startDate, endDate, month, year } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const pageSizeNum = parseInt(pageSize as string) || 10;
    const skip = (pageNum - 1) * pageSizeNum;

    // Build filter
    const where: any = {};

    // RBAC: EMPLOYEE can only see their own reimbursements
    const ownershipFilter = buildOwnershipFilter(userId, role, 'employeeId');
    if (Object.keys(ownershipFilter).length > 0) {
      where.employeeId = ownershipFilter.employeeId;
    } else if (employeeId) {
      // Privileged roles can filter by employeeId if provided
      where.employeeId = employeeId;
    }

    if (status) {
      where.status = status;
    }

    if (reimbursementTypeId) {
      where.reimbursementTypeId = reimbursementTypeId;
    }

    // Filter by expense date (month/year) or startDate/endDate
    if (month && year) {
      const monthNum = parseInt(month as string);
      const yearNum = parseInt(year as string);
      if (!isNaN(monthNum) && !isNaN(yearNum) && monthNum >= 1 && monthNum <= 12 && yearNum > 0) {
        const startOfMonth = new Date(yearNum, monthNum - 1, 1);
        // Get last day of the selected month (monthNum + 1 gives the next month, 0 gives last day of previous)
        const endOfMonth = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);
        where.expenseDate = {
          gte: startOfMonth,
          lte: endOfMonth,
        };
      }
    } else if (startDate || endDate) {
      where.expenseDate = {};
      if (startDate) {
        where.expenseDate.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.expenseDate.lte = new Date(endDate as string);
      }
    }

    // Get total count
    const total = await prisma.reimbursement.count({ where });

    // Get reimbursements
    const reimbursements = await prisma.reimbursement.findMany({
      where,
      include: reimbursementInclude,
      orderBy: { expenseDate: 'desc' },
      skip,
      take: pageSizeNum,
    });

    res.json({
      success: true,
      data: {
        reimbursements,
        pagination: {
          page: pageNum,
          pageSize: pageSizeNum,
          total,
          pages: Math.ceil(total / pageSizeNum),
        },
      },
      message: 'Reimbursement claims retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching reimbursements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reimbursement claims',
    });
  }
};

/**
 * Finance approval (Stage 1) - PENDING/ON_HOLD -> FINANCE_APPROVED
 * POST /reimbursements/:id/finance-approve
 */
export const financeApproveReimbursement = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = getUserInfo(req);
    const approverId = userId || (req as any).user?.id || (req as any).user?.email;

    const reimbursement = await prisma.reimbursement.findUnique({
      where: { id },
      include: reimbursementInclude,
    });

    if (!reimbursement) {
      return res.status(404).json({
        success: false,
        message: 'Reimbursement claim not found',
      });
    }

    const financeApprovableStatuses: ReimbursementStatus[] = [
      ReimbursementStatus.PENDING,
      ReimbursementStatus.ON_HOLD,
    ];

    if (!financeApprovableStatuses.includes(reimbursement.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot finance-approve reimbursement in status: ${reimbursement.status}`,
      });
    }

    const updated = await prisma.reimbursement.update({
      where: { id },
      data: {
        status: ReimbursementStatus.FINANCE_APPROVED,
        financeApprovedAt: new Date(),
        financeApprovedBy: approverId,
        onHoldAt: null,
        onHoldBy: null,
        onHoldReason: null,
      },
      include: reimbursementInclude,
    });

    schedulePayrollSyncForReimbursement(updated);

    return res.status(200).json({
      success: true,
      data: updated,
      message: 'Reimbursement approved by Finance',
    });
  } catch (error) {
    console.error('Finance approve reimbursement error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to approve reimbursement',
    });
  }
};

/**
 * Management approval (Stage 2) - FINANCE_APPROVED -> MANAGEMENT_APPROVED
 * POST /reimbursements/:id/management-approve
 */
export const managementApproveReimbursement = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = getUserInfo(req);
    const approverId = userId || (req as any).user?.id || (req as any).user?.email;

    const reimbursement = await prisma.reimbursement.findUnique({
      where: { id },
      include: reimbursementInclude,
    });

    if (!reimbursement) {
      return res.status(404).json({
        success: false,
        message: 'Reimbursement claim not found',
      });
    }

    if (reimbursement.status !== ReimbursementStatus.FINANCE_APPROVED) {
      return res.status(400).json({
        success: false,
        message: `Cannot management-approve reimbursement in status: ${reimbursement.status}`,
      });
    }

    const updated = await prisma.reimbursement.update({
      where: { id },
      data: {
        status: ReimbursementStatus.MANAGEMENT_APPROVED,
        managementApprovedAt: new Date(),
        managementApprovedBy: approverId,
      },
      include: reimbursementInclude,
    });

    schedulePayrollSyncForReimbursement(updated);

    return res.status(200).json({
      success: true,
      data: updated,
      message: 'Reimbursement approved by Management',
    });
  } catch (error) {
    console.error('Management approve reimbursement error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to approve reimbursement by Management',
    });
  }
};

/**
 * Upload to bank / ready for payment (Stage 3)
 * POST /reimbursements/:id/upload-to-bank
 */
export const uploadReimbursementToBank = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { bankUploadReference } = req.body;
    const { userId } = getUserInfo(req);
    const actorId = userId || (req as any).user?.id || (req as any).user?.email;

    const reimbursement = await prisma.reimbursement.findUnique({
      where: { id },
      include: reimbursementInclude,
    });

    if (!reimbursement) {
      return res.status(404).json({
        success: false,
        message: 'Reimbursement claim not found',
      });
    }

    if (reimbursement.status !== ReimbursementStatus.MANAGEMENT_APPROVED) {
      return res.status(400).json({
        success: false,
        message: `Cannot mark reimbursement ready for payment in status: ${reimbursement.status}`,
      });
    }

    const updated = await prisma.reimbursement.update({
      where: { id },
      data: {
        status: ReimbursementStatus.UPLOADED_TO_BANK,
        uploadedToBankAt: new Date(),
        uploadedToBankBy: actorId,
        bankUploadReference: bankUploadReference || null,
      },
      include: reimbursementInclude,
    });

    schedulePayrollSyncForReimbursement(updated);

    return res.status(200).json({
      success: true,
      data: updated,
      message: 'Reimbursement marked as uploaded to bank',
    });
  } catch (error) {
    console.error('Upload reimbursement to bank error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark reimbursement as uploaded to bank',
    });
  }
};

/**
 * Approve payment / mark as paid (Stage 4)
 * POST /reimbursements/:id/mark-paid
 */
export const markReimbursementPaid = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { paymentReference } = req.body;
    const { userId } = getUserInfo(req);
    const actorId = userId || (req as any).user?.id || (req as any).user?.email;

    const reimbursement = await prisma.reimbursement.findUnique({
      where: { id },
      include: reimbursementInclude,
    });

    if (!reimbursement) {
      return res.status(404).json({
        success: false,
        message: 'Reimbursement claim not found',
      });
    }

    if (reimbursement.status !== ReimbursementStatus.UPLOADED_TO_BANK) {
      return res.status(400).json({
        success: false,
        message: `Cannot mark reimbursement paid in status: ${reimbursement.status}`,
      });
    }

    const now = new Date();

    const updated = await prisma.reimbursement.update({
      where: { id },
      data: {
        status: ReimbursementStatus.PAID,
        bankPaymentApprovedAt: now,
        bankPaymentApprovedBy: actorId,
        bankPaymentReference: paymentReference || null,
        paidDate: now,
      },
      include: reimbursementInclude,
    });

    schedulePayrollSyncForReimbursement(updated);

    return res.status(200).json({
      success: true,
      data: updated,
      message: 'Reimbursement marked as paid',
    });
  } catch (error) {
    console.error('Mark reimbursement paid error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark reimbursement as paid',
    });
  }
};

/**
 * Put reimbursement on hold
 * POST /reimbursements/:id/on-hold
 */
export const putReimbursementOnHold = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { onHoldReason } = req.body;
    const { userId } = getUserInfo(req);
    const actorId = userId || (req as any).user?.id || (req as any).user?.email;

    if (!onHoldReason || !onHoldReason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'On hold reason is required',
      });
    }

    const reimbursement = await prisma.reimbursement.findUnique({
      where: { id },
      include: reimbursementInclude,
    });

    if (!reimbursement) {
      return res.status(404).json({
        success: false,
        message: 'Reimbursement claim not found',
      });
    }

    if (reimbursement.status === ReimbursementStatus.PAID || reimbursement.status === ReimbursementStatus.REJECTED) {
      return res.status(400).json({
        success: false,
        message: `Cannot put reimbursement on hold in status: ${reimbursement.status}`,
      });
    }

    const updated = await prisma.reimbursement.update({
      where: { id },
      data: {
        status: ReimbursementStatus.ON_HOLD,
        onHoldAt: new Date(),
        onHoldBy: actorId,
        onHoldReason: onHoldReason.trim(),
      },
      include: reimbursementInclude,
    });

    schedulePayrollSyncForReimbursement(updated);

    return res.status(200).json({
      success: true,
      data: updated,
      message: 'Reimbursement placed on hold',
    });
  } catch (error) {
    console.error('Put reimbursement on hold error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to put reimbursement on hold',
    });
  }
};

/**
 * Reject reimbursement (available until paid)
 * POST /reimbursements/:id/reject
 */
export const rejectReimbursement = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const { userId } = getUserInfo(req);
    const actorId = userId || (req as any).user?.id || (req as any).user?.email;

    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required',
      });
    }

    const reimbursement = await prisma.reimbursement.findUnique({
      where: { id },
      include: reimbursementInclude,
    });

    if (!reimbursement) {
      return res.status(404).json({
        success: false,
        message: 'Reimbursement claim not found',
      });
    }

    if (reimbursement.status === ReimbursementStatus.PAID) {
      return res.status(400).json({
        success: false,
        message: 'Cannot reject a reimbursement that has been paid',
      });
    }

    const updated = await prisma.reimbursement.update({
      where: { id },
      data: {
        status: ReimbursementStatus.REJECTED,
        rejectedAt: new Date(),
        rejectedBy: actorId,
        rejectionReason: rejectionReason.trim(),
      },
      include: reimbursementInclude,
    });

    schedulePayrollSyncForReimbursement(updated);

    return res.status(200).json({
      success: true,
      data: updated,
      message: 'Reimbursement claim rejected',
    });
  } catch (error) {
    console.error('Reject reimbursement error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reject reimbursement claim',
    });
  }
};

