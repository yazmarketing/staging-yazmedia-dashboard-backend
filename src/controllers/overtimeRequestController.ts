import { Request, Response } from 'express';
import { prisma } from '../index';
import { IApiResponse } from '../types';
import { getIO } from '../websocket/attendanceSocket';
import { getUserInfo } from '../utils/ownershipValidation';

/**
 * Create an overtime request
 * POST /overtime-requests
 */
export const createOvertimeRequest = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const userId = (req as any).user?.userId;
    const { clientName, projectName, reason, canDoNextDay, urgencyReason, requestedHours, requestedDate } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      } as IApiResponse<null>);
    }

    // Validate required fields
    if (!clientName || !projectName || !reason || requestedHours === undefined || !requestedDate) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Missing required fields: clientName, projectName, reason, requestedHours, requestedDate',
      } as IApiResponse<null>);
    }

    // Validate canDoNextDay logic
    if (!canDoNextDay && !urgencyReason) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'If canDoNextDay is false, urgencyReason is required',
      } as IApiResponse<null>);
    }

    // Find or create client by name
    let client = await prisma.client.findUnique({ where: { name: clientName } });
    if (!client) {
      client = await prisma.client.create({
        data: {
          name: clientName,
          isActive: true,
        },
      });
    }

    // Find or create project by name and client
    let project = await prisma.project.findFirst({
      where: {
        name: projectName,
        clientId: client.id,
      },
    });
    if (!project) {
      project = await prisma.project.create({
        data: {
          name: projectName,
          clientId: client.id,
          isActive: true,
        },
      });
    }

    // Get employee to find their line manager
    const employee = await prisma.employee.findUnique({
      where: { id: userId },
      select: { managerId: true },
    });

    if (!employee?.managerId) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Employee does not have a line manager assigned',
      } as IApiResponse<null>);
    }

    // Create overtime request
    const overtimeRequest = await prisma.overtimeRequest.create({
      data: {
        employeeId: userId,
        clientId: client.id,
        projectId: project.id,
        reason,
        canDoNextDay,
        urgencyReason: canDoNextDay ? null : urgencyReason,
        requestedHours,
        requestedDate: new Date(requestedDate),
        approvedBy: employee.managerId, // Set to line manager
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        approver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    const response: IApiResponse<any> = {
      success: true,
      data: overtimeRequest,
      message: 'Overtime request created successfully and sent to line manager',
    };

    return res.status(201).json(response);
  } catch (error) {
    console.error('Create overtime request error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Get all overtime requests for the logged-in employee
 * GET /overtime-requests/my-requests
 */
export const getMyOvertimeRequests = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const userId = (req as any).user?.userId;
    const { page = 1, pageSize = 10, status } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      } as IApiResponse<null>);
    }

    const skip = (Number(page) - 1) * Number(pageSize);
    const where: any = { employeeId: userId };

    if (status) {
      where.status = status;
    }

    const [requests, total] = await Promise.all([
      prisma.overtimeRequest.findMany({
        where,
        skip,
        take: Number(pageSize),
        orderBy: { createdAt: 'desc' },
        include: {
          client: true,
          project: true,
          approver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      prisma.overtimeRequest.count({ where }),
    ]);

    const response: IApiResponse<any> = {
      success: true,
      data: {
        requests,
        pagination: {
          page: Number(page),
          pageSize: Number(pageSize),
          total,
          totalPages: Math.ceil(total / Number(pageSize)),
        },
      },
      message: 'Overtime requests retrieved successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Get overtime requests error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Get overtime requests pending for the logged-in line manager
 * GET /overtime-requests/pending-approvals
 */
export const getPendingOvertimeRequests = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const userId = (req as any).user?.userId;
    const { page = 1, pageSize = 10 } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      } as IApiResponse<null>);
    }

    const skip = (Number(page) - 1) * Number(pageSize);

    const [requests, total] = await Promise.all([
      prisma.overtimeRequest.findMany({
        where: {
          approvedBy: userId,
          status: 'PENDING',
        },
        skip,
        take: Number(pageSize),
        orderBy: { createdAt: 'desc' },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              designation: true,
            },
          },
          client: true,
          project: true,
        },
      }),
      prisma.overtimeRequest.count({
        where: {
          approvedBy: userId,
          status: 'PENDING',
        },
      }),
    ]);

    const response: IApiResponse<any> = {
      success: true,
      data: {
        requests,
        pagination: {
          page: Number(page),
          pageSize: Number(pageSize),
          total,
          totalPages: Math.ceil(total / Number(pageSize)),
        },
      },
      message: 'Pending overtime requests retrieved successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Get pending overtime requests error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Approve an overtime request
 * PATCH /overtime-requests/:id/approve
 */
export const approveOvertimeRequest = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      } as IApiResponse<null>);
    }

    // Get the overtime request
    const overtimeRequest = await prisma.overtimeRequest.findUnique({
      where: { id },
    });

    if (!overtimeRequest) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Overtime request not found',
      } as IApiResponse<null>);
    }

    // RBAC: Verify the user is either the line manager or MANAGEMENT
    const { role } = getUserInfo(req);
    const isManagement = role === 'MANAGEMENT';
    const isLineManager = overtimeRequest.approvedBy === userId;
    
    if (!isManagement && !isLineManager) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Only line managers or MANAGEMENT can approve overtime requests',
      } as IApiResponse<null>);
    }

    // Update the request status
    const updated = await prisma.overtimeRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvalDate: new Date(),
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        client: true,
        project: true,
      },
    });

    // Notify employee via WebSocket about overtime approval
    const io = getIO();
    if (io && updated.employee) {
      io.to(`user:${updated.employee.id}`).emit('overtime-approved', {
        employeeId: updated.employee.id,
        approvedHours: updated.requestedHours,
        message: `${updated.requestedHours} hours overtime approved`,
        overtimeRequest: updated,
      });
    }

    const response: IApiResponse<any> = {
      success: true,
      data: updated,
      message: 'Overtime request approved successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Approve overtime request error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Reject an overtime request
 * PATCH /overtime-requests/:id/reject
 */
export const rejectOvertimeRequest = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      } as IApiResponse<null>);
    }

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'rejectionReason is required',
      } as IApiResponse<null>);
    }

    // Get the overtime request
    const overtimeRequest = await prisma.overtimeRequest.findUnique({
      where: { id },
    });

    if (!overtimeRequest) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Overtime request not found',
      } as IApiResponse<null>);
    }

    // RBAC: Verify the user is either the line manager or MANAGEMENT
    const { role } = getUserInfo(req);
    const isManagement = role === 'MANAGEMENT';
    const isLineManager = overtimeRequest.approvedBy === userId;
    
    if (!isManagement && !isLineManager) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Only line managers or MANAGEMENT can reject overtime requests',
      } as IApiResponse<null>);
    }

    // Update the request status
    const updated = await prisma.overtimeRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason,
        approvalDate: new Date(),
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        client: true,
        project: true,
      },
    });

    const response: IApiResponse<any> = {
      success: true,
      data: updated,
      message: 'Overtime request rejected successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Reject overtime request error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};
