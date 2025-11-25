import { prisma } from '../../index';

/**
 * Create a contract template
 */
export const createTemplate = async (data: {
  name: string;
  description?: string;
  contractType: string;
  defaultDuration?: number;
  defaultNoticePeriod?: number;
  defaultProbationPeriod?: number;
  terms?: any;
  clauses?: any;
  isDefault?: boolean;
  createdBy?: string;
}) => {
  // If setting as default, unset other defaults
  if (data.isDefault) {
    await prisma.contractTemplate.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }
  
  return await prisma.contractTemplate.create({
    data: {
      name: data.name,
      description: data.description,
      contractType: data.contractType as any,
      defaultDuration: data.defaultDuration,
      defaultNoticePeriod: data.defaultNoticePeriod,
      defaultProbationPeriod: data.defaultProbationPeriod,
      terms: data.terms ? JSON.stringify(data.terms) : null,
      clauses: data.clauses ? JSON.stringify(data.clauses) : null,
      isDefault: data.isDefault || false,
      createdBy: data.createdBy,
    },
  });
};

/**
 * Get all templates
 */
export const getTemplates = async (filters?: {
  contractType?: string;
  isActive?: boolean;
}) => {
  const where: any = {};
  
  if (filters?.contractType) {
    where.contractType = filters.contractType;
  }
  
  if (filters?.isActive !== undefined) {
    where.isActive = filters.isActive;
  }
  
  return await prisma.contractTemplate.findMany({
    where,
    orderBy: [
      { isDefault: 'desc' },
      { createdAt: 'desc' },
    ],
  });
};

/**
 * Get template by ID
 */
export const getTemplateById = async (id: string) => {
  return await prisma.contractTemplate.findUnique({
    where: { id },
  });
};

/**
 * Update template
 */
export const updateTemplate = async (id: string, data: {
  name?: string;
  description?: string;
  contractType?: string;
  defaultDuration?: number;
  defaultNoticePeriod?: number;
  defaultProbationPeriod?: number;
  terms?: any;
  clauses?: any;
  isActive?: boolean;
  isDefault?: boolean;
  updatedBy?: string;
}) => {
  // If setting as default, unset other defaults
  if (data.isDefault) {
    await prisma.contractTemplate.updateMany({
      where: {
        isDefault: true,
        id: { not: id },
      },
      data: { isDefault: false },
    });
  }
  
  const updateData: any = {};
  
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.contractType !== undefined) updateData.contractType = data.contractType as any;
  if (data.defaultDuration !== undefined) updateData.defaultDuration = data.defaultDuration;
  if (data.defaultNoticePeriod !== undefined) updateData.defaultNoticePeriod = data.defaultNoticePeriod;
  if (data.defaultProbationPeriod !== undefined) updateData.defaultProbationPeriod = data.defaultProbationPeriod;
  if (data.terms !== undefined) updateData.terms = data.terms ? JSON.stringify(data.terms) : null;
  if (data.clauses !== undefined) updateData.clauses = data.clauses ? JSON.stringify(data.clauses) : null;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;
  if (data.updatedBy !== undefined) updateData.updatedBy = data.updatedBy;
  
  return await prisma.contractTemplate.update({
    where: { id },
    data: updateData,
  });
};

/**
 * Delete template
 */
export const deleteTemplate = async (id: string) => {
  return await prisma.contractTemplate.delete({
    where: { id },
  });
};










