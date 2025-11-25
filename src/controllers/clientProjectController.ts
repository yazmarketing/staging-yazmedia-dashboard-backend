import { Request, Response } from 'express';
import { prisma } from '../index';
import { IApiResponse } from '../types';

/**
 * Get all clients
 * GET /clients
 */
export const getClients = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { page = 1, pageSize = 10, search, isActive = true } = req.query;

    const skip = (Number(page) - 1) * Number(pageSize);
    const where: any = {};

    if (isActive !== 'all') {
      where.isActive = isActive === 'true';
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: Number(pageSize),
        orderBy: { createdAt: 'desc' },
        include: {
          projects: {
            where: { isActive: true },
            select: { id: true, name: true },
          },
        },
      }),
      prisma.client.count({ where }),
    ]);

    const response: IApiResponse<any> = {
      success: true,
      data: {
        clients,
        pagination: {
          page: Number(page),
          pageSize: Number(pageSize),
          total,
          totalPages: Math.ceil(total / Number(pageSize)),
        },
      },
      message: 'Clients retrieved successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Get clients error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Create a new client
 * POST /clients
 */
export const createClient = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { name, email, phone, address, city, country, description } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Client name is required',
      } as IApiResponse<null>);
    }

    const client = await prisma.client.create({
      data: {
        name,
        email,
        phone,
        address,
        city,
        country,
        description,
      },
    });

    const response: IApiResponse<any> = {
      success: true,
      data: client,
      message: 'Client created successfully',
    };

    return res.status(201).json(response);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Client name already exists',
      } as IApiResponse<null>);
    }
    console.error('Create client error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Get all projects for a client
 * GET /clients/:clientId/projects
 */
export const getProjectsByClient = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { clientId } = req.params;
    const { page = 1, pageSize = 10, isActive = true } = req.query;

    // Verify client exists
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Client not found',
      } as IApiResponse<null>);
    }

    const skip = (Number(page) - 1) * Number(pageSize);
    const where: any = { clientId };

    if (isActive !== 'all') {
      where.isActive = isActive === 'true';
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        skip,
        take: Number(pageSize),
        orderBy: { createdAt: 'desc' },
        include: {
          client: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.project.count({ where }),
    ]);

    const response: IApiResponse<any> = {
      success: true,
      data: {
        projects,
        pagination: {
          page: Number(page),
          pageSize: Number(pageSize),
          total,
          totalPages: Math.ceil(total / Number(pageSize)),
        },
      },
      message: 'Projects retrieved successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Get projects error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Create a new project
 * POST /projects
 */
export const createProject = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { name, clientId, description, startDate, endDate } = req.body;

    if (!name || !clientId) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Project name and clientId are required',
      } as IApiResponse<null>);
    }

    // Verify client exists
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Client not found',
      } as IApiResponse<null>);
    }

    const project = await prisma.project.create({
      data: {
        name,
        clientId,
        description,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      },
      include: {
        client: {
          select: { id: true, name: true },
        },
      },
    });

    const response: IApiResponse<any> = {
      success: true,
      data: project,
      message: 'Project created successfully',
    };

    return res.status(201).json(response);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Project name already exists for this client',
      } as IApiResponse<null>);
    }
    console.error('Create project error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Get all active clients and projects (for dropdown selection in overtime request form)
 * GET /clients-projects/for-selection
 */
export const getClientsAndProjectsForSelection = async (_req: Request, res: Response): Promise<Response | void> => {
  try {
    const clients = await prisma.client.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        projects: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const response: IApiResponse<any> = {
      success: true,
      data: clients,
      message: 'Clients and projects retrieved successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Get clients and projects error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

