import { z } from 'zod';

// Auth Validation
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
});

// Employee Validation
export const createEmployeeSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  employeeId: z.string().min(1, 'Employee ID is required'),
  departmentId: z.string().min(1, 'Department is required'),
  designation: z.string().min(1, 'Designation is required'),
  joinDate: z.string().datetime(),
  baseSalary: z.number().positive('Salary must be positive'),
  totalSalary: z.number().positive('Total salary must be positive'),
});

// Leave Request Validation
export const createLeaveRequestSchema = z.object({
  leaveType: z.enum(['ANNUAL', 'SICK', 'MATERNITY', 'EMERGENCY', 'TOIL', 'WFH']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  numberOfDays: z.number().positive('Number of days must be positive'),
  reason: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;

