/**
 * Ownership Validation Utilities
 * 
 * These utilities ensure that EMPLOYEE role can only access their own data,
 * while HR, FINANCE, and MANAGEMENT can access all data.
 */

import { Request } from 'express';

/**
 * Check if a user can access a resource based on ownership
 * @param resourceEmployeeId - The employee ID that owns the resource
 * @param userId - The current user's ID
 * @param role - The current user's role
 * @returns true if access is allowed, false otherwise
 */
export const canAccessResource = (
  resourceEmployeeId: string,
  userId: string,
  role: string
): boolean => {
  // MANAGEMENT, HR, and FINANCE can access all resources
  if (role === 'MANAGEMENT' || role === 'HR' || role === 'FINANCE') {
    return true;
  }
  
  // EMPLOYEE can only access their own resources
  return resourceEmployeeId === userId;
};

/**
 * Ensure ownership for a resource - returns true if allowed, false otherwise
 * @param resourceEmployeeId - The employee ID that owns the resource
 * @param userId - The current user's ID
 * @param role - The current user's role
 * @returns true if access is allowed, false otherwise
 */
export const ensureOwnership = (
  resourceEmployeeId: string,
  userId: string,
  role: string
): boolean => {
  return canAccessResource(resourceEmployeeId, userId, role);
};

/**
 * Get user info from request
 * @param req - Express request object
 * @returns Object with userId and role
 */
export const getUserInfo = (req: Request): { userId: string; role: string } => {
  if (!req.user) {
    throw new Error('Unauthorized: User not authenticated');
  }
  
  return {
    userId: req.user.userId,
    role: req.user.role,
  };
};

/**
 * Check if user is a privileged role (can access all data)
 * @param role - User role
 * @returns true if role is MANAGEMENT, HR, or FINANCE
 */
export const isPrivilegedRole = (role: string): boolean => {
  return role === 'MANAGEMENT' || role === 'HR' || role === 'FINANCE';
};

/**
 * Build ownership filter for database queries
 * For EMPLOYEE role, filters to only their own data
 * For privileged roles, returns empty filter (all data)
 * @param userId - Current user's ID
 * @param role - Current user's role
 * @param employeeIdField - Name of the employee ID field in the model (default: 'employeeId')
 * @returns Filter object for Prisma queries
 */
export const buildOwnershipFilter = (
  userId: string,
  role: string,
  employeeIdField: string = 'employeeId'
): Record<string, string> => {
  // Privileged roles can see all data - return empty object (will be merged with where clause)
  if (isPrivilegedRole(role)) {
    return {};
  }
  
  // EMPLOYEE can only see their own data
  return { [employeeIdField]: userId };
};

