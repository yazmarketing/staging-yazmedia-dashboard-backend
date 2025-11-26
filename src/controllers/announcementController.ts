import { Request, Response } from 'express';
import { prisma } from '../index';
import { IApiResponse } from '../types';

/**
 * Get all announcements with filters
 * GET /announcements
 * Query params: page, pageSize, status, priority, departmentId, search
 */
export const getAnnouncements = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const {
      page = 1,
      pageSize = 10,
      status,
      priority,
      departmentId,
      search,
    } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const pageSizeNum = parseInt(pageSize as string) || 10;
    const skip = (pageNum - 1) * pageSizeNum;

    // Build filter conditions
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priority = priority;
    }

    if (departmentId) {
      where.targetDepartments = {
        some: {
          departmentId: departmentId as string,
        },
      };
    }

    // Search by title or content
    if (search) {
      where.OR = [
        {
          title: {
            contains: search as string,
            mode: 'insensitive',
          },
        },
        {
          content: {
            contains: search as string,
            mode: 'insensitive',
          },
        },
      ];
    }

    // Get total count
    const total = await (prisma as any).announcement.count({ where });

    // Get announcements with pagination
    const announcements = await (prisma as any).announcement.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        targetDepartments: {
          include: {
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: pageSizeNum,
    });

    const response: IApiResponse<any> = {
      success: true,
      data: {
        announcements,
        pagination: {
          page: pageNum,
          pageSize: pageSizeNum,
          total,
          totalPages: Math.ceil(total / pageSizeNum),
        },
      },
      message: 'Announcements retrieved successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Get announcements error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Get single announcement by ID
 * GET /announcements/:id
 */
export const getAnnouncementById = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;

    const announcement = await (prisma as any).announcement.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        targetDepartments: {
          include: {
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!announcement) {
      return res.status(404).json({
        success: false,
        error: 'Announcement not found',
      } as IApiResponse<null>);
    }

    const response: IApiResponse<any> = {
      success: true,
      data: announcement,
      message: 'Announcement retrieved successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Get announcement by ID error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Create new announcement
 * POST /announcements
 */
export const createAnnouncement = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { title, content, priority, departmentIds } = req.body;
    const userId = (req as any).user?.userId;

    // Validate required fields
    if (!title || !content || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: title, content',
      } as IApiResponse<null>);
    }

    // Create announcement
    const announcement = await (prisma as any).announcement.create({
      data: {
        title,
        content,
        priority: priority || 'MEDIUM',
        status: 'DRAFT',
        createdBy: userId,
      },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Add target departments if provided
    if (departmentIds && Array.isArray(departmentIds) && departmentIds.length > 0) {
      await Promise.all(
        departmentIds.map((deptId: string) =>
          (prisma as any).announcementDepartment.create({
            data: {
              announcementId: announcement.id,
              departmentId: deptId,
            },
          })
        )
      );
    }

    const response: IApiResponse<any> = {
      success: true,
      data: announcement,
      message: 'Announcement created successfully',
    };

    return res.status(201).json(response);
  } catch (error) {
    console.error('Create announcement error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Update announcement
 * PUT /announcements/:id
 */
export const updateAnnouncement = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { title, content, priority, status, departmentIds } = req.body;

    // Check if announcement exists
    const existing = await (prisma as any).announcement.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Announcement not found',
      } as IApiResponse<null>);
    }

    // Update announcement
    const announcement = await (prisma as any).announcement.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(content && { content }),
        ...(priority && { priority }),
        ...(status && { status }),
        ...(status === 'PUBLISHED' && { publishedAt: new Date() }),
      },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        targetDepartments: {
          include: {
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Update target departments if provided
    if (departmentIds && Array.isArray(departmentIds)) {
      // Delete existing department associations
      await (prisma as any).announcementDepartment.deleteMany({
        where: { announcementId: id },
      });

      // Create new associations
      if (departmentIds.length > 0) {
        await Promise.all(
          departmentIds.map((deptId: string) =>
            (prisma as any).announcementDepartment.create({
              data: {
                announcementId: id,
                departmentId: deptId,
              },
            })
          )
        );
      }
    }

    const response: IApiResponse<any> = {
      success: true,
      data: announcement,
      message: 'Announcement updated successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Update announcement error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Delete announcement
 * DELETE /announcements/:id
 */
export const deleteAnnouncement = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;

    // Check if announcement exists
    const existing = await (prisma as any).announcement.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Announcement not found',
      } as IApiResponse<null>);
    }

    // Delete announcement (cascade will delete department associations)
    await (prisma as any).announcement.delete({
      where: { id },
    });

    const response: IApiResponse<null> = {
      success: true,
      message: 'Announcement deleted successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Delete announcement error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Publish announcement
 * PATCH /announcements/:id/publish
 */
export const publishAnnouncement = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;

    const announcement = await (prisma as any).announcement.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        targetDepartments: {
          include: {
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    const response: IApiResponse<any> = {
      success: true,
      data: announcement,
      message: 'Announcement published successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Publish announcement error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Get recipients data for announcement creation
 * Returns departments with their employees and all employees list
 * GET /announcements/recipients/data
 */
export const getRecipientsData = async (_req: Request, res: Response): Promise<Response | void> => {
  try {
    // Get all departments with their employees
    const departments = await prisma.department.findMany({
      include: {
        employees: {
          where: {
            status: 'ACTIVE', // Only active employees
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            designation: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Get all active employees for mentions/direct selection
    const allEmployees = await prisma.employee.findMany({
      where: {
        status: 'ACTIVE',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        designation: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        firstName: 'asc',
      },
    });

    const response: IApiResponse<any> = {
      success: true,
      data: {
        departments: departments.map(dept => ({
          id: dept.id,
          name: dept.name,
          code: dept.code,
          employeeCount: dept.employees.length,
          employees: dept.employees,
        })),
        allEmployees: allEmployees.map(emp => ({
          id: emp.id,
          firstName: emp.firstName,
          lastName: emp.lastName,
          fullName: `${emp.firstName} ${emp.lastName}`,
          email: emp.email,
          designation: emp.designation,
          departmentId: emp.department?.id,
          departmentName: emp.department?.name,
        })),
      },
      message: 'Recipients data retrieved successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Get recipients data error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};
