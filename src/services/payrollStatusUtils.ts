import { BonusStatus, DeductionStatus, PayrollStatus, ReimbursementStatus } from '@prisma/client';

export const LOCKED_PAYROLL_STATUSES: PayrollStatus[] = [
  PayrollStatus.UPLOADED_TO_BANK,
  PayrollStatus.BANK_PAYMENT_APPROVED,
];

export const REVIEWABLE_PAYROLL_STATUSES: PayrollStatus[] = [
  PayrollStatus.PENDING,
  PayrollStatus.ON_HOLD,
  PayrollStatus.FINANCE_APPROVED,
  PayrollStatus.MANAGEMENT_APPROVED,
  PayrollStatus.UPLOADED_TO_BANK,
  PayrollStatus.BANK_PAYMENT_APPROVED,
  PayrollStatus.REJECTED,
];

export const APPROVED_REIMBURSEMENT_STATUSES: ReimbursementStatus[] = [
  ReimbursementStatus.MANAGEMENT_APPROVED,
  ReimbursementStatus.UPLOADED_TO_BANK,
  ReimbursementStatus.PAID,
];

export const APPROVED_BONUS_STATUSES: BonusStatus[] = [
  BonusStatus.MANAGEMENT_APPROVED,
  BonusStatus.READY_FOR_PAYROLL,
  BonusStatus.APPLIED_TO_PAYROLL,
];

export const BONUS_AFFECTING_STATUSES = new Set<BonusStatus>([
  BonusStatus.MANAGEMENT_APPROVED,
  BonusStatus.READY_FOR_PAYROLL,
  BonusStatus.APPLIED_TO_PAYROLL,
]);

export const APPROVED_DEDUCTION_STATUSES: DeductionStatus[] = [
  DeductionStatus.MANAGEMENT_APPROVED,
  DeductionStatus.READY_FOR_PAYROLL,
  DeductionStatus.APPLIED_TO_PAYROLL,
  DeductionStatus.APPROVED,
];

export const DEDUCTION_AFFECTING_STATUSES = new Set<DeductionStatus>([
  DeductionStatus.MANAGEMENT_APPROVED,
  DeductionStatus.READY_FOR_PAYROLL,
  DeductionStatus.APPLIED_TO_PAYROLL,
  DeductionStatus.APPROVED,
]);

export const REIMBURSEMENT_AFFECTING_STATUSES = new Set<ReimbursementStatus>([
  ReimbursementStatus.MANAGEMENT_APPROVED,
  ReimbursementStatus.UPLOADED_TO_BANK,
  ReimbursementStatus.PAID,
]);
