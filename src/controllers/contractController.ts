import { Request, Response } from 'express';
import { IApiResponse, IPaginatedResponse } from '../types';
import { getUserInfo } from '../utils/ownershipValidation';
import * as contractService from '../services/contract/contractService';

/**
 * Get all contracts
 */
export const getContracts = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { userId, role } = getUserInfo(req);
    const { status, contractType, page, pageSize, search, expiringInDays } = req.query;
    
    // RBAC: EMPLOYEE can only see their own contract
    let employeeIdFilter: string | undefined;
    if (role === 'EMPLOYEE') {
      employeeIdFilter = userId;
    }
    
    const filters: any = {
      status: status as string,
      contractType: contractType as string,
      page: page ? parseInt(page as string) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined,
      search: search as string,
      expiringInDays: expiringInDays ? parseInt(expiringInDays as string) : undefined,
    };
    
    // Add employee filter if needed
    if (employeeIdFilter) {
      // We'll handle this in the service or add it as a filter
      filters.employeeId = employeeIdFilter;
    }
    
    const result = await contractService.getContracts(filters);
    
    const response: IApiResponse<IPaginatedResponse<any>> = {
      success: true,
      data: {
        data: result.contracts,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      },
      message: 'Contracts retrieved successfully',
    };
    
    return res.status(200).json(response);
  } catch (error: any) {
    console.error('Error fetching contracts:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message || 'Failed to retrieve contracts',
    });
  }
};

/**
 * Get contract by ID
 */
export const getContractById = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { userId, role } = getUserInfo(req);
    
    const contract = await contractService.getContractById(id);
    
    if (!contract) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Contract not found',
      });
    }
    
    // RBAC: EMPLOYEE can only access their own contract
    if (role === 'EMPLOYEE' && contract.employeeId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'You can only access your own contract',
      });
    }
    
    const response: IApiResponse<any> = {
      success: true,
      data: contract,
      message: 'Contract retrieved successfully',
    };
    
    return res.status(200).json(response);
  } catch (error: any) {
    console.error('Error fetching contract:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message || 'Failed to retrieve contract',
    });
  }
};

/**
 * Get contract by employee ID
 */
export const getContractByEmployeeId = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { employeeId } = req.params;
    const { userId, role } = getUserInfo(req);
    
    // RBAC: EMPLOYEE can only access their own contract
    if (role === 'EMPLOYEE' && employeeId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'You can only access your own contract',
      });
    }
    
    const contract = await contractService.getContractByEmployeeId(employeeId);
    
    if (!contract) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Contract not found for this employee',
      });
    }
    
    const response: IApiResponse<any> = {
      success: true,
      data: contract,
      message: 'Contract retrieved successfully',
    };
    
    return res.status(200).json(response);
  } catch (error: any) {
    console.error('Error fetching contract:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message || 'Failed to retrieve contract',
    });
  }
};

/**
 * Create new contract
 */
export const createContract = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { userId, role } = getUserInfo(req);
    
    // RBAC: Only HR and MANAGEMENT can create contracts
    if (role !== 'HR' && role !== 'MANAGEMENT') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Only HR and MANAGEMENT can create contracts',
      });
    }
    
    const {
      employeeId,
      contractType,
      startDate,
      endDate,
      baseSalary,
      currency,
      probationPeriod,
      noticePeriod,
      workingHours,
      workMode,
      autoRenewal,
      renewalDuration,
      renewalReminderDays,
      allowances,
      notes,
      templateId,
    } = req.body;
    
    if (!employeeId || !contractType || !startDate || !baseSalary) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Missing required fields: employeeId, contractType, startDate, baseSalary',
      });
    }
    
    const contract = await contractService.createContract({
      employeeId,
      contractType,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      baseSalary: parseFloat(baseSalary),
      currency,
      probationPeriod: probationPeriod ? parseInt(probationPeriod) : undefined,
      noticePeriod: noticePeriod ? parseInt(noticePeriod) : undefined,
      workingHours: workingHours ? parseInt(workingHours) : undefined,
      workMode,
      autoRenewal: autoRenewal || false,
      renewalDuration: renewalDuration ? parseInt(renewalDuration) : undefined,
      renewalReminderDays: renewalReminderDays ? parseInt(renewalReminderDays) : undefined,
      allowances,
      notes,
      templateId,
      createdBy: userId,
    });
    
    const response: IApiResponse<any> = {
      success: true,
      data: contract,
      message: 'Contract created successfully',
    };
    
    return res.status(201).json(response);
  } catch (error: any) {
    console.error('Error creating contract:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message || 'Failed to create contract',
    });
  }
};

/**
 * Update contract
 */
export const updateContract = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { userId, role } = getUserInfo(req);
    
    // RBAC: Only HR and MANAGEMENT can update contracts
    if (role !== 'HR' && role !== 'MANAGEMENT') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Only HR and MANAGEMENT can update contracts',
      });
    }
    
    const contract = await contractService.getContractById(id);
    if (!contract) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Contract not found',
      });
    }
    
    const {
      contractType,
      startDate,
      endDate,
      baseSalary,
      currency,
      probationPeriod,
      noticePeriod,
      workingHours,
      workMode,
      autoRenewal,
      renewalDuration,
      renewalReminderDays,
      allowances,
      notes,
    } = req.body;
    
    const updateData: any = {};
    if (contractType !== undefined) updateData.contractType = contractType;
    if (startDate !== undefined) updateData.startDate = new Date(startDate);
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
    if (baseSalary !== undefined) updateData.baseSalary = parseFloat(baseSalary);
    if (currency !== undefined) updateData.currency = currency;
    if (probationPeriod !== undefined) updateData.probationPeriod = probationPeriod ? parseInt(probationPeriod) : undefined;
    if (noticePeriod !== undefined) updateData.noticePeriod = noticePeriod ? parseInt(noticePeriod) : undefined;
    if (workingHours !== undefined) updateData.workingHours = workingHours ? parseInt(workingHours) : undefined;
    if (workMode !== undefined) updateData.workMode = workMode;
    if (autoRenewal !== undefined) updateData.autoRenewal = autoRenewal;
    if (renewalDuration !== undefined) updateData.renewalDuration = renewalDuration ? parseInt(renewalDuration) : undefined;
    if (renewalReminderDays !== undefined) updateData.renewalReminderDays = renewalReminderDays ? parseInt(renewalReminderDays) : undefined;
    if (allowances !== undefined) updateData.allowances = allowances;
    if (notes !== undefined) updateData.notes = notes;
    updateData.updatedBy = userId;
    
    const updated = await contractService.updateContract(id, updateData);
    
    const response: IApiResponse<any> = {
      success: true,
      data: updated,
      message: 'Contract updated successfully',
    };
    
    return res.status(200).json(response);
  } catch (error: any) {
    console.error('Error updating contract:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message || 'Failed to update contract',
    });
  }
};

/**
 * Terminate contract
 */
export const terminateContract = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { userId, role } = getUserInfo(req);
    
    // RBAC: Only HR and MANAGEMENT can terminate contracts
    if (role !== 'HR' && role !== 'MANAGEMENT') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Only HR and MANAGEMENT can terminate contracts',
      });
    }
    
    const { terminationDate, notes } = req.body;
    
    if (!terminationDate) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Termination date is required',
      });
    }
    
    const terminated = await contractService.terminateContract(id, {
      terminationDate: new Date(terminationDate),
      notes,
      updatedBy: userId,
    });
    
    const response: IApiResponse<any> = {
      success: true,
      data: terminated,
      message: 'Contract terminated successfully',
    };
    
    return res.status(200).json(response);
  } catch (error: any) {
    console.error('Error terminating contract:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message || 'Failed to terminate contract',
    });
  }
};

/**
 * Get expiring contracts
 */
export const getExpiringContracts = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { days } = req.query;
    const daysNum = days ? parseInt(days as string) : 30;
    
    const contracts = await contractService.getExpiringContracts(daysNum);
    
    const response: IApiResponse<any[]> = {
      success: true,
      data: contracts,
      message: 'Expiring contracts retrieved successfully',
    };
    
    return res.status(200).json(response);
  } catch (error: any) {
    console.error('Error fetching expiring contracts:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message || 'Failed to retrieve expiring contracts',
    });
  }
};

