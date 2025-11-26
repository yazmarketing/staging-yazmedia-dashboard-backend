import { Request, Response } from 'express';
import { prisma } from '../index';
import { IApiResponse, IPaginatedResponse } from '../types';

/**
 * Get all employees for management (view and manage roles/status)
 * GET /employees/management?page=1&pageSize=10&userStatus=ACTIVE&role=EMPLOYEE&search=john
 */
export const getAllEmployeesForManagement = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const userStatus = req.query.userStatus as string;
    const role = req.query.role as string;
    const search = req.query.search as string;

    // Build filter
    const where: any = {};
    if (userStatus) where.userStatus = userStatus;
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * pageSize;

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          department: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.employee.count({ where }),
    ]);

    // Format response
    const formattedEmployees = employees.map((emp) => ({
      id: emp.id,
      email: emp.email,
      firstName: emp.firstName,
      lastName: emp.lastName,
      fullName: `${emp.firstName} ${emp.lastName}`,
      employeeId: emp.employeeId,
      role: emp.role,
      userStatus: emp.userStatus,
      lastLogin: emp.lastLogin,
      designation: emp.designation,
      department: emp.department,
      createdAt: emp.createdAt,
      updatedAt: emp.updatedAt,
    }));

    const response: IApiResponse<IPaginatedResponse<any>> = {
      success: true,
      data: {
        data: formattedEmployees,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
      message: 'Employees retrieved successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Get all employees error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Toggle employee user status (ACTIVE <-> INACTIVE)
 * PATCH /employees/:id/toggle-status
 * If employee is ACTIVE, sets to INACTIVE
 * If employee is INACTIVE, sets to ACTIVE
 */
export const toggleEmployeeStatus = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;

    // Check if employee exists
    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found',
      } as IApiResponse<null>);
    }

    // Prevent toggling management employees (highest role)
    if (employee.role === 'MANAGEMENT') {
      return res.status(403).json({
        success: false,
        error: 'Cannot toggle management employee status',
      } as IApiResponse<null>);
    }

    // Toggle status
    const newStatus = employee.userStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const updated = await prisma.employee.update({
      where: { id },
      data: { userStatus: newStatus },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    const response: IApiResponse<any> = {
      success: true,
      data: {
        id: updated.id,
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        fullName: `${updated.firstName} ${updated.lastName}`,
        employeeId: updated.employeeId,
        role: updated.role,
        userStatus: updated.userStatus,
        designation: updated.designation,
        department: updated.department,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
      message: `Employee status toggled to ${newStatus} successfully`,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Toggle employee status error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Manage employee role (change role to EMPLOYEE, HR, FINANCE, or MANAGEMENT)
 * PATCH /employees/:id/role
 */
export const manageEmployeeRole = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    // Validate role
    const validRoles = ['EMPLOYEE', 'HR', 'FINANCE', 'MANAGEMENT'];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role. Must be one of: EMPLOYEE, HR, FINANCE, MANAGEMENT',
      } as IApiResponse<null>);
    }

    // Check if employee exists
    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found',
      } as IApiResponse<null>);
    }

    // Prevent changing admin role
    if (employee.role === 'MANAGEMENT') {
      return res.status(403).json({
        success: false,
        error: 'Cannot change management employee role',
      } as IApiResponse<null>);
    }

    // Update employee role
    const updated = await prisma.employee.update({
      where: { id },
      data: { role },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    const response: IApiResponse<any> = {
      success: true,
      data: {
        id: updated.id,
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        fullName: `${updated.firstName} ${updated.lastName}`,
        employeeId: updated.employeeId,
        role: updated.role,
        userStatus: updated.userStatus,
        designation: updated.designation,
        department: updated.department,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
      message: `Employee role changed to ${role} successfully`,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Manage employee role error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

