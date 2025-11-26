import { Request, Response } from 'express';
import { prisma } from '../index';
import { IApiResponse } from '../types';

/**
 * Get all holiday types
 * GET /holiday-types
 */
export const getHolidayTypes = async (_req: Request, res: Response): Promise<Response | void> => {
  try {
    const holidayTypes = await prisma.holidayType.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    const response: IApiResponse<any> = {
      success: true,
      data: holidayTypes,
      message: 'Holiday types retrieved successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Get holiday types error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Get all holidays with pagination and filters
 * GET /holidays
 * Query params: page, pageSize, type, search, startDate, endDate
 */
export const getHolidays = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const {
      page = 1,
      pageSize = 10,
      type,
      search,
      startDate,
      endDate,
    } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const pageSizeNum = parseInt(pageSize as string) || 10;
    const skip = (pageNum - 1) * pageSizeNum;

    // Build filter conditions
    const where: any = {};

    if (type) {
      where.holidayType = {
        type: type as string,
      };
    }

    if (search) {
      where.OR = [
        {
          name: {
            contains: search as string,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: search as string,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (startDate || endDate) {
      where.startDate = {};
      if (startDate) {
        where.startDate.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.startDate.lte = new Date(endDate as string);
      }
    }

    // Get total count
    const total = await prisma.holiday.count({ where });

    // Get holidays with pagination
    const holidays = await prisma.holiday.findMany({
      where,
      skip,
      take: pageSizeNum,
      include: {
        holidayType: true,
      },
      orderBy: {
        startDate: 'asc',
      },
    });

    // Format response
    const formattedHolidays = holidays.map((holiday) => ({
      id: holiday.id,
      name: holiday.name,
      description: holiday.description,
      startDate: holiday.startDate,
      endDate: holiday.endDate,
      type: holiday.holidayType.type,
      typeName: holiday.holidayType.name,
      duration: holiday.duration,
      createdAt: holiday.createdAt,
    }));

    const totalPages = Math.ceil(total / pageSizeNum);

    const response: IApiResponse<any> = {
      success: true,
      data: {
        data: formattedHolidays,
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages,
      },
      message: 'Holidays retrieved successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Get holidays error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Create a new holiday
 * POST /holidays
 */
export const createHoliday = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { name, description, startDate, endDate, holidayTypeId } = req.body;

    // Validate required fields
    if (!name || !startDate || !endDate || !holidayTypeId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, startDate, endDate, holidayTypeId',
      } as IApiResponse<null>);
    }

    // Validate holiday type exists
    const holidayType = await prisma.holidayType.findUnique({
      where: { id: holidayTypeId },
    });

    if (!holidayType) {
      return res.status(404).json({
        success: false,
        error: 'Holiday type not found',
      } as IApiResponse<null>);
    }

    // Calculate duration
    const start = new Date(startDate);
    const end = new Date(endDate);
    const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Create holiday
    const holiday = await prisma.holiday.create({
      data: {
        name,
        description,
        startDate: start,
        endDate: end,
        holidayTypeId,
        duration,
      },
      include: {
        holidayType: true,
      },
    });

    const response: IApiResponse<any> = {
      success: true,
      data: {
        id: holiday.id,
        name: holiday.name,
        description: holiday.description,
        startDate: holiday.startDate,
        endDate: holiday.endDate,
        type: holiday.holidayType.type,
        typeName: holiday.holidayType.name,
        duration: holiday.duration,
      },
      message: 'Holiday created successfully',
    };

    return res.status(201).json(response);
  } catch (error) {
    console.error('Create holiday error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

