import { Request, Response } from 'express';
import { prisma } from '../index';
import { generateToken } from '../utils/jwt';
import { comparePassword } from '../utils/password';
import { verifyGoogleToken } from '../utils/googleAuth';
import { ILoginRequest, IAuthResponse, IApiResponse } from '../types';

/**
 * Login with email and password
 * POST /auth/login
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as ILoginRequest;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      } as IApiResponse<null>);
    }

    // Find employee by email
    const employee = await prisma.employee.findUnique({
      where: { email },
    });

    console.log('🔍 Employee fetched from database:', {
      id: employee?.id,
      email: employee?.email,
      firstName: employee?.firstName,
      lastName: employee?.lastName,
      role: employee?.role,
      userStatus: employee?.userStatus,
      status: employee?.status,
    });

    if (!employee) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      } as IApiResponse<null>);
    }

    // Compare password
    const isPasswordValid = await comparePassword(password, employee.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      } as IApiResponse<null>);
    }

    // Update last login
    await prisma.employee.update({
      where: { id: employee.id },
      data: { lastLogin: new Date() },
    });

    // Generate JWT token
    const token = generateToken({
      userId: employee.id,
      email: employee.email,
      role: employee.role,
    });

    // Prepare user object to return
    const userObject = {
      id: employee.id,
      email: employee.email,
      firstName: employee.firstName,
      lastName: employee.lastName,
      role: employee.role,
      status: employee.userStatus,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
    };

    console.log('✅ User object being returned to frontend:', {
      ...userObject,
      role: userObject.role,
      roleType: typeof userObject.role,
    });

    // Return response
    const response: IApiResponse<IAuthResponse> = {
      success: true,
      data: {
        token,
        user: userObject,
      },
      message: 'Login successful',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};



/**
 * Authenticate with Google JWT token
 * POST /auth/google
 */
export const googleAuth = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    // Validate input
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token is required',
      } as IApiResponse<null>);
    }

    // Verify Google token
    const googleUser = await verifyGoogleToken(token);

    // Find existing employee by email
    let employee = await prisma.employee.findUnique({
      where: { email: googleUser.email },
    });

    console.log('🔍 Employee fetched from database (Google Auth):', {
      id: employee?.id,
      email: employee?.email,
      firstName: employee?.firstName,
      lastName: employee?.lastName,
      role: employee?.role,
      userStatus: employee?.userStatus,
      status: employee?.status,
    });

    if (!employee) {
      // Employee doesn't exist - return error
      // (Frontend should handle this and prompt user to contact admin)
      return res.status(404).json({
        success: false,
        error: 'Employee not found. Please contact your administrator.',
      } as IApiResponse<null>);
    }

    // Check if employee is active
    if (employee.userStatus !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        error: 'Your account is not active. Please contact your administrator.',
      } as IApiResponse<null>);
    }

    // Update last login
    await prisma.employee.update({
      where: { id: employee.id },
      data: { lastLogin: new Date() },
    });

    // Generate JWT token
    const jwtToken = generateToken({
      userId: employee.id,
      email: employee.email,
      role: employee.role,
    });

    // Prepare user object to return
    const userObject = {
      id: employee.id,
      email: employee.email,
      firstName: employee.firstName,
      lastName: employee.lastName,
      role: employee.role,
      status: employee.userStatus,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
    };

    console.log('✅ User object being returned to frontend (Google Auth):', {
      ...userObject,
      role: userObject.role,
      roleType: typeof userObject.role,
    });

    // Return response
    const response: IApiResponse<IAuthResponse> = {
      success: true,
      message: 'Sign in successful',
      data: {
        token: jwtToken,
        user: userObject,
      },
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Google auth error:', error);
    return res.status(401).json({
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed',
    } as IApiResponse<null>);
  }
};

