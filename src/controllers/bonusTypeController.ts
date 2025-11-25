import { Request, Response } from 'express';
import { prisma } from '../index';
import { IApiResponse } from '../types';

/**
 * Get all bonus types
 * GET /bonus-types
 */
export const getBonusTypes = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { includeInactive } = req.query;

    const where: any = {};
    if (includeInactive !== 'true') {
      where.isActive = true;
    }

    const bonusTypes = await prisma.bonusType.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return res.status(200).json({
      success: true,
      data: bonusTypes,
      message: 'Bonus types retrieved successfully',
    } as IApiResponse<any>);
  } catch (error) {
    console.error('Error fetching bonus types:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch bonus types',
    } as IApiResponse<null>);
  }
};

