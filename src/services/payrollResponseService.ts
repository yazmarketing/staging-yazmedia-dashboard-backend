import { prisma } from '../index';
import { APPROVED_BONUS_STATUSES, APPROVED_DEDUCTION_STATUSES, APPROVED_REIMBURSEMENT_STATUSES } from './payrollStatusUtils';
import { AccuratePayrollCalculation } from '../utils/payrollCalculator';

const getMonthBounds = (year: number, month: number) => {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
};

export interface ProrationDetails {
  isProrated: boolean;
  reasons: string[];
  summary: string;
  proratedTotalSalary: number;
  originalTotalSalary: number;
  prorataFactor: number;
  calendarDaysInMonth: number;
  calendarDaysWorked: number;
}

export const buildProrationDetails = (
  calculation: AccuratePayrollCalculation
): ProrationDetails => {
  const breakdown = calculation.calculationBreakdown || {};
  const reasons: string[] = [];

  if (breakdown.joinedMidMonth) {
    reasons.push('Joined mid-month');
  }
  if (breakdown.terminatedMidMonth) {
    reasons.push('Terminated mid-month');
  }
  if (breakdown.salaryChangedMidMonth) {
    reasons.push('Salary changed within the month');
  }
  if (breakdown.hasUnpaidLeave) {
    reasons.push('Unpaid leave taken during the month');
  }

  const originalRounded = Math.round(calculation.totalSalary * 100);
  const proratedRounded = Math.round(calculation.proratedTotalSalary * 100);
  const isProrated = originalRounded !== proratedRounded;

  if (isProrated && reasons.length === 0) {
    reasons.push('Worked partial month based on calendar days');
  }

  const originalTotal = calculation.totalSalary;
  const proratedTotal = calculation.proratedTotalSalary;
  const ratio =
    originalTotal > 0 ? Math.round((proratedTotal / originalTotal) * 10000) / 100 : 100;
  const percentage = ratio.toFixed(2);
  const calendarPortion = `${calculation.calendarDaysWorked}/${calculation.calendarDaysInMonth} calendar days`;

  let summary: string;
  if (!isProrated) {
    if (reasons.length > 0) {
      summary = `Prorated using multiple salary periods (${calendarPortion})`;
    } else {
      summary = 'Full month salary';
    }
  } else {
    summary = `Prorated to ${percentage}% of original salary (${calendarPortion})`;
  }

  return {
    isProrated,
    reasons,
    summary,
    proratedTotalSalary: calculation.proratedTotalSalary,
    originalTotalSalary: calculation.totalSalary,
    prorataFactor: calculation.prorataFactor,
    calendarDaysInMonth: calculation.calendarDaysInMonth,
    calendarDaysWorked: calculation.calendarDaysWorked,
  };
};

export const buildDetailedPayrollResponse = async (
  payroll: any,
  options: {
    calculation?: AccuratePayrollCalculation;
    proration?: ProrationDetails;
  } = {}
) => {
  try {
    const { start: startOfMonth, end: endOfMonth } = getMonthBounds(payroll.year, payroll.month);

    const [overtimes, bonuses, reimbursements, deductions] = await Promise.all([
      prisma.overtime.findMany({
        where: {
          employeeId: payroll.employeeId,
          status: 'APPROVED',
          date: {
            gte: startOfMonth,
            lt: new Date(payroll.year, payroll.month, 1),
          },
        },
        select: {
          id: true,
          amount: true,
          hoursWorked: true,
          overtimeHours: true,
          rate: true,
        },
      }),
      prisma.bonus.findMany({
        where: {
          employeeId: payroll.employeeId,
          status: { in: APPROVED_BONUS_STATUSES },
          bonusDate: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        select: {
          id: true,
          amount: true,
          reason: true,
        },
      }),
      prisma.reimbursement.findMany({
        where: {
          employeeId: payroll.employeeId,
          status: { in: APPROVED_REIMBURSEMENT_STATUSES },
          createdAt: {
            gte: startOfMonth,
            lt: new Date(payroll.year, payroll.month, 1),
          },
        },
        include: {
          reimbursementType: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.deduction.findMany({
        where: {
          employeeId: payroll.employeeId,
          status: { in: APPROVED_DEDUCTION_STATUSES },
          deductionDate: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        include: {
          deductionType: {
            select: {
              name: true,
            },
          },
        },
      }),
    ]);

    const additionsItems = [
      ...overtimes.map((ot) => ({
        id: ot.id,
        type: 'OVERTIME',
        amount: ot.amount,
        description: `Overtime - ${ot.overtimeHours}h @ ${ot.rate}x rate`,
      })),
      ...bonuses.map((bonus) => ({
        id: bonus.id,
        type: 'BONUS',
        amount: bonus.amount,
        description: bonus.reason,
      })),
      ...reimbursements.map((reimbursement: any) => ({
        id: reimbursement.id,
        type: 'REIMBURSEMENT',
        amount: reimbursement.amount,
        description: `${reimbursement.reimbursementType?.name || 'Reimbursement'} - ${reimbursement.description || ''}`.trim(),
      })),
    ];

    const deductionsItems = deductions.map((deduction) => ({
      id: deduction.id,
      type: deduction.deductionType?.name || 'Deduction',
      amount: deduction.amount,
      description: deduction.reason,
    }));

    return {
      ...payroll,
      salaryBreakdown: {
        baseSalary: payroll.employee?.baseSalary || 0,
        telephoneAllowance: payroll.employee?.telephoneAllowance || 0,
        housingAllowance: payroll.employee?.housingAllowance || 0,
        transportationAllowance: payroll.employee?.transportationAllowance || 0,
        totalSalary: payroll.totalSalary,
      },
      additions: {
        total: payroll.allowances,
        items: additionsItems,
      },
      deductions: {
        total: payroll.deductions,
        items: deductionsItems,
      },
      proratedTotalSalary: options.calculation?.proratedTotalSalary ?? payroll.totalSalary,
      proratedBaseSalary: options.calculation?.proratedBaseSalary ?? payroll.baseSalary,
      proration: options.proration ?? null,
      isProrated: options.proration?.isProrated ?? false,
      prorationSummary: options.proration?.summary ?? null,
      prorationReasons: options.proration?.reasons ?? [],
      calculationDetails: options.calculation
        ? {
            ...options.calculation,
            proration: options.proration ?? null,
          }
        : undefined,
    };
  } catch (error) {
    console.error('Error building detailed payroll response:', error);
    return payroll;
  }
};
