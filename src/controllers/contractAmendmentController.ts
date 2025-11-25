import { Request, Response } from 'express';
import { IApiResponse } from '../types';
import { getUserInfo } from '../utils/ownershipValidation';
import * as amendmentService from '../services/contract/contractAmendmentService';

/**
 * Create amendment
 */
export const createAmendment = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { contractId } = req.params;
    const { userId, role } = getUserInfo(req);
    
    // RBAC: Only HR and MANAGEMENT can create amendments
    if (role !== 'HR' && role !== 'MANAGEMENT') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Only HR and MANAGEMENT can create amendments',
      });
    }
    
    const { amendmentType, title, description, previousValue, newValue, effectiveDate, notes } = req.body;
    
    if (!amendmentType || !title || !description || !effectiveDate) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'amendmentType, title, description, and effectiveDate are required',
      });
    }
    
    const amendment = await amendmentService.createAmendment({
      contractId,
      amendmentType,
      title,
      description,
      previousValue,
      newValue,
      effectiveDate: new Date(effectiveDate),
      requestedBy: userId,
      notes,
    });
    
    const response: IApiResponse<any> = {
      success: true,
      data: amendment,
      message: 'Amendment created successfully',
    };
    
    return res.status(201).json(response);
  } catch (error: any) {
    console.error('Error creating amendment:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message || 'Failed to create amendment',
    });
  }
};

/**
 * Approve amendment
 */
export const approveAmendment = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { userId, role } = getUserInfo(req);
    
    // RBAC: Only HR and MANAGEMENT can approve amendments
    if (role !== 'HR' && role !== 'MANAGEMENT') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Only HR and MANAGEMENT can approve amendments',
      });
    }
    
    const amendment = await amendmentService.approveAmendment(id, userId);
    
    const response: IApiResponse<any> = {
      success: true,
      data: amendment,
      message: 'Amendment approved successfully',
    };
    
    return res.status(200).json(response);
  } catch (error: any) {
    console.error('Error approving amendment:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message || 'Failed to approve amendment',
    });
  }
};

/**
 * Reject amendment
 */
export const rejectAmendment = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { userId, role } = getUserInfo(req);
    
    // RBAC: Only HR and MANAGEMENT can reject amendments
    if (role !== 'HR' && role !== 'MANAGEMENT') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Only HR and MANAGEMENT can reject amendments',
      });
    }
    
    const { rejectionReason } = req.body;
    
    const amendment = await amendmentService.rejectAmendment(id, {
      approvedBy: userId,
      rejectionReason,
    });
    
    const response: IApiResponse<any> = {
      success: true,
      data: amendment,
      message: 'Amendment rejected',
    };
    
    return res.status(200).json(response);
  } catch (error: any) {
    console.error('Error rejecting amendment:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message || 'Failed to reject amendment',
    });
  }
};

/**
 * Apply amendment
 */
export const applyAmendment = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { role } = getUserInfo(req);
    
    // RBAC: Only HR and MANAGEMENT can apply amendments
    if (role !== 'HR' && role !== 'MANAGEMENT') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Only HR and MANAGEMENT can apply amendments',
      });
    }
    
    const amendment = await amendmentService.applyAmendment(id);
    
    const response: IApiResponse<any> = {
      success: true,
      data: amendment,
      message: 'Amendment applied successfully',
    };
    
    return res.status(200).json(response);
  } catch (error: any) {
    console.error('Error applying amendment:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message || 'Failed to apply amendment',
    });
  }
};

/**
 * Get amendments for a contract
 */
export const getAmendments = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { contractId } = req.params;
    
    const amendments = await amendmentService.getAmendmentHistory(contractId);
    
    const response: IApiResponse<any[]> = {
      success: true,
      data: amendments,
      message: 'Amendments retrieved successfully',
    };
    
    return res.status(200).json(response);
  } catch (error: any) {
    console.error('Error fetching amendments:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message || 'Failed to retrieve amendments',
    });
  }
};

