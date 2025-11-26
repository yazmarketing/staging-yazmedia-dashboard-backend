import { Request, Response } from 'express';
import { prisma } from '../index';
import { PayrollStatus } from '@prisma/client';
import { IApiResponse } from '../types';
import {
  calculateAccuratePayroll,
} from '../utils/payrollCalculator';
import { buildOwnershipFilter, getUserInfo } from '../utils/ownershipValidation';
import { runPayrollSync } from '../services/payrollSyncService';
import { buildDetailedPayrollResponse, buildProrationDetails } from '../services/payrollResponseService';

/**
 * Get all payroll records with filters and pagination
 * GET /payroll
 * Query: page, pageSize, status, employeeId, month, year
 */
export const getPayroll = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { userId, role } = getUserInfo(req);
    const {
      page = 1,
      pageSize = 10,
      status,
      employeeId,
      month,
      year,
      search,
    } = req.query;

    const skip = (Number(page) - 1) * Number(pageSize);
    const where: any = {};

    // RBAC: EMPLOYEE can only see their own payroll
    const ownershipFilter = buildOwnershipFilter(userId, role, 'employeeId');
    if (Object.keys(ownershipFilter).length > 0) {
      where.employeeId = ownershipFilter.employeeId;
    } else if (employeeId) {
      // Privileged roles can filter by employeeId if provided
      where.employeeId = employeeId;
    }

    if (status) where.status = status;
    if (month) where.month = Number(month);
    if (year) where.year = Number(year);

    // Build search filter for employee name
    let employeeSearchFilter: any = {};
    if (search && typeof search === 'string' && search.trim()) {
      const searchTerm = search.trim();
      employeeSearchFilter = {
        OR: [
          { firstName: { contains: searchTerm, mode: 'insensitive' as const } },
          { lastName: { contains: searchTerm, mode: 'insensitive' as const } },
          { 
            AND: [
              { firstName: { contains: searchTerm.split(' ')[0], mode: 'insensitive' as const } },
              { lastName: { contains: searchTerm.split(' ')[1] || '', mode: 'insensitive' as const } }
            ]
          }
        ]
      };
    }

    const payroll = await prisma.payroll.findMany({
      where: {
        ...where,
        ...(Object.keys(employeeSearchFilter).length > 0 && {
          employee: employeeSearchFilter
        })
      },
      skip,
      take: Number(pageSize),
      select: {
        id: true,
        employeeId: true,
        month: true,
        year: true,
        baseSalary: true,
        totalSalary: true,
        allowances: true,
        deductions: true,
        taxDeduction: true,
        netSalary: true,
        status: true,
        paidDate: true,
        // Approval tracking fields - explicitly select all
        financeApprovedAt: true,
        financeApprovedBy: true,
        managementApprovedAt: true,
        managementApprovedBy: true,
        uploadedToBankAt: true,
        uploadedToBankBy: true,
        bankUploadReference: true,
        bankPaymentApprovedAt: true,
        bankPaymentApprovedBy: true,
        bankPaymentReference: true,
        rejectedAt: true,
        rejectedBy: true,
        rejectionReason: true,
        rejectedAtStage: true,
        onHoldAt: true,
        onHoldBy: true,
        onHoldReason: true,
        onHoldHistory: true,
        createdAt: true,
        updatedAt: true,
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeId: true,
            designation: true,
            baseSalary: true,
            telephoneAllowance: true,
            housingAllowance: true,
            transportationAllowance: true,
            totalSalary: true,
            joinDate: true,
            terminationDate: true,
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    const total = await prisma.payroll.count({
      where: {
        ...where,
        ...(Object.keys(employeeSearchFilter).length > 0 && {
          employee: employeeSearchFilter
        })
      }
    });

    // Build detailed responses for each payroll
    const detailedPayroll = await Promise.all(
      payroll.map(async (p) => {
        const employeeForCalculation = {
          ...p.employee,
          id: p.employeeId,
          joinDate: p.employee?.joinDate,
          terminationDate: p.employee?.terminationDate,
        };

        const calculation = await calculateAccuratePayroll(prisma, employeeForCalculation, p.year, p.month);
        const proration = buildProrationDetails(calculation);

        return buildDetailedPayrollResponse(p, {
          calculation,
          proration,
        });
      })
    );

    const response: IApiResponse<any> = {
      success: true,
      data: {
        payroll: detailedPayroll,
        pagination: {
          page: Number(page),
          pageSize: Number(pageSize),
          total,
          totalPages: Math.ceil(total / Number(pageSize)),
        },
      },
      message: 'Payroll records retrieved successfully',
    };

    return res.status(200).json(response);
  } catch (error: any) {
    console.error('Get payroll error:', error);
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    });
    return res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? {
        code: error?.code,
        meta: error?.meta,
      } : undefined,
    } as IApiResponse<null>);
  }
};

/**
 * Get single payroll record by ID
 * GET /payroll/:id
 */
export const getPayrollById = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;

    const payroll = await prisma.payroll.findUnique({
      where: { id },
      select: {
        id: true,
        employeeId: true,
        month: true,
        year: true,
        baseSalary: true,
        totalSalary: true,
        allowances: true,
        deductions: true,
        taxDeduction: true,
        netSalary: true,
        status: true,
        paidDate: true,
        // Approval tracking fields
        financeApprovedAt: true,
        financeApprovedBy: true,
        managementApprovedAt: true,
        managementApprovedBy: true,
        uploadedToBankAt: true,
        uploadedToBankBy: true,
        bankUploadReference: true,
        bankPaymentApprovedAt: true,
        bankPaymentApprovedBy: true,
        bankPaymentReference: true,
        rejectedAt: true,
        rejectedBy: true,
        rejectionReason: true,
        rejectedAtStage: true,
        onHoldAt: true,
        onHoldBy: true,
        onHoldReason: true,
        onHoldHistory: true,
        createdAt: true,
        updatedAt: true,
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeId: true,
            designation: true,
            baseSalary: true,
            telephoneAllowance: true,
            housingAllowance: true,
            transportationAllowance: true,
            totalSalary: true,
            joinDate: true,
            terminationDate: true,
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

    if (!payroll) {
      return res.status(404).json({
        success: false,
        error: 'Payroll record not found',
      } as IApiResponse<null>);
    }

    const employeeForCalculation = {
      ...payroll.employee,
      id: payroll.employeeId,
      joinDate: payroll.employee?.joinDate,
      terminationDate: payroll.employee?.terminationDate,
    };

    const calculation = await calculateAccuratePayroll(prisma, employeeForCalculation, payroll.year, payroll.month);
    const proration = buildProrationDetails(calculation);

    const detailedPayroll = await buildDetailedPayrollResponse(payroll, {
      calculation,
      proration,
    });

    const response: IApiResponse<any> = {
      success: true,
      data: detailedPayroll,
      message: 'Payroll record retrieved successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Get payroll by ID error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Generate payroll for a specific month
 * POST /payroll/generate
 * Body: { month, year, employeeIds?, forceRegenerate? }
 */
export const generatePayroll = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { month, year, employeeIds, forceRegenerate = false } = req.body;

    if (!month || !year) {
      return res.status(400).json({
        success: false,
        error: 'Month and year are required',
      } as IApiResponse<null>);
    }

    if (month < 1 || month > 12) {
      return res.status(400).json({
        success: false,
        error: 'Month must be between 1 and 12',
      } as IApiResponse<null>);
    }

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const where: any = {
      OR: [
        {
          status: 'ACTIVE',
          userStatus: 'ACTIVE',
        },
        {
          status: { in: ['TERMINATED', 'EXPIRED'] },
          terminationDate: {
            gte: monthStart,
          },
        },
      ],
      joinDate: {
        lte: monthEnd,
      },
    };

    if (employeeIds && Array.isArray(employeeIds) && employeeIds.length > 0) {
      where.id = { in: employeeIds };
    }

    const employees = await prisma.employee.findMany({
      where,
    });

    const createdPayrolls: any[] = [];
    const updatedPayrolls: any[] = [];
    const skippedPayrolls: any[] = [];

    for (const employee of employees) {
      try {
        const result = await runPayrollSync(employee.id, {
          month,
          year,
          allowCreate: true,
          forceRegenerate,
          meta: {
            type: 'manual',
          },
        });

        if (result.status === 'created' && result.payroll) {
          createdPayrolls.push(result.payroll);
        } else if (result.status === 'updated' && result.payroll) {
          updatedPayrolls.push(result.payroll);
        } else {
          skippedPayrolls.push({
            employeeId: employee.id,
            reason: result.reason || 'Skipped',
          });
        }
      } catch (error) {
        console.error(`Error generating payroll for employee ${employee.id}:`, error);
        skippedPayrolls.push({
          employeeId: employee.id,
          reason: `Error during payroll generation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }

    const response: IApiResponse<any> = {
      success: true,
      data: {
        created: createdPayrolls,
        updated: updatedPayrolls,
        skipped: skippedPayrolls,
        summary: {
          totalCreated: createdPayrolls.length,
          totalUpdated: updatedPayrolls.length,
          totalSkipped: skippedPayrolls.length,
          month,
          year,
        },
      },
      message: `Payroll generation tasks completed for ${month}/${year}`,
    };

    return res.status(201).json(response);
  } catch (error) {
    console.error('Generate payroll error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Finance Approval - Stage 1
 * POST /payroll/:id/finance-approve
 * Body: { approvalNotes?: string }
 * Access: FINANCE role only
 * Action: PENDING → FINANCE_APPROVED
 */
export const financeApprove = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId || (req as any).user?.id;

    const payroll = await prisma.payroll.findUnique({
      where: { id },
    });

    if (!payroll) {
      return res.status(404).json({
        success: false,
        error: 'Payroll record not found',
      } as IApiResponse<null>);
    }

    // Validate current status - can approve from PENDING or ON_HOLD
    if (payroll.status !== PayrollStatus.PENDING && payroll.status !== PayrollStatus.ON_HOLD) {
      return res.status(400).json({
        success: false,
        error: `Cannot approve payroll with status: ${payroll.status}. Expected status: PENDING or ON_HOLD`,
      } as IApiResponse<null>);
    }

    const updated = await prisma.payroll.update({
      where: { id },
      data: {
        status: PayrollStatus.FINANCE_APPROVED,
        financeApprovedAt: new Date(),
        financeApprovedBy: userId,
        // Clear onHold fields if it was on hold
        onHoldAt: null,
        onHoldBy: null,
        onHoldReason: null,
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
      message: 'Payroll approved by Finance',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Finance approve error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Management Approval - Stage 2
 * POST /payroll/:id/management-approve
 * Body: { approvalNotes?: string }
 * Access: MANAGEMENT role only
 * Action: FINANCE_APPROVED → MANAGEMENT_APPROVED
 */
export const managementApprove = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId || (req as any).user?.id;

    const payroll = await prisma.payroll.findUnique({
      where: { id },
    });

    if (!payroll) {
      return res.status(404).json({
        success: false,
        error: 'Payroll record not found',
      } as IApiResponse<null>);
    }

    // Validate current status
    if (payroll.status !== PayrollStatus.FINANCE_APPROVED) {
      return res.status(400).json({
        success: false,
        error: `Cannot approve payroll with status: ${payroll.status}. Expected status: FINANCE_APPROVED`,
      } as IApiResponse<null>);
    }

    const updated = await prisma.payroll.update({
      where: { id },
      data: {
        status: PayrollStatus.MANAGEMENT_APPROVED,
        managementApprovedAt: new Date(),
        managementApprovedBy: userId,
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
      message: 'Payroll approved by Management',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Management approve error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Upload to Bank - Stage 3
 * POST /payroll/:id/upload-to-bank
 * Body: { bankReference?: string, uploadNotes?: string }
 * Access: FINANCE role only
 * Action: MANAGEMENT_APPROVED → UPLOADED_TO_BANK
 */
export const uploadToBank = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { bankReference } = req.body;
    const userId = (req as any).user?.userId || (req as any).user?.id;

    const payroll = await prisma.payroll.findUnique({
      where: { id },
    });

    if (!payroll) {
      return res.status(404).json({
        success: false,
        error: 'Payroll record not found',
      } as IApiResponse<null>);
    }

    // Validate current status
    if (payroll.status !== PayrollStatus.MANAGEMENT_APPROVED) {
      return res.status(400).json({
        success: false,
        error: `Cannot upload to bank with status: ${payroll.status}. Expected status: MANAGEMENT_APPROVED`,
      } as IApiResponse<null>);
    }

    const updated = await prisma.payroll.update({
      where: { id },
      data: {
        status: PayrollStatus.UPLOADED_TO_BANK,
        uploadedToBankAt: new Date(),
        uploadedToBankBy: userId,
        bankUploadReference: bankReference || null,
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
      message: 'Payroll uploaded to bank',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Upload to bank error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Approve Bank Payment - Stage 4 (Final)
 * POST /payroll/:id/approve-bank-payment
 * Body: { paymentReference?: string, paymentNotes?: string }
 * Access: MANAGEMENT role only
 * Action: UPLOADED_TO_BANK → BANK_PAYMENT_APPROVED
 */
export const approveBankPayment = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { paymentReference } = req.body;
    const userId = (req as any).user?.userId || (req as any).user?.id;

    const payroll = await prisma.payroll.findUnique({
      where: { id },
    });

    if (!payroll) {
      return res.status(404).json({
        success: false,
        error: 'Payroll record not found',
      } as IApiResponse<null>);
    }

    // Validate current status
    if (payroll.status !== PayrollStatus.UPLOADED_TO_BANK) {
      return res.status(400).json({
        success: false,
        error: `Cannot approve bank payment with status: ${payroll.status}. Expected status: UPLOADED_TO_BANK`,
      } as IApiResponse<null>);
    }

    const updated = await prisma.payroll.update({
      where: { id },
      data: {
        status: PayrollStatus.BANK_PAYMENT_APPROVED,
        bankPaymentApprovedAt: new Date(),
        bankPaymentApprovedBy: userId,
        bankPaymentReference: paymentReference || null,
        paidDate: new Date(), // Set paid date when payment is confirmed
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
      message: 'Payroll marked as paid',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Approve bank payment error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Reject Payroll - Can be rejected at any stage
 * POST /payroll/:id/reject
 * Body: { rejectionReason: string }
 * Access: FINANCE, MANAGEMENT (based on current stage)
 * Action: Current Status → REJECTED
 */
export const rejectPayroll = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const { role } = getUserInfo(req);

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        error: 'Rejection reason is required',
      } as IApiResponse<null>);
    }

    const payroll = await prisma.payroll.findUnique({
      where: { id },
    });

    if (!payroll) {
      return res.status(404).json({
        success: false,
        error: 'Payroll record not found',
      } as IApiResponse<null>);
    }

    // Cannot reject completed payroll
    if (payroll.status === PayrollStatus.BANK_PAYMENT_APPROVED) {
      return res.status(400).json({
        success: false,
        error: 'Cannot reject completed payroll',
      } as IApiResponse<null>);
    }

    // Only Management can reject (Finance uses "On Hold" instead)
    if (role !== 'MANAGEMENT') {
      return res.status(403).json({
        success: false,
        error: 'Only Management can reject payroll. Finance should use "On Hold" instead.',
      } as IApiResponse<null>);
    }

    // Rejected records go back to PENDING for Finance to fix
    const updated = await prisma.payroll.update({
      where: { id },
      data: {
        status: PayrollStatus.PENDING, // Go back to PENDING for Finance to fix
        rejectedAt: new Date(),
        rejectedBy: userId,
        rejectionReason,
        rejectedAtStage: payroll.status, // Track which stage it was rejected at
        // Clear approval fields since it's going back to PENDING
        financeApprovedAt: null,
        financeApprovedBy: null,
        managementApprovedAt: null,
        managementApprovedBy: null,
        uploadedToBankAt: null,
        uploadedToBankBy: null,
        bankUploadReference: null,
        bankPaymentApprovedAt: null,
        bankPaymentApprovedBy: null,
        bankPaymentReference: null,
        onHoldAt: null,
        onHoldBy: null,
        onHoldReason: null,
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
      message: 'Payroll rejected and returned to PENDING for Finance to fix',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Reject payroll error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Put Payroll On Hold - Finance or Management can put records on hold
 * POST /payroll/:id/on-hold
 * Body: { onHoldReason: string }
 * Access: FINANCE, MANAGEMENT roles
 * Action: Any status except BANK_PAYMENT_APPROVED → ON_HOLD
 */
export const putOnHold = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { onHoldReason } = req.body;
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const { role } = getUserInfo(req);

    if (!onHoldReason || !onHoldReason.trim()) {
      return res.status(400).json({
        success: false,
        error: 'On hold reason is required',
      } as IApiResponse<null>);
    }

    // Only Finance and Management can put records on hold
    if (role !== 'FINANCE' && role !== 'MANAGEMENT') {
      return res.status(403).json({
        success: false,
        error: 'Only Finance or Management can put payroll on hold',
      } as IApiResponse<null>);
    }

    const payroll = await prisma.payroll.findUnique({
      where: { id },
    });

    if (!payroll) {
      return res.status(404).json({
        success: false,
        error: 'Payroll record not found',
      } as IApiResponse<null>);
    }

    // Cannot put completed payroll on hold
    if (payroll.status === PayrollStatus.BANK_PAYMENT_APPROVED) {
      return res.status(400).json({
        success: false,
        error: 'Cannot put completed payroll on hold',
      } as IApiResponse<null>);
    }

    // Get existing hold history or initialize empty array
    const existingHistory = (payroll.onHoldHistory as any[]) || [];
    const newHoldEntry = {
      at: new Date().toISOString(),
      by: userId,
      reason: onHoldReason.trim(),
    };
    const updatedHistory = [...existingHistory, newHoldEntry];

    const updated = await prisma.payroll.update({
      where: { id },
      data: {
        status: PayrollStatus.ON_HOLD,
        onHoldAt: new Date(),
        onHoldBy: userId,
        onHoldReason: onHoldReason.trim(),
        onHoldHistory: updatedHistory,
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
      message: 'Payroll put on hold',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Put on hold error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

