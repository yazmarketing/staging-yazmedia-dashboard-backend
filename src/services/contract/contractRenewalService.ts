import { prisma } from '../../index';
import * as contractService from './contractService';

/**
 * Initiate a contract renewal
 */
export const initiateRenewal = async (data: {
  contractId: string;
  renewalType: string;
  newEndDate: Date;
  newSalary?: number;
  changes?: any;
  effectiveDate: Date;
  requestedBy?: string;
  notes?: string;
}) => {
  const contract = await prisma.contract.findUnique({
    where: { id: data.contractId },
  });
  
  if (!contract) {
    throw new Error('Contract not found');
  }
  
  return await prisma.contractRenewal.create({
    data: {
      contractId: data.contractId,
      renewalType: data.renewalType as any,
      previousEndDate: contract.endDate || contract.startDate,
      newEndDate: data.newEndDate,
      previousSalary: contract.baseSalary,
      newSalary: data.newSalary,
      changes: data.changes ? JSON.stringify(data.changes) : null,
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
 * Approve a renewal
 */
export const approveRenewal = async (renewalId: string, approvedBy: string) => {
  const renewal = await prisma.contractRenewal.findUnique({
    where: { id: renewalId },
    include: { contract: true },
  });
  
  if (!renewal) {
    throw new Error('Renewal not found');
  }
  
  return await prisma.contractRenewal.update({
    where: { id: renewalId },
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
 * Reject a renewal
 */
export const rejectRenewal = async (renewalId: string, data: {
  approvedBy: string;
  rejectionReason: string;
}) => {
  return await prisma.contractRenewal.update({
    where: { id: renewalId },
    data: {
      status: 'REJECTED',
      approvedBy: data.approvedBy,
      approvalDate: new Date(),
      rejectionReason: data.rejectionReason,
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
 * Process a renewal - creates new contract or extends existing
 */
export const processRenewal = async (renewalId: string) => {
  const renewal = await prisma.contractRenewal.findUnique({
    where: { id: renewalId },
    include: { contract: { include: { employee: true } } },
  });
  
  if (!renewal) {
    throw new Error('Renewal not found');
  }
  
  if (renewal.status !== 'APPROVED') {
    throw new Error('Renewal must be approved before processing');
  }
  
  const contract = renewal.contract;
  
  if (renewal.renewalType === 'EXTENSION') {
    // Extend existing contract
    await contractService.updateContract(contract.id, {
      endDate: renewal.newEndDate,
      baseSalary: renewal.newSalary || contract.baseSalary,
    });
    
    // Mark old contract as renewed
    await prisma.contract.update({
      where: { id: contract.id },
      data: { status: 'RENEWED' },
    });
  } else {
    // Create new contract
    const newContract = await contractService.createContract({
      employeeId: contract.employeeId,
      contractType: contract.contractType,
      startDate: renewal.effectiveDate,
      endDate: renewal.newEndDate,
      baseSalary: renewal.newSalary || contract.baseSalary,
      currency: contract.currency,
      probationPeriod: contract.probationPeriod ?? undefined,
      noticePeriod: contract.noticePeriod ?? undefined,
      workingHours: contract.workingHours ?? undefined,
      workMode: contract.workMode,
      autoRenewal: contract.autoRenewal,
      renewalDuration: contract.renewalDuration ?? undefined,
      renewalReminderDays: contract.renewalReminderDays ?? undefined,
      allowances: contract.allowances ? JSON.parse(contract.allowances) : undefined,
      createdBy: renewal.approvedBy ?? undefined,
    });
    
    // Update renewal with new contract ID
    await prisma.contractRenewal.update({
      where: { id: renewalId },
      data: {
        newContractId: newContract.id,
        status: 'COMPLETED',
      },
    });
    
    // Mark old contract as renewed
    await prisma.contract.update({
      where: { id: contract.id },
      data: { status: 'RENEWED' },
    });
  }
  
  return await prisma.contractRenewal.findUnique({
    where: { id: renewalId },
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
 * Auto-renew contract if autoRenewal is enabled
 */
export const autoRenewContract = async (contractId: string) => {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
  });
  
  if (!contract || !contract.autoRenewal) {
    return null;
  }
  
  if (!contract.endDate || !contract.renewalDuration) {
    return null;
  }
  
  const newEndDate = new Date(contract.endDate);
  newEndDate.setDate(newEndDate.getDate() + contract.renewalDuration);
  
  // Create renewal and auto-approve
  const renewal = await initiateRenewal({
    contractId,
    renewalType: 'AUTOMATIC',
    newEndDate,
    newSalary: contract.baseSalary,
    effectiveDate: contract.endDate,
  });
  
  // Auto-approve and process
  await approveRenewal(renewal.id, 'SYSTEM');
  await processRenewal(renewal.id);
  
  return renewal;
};

/**
 * Extend contract
 */
export const extendContract = async (contractId: string, days: number) => {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
  });
  
  if (!contract || !contract.endDate) {
    throw new Error('Contract not found or has no end date');
  }
  
  const newEndDate = new Date(contract.endDate);
  newEndDate.setDate(newEndDate.getDate() + days);
  
  return await contractService.updateContract(contractId, {
    endDate: newEndDate,
  });
};

/**
 * Get renewals for a contract
 */
export const getRenewals = async (contractId: string) => {
  return await prisma.contractRenewal.findMany({
    where: { contractId },
    orderBy: { createdAt: 'desc' },
    include: {
      contract: {
        select: {
          contractNumber: true,
          employee: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });
};

