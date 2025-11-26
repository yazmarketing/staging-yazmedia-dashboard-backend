import { Request, Response } from 'express';
import { IApiResponse } from '../types';
import { getUserInfo } from '../utils/ownershipValidation';
import * as templateService from '../services/contract/contractTemplateService';

/**
 * Get all templates
 */
export const getTemplates = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { contractType, isActive } = req.query;
    
    const filters: any = {};
    if (contractType) filters.contractType = contractType;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    
    const templates = await templateService.getTemplates(filters);
    
    const response: IApiResponse<any[]> = {
      success: true,
      data: templates,
      message: 'Templates retrieved successfully',
    };
    
    return res.status(200).json(response);
  } catch (error: any) {
    console.error('Error fetching templates:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message || 'Failed to retrieve templates',
    });
  }
};

/**
 * Get template by ID
 */
export const getTemplateById = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    
    const template = await templateService.getTemplateById(id);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Template not found',
      });
    }
    
    const response: IApiResponse<any> = {
      success: true,
      data: template,
      message: 'Template retrieved successfully',
    };
    
    return res.status(200).json(response);
  } catch (error: any) {
    console.error('Error fetching template:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message || 'Failed to retrieve template',
    });
  }
};

/**
 * Create template
 */
export const createTemplate = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { userId, role } = getUserInfo(req);
    
    // RBAC: Only HR and MANAGEMENT can create templates
    if (role !== 'HR' && role !== 'MANAGEMENT') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Only HR and MANAGEMENT can create templates',
      });
    }
    
    const {
      name,
      description,
      contractType,
      defaultDuration,
      defaultNoticePeriod,
      defaultProbationPeriod,
      terms,
      clauses,
      isDefault,
    } = req.body;
    
    if (!name || !contractType) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'name and contractType are required',
      });
    }
    
    const template = await templateService.createTemplate({
      name,
      description,
      contractType,
      defaultDuration: defaultDuration ? parseInt(defaultDuration) : undefined,
      defaultNoticePeriod: defaultNoticePeriod ? parseInt(defaultNoticePeriod) : undefined,
      defaultProbationPeriod: defaultProbationPeriod ? parseInt(defaultProbationPeriod) : undefined,
      terms,
      clauses,
      isDefault,
      createdBy: userId,
    });
    
    const response: IApiResponse<any> = {
      success: true,
      data: template,
      message: 'Template created successfully',
    };
    
    return res.status(201).json(response);
  } catch (error: any) {
    console.error('Error creating template:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message || 'Failed to create template',
    });
  }
};

/**
 * Update template
 */
export const updateTemplate = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { userId, role } = getUserInfo(req);
    
    // RBAC: Only HR and MANAGEMENT can update templates
    if (role !== 'HR' && role !== 'MANAGEMENT') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Only HR and MANAGEMENT can update templates',
      });
    }
    
    const {
      name,
      description,
      contractType,
      defaultDuration,
      defaultNoticePeriod,
      defaultProbationPeriod,
      terms,
      clauses,
      isActive,
      isDefault,
    } = req.body;
    
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (contractType !== undefined) updateData.contractType = contractType;
    if (defaultDuration !== undefined) updateData.defaultDuration = defaultDuration ? parseInt(defaultDuration) : undefined;
    if (defaultNoticePeriod !== undefined) updateData.defaultNoticePeriod = defaultNoticePeriod ? parseInt(defaultNoticePeriod) : undefined;
    if (defaultProbationPeriod !== undefined) updateData.defaultProbationPeriod = defaultProbationPeriod ? parseInt(defaultProbationPeriod) : undefined;
    if (terms !== undefined) updateData.terms = terms;
    if (clauses !== undefined) updateData.clauses = clauses;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (isDefault !== undefined) updateData.isDefault = isDefault;
    updateData.updatedBy = userId;
    
    const template = await templateService.updateTemplate(id, updateData);
    
    const response: IApiResponse<any> = {
      success: true,
      data: template,
      message: 'Template updated successfully',
    };
    
    return res.status(200).json(response);
  } catch (error: any) {
    console.error('Error updating template:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message || 'Failed to update template',
    });
  }
};

/**
 * Delete template
 */
export const deleteTemplate = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { role } = getUserInfo(req);
    
    // RBAC: Only HR and MANAGEMENT can delete templates
    if (role !== 'HR' && role !== 'MANAGEMENT') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Only HR and MANAGEMENT can delete templates',
      });
    }
    
    await templateService.deleteTemplate(id);
    
    const response: IApiResponse<null> = {
      success: true,
      data: null,
      message: 'Template deleted successfully',
    };
    
    return res.status(200).json(response);
  } catch (error: any) {
    console.error('Error deleting template:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message || 'Failed to delete template',
    });
  }
};

