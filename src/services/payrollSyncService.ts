import { BonusStatus, DeductionStatus, Prisma, PayrollStatus, ReimbursementStatus } from '@prisma/client';
import { prisma } from '../index';
import {
  APPROVED_BONUS_STATUSES,
  APPROVED_DEDUCTION_STATUSES,
  APPROVED_REIMBURSEMENT_STATUSES,
  BONUS_AFFECTING_STATUSES,
  DEDUCTION_AFFECTING_STATUSES,
  LOCKED_PAYROLL_STATUSES,
  REIMBURSEMENT_AFFECTING_STATUSES,
} from './payrollStatusUtils';
import {
  calculateAccuratePayroll,
  calculateNetPayroll,
  calculateTotalAdjustments,
  calculateTotalDeductions,
} from '../utils/payrollCalculator';
import { buildDetailedPayrollResponse, buildProrationDetails } from './payrollResponseService';
import { getIO } from '../websocket/attendanceSocket';

export type PayrollSyncTrigger = 'manual' | 'bonus' | 'reimbursement' | 'deduction' | 'salary-change';

interface PayrollSyncMeta {
  type: PayrollSyncTrigger;
  recordId?: string;
  note?: string;
}

interface ScheduleOptions {
  month?: number;
  year?: number;
  allowCreate?: boolean;
  forceRegenerate?: boolean;
  emitEvent?: boolean;
  meta?: PayrollSyncMeta;
}

interface PendingSyncEntry {
  timer: NodeJS.Timeout;
  metas: PayrollSyncMeta[];
  options: Omit<ScheduleOptions, 'meta'>;
}

export interface PayrollSyncResult {
  status: 'created' | 'updated' | 'skipped';
  payroll?: any;
  reason?: string;
  meta?: PayrollSyncMeta[];
  month: number;
  year: number;
}

const SYNC_DELAY_MS = 1500;
const pendingSyncs = new Map<string, PendingSyncEntry>();

const normalizeMonthYear = (year?: number, month?: number) => {
  const now = new Date();
  const targetYear = year ?? now.getFullYear();
  const targetMonth = month ?? now.getMonth() + 1;
  return { targetYear, targetMonth };
};

const emitPayrollUpdate = (payload: any) => {
  try {
    const io = getIO();
    if (!io) {
      return;
    }

    io.to('finance-dashboard').emit('finance:payroll:update', payload);
  } catch (error) {
    console.error('Failed to emit payroll update event:', error);
  }
};

const collectMeta = (entry: PendingSyncEntry | undefined, meta?: PayrollSyncMeta) => {
  const metas = entry ? [...entry.metas] : [];
  if (meta) {
    metas.push(meta);
  }
  return metas;
};

const createOrUpdatePayroll = async (
  employeeId: string,
  month: number,
  year: number,
  options: Omit<ScheduleOptions, 'month' | 'year' | 'meta'>,
  metas: PayrollSyncMeta[]
): Promise<PayrollSyncResult> => {
  const allowCreate = options.allowCreate !== false;
  const forceRegenerate = options.forceRegenerate === true;

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
  });

  if (!employee) {
    return {
      status: 'skipped',
      reason: 'EMPLOYEE_NOT_FOUND',
      meta: metas,
      month,
      year,
    };
  }

  let existingPayroll = await prisma.payroll.findFirst({
    where: { employeeId, month, year },
  });

  if (existingPayroll && LOCKED_PAYROLL_STATUSES.includes(existingPayroll.status as PayrollStatus)) {
    return {
      status: 'skipped',
      reason: 'PAYROLL_LOCKED',
      payroll: existingPayroll,
      meta: metas,
      month,
      year,
    };
  }

  if (existingPayroll && forceRegenerate) {
    await prisma.payroll.delete({ where: { id: existingPayroll.id } });
    existingPayroll = null;
  }

  if (!existingPayroll && !allowCreate) {
    return {
      status: 'skipped',
      reason: 'CREATION_DISABLED',
      meta: metas,
      month,
      year,
    };
  }

  const accuratePayroll = await calculateAccuratePayroll(prisma, employee, year, month);
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

  const [
    overtimes,
    reimbursements,
    bonuses,
    deductions,
  ] = await Promise.all([
    prisma.overtime.findMany({
      where: {
        employeeId,
        status: 'APPROVED',
        date: {
          gte: startOfMonth,
          lt: new Date(year, month, 1),
        },
      },
    }),
    prisma.reimbursement.findMany({
      where: {
        employeeId,
        status: { in: APPROVED_REIMBURSEMENT_STATUSES },
        createdAt: {
          gte: startOfMonth,
          lt: new Date(year, month, 1),
        },
      },
    }),
    prisma.bonus.findMany({
      where: {
        employeeId,
        status: { in: APPROVED_BONUS_STATUSES },
        bonusDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    }),
    prisma.deduction.findMany({
      where: {
        employeeId,
        status: { in: APPROVED_DEDUCTION_STATUSES },
        deductionDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    }),
  ]);

  const totalOvertime = overtimes.reduce((sum, ot) => sum + (ot.amount || 0), 0);
  const totalReimbursements = reimbursements.reduce((sum, reimbursement) => sum + (reimbursement.amount || 0), 0);
  const totalBonuses = bonuses.reduce((sum, bonus) => sum + (bonus.amount || 0), 0);
  const totalDeductions = deductions.reduce((sum, deduction) => sum + (deduction.amount || 0), 0);

  const allowances = calculateTotalAdjustments(totalOvertime, totalReimbursements, totalBonuses);
  const totalDeductionsAmount = calculateTotalDeductions(totalDeductions, 0);
  const netSalary = calculateNetPayroll(
    accuratePayroll.proratedTotalSalary,
    totalOvertime,
    totalReimbursements,
    totalBonuses,
    totalDeductions,
    0
  );

  let resultStatus: PayrollSyncResult['status'] = existingPayroll ? 'updated' : 'created';
  let payrollRecord;

  if (existingPayroll) {
    payrollRecord = await prisma.payroll.update({
      where: { id: existingPayroll.id },
      data: {
        baseSalary: accuratePayroll.proratedBaseSalary,
        totalSalary: accuratePayroll.proratedTotalSalary,
        allowances,
        deductions: totalDeductionsAmount,
        taxDeduction: 0,
        netSalary,
        status: PayrollStatus.PENDING,
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
        rejectedAt: null,
        rejectedBy: null,
        rejectionReason: null,
        rejectedAtStage: null,
        onHoldAt: null,
        onHoldBy: null,
        onHoldReason: null,
        onHoldHistory: Prisma.JsonNull,
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
            baseSalary: true,
            telephoneAllowance: true,
            housingAllowance: true,
            transportationAllowance: true,
            totalSalary: true,
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
  } else {
    payrollRecord = await prisma.payroll.create({
      data: {
        employeeId,
        month,
        year,
        status: PayrollStatus.PENDING,
        baseSalary: accuratePayroll.proratedBaseSalary,
        totalSalary: accuratePayroll.proratedTotalSalary,
        allowances,
        deductions: totalDeductionsAmount,
        taxDeduction: 0,
        netSalary,
        onHoldHistory: Prisma.JsonNull,
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
            baseSalary: true,
            telephoneAllowance: true,
            housingAllowance: true,
            transportationAllowance: true,
            totalSalary: true,
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
  }

  const prorationDetails = buildProrationDetails(accuratePayroll);
  const detailedPayroll = await buildDetailedPayrollResponse(payrollRecord, {
    calculation: accuratePayroll,
    proration: prorationDetails,
  });

  const payload = {
    payroll: detailedPayroll,
    summary: {
      status: resultStatus,
      month,
      year,
    },
    meta: {
      triggers: metas,
    },
  };

  if (options.emitEvent !== false) {
    emitPayrollUpdate(payload);
  }

  return {
    status: resultStatus,
    payroll: detailedPayroll,
    meta: metas,
    month,
    year,
  };
};

export const runPayrollSync = async (
  employeeId: string,
  options: ScheduleOptions = {}
): Promise<PayrollSyncResult> => {
  const { targetYear, targetMonth } = normalizeMonthYear(options.year, options.month);
  const metas = options.meta ? [options.meta] : [];
  return createOrUpdatePayroll(employeeId, targetMonth, targetYear, options, metas);
};

export const schedulePayrollSync = (
  employeeId: string,
  options: ScheduleOptions = {}
) => {
  const { targetYear, targetMonth } = normalizeMonthYear(options.year, options.month);
  const key = `${employeeId}:${targetYear}:${targetMonth}`;
  const currentEntry = pendingSyncs.get(key);
  const metas = collectMeta(currentEntry, options.meta);
  const baseOptions: Omit<ScheduleOptions, 'meta'> = {
    allowCreate: options.allowCreate,
    forceRegenerate: options.forceRegenerate,
    emitEvent: options.emitEvent,
  };

  if (currentEntry) {
    clearTimeout(currentEntry.timer);
  }

  const timer = setTimeout(async () => {
    pendingSyncs.delete(key);
    try {
      await createOrUpdatePayroll(employeeId, targetMonth, targetYear, baseOptions, metas);
    } catch (error) {
      console.error('Payroll sync error:', { employeeId, targetMonth, targetYear, error });
    }
  }, SYNC_DELAY_MS);

  pendingSyncs.set(key, {
    timer,
    metas,
    options: baseOptions,
  });
};

export const schedulePayrollSyncForBonus = (bonus: any, trigger: PayrollSyncTrigger = 'bonus') => {
  if (!BONUS_AFFECTING_STATUSES.has(bonus.status)) {
    // If the new status no longer affects payroll (e.g., rejected/on hold), still resync to remove
    if (![BonusStatus.ON_HOLD, BonusStatus.REJECTED].includes(bonus.status)) {
      return;
    }
  }

  const bonusDate = new Date(bonus.bonusDate);
  schedulePayrollSync(bonus.employeeId, {
    month: bonusDate.getMonth() + 1,
    year: bonusDate.getFullYear(),
    allowCreate: true,
    meta: {
      type: trigger,
      recordId: bonus.id,
    },
  });
};

export const schedulePayrollSyncForReimbursement = (reimbursement: any, trigger: PayrollSyncTrigger = 'reimbursement') => {
  if (!REIMBURSEMENT_AFFECTING_STATUSES.has(reimbursement.status)) {
    if (![ReimbursementStatus.ON_HOLD, ReimbursementStatus.REJECTED].includes(reimbursement.status)) {
      return;
    }
  }

  const createdDate = new Date(reimbursement.createdAt || Date.now());
  schedulePayrollSync(reimbursement.employeeId, {
    month: createdDate.getMonth() + 1,
    year: createdDate.getFullYear(),
    allowCreate: true,
    meta: {
      type: trigger,
      recordId: reimbursement.id,
    },
  });
};

export const schedulePayrollSyncForDeduction = (deduction: any, trigger: PayrollSyncTrigger = 'deduction') => {
  if (!DEDUCTION_AFFECTING_STATUSES.has(deduction.status)) {
    if (![DeductionStatus.ON_HOLD, DeductionStatus.REJECTED].includes(deduction.status)) {
      return;
    }
  }

  const deductionDate = new Date(deduction.deductionDate);
  schedulePayrollSync(deduction.employeeId, {
    month: deductionDate.getMonth() + 1,
    year: deductionDate.getFullYear(),
    allowCreate: true,
    meta: {
      type: trigger,
      recordId: deduction.id,
    },
  });
};
