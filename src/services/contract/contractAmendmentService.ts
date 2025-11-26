import { prisma } from '../../index';
import * as contractService from './contractService';

/**
 * Create an amendment
 */
export const createAmendment = async (data: {
  contractId: string;
  amendmentType: string;
  title: string;
  description: string;
  previousValue?: any;
  newValue?: any;
  effectiveDate: Date;
  requestedBy?: string;
  notes?: string;
}) => {
  return await prisma.contractAmendment.create({
    data: {
      contractId: data.contractId,
      amendmentType: data.amendmentType as any,
      title: data.title,
      description: data.description,
      previousValue: data.previousValue ? JSON.stringify(data.previousValue) : null,
      newValue: data.newValue ? JSON.stringify(data.newValue) : null,
      effectiveDate: data.effectiveDate,
      requestedBy: data.requestedBy,
      notes: data.notes,
      status: 'PENDING',
    },
    include: {
      contract: {
        include: {
          employee: true,
        },
      },
    },
  });
};

/**
 * Approve an amendment
 */
export const approveAmendment = async (amendmentId: string, approvedBy: string) => {
  return await prisma.contractAmendment.update({
    where: { id: amendmentId },
    data: {
      status: 'APPROVED',
      approvedBy,
      approvalDate: new Date(),
    },
    include: {
      contract: {
        include: {
          employee: true,
        },
      },
    },
  });
};

/**
 * Reject an amendment
 */
export const rejectAmendment = async (amendmentId: string, data: {
  approvedBy: string;
  rejectionReason?: string;
}) => {
  return await prisma.contractAmendment.update({
    where: { id: amendmentId },
    data: {
      status: 'REJECTED',
      approvedBy: data.approvedBy,
      approvalDate: new Date(),
      notes: data.rejectionReason,
    },
    include: {
      contract: {
        include: {
          employee: true,
        },
      },
    },
  });
};

/**
 * Apply amendment to contract
 */
export const applyAmendment = async (amendmentId: string) => {
  const amendment = await prisma.contractAmendment.findUnique({
    where: { id: amendmentId },
    include: { contract: true },
  });
  
  if (!amendment) {
    throw new Error('Amendment not found');
  }
  
  if (amendment.status !== 'APPROVED') {
    throw new Error('Amendment must be approved before applying');
  }
  
  const newValue = amendment.newValue ? JSON.parse(amendment.newValue) : {};
  
  // Apply changes based on amendment type
  const updateData: any = {};
  
  switch (amendment.amendmentType) {
    case 'SALARY_CHANGE':
      if (newValue.baseSalary) updateData.baseSalary = newValue.baseSalary;
      break;
    case 'WORK_MODE_CHANGE':
      if (newValue.workMode) updateData.workMode = newValue.workMode;
      break;
    case 'TERMS_CHANGE':
      if (newValue.probationPeriod !== undefined) updateData.probationPeriod = newValue.probationPeriod;
      if (newValue.noticePeriod !== undefined) updateData.noticePeriod = newValue.noticePeriod;
      if (newValue.workingHours !== undefined) updateData.workingHours = newValue.workingHours;
      break;
    case 'ALLOWANCE_CHANGE':
      if (newValue.allowances) updateData.allowances = JSON.stringify(newValue.allowances);
      break;
    case 'POSITION_CHANGE':
      // Position changes are handled in Employee model, not Contract
      break;
  }
  
  if (Object.keys(updateData).length > 0) {
    await contractService.updateContract(amendment.contractId, updateData);
  }
  
  // Mark amendment as implemented
  return await prisma.contractAmendment.update({
    where: { id: amendmentId },
    data: {
      status: 'IMPLEMENTED',
    },
    include: {
      contract: {
        include: {
          employee: true,
        },
      },
    },
  });
};

/**
 * Get amendment history for a contract
 */
export const getAmendmentHistory = async (contractId: string) => {
  return await prisma.contractAmendment.findMany({
    where: { contractId },
    orderBy: { createdAt: 'desc' },
    include: {
      contract: {
        select: {
          contractNumber: true,
        },
      },
    },
  });
};

