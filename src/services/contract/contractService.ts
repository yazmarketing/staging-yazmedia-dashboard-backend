import { prisma } from '../../index';

/**
 * Generate unique contract number: CT-YYYY-XXX
 */
export const generateContractNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const prefix = `CT-${year}-`;
  
  // Find the latest contract number for this year
  const latestContract = await prisma.contract.findFirst({
    where: {
      contractNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      contractNumber: 'desc',
    },
  });
  
  let sequence = 1;
  if (latestContract) {
    const lastSequence = parseInt(latestContract.contractNumber.split('-')[2] || '0');
    sequence = lastSequence + 1;
  }
  
  return `${prefix}${sequence.toString().padStart(3, '0')}`;
};

/**
 * Create a new contract
 */
export const createContract = async (data: {
  employeeId: string;
  contractType: string;
  startDate: Date;
  endDate?: Date | null;
  baseSalary: number;
  currency?: string;
  probationPeriod?: number;
  noticePeriod?: number;
  workingHours?: number;
  workMode?: string;
  autoRenewal?: boolean;
  renewalDuration?: number;
  renewalReminderDays?: number;
  allowances?: any;
  notes?: string;
  templateId?: string;
  createdBy?: string;
}) => {
  const contractNumber = await generateContractNumber();
  
  return await prisma.contract.create({
    data: {
      contractNumber,
      employeeId: data.employeeId,
      contractType: data.contractType as any,
      startDate: data.startDate,
      endDate: data.endDate || null,
      baseSalary: data.baseSalary,
      currency: data.currency || 'AED',
      probationPeriod: data.probationPeriod,
      noticePeriod: data.noticePeriod,
      workingHours: data.workingHours,
      workMode: (data.workMode as any) || 'ON_SITE',
      autoRenewal: data.autoRenewal || false,
      renewalDuration: data.renewalDuration,
      renewalReminderDays: data.renewalReminderDays || 30,
      allowances: data.allowances ? JSON.stringify(data.allowances) : null,
      notes: data.notes,
      templateId: data.templateId,
      createdBy: data.createdBy,
      status: 'ACTIVE',
    },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          employeeId: true,
        },
      },
      template: true,
    },
  });
};

/**
 * Get contract by ID
 */
export const getContractById = async (id: string) => {
  return await prisma.contract.findUnique({
    where: { id },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          employeeId: true,
          designation: true,
          department: true,
        },
      },
      renewals: {
        orderBy: { createdAt: 'desc' },
      },
      amendments: {
        orderBy: { createdAt: 'desc' },
      },
      documents: {
        orderBy: { uploadedAt: 'desc' },
      },
      template: true,
    },
  });
};

/**
 * Get contract by employee ID
 */
export const getContractByEmployeeId = async (employeeId: string) => {
  return await prisma.contract.findUnique({
    where: { employeeId },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          employeeId: true,
          designation: true,
          department: true,
        },
      },
      renewals: {
        orderBy: { createdAt: 'desc' },
      },
      amendments: {
        orderBy: { createdAt: 'desc' },
      },
      documents: {
        orderBy: { uploadedAt: 'desc' },
      },
      template: true,
    },
  });
};

/**
 * Get all contracts with filters and pagination
 */
export const getContracts = async (filters: {
  status?: string;
  contractType?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  expiringInDays?: number;
}) => {
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 10;
  const skip = (page - 1) * pageSize;
  
  const where: any = {};
  
  if (filters.status) {
    where.status = filters.status;
  }
  
  if (filters.contractType) {
    where.contractType = filters.contractType;
  }
  
  if (filters.search) {
    where.OR = [
      { contractNumber: { contains: filters.search, mode: 'insensitive' } },
      { employee: { firstName: { contains: filters.search, mode: 'insensitive' } } },
      { employee: { lastName: { contains: filters.search, mode: 'insensitive' } } },
      { employee: { employeeId: { contains: filters.search, mode: 'insensitive' } } },
    ];
  }
  
  if (filters.expiringInDays) {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + filters.expiringInDays);
    
    where.endDate = {
      gte: today,
      lte: futureDate,
    };
    where.status = 'ACTIVE';
  }
  
  const [contracts, total] = await Promise.all([
    prisma.contract.findMany({
      where,
      skip,
      take: pageSize,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeId: true,
            designation: true,
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.contract.count({ where }),
  ]);
  
  return {
    contracts,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
};

/**
 * Update contract
 */
export const updateContract = async (id: string, data: {
  contractType?: string;
  startDate?: Date;
  endDate?: Date | null;
  baseSalary?: number;
  currency?: string;
  probationPeriod?: number;
  noticePeriod?: number;
  workingHours?: number;
  workMode?: string;
  autoRenewal?: boolean;
  renewalDuration?: number;
  renewalReminderDays?: number;
  allowances?: any;
  notes?: string;
  updatedBy?: string;
}) => {
  const updateData: any = {};
  
  if (data.contractType !== undefined) updateData.contractType = data.contractType as any;
  if (data.startDate !== undefined) updateData.startDate = data.startDate;
  if (data.endDate !== undefined) updateData.endDate = data.endDate;
  if (data.baseSalary !== undefined) updateData.baseSalary = data.baseSalary;
  if (data.currency !== undefined) updateData.currency = data.currency;
  if (data.probationPeriod !== undefined) updateData.probationPeriod = data.probationPeriod;
  if (data.noticePeriod !== undefined) updateData.noticePeriod = data.noticePeriod;
  if (data.workingHours !== undefined) updateData.workingHours = data.workingHours;
  if (data.workMode !== undefined) updateData.workMode = data.workMode as any;
  if (data.autoRenewal !== undefined) updateData.autoRenewal = data.autoRenewal;
  if (data.renewalDuration !== undefined) updateData.renewalDuration = data.renewalDuration;
  if (data.renewalReminderDays !== undefined) updateData.renewalReminderDays = data.renewalReminderDays;
  if (data.allowances !== undefined) updateData.allowances = data.allowances ? JSON.stringify(data.allowances) : null;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.updatedBy !== undefined) updateData.updatedBy = data.updatedBy;
  
  return await prisma.contract.update({
    where: { id },
    data: updateData,
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          employeeId: true,
        },
      },
    },
  });
};

/**
 * Terminate contract
 */
export const terminateContract = async (id: string, data: {
  terminationDate: Date;
  notes?: string;
  updatedBy?: string;
}) => {
  return await prisma.contract.update({
    where: { id },
    data: {
      status: 'TERMINATED',
      terminationDate: data.terminationDate,
      notes: data.notes,
      updatedBy: data.updatedBy,
    },
    include: {
      employee: true,
    },
  });
};

/**
 * Get expiring contracts
 */
export const getExpiringContracts = async (days: number = 30) => {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + days);
  
  return await prisma.contract.findMany({
    where: {
      status: 'ACTIVE',
      endDate: {
        gte: today,
        lte: futureDate,
      },
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
          department: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      endDate: 'asc',
    },
  });
};

/**
 * Auto-check and mark expired contracts
 */
export const autoCheckExpiredContracts = async () => {
  const today = new Date();
  
  const expired = await prisma.contract.updateMany({
    where: {
      status: 'ACTIVE',
      endDate: {
        lt: today,
      },
    },
    data: {
      status: 'EXPIRED',
    },
  });
  
  return expired.count;
};










