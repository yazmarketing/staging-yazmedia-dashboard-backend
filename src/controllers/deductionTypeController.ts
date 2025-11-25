import { Request, Response } from 'express';
import { prisma } from '../index';
import { IApiResponse } from '../types';

/**
 * Get all deduction types
 * GET /deduction-types
 */
export const getDeductionTypes = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { includeInactive } = req.query;

    const where: any = {};
    if (includeInactive !== 'true') {
      where.isActive = true;
    }

    const deductionTypes = await prisma.deductionType.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return res.status(200).json({
      success: true,
      data: deductionTypes,
      message: 'Deduction types retrieved successfully',
    } as IApiResponse<any>);
  } catch (error) {
    console.error('Error fetching deduction types:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch deduction types',
    } as IApiResponse<null>);
  }
};

