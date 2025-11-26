// @ts-ignore - Prisma enums are exported but TypeScript language server has issues recognizing them
import type { EmployeeRole, EmployeeUserStatus, EmploymentType, EmployeeStatus, WorkMode, LeaveType, LeaveStatus, PrismaClient } from '@prisma/client';

// User Types
export interface IUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: EmployeeRole;
  status: EmployeeUserStatus;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILoginRequest {
  email: string;
  password: string;
}

export interface IRegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface IAuthResponse {
  token: string;
  user: IUser;
}

// Employee Types
export interface IEmployee {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  employeeId: string;
  departmentId: string;
  designation: string;
  employmentType: EmploymentType;
  status: EmployeeStatus;
  workMode: WorkMode;
  joinDate: Date;
  baseSalary: number;
  totalSalary: number;
}

// Leave Types
export interface ILeaveRequest {
  id: string;
  userId: string;
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  numberOfDays: number;
  reason?: string;
  status: LeaveStatus;
  createdAt: Date;
}

// API Response Types
export interface IApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: Record<string, any>;
}

export interface IPaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// JWT Payload
export interface IJWTPayload {
  userId: string;
  email: string;
  role: EmployeeRole;
  iat?: number;
  exp?: number;
}

