import { Request, Response } from 'express';
import { IApiResponse } from '../types';
import { getUserInfo } from '../utils/ownershipValidation';
import * as renewalService from '../services/contract/contractRenewalService';

/**
 * Initiate renewal
 */
export const initiateRenewal = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { contractId } = req.params;
    const { userId, role } = getUserInfo(req);
    
    // RBAC: Only HR and MANAGEMENT can initiate renewals
    if (role !== 'HR' && role !== 'MANAGEMENT') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Only HR and MANAGEMENT can initiate renewals',
      });
    }
    
    const { renewalType, newEndDate, newSalary, changes, effectiveDate, notes } = req.body;
    
    if (!newEndDate || !effectiveDate) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'newEndDate and effectiveDate are required',
      });
    }
    
    const renewal = await renewalService.initiateRenewal({
      contractId,
      renewalType: renewalType || 'MANUAL',
      newEndDate: new Date(newEndDate),
      newSalary: newSalary ? parseFloat(newSalary) : undefined,
      changes,
      effectiveDate: new Date(effectiveDate),
      requestedBy: userId,
      notes,
    });
    
    const response: IApiResponse<any> = {
      success: true,
      data: renewal,
      message: 'Renewal initiated successfully',
    };
    
    return res.status(201).json(response);
  } catch (error: any) {
    console.error('Error initiating renewal:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message || 'Failed to initiate renewal',
    });
  }
};

/**
 * Approve renewal
 */
export const approveRenewal = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { userId, role } = getUserInfo(req);
    
    // RBAC: Only HR and MANAGEMENT can approve renewals
    if (role !== 'HR' && role !== 'MANAGEMENT') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Only HR and MANAGEMENT can approve renewals',
      });
    }
    
    const renewal = await renewalService.approveRenewal(id, userId);
    
    const response: IApiResponse<any> = {
      success: true,
      data: renewal,
      message: 'Renewal approved successfully',
    };
    
    return res.status(200).json(response);
  } catch (error: any) {
    console.error('Error approving renewal:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message || 'Failed to approve renewal',
    });
  }
};

/**
 * Reject renewal
 */
export const rejectRenewal = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { userId, role } = getUserInfo(req);
    
    // RBAC: Only HR and MANAGEMENT can reject renewals
    if (role !== 'HR' && role !== 'MANAGEMENT') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Only HR and MANAGEMENT can reject renewals',
      });
    }
    
    const { rejectionReason } = req.body;
    
    const renewal = await renewalService.rejectRenewal(id, {
      approvedBy: userId,
      rejectionReason,
    });
    
    const response: IApiResponse<any> = {
      success: true,
      data: renewal,
      message: 'Renewal rejected',
    };
    
    return res.status(200).json(response);
  } catch (error: any) {
    console.error('Error rejecting renewal:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message || 'Failed to reject renewal',
    });
  }
};

/**
 * Process renewal
 */
export const processRenewal = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { role } = getUserInfo(req);
    
    // RBAC: Only HR and MANAGEMENT can process renewals
    if (role !== 'HR' && role !== 'MANAGEMENT') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Only HR and MANAGEMENT can process renewals',
      });
    }
    
    const renewal = await renewalService.processRenewal(id);
    
    const response: IApiResponse<any> = {
      success: true,
      data: renewal,
      message: 'Renewal processed successfully',
    };
    
    return res.status(200).json(response);
  } catch (error: any) {
    console.error('Error processing renewal:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message || 'Failed to process renewal',
    });
  }
};

/**
 * Get renewals for a contract
 */
export const getRenewals = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { contractId } = req.params;
    
    const renewals = await renewalService.getRenewals(contractId);
    
    const response: IApiResponse<any[]> = {
      success: true,
      data: renewals,
      message: 'Renewals retrieved successfully',
    };
    
    return res.status(200).json(response);
  } catch (error: any) {
    console.error('Error fetching renewals:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message || 'Failed to retrieve renewals',
    });
  }
};

