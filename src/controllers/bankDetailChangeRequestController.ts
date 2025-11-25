import { Request, Response } from 'express';
import { prisma } from '../index';
import { IApiResponse, IPaginatedResponse } from '../types';
import { getUserInfo } from '../utils/ownershipValidation';
import { EmployeeRole } from '@prisma/client';

const DEFAULT_PAGE_SIZE = 10;

const BANK_DETAIL_CHANGE_STATUS = {
  PENDING_FINANCE: 'PENDING_FINANCE',
  FINANCE_APPROVED: 'FINANCE_APPROVED',
  FINANCE_REJECTED: 'FINANCE_REJECTED',
  MANAGEMENT_APPROVED: 'MANAGEMENT_APPROVED',
  MANAGEMENT_REJECTED: 'MANAGEMENT_REJECTED',
} as const;

const bankDetailChangeRequest = (prisma as any)?.bankDetailChangeRequest;
const notifyModelMissing = (res: Response): Response => {
  console.warn(
    '[BankDetailChangeRequestController] bankDetailChangeRequest model is not available on Prisma client. Make sure migrations are applied and Prisma client is regenerated.'
  );
  return res.status(501).json({
    success: false,
    error: 'Bank detail change request feature is not available. Please apply the latest database migrations and regenerate the Prisma client.',
  } as IApiResponse<null>);
};

const includeRequestRelations = {
  employee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeId: true,
      department: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  requestedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  financeReviewer: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  managementReviewer: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
};

export const createBankDetailChangeRequest = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { userId, role: rawRole } = getUserInfo(req);
    const role = rawRole as EmployeeRole;
    if (!bankDetailChangeRequest) {
      return notifyModelMissing(res);
    }
    const {
      employeeId,
      paymentMethod,
      bankName,
      accountHolderName,
      iban,
      routingNumber,
      reason,
    } = req.body;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        error: 'employeeId is required',
      } as IApiResponse<null>);
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        bankDetails: true,
      },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found',
      } as IApiResponse<null>);
    }

    if (
      role === EmployeeRole.EMPLOYEE &&
      userId !== employeeId
    ) {
      return res.status(403).json({
        success: false,
        error: 'You can only request bank detail changes for yourself',
      } as IApiResponse<null>);
    }

    const allowedRequesterRoles = new Set<EmployeeRole>([
      EmployeeRole.EMPLOYEE,
      EmployeeRole.HR,
      EmployeeRole.MANAGEMENT,
      EmployeeRole.FINANCE,
    ]);

    if (!allowedRequesterRoles.has(role)) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to request bank detail changes',
      } as IApiResponse<null>);
    }

    const newPaymentMethod = paymentMethod ?? null;
    const newBankName = bankName ?? null;
    const newAccountHolder = accountHolderName ?? null;
    const newIban = iban ?? null;
    const newRoutingNumber = routingNumber ?? null;

    if (
      !newPaymentMethod &&
      !newBankName &&
      !newAccountHolder &&
      !newIban &&
      !newRoutingNumber
    ) {
      return res.status(400).json({
        success: false,
        error: 'At least one bank detail field must be provided',
      } as IApiResponse<null>);
    }

    const existingPendingRequest = await bankDetailChangeRequest.findFirst({
      where: {
        employeeId,
        status: {
          in: [
            BANK_DETAIL_CHANGE_STATUS.PENDING_FINANCE,
            BANK_DETAIL_CHANGE_STATUS.FINANCE_APPROVED,
          ],
        },
      },
    });

    if (existingPendingRequest) {
      return res.status(409).json({
        success: false,
        error: 'There is already a bank detail change request in progress for this employee',
      } as IApiResponse<null>);
    }

    const request = await bankDetailChangeRequest.create({
      data: {
        employeeId,
        requestedById: userId,
        status: BANK_DETAIL_CHANGE_STATUS.PENDING_FINANCE,
        requestNotes: reason ?? null,
        currentPaymentMethod: employee.bankDetails?.paymentMethod ?? null,
        currentBankName: employee.bankDetails?.bankName ?? null,
        currentAccountHolder: employee.bankDetails?.accountHolderName ?? null,
        currentIban: employee.bankDetails?.iban ?? null,
        currentRoutingNumber: employee.bankDetails?.routingNumber ?? null,
        newPaymentMethod,
        newBankName,
        newAccountHolder,
        newIban,
        newRoutingNumber,
      },
      include: includeRequestRelations,
    });

    return res.status(201).json({
      success: true,
      data: request,
      message: 'Bank detail change request submitted successfully',
    } as IApiResponse<any>);
  } catch (error) {
    console.error('Error creating bank detail change request:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

export const getBankDetailChangeRequests = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { userId, role: rawRole } = getUserInfo(req);
    const role = rawRole as EmployeeRole;
    if (!bankDetailChangeRequest) {
      return notifyModelMissing(res);
    }
    const page = parseInt(req.query.page as string, 10) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string, 10) || DEFAULT_PAGE_SIZE, 50);
    const statusFilter = req.query.status as string | undefined;
    const employeeIdFilter = req.query.employeeId as string | undefined;

    const where: any = {};

    if (statusFilter) {
      where.status = statusFilter;
    }

    if (employeeIdFilter) {
      where.employeeId = employeeIdFilter;
    }

    if (role === EmployeeRole.EMPLOYEE) {
      where.OR = [
        { employeeId: userId },
        { requestedById: userId },
      ];
    }

    const skip = (page - 1) * pageSize;

    const [requests, total] = await Promise.all([
      bankDetailChangeRequest.findMany({
        where,
        include: includeRequestRelations,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: pageSize,
      }),
      bankDetailChangeRequest.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        data: requests,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      } as IPaginatedResponse<any>,
      message: 'Bank detail change requests retrieved successfully',
    } as IApiResponse<IPaginatedResponse<any>>);
  } catch (error) {
    console.error('Error fetching bank detail change requests:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

export const getBankDetailChangeRequestById = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { userId, role: rawRole } = getUserInfo(req);
    const role = rawRole as EmployeeRole;
    if (!bankDetailChangeRequest) {
      return notifyModelMissing(res);
    }
    const { id } = req.params;

    const requestRecord = await bankDetailChangeRequest.findUnique({
      where: { id },
      include: includeRequestRelations,
    });

    if (!requestRecord) {
      return res.status(404).json({
        success: false,
        error: 'Bank detail change request not found',
      } as IApiResponse<null>);
    }

    if (
      role === EmployeeRole.EMPLOYEE &&
      requestRecord.employeeId !== userId &&
      requestRecord.requestedById !== userId
    ) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to view this request',
      } as IApiResponse<null>);
    }

    return res.status(200).json({
      success: true,
      data: requestRecord,
      message: 'Bank detail change request retrieved successfully',
    } as IApiResponse<any>);
  } catch (error) {
    console.error('Error fetching bank detail change request:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

export const financeReviewBankDetailChangeRequest = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { userId, role: rawRole } = getUserInfo(req);
    const role = rawRole as EmployeeRole;
    if (!bankDetailChangeRequest) {
      return notifyModelMissing(res);
    }
    const { id } = req.params;
    const { action, notes } = req.body as { action: 'approve' | 'reject'; notes?: string };

    if (role !== EmployeeRole.FINANCE && role !== EmployeeRole.MANAGEMENT) {
      return res.status(403).json({
        success: false,
        error: 'Only Finance or Management can review bank detail change requests at this stage',
      } as IApiResponse<null>);
    }

    const requestRecord = await bankDetailChangeRequest.findUnique({
      where: { id },
    });

    if (!requestRecord) {
      return res.status(404).json({
        success: false,
        error: 'Bank detail change request not found',
      } as IApiResponse<null>);
    }

    if (requestRecord.status !== BANK_DETAIL_CHANGE_STATUS.PENDING_FINANCE) {
      return res.status(400).json({
        success: false,
        error: 'Bank detail change request is not awaiting Finance review',
      } as IApiResponse<null>);
    }

    const updatedRequest = await bankDetailChangeRequest.update({
      where: { id },
      data: {
        status:
          action === 'approve'
            ? BANK_DETAIL_CHANGE_STATUS.FINANCE_APPROVED
            : BANK_DETAIL_CHANGE_STATUS.FINANCE_REJECTED,
        financeReviewerId: userId,
        financeReviewedAt: new Date(),
        financeNotes: notes ?? null,
      },
      include: includeRequestRelations,
    });

    return res.status(200).json({
      success: true,
      data: updatedRequest,
      message: `Bank detail change request ${action === 'approve' ? 'approved' : 'rejected'} by Finance`,
    } as IApiResponse<any>);
  } catch (error) {
    console.error('Error updating bank detail change request (finance review):', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

export const managementReviewBankDetailChangeRequest = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { userId, role: rawRole } = getUserInfo(req);
    const role = rawRole as EmployeeRole;
    if (!bankDetailChangeRequest) {
      return notifyModelMissing(res);
    }
    const { id } = req.params;
    const { action, notes } = req.body as { action: 'approve' | 'reject'; notes?: string };

    if (role !== EmployeeRole.MANAGEMENT) {
      return res.status(403).json({
        success: false,
        error: 'Only Management can perform this action',
      } as IApiResponse<null>);
    }

    const requestRecord = await bankDetailChangeRequest.findUnique({
      where: { id },
    });

    if (!requestRecord) {
      return res.status(404).json({
        success: false,
        error: 'Bank detail change request not found',
      } as IApiResponse<null>);
    }

    if (requestRecord.status !== BANK_DETAIL_CHANGE_STATUS.FINANCE_APPROVED) {
      return res.status(400).json({
        success: false,
        error: 'Bank detail change request is not awaiting Management approval',
      } as IApiResponse<null>);
    }

    if (action === 'reject') {
      const updatedRequest = await bankDetailChangeRequest.update({
        where: { id },
        data: {
          status: BANK_DETAIL_CHANGE_STATUS.MANAGEMENT_REJECTED,
          managementReviewerId: userId,
          managementReviewedAt: new Date(),
          managementNotes: notes ?? null,
        },
        include: includeRequestRelations,
      });

      return res.status(200).json({
        success: true,
        data: updatedRequest,
        message: 'Bank detail change request rejected by Management',
      } as IApiResponse<any>);
    }

    const updatedRequest = await prisma.$transaction(async (tx) => {
      const appliedRequest = await (tx as any).bankDetailChangeRequest.update({
        where: { id },
        data: {
          status: BANK_DETAIL_CHANGE_STATUS.MANAGEMENT_APPROVED,
          managementReviewerId: userId,
          managementReviewedAt: new Date(),
          managementNotes: notes ?? null,
        },
        include: includeRequestRelations,
      });

      await tx.employeeBank.upsert({
        where: { employeeId: appliedRequest.employeeId },
        create: {
          employeeId: appliedRequest.employeeId,
          paymentMethod: appliedRequest.newPaymentMethod ?? '',
          bankName: appliedRequest.newBankName ?? '',
          accountHolderName: appliedRequest.newAccountHolder ?? '',
          iban: appliedRequest.newIban ?? '',
          routingNumber: appliedRequest.newRoutingNumber ?? '',
        },
        update: {
          paymentMethod: appliedRequest.newPaymentMethod ?? '',
          bankName: appliedRequest.newBankName ?? '',
          accountHolderName: appliedRequest.newAccountHolder ?? '',
          iban: appliedRequest.newIban ?? '',
          routingNumber: appliedRequest.newRoutingNumber ?? '',
        },
      });

      return appliedRequest;
    });

    return res.status(200).json({
      success: true,
      data: updatedRequest,
      message: 'Bank detail change request approved by Management and applied successfully',
    } as IApiResponse<any>);
  } catch (error) {
    console.error('Error updating bank detail change request (management review):', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

