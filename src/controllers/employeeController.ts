import { Request, Response } from 'express';
import { EmployeeStatus, EmploymentType, WorkMode, EmployeeUserStatus } from '@prisma/client';
import { prisma } from '../index';
import { getTimezoneForCountry } from '../utils/timezoneHelper';
import { IApiResponse, IPaginatedResponse } from '../types';
import { buildOwnershipFilter, getUserInfo, ensureOwnership } from '../utils/ownershipValidation';
import { hashPassword } from '../utils/password';

const PERMANENT_LABELS = new Set(['permanent', 'permanent contract', 'indefinite', 'no fixed term']);

export const parseMonthsMetadata = (
  input?: string | null
): { months: number | null; isPermanent: boolean } => {
  if (input === null || input === undefined) {
    return { months: null, isPermanent: false };
  }

  const normalized = String(input).trim();
  if (!normalized) {
    return { months: null, isPermanent: false };
  }

  const lowered = normalized.toLowerCase();
  if (PERMANENT_LABELS.has(lowered)) {
    return { months: null, isPermanent: true };
  }

  const match = lowered.match(/(\d+(\.\d+)?)/);
  if (!match) {
    return { months: null, isPermanent: false };
  }

  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { months: null, isPermanent: false };
  }

  return { months: Math.round(parsed), isPermanent: false };
};

export const formatMonthsLabel = (months: number): string => {
  const rounded = Math.round(months);
  return `${rounded} month${rounded === 1 ? '' : 's'}`;
};

export const computeConfirmationDate = (
  joinDate: Date | null | undefined,
  months: number | null
): Date | null => {
  if (!joinDate || months === null) return null;

  const base = new Date(joinDate);
  base.setHours(0, 0, 0, 0);

  const result = new Date(base);
  result.setMonth(result.getMonth() + months);
  result.setHours(0, 0, 0, 0);
  return result;
};

export const computeContractExpiryDate = (
  joinDate: Date | null | undefined,
  months: number | null
): Date | null => {
  if (!joinDate || months === null) return null;

  const base = new Date(joinDate);
  base.setHours(0, 0, 0, 0);

  const result = new Date(base);
  result.setMonth(result.getMonth() + months);
  result.setDate(result.getDate() - 1);
  result.setHours(23, 59, 59, 999);
  return result;
};

/**
 * Helper function to compute display status based on hierarchy
 * Priority: userStatus (INACTIVE/SUSPENDED) > status (ON_LEAVE/TERMINATED/ACTIVE)
 * @param employee - Employee object with userStatus and status fields
 * @returns Computed display status string
 */
// @ts-ignore - False positive: function is used on lines 102 and 163
function getDisplayStatus(employee: any): string {
  // Highest priority: userStatus INACTIVE means employee is not in company
  if (employee.userStatus === 'INACTIVE') return 'INACTIVE';

  // Second priority: userStatus SUSPENDED
  if (employee.userStatus === 'SUSPENDED') return 'SUSPENDED';

  // Otherwise, return employment status
  return employee.status;
}

/**
 * Get all employees with filters and pagination
 * GET /employees?page=1&pageSize=10&status=ACTIVE&departmentId=xxx&workMode=HYBRID&employmentType=FULL_TIME&search=john
 *
 * Status Hierarchy:
 * 1. userStatus = INACTIVE (not in company) - highest priority
 * 2. userStatus = SUSPENDED
 * 3. status = ON_LEAVE, TERMINATED, or ACTIVE - lowest priority
 */
const formatEnumLabel = (value: string): string =>
  value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const getEmployees = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { userId, role } = getUserInfo(req);
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const status = req.query.status as string;
    const departmentId = req.query.departmentId as string;
    const workMode = req.query.workMode as string;
    const employmentType = req.query.employmentType as string;
    const search = req.query.search as string;

    // Build filter - handle status hierarchy
    const where: any = {};

    // RBAC: EMPLOYEE can only see themselves, privileged roles can see all
    const ownershipFilter = buildOwnershipFilter(userId, role, 'id');
    if (Object.keys(ownershipFilter).length > 0) {
      where.id = ownershipFilter.id;
    }

    // If filtering by status, we need to check both userStatus and status fields
    if (status) {
      if (status === 'INACTIVE') {
        // INACTIVE means userStatus is INACTIVE
        where.userStatus = 'INACTIVE';
      } else if (status === 'SUSPENDED') {
        // SUSPENDED means userStatus is SUSPENDED
        where.userStatus = 'SUSPENDED';
      } else {
        // For other statuses (ACTIVE, ON_LEAVE, TERMINATED), check employment status
        // but exclude employees with userStatus INACTIVE or SUSPENDED
        where.AND = [
          { status },
          { userStatus: { not: 'INACTIVE' } },
          { userStatus: { not: 'SUSPENDED' } },
        ];
      }
    }

    if (departmentId) where.departmentId = departmentId;
    if (workMode) where.workMode = workMode;
    if (employmentType) where.employmentType = employmentType;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * pageSize;

    const [employees, total, departments] = await Promise.all([
      prisma.employee.findMany({
        where,
        skip,
        take: pageSize,
        include: { department: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.employee.count({ where }),
      prisma.department.findMany({
        select: {
          id: true,
          name: true,
          code: true,
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    // Format response with computed display status
    // Replace the raw status field with the computed displayStatus
    const formattedEmployees = employees.map((emp) => {
      const { status, ...rest } = emp;
      return {
        ...rest,
        status: getDisplayStatus(emp), // Replace status with computed value
      };
    });

    const statusOptions = Array.from(
      new Set<string>([
        ...Object.values(EmployeeStatus).filter((status) => status !== 'ON_LEAVE'),
        ...Object.values(EmployeeUserStatus),
      ])
    );

    const filters = {
      statuses: statusOptions.map((status) => ({
        value: status,
        label: formatEnumLabel(status),
      })),
      employmentTypes: Object.values(EmploymentType).map((type) => ({
        value: type,
        label: formatEnumLabel(type),
      })),
      workModes: Object.values(WorkMode).map((mode) => ({
        value: mode,
        label: formatEnumLabel(mode),
      })),
      departments: departments.map((dept) => ({
        value: dept.id,
        label: dept.name,
        code: dept.code,
      })),
    };

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
      meta: {
        filters,
      },
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Get employees error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Get single employee by ID
 * GET /employees/:id
 */
export const getEmployeeById = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { userId, role } = getUserInfo(req);

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        department: true,
      },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found',
      } as IApiResponse<null>);
    }

    // RBAC: EMPLOYEE can only access their own data
    if (!ensureOwnership(employee.id, userId, role)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You can only access your own data',
      } as IApiResponse<null>);
    }

    // Replace the raw status field with the computed display status
    const { status, ...rest } = employee;
    const employeeWithDisplayStatus = {
      ...rest,
      status: getDisplayStatus(employee), // Replace status with computed value
    };

    const response: IApiResponse<any> = {
      success: true,
      data: employeeWithDisplayStatus,
      message: 'Employee retrieved successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Get employee error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Create new employee
 * POST /employees
 */
export const createEmployee = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      employeeId,
      departmentId,
      designation,
      employmentType,
      workMode,
      joinDate,
      baseSalary,
      telephoneAllowance = 0,
      housingAllowance = 0,
      transportationAllowance = 0,
      totalSalary,
      dateOfBirth,
      gender,
      address,
      city,
      state,
      zipCode,
      country,
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !employeeId || !departmentId || !designation || !joinDate || !baseSalary) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      } as IApiResponse<null>);
    }

    // Check if employee already exists
    const existingEmployee = await prisma.employee.findFirst({
      where: {
        OR: [{ email }, { employeeId }],
      },
    });

    if (existingEmployee) {
      return res.status(409).json({
        success: false,
        error: 'Employee with this email or ID already exists',
      } as IApiResponse<null>);
    }

    // Calculate totalSalary if not provided: baseSalary + telephoneAllowance + housingAllowance + transportationAllowance
    const calculatedTotalSalary = totalSalary || (baseSalary + telephoneAllowance + housingAllowance + transportationAllowance);

    // Auto-set timezone based on country if country is provided
    const timezone = country ? getTimezoneForCountry(country) : 'Asia/Dubai';

    // Hash password before storing
    const hashedPassword = password ? await hashPassword(password) : await hashPassword('TempPassword123!');

    // Create employee
    const employee = await prisma.employee.create({
      data: {
        firstName,
        lastName,
        email,
        password: hashedPassword,
        phone,
        employeeId,
        departmentId,
        designation,
        employmentType: employmentType || 'FULL_TIME',
        workMode: workMode || 'ON_SITE',
        joinDate: new Date(joinDate),
        baseSalary,
        telephoneAllowance,
        housingAllowance,
        transportationAllowance,
        totalSalary: calculatedTotalSalary,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        gender,
        address,
        city,
        state,
        zipCode,
        country,
        timezone,
      },
      include: { department: true },
    });

    const response: IApiResponse<any> = {
      success: true,
      data: employee,
      message: 'Employee created successfully',
    };

    return res.status(201).json(response);
  } catch (error) {
    console.error('Create employee error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Update employee
 * PUT /employees/:id
 */
export const updateEmployee = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if employee exists
    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found',
      } as IApiResponse<null>);
    }

    // Prepare update data with date conversions
    const dataToUpdate: any = {
      ...updateData,
      joinDate: updateData.joinDate ? new Date(updateData.joinDate) : undefined,
      dateOfBirth: updateData.dateOfBirth ? new Date(updateData.dateOfBirth) : undefined,
      terminationDate: updateData.terminationDate ? new Date(updateData.terminationDate) : undefined,
    };

    // Auto-update timezone if country is being updated
    if (updateData.country !== undefined) {
      dataToUpdate.timezone = getTimezoneForCountry(updateData.country);
    }

    // Auto-calculate totalSalary if any salary component is being updated
    if (updateData.baseSalary !== undefined || updateData.telephoneAllowance !== undefined || 
        updateData.housingAllowance !== undefined || updateData.transportationAllowance !== undefined) {
      const newBaseSalary = updateData.baseSalary !== undefined ? updateData.baseSalary : employee.baseSalary;
      const newTelephoneAllowance = updateData.telephoneAllowance !== undefined ? updateData.telephoneAllowance : employee.telephoneAllowance;
      const newHousingAllowance = updateData.housingAllowance !== undefined ? updateData.housingAllowance : employee.housingAllowance;
      const newTransportationAllowance = updateData.transportationAllowance !== undefined ? updateData.transportationAllowance : employee.transportationAllowance;

      // Only auto-calculate if totalSalary is not explicitly provided
      if (updateData.totalSalary === undefined) {
        dataToUpdate.totalSalary = newBaseSalary + newTelephoneAllowance + newHousingAllowance + newTransportationAllowance;
      }
    }

    // Update employee
    const updated = await prisma.employee.update({
      where: { id },
      data: dataToUpdate,
      include: { department: true },
    });

    const response: IApiResponse<any> = {
      success: true,
      data: updated,
      message: 'Employee updated successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Update employee error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Patch update employee with nested fields
 * PATCH /employees/:id
 * Supports partial updates with nested objects: personalInfo, employmentDetails, paymentInfo
 */
export const patchUpdateEmployee = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { personalInfo, employmentDetails, paymentInfo } = req.body;

    // Check if employee exists
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { bankDetails: true },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found',
      } as IApiResponse<null>);
    }

    // Build employee update data from personalInfo and employmentDetails
    const employeeUpdateData: any = {};

    // Process personalInfo fields
    if (personalInfo) {
      if (personalInfo.firstName !== undefined) employeeUpdateData.firstName = personalInfo.firstName;
      if (personalInfo.lastName !== undefined) employeeUpdateData.lastName = personalInfo.lastName;
      if (personalInfo.workEmail !== undefined) employeeUpdateData.email = personalInfo.workEmail;
      if (personalInfo.personalEmail !== undefined) employeeUpdateData.personalEmail = personalInfo.personalEmail;
      if (personalInfo.phone !== undefined) employeeUpdateData.phone = personalInfo.phone;
      if (personalInfo.dateOfBirth !== undefined) {
        // Only convert to Date if it's a valid date string
        if (personalInfo.dateOfBirth) {
          const dateObj = new Date(personalInfo.dateOfBirth);
          employeeUpdateData.dateOfBirth = isNaN(dateObj.getTime()) ? null : dateObj;
        } else {
          employeeUpdateData.dateOfBirth = null;
        }
      }
      if (personalInfo.gender !== undefined) employeeUpdateData.gender = personalInfo.gender;
      if (personalInfo.molId !== undefined) employeeUpdateData.molId = personalInfo.molId;
      if (personalInfo.address !== undefined) employeeUpdateData.address = personalInfo.address;
      if (personalInfo.city !== undefined) employeeUpdateData.city = personalInfo.city;
      if (personalInfo.state !== undefined) employeeUpdateData.state = personalInfo.state;
      if (personalInfo.zipCode !== undefined) employeeUpdateData.zipCode = personalInfo.zipCode;
      if (personalInfo.country !== undefined) employeeUpdateData.country = personalInfo.country;
    }

    const actorId = req.user?.userId ?? null;
    let probationPeriodInput: string | null | undefined;
    let contractDurationInput: string | null | undefined;
    let terminationLastWorkingDayInput: string | null | undefined;

    // Process employmentDetails fields
    if (employmentDetails) {
      if (employmentDetails.designation !== undefined) employeeUpdateData.designation = employmentDetails.designation;
      if (employmentDetails.employmentType !== undefined) employeeUpdateData.employmentType = employmentDetails.employmentType;
      if (employmentDetails.workMode !== undefined) employeeUpdateData.workMode = employmentDetails.workMode;
      if (employmentDetails.joinDate !== undefined) {
        if (employmentDetails.joinDate) {
          const dateObj = new Date(employmentDetails.joinDate);
          employeeUpdateData.joinDate = isNaN(dateObj.getTime()) ? null : dateObj;
        } else {
          employeeUpdateData.joinDate = null;
        }
      }
      if (employmentDetails.probationPeriod !== undefined) {
        probationPeriodInput = employmentDetails.probationPeriod;
      }
      if (employmentDetails.contractDuration !== undefined) {
        contractDurationInput = employmentDetails.contractDuration;
      }
      if (employmentDetails.terminationLastWorkingDay !== undefined) {
        terminationLastWorkingDayInput = employmentDetails.terminationLastWorkingDay;
      }
      // Handle status changes with termination logic
      if (employmentDetails.status !== undefined) {
        const newStatus = employmentDetails.status;
        
        // If setting to TERMINATED, require terminationDate and terminationReason
        if (newStatus === 'TERMINATED') {
          if (!employmentDetails.terminationDate || !employmentDetails.terminationReason) {
            return res.status(400).json({
              success: false,
              error: 'Termination date and reason are required when setting status to TERMINATED',
            } as IApiResponse<null>);
          }
          
          employeeUpdateData.status = newStatus;
          const terminationDateObj = new Date(employmentDetails.terminationDate);
          employeeUpdateData.terminationDate = terminationDateObj;
          employeeUpdateData.terminationReason = employmentDetails.terminationReason;
          const lastWorkingDaySource = terminationLastWorkingDayInput ?? employmentDetails.terminationDate;
          const lastWorkingDayObj = lastWorkingDaySource ? new Date(lastWorkingDaySource) : terminationDateObj;
          employeeUpdateData.terminationLastWorkingDay = isNaN(lastWorkingDayObj.getTime()) ? terminationDateObj : lastWorkingDayObj;
          employeeUpdateData.terminationRecordedAt = new Date();
          if (actorId) {
            employeeUpdateData.terminatedById = actorId;
          }
        } else if (newStatus !== 'TERMINATED') {
          // If changing from TERMINATED to another status, clear termination fields
          employeeUpdateData.status = newStatus;
          if (employee.status === 'TERMINATED') {
            employeeUpdateData.terminationDate = null;
            employeeUpdateData.terminationReason = null;
            employeeUpdateData.terminationLastWorkingDay = null;
            employeeUpdateData.terminationRecordedAt = null;
            employeeUpdateData.terminatedById = null;
          }
        } else {
          employeeUpdateData.status = newStatus;
        }
      }
      
      // Handle terminationDate and terminationReason separately
      if (employmentDetails.terminationDate !== undefined) {
        if (employmentDetails.terminationDate) {
          const terminationDateObj = new Date(employmentDetails.terminationDate);
          employeeUpdateData.terminationDate = isNaN(terminationDateObj.getTime()) ? null : terminationDateObj;
          if (terminationLastWorkingDayInput === undefined) {
            employeeUpdateData.terminationLastWorkingDay = isNaN(terminationDateObj.getTime()) ? null : terminationDateObj;
          }
        } else {
          employeeUpdateData.terminationDate = null;
          if (terminationLastWorkingDayInput === undefined) {
            employeeUpdateData.terminationLastWorkingDay = null;
          }
        }
      }
      if (employmentDetails.terminationLastWorkingDay !== undefined) {
        if (employmentDetails.terminationLastWorkingDay) {
          const lastWorkingDayObj = new Date(employmentDetails.terminationLastWorkingDay);
          employeeUpdateData.terminationLastWorkingDay = isNaN(lastWorkingDayObj.getTime()) ? null : lastWorkingDayObj;
        } else {
          employeeUpdateData.terminationLastWorkingDay = null;
        }
      }
      if (employmentDetails.terminationReason !== undefined) {
        employeeUpdateData.terminationReason = employmentDetails.terminationReason;
      }
      // Handle managerId assignment
      if (employmentDetails.managerId !== undefined) {
        employeeUpdateData.managerId = employmentDetails.managerId || null;
      }
    }

    // Derive confirmation and contract expiry dates based on join date and duration inputs
    const joinDateForCalculation: Date | null =
      employeeUpdateData.joinDate !== undefined
        ? employeeUpdateData.joinDate
        : employee.joinDate;

    const probationSource =
      probationPeriodInput !== undefined ? probationPeriodInput : employee.probationPeriod;
    const probationMetadata = parseMonthsMetadata(probationSource);

    if (probationMetadata.months !== null && joinDateForCalculation) {
      employeeUpdateData.probationPeriod = formatMonthsLabel(probationMetadata.months);
      employeeUpdateData.confirmationDate = computeConfirmationDate(
        joinDateForCalculation,
        probationMetadata.months
      );
    } else if (probationPeriodInput !== undefined) {
      employeeUpdateData.probationPeriod = probationPeriodInput || null;
      employeeUpdateData.confirmationDate = null;
    } else if (employeeUpdateData.joinDate !== undefined && joinDateForCalculation) {
      const existingProbationMetadata = parseMonthsMetadata(employee.probationPeriod);
      if (existingProbationMetadata.months !== null) {
        employeeUpdateData.probationPeriod = formatMonthsLabel(existingProbationMetadata.months);
        employeeUpdateData.confirmationDate = computeConfirmationDate(
          joinDateForCalculation,
          existingProbationMetadata.months
        );
      }
    }

    const contractSource =
      contractDurationInput !== undefined ? contractDurationInput : employee.contractDuration;
    const contractMetadata = parseMonthsMetadata(contractSource);

    if (contractMetadata.isPermanent) {
      employeeUpdateData.contractDuration = 'Permanent';
      employeeUpdateData.contractExpiryDate = null;
    } else if (contractMetadata.months !== null && joinDateForCalculation) {
      employeeUpdateData.contractDuration = formatMonthsLabel(contractMetadata.months);
      employeeUpdateData.contractExpiryDate = computeContractExpiryDate(
        joinDateForCalculation,
        contractMetadata.months
      );
    } else if (contractDurationInput !== undefined) {
      employeeUpdateData.contractDuration = contractDurationInput || null;
      if (!contractDurationInput) {
        employeeUpdateData.contractExpiryDate = null;
      }
    } else if (employeeUpdateData.joinDate !== undefined && joinDateForCalculation) {
      const existingContractMetadata = parseMonthsMetadata(employee.contractDuration);
      if (existingContractMetadata.isPermanent) {
        employeeUpdateData.contractDuration = 'Permanent';
        employeeUpdateData.contractExpiryDate = null;
      } else if (existingContractMetadata.months !== null) {
        employeeUpdateData.contractDuration = formatMonthsLabel(existingContractMetadata.months);
        employeeUpdateData.contractExpiryDate = computeContractExpiryDate(
          joinDateForCalculation,
          existingContractMetadata.months
        );
      }
    }

    // Update employee with flat fields
    await prisma.employee.update({
      where: { id },
      data: employeeUpdateData,
      include: {
        department: true,
        bankDetails: true,
      },
    });

    // Handle paymentInfo (bank details and salary) - separate model
    if (paymentInfo) {
      const attemptingBankUpdate =
        paymentInfo.paymentMethod !== undefined ||
        paymentInfo.bankName !== undefined ||
        paymentInfo.accountHolderName !== undefined ||
        paymentInfo.iban !== undefined ||
        paymentInfo.routingNumber !== undefined;

      // This endpoint is protected by requireRole('HR', 'MANAGEMENT') middleware
      // So HR and MANAGEMENT can edit bank details directly
      const bankUpdateData: any = {};
      const salaryUpdateData: any = {};

      // Process bank details - create if doesn't exist, update if exists
      // Since this endpoint requires HR or MANAGEMENT role, allow bank detail edits
      if (attemptingBankUpdate) {
        if (paymentInfo.paymentMethod !== undefined) bankUpdateData.paymentMethod = paymentInfo.paymentMethod;
        if (paymentInfo.bankName !== undefined) bankUpdateData.bankName = paymentInfo.bankName;
        if (paymentInfo.accountHolderName !== undefined) bankUpdateData.accountHolderName = paymentInfo.accountHolderName;
        if (paymentInfo.iban !== undefined) bankUpdateData.iban = paymentInfo.iban;
        if (paymentInfo.routingNumber !== undefined) bankUpdateData.routingNumber = paymentInfo.routingNumber;

        // Upsert bank details (create if doesn't exist, update if exists)
        await prisma.employeeBank.upsert({
          where: { employeeId: id },
          create: {
            employeeId: id,
            paymentMethod: bankUpdateData.paymentMethod || '',
            bankName: bankUpdateData.bankName || '',
            accountHolderName: bankUpdateData.accountHolderName || '',
            iban: bankUpdateData.iban || '',
            routingNumber: bankUpdateData.routingNumber || '',
          },
          update: bankUpdateData,
        });
      }

      // Process salary fields
      if (paymentInfo.baseSalary !== undefined) salaryUpdateData.baseSalary = paymentInfo.baseSalary;
      if (paymentInfo.telephoneAllowance !== undefined) salaryUpdateData.telephoneAllowance = paymentInfo.telephoneAllowance;
      if (paymentInfo.housingAllowance !== undefined) salaryUpdateData.housingAllowance = paymentInfo.housingAllowance;
      if (paymentInfo.transportationAllowance !== undefined) salaryUpdateData.transportationAllowance = paymentInfo.transportationAllowance;
      if (paymentInfo.totalSalary !== undefined) {
        salaryUpdateData.totalSalary = paymentInfo.totalSalary;
      } else if (paymentInfo.baseSalary !== undefined || paymentInfo.telephoneAllowance !== undefined || 
                 paymentInfo.housingAllowance !== undefined || paymentInfo.transportationAllowance !== undefined) {
        // Auto-calculate totalSalary if any component changed
        const currentEmployee = await prisma.employee.findUnique({ where: { id } });
        if (currentEmployee) {
          const newBaseSalary = paymentInfo.baseSalary !== undefined ? paymentInfo.baseSalary : currentEmployee.baseSalary;
          const newTelephoneAllowance = paymentInfo.telephoneAllowance !== undefined ? paymentInfo.telephoneAllowance : currentEmployee.telephoneAllowance;
          const newHousingAllowance = paymentInfo.housingAllowance !== undefined ? paymentInfo.housingAllowance : currentEmployee.housingAllowance;
          const newTransportationAllowance = paymentInfo.transportationAllowance !== undefined ? paymentInfo.transportationAllowance : currentEmployee.transportationAllowance;
          salaryUpdateData.totalSalary = newBaseSalary + newTelephoneAllowance + newHousingAllowance + newTransportationAllowance;
        }
      }
      if (paymentInfo.currency !== undefined) salaryUpdateData.currency = paymentInfo.currency;

      // Bank details are already handled above with upsert

      // Update salary fields if provided
      if (Object.keys(salaryUpdateData).length > 0) {
        await prisma.employee.update({
          where: { id },
          data: salaryUpdateData,
        });
      }
    }

    // Fetch updated employee with all relations (same structure as profile)
    const finalEmployee = await prisma.employee.findUnique({
      where: { id },
      include: {
        department: true,
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            designation: true,
          },
        },
        terminatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        documents: true,
        bankDetails: true,
        payroll: {
          orderBy: { createdAt: 'desc' },
          take: 12,
        },
      },
    });

    if (!finalEmployee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found',
      } as IApiResponse<null>);
    }

    const finalJoinDate = finalEmployee.joinDate ? new Date(finalEmployee.joinDate) : null;
    const finalProbationMetadata = parseMonthsMetadata(finalEmployee.probationPeriod);
    const finalContractMetadata = parseMonthsMetadata(finalEmployee.contractDuration);
    const effectiveConfirmationDate =
      finalEmployee.confirmationDate ||
      computeConfirmationDate(finalJoinDate, finalProbationMetadata.months);
    const effectiveContractExpiryDate = finalContractMetadata.isPermanent
      ? null
      : finalEmployee.contractExpiryDate ||
        computeContractExpiryDate(finalJoinDate, finalContractMetadata.months);
    const probationLabel =
      finalProbationMetadata.months !== null
        ? formatMonthsLabel(finalProbationMetadata.months)
        : finalEmployee.probationPeriod || null;
    const contractLabel = finalContractMetadata.isPermanent
      ? 'Permanent'
      : finalContractMetadata.months !== null
        ? formatMonthsLabel(finalContractMetadata.months)
        : finalEmployee.contractDuration || null;

    // Format the response (same as profile GET)
    const response: IApiResponse<any> = {
      success: true,
      data: {
        // Basic Info
        id: finalEmployee.id,
        employeeId: finalEmployee.employeeId,
        firstName: finalEmployee.firstName,
        lastName: finalEmployee.lastName,
        fullName: `${finalEmployee.firstName} ${finalEmployee.lastName}`,
        avatar: `${finalEmployee.firstName.charAt(0)}${finalEmployee.lastName.charAt(0)}`.toUpperCase(),

        // Personal Information Tab
        personalInfo: {
          workEmail: finalEmployee.email,
          personalEmail: finalEmployee.personalEmail || null,
          phone: finalEmployee.phone || null,
          dateOfBirth: finalEmployee.dateOfBirth || null,
          gender: finalEmployee.gender || null,
          molId: finalEmployee.molId || null,
          address: finalEmployee.address || null,
          city: finalEmployee.city || null,
          state: finalEmployee.state || null,
          zipCode: finalEmployee.zipCode || null,
          country: finalEmployee.country || null,
        },

        // Employment Details Tab
        employmentDetails: {
          positionInfo: {
            status: finalEmployee.status,
            employmentStatus: finalEmployee.status,
            userStatus: finalEmployee.userStatus,
            employmentType: finalEmployee.employmentType,
            department: finalEmployee.department
              ? {
                  id: finalEmployee.department.id,
                  name: finalEmployee.department.name,
                  code: finalEmployee.department.code,
                }
              : null,
            designation: finalEmployee.designation,
            joinDate: finalEmployee.joinDate,
            probationPeriod: probationLabel,
            probationPeriodMonths: finalProbationMetadata.months,
            confirmationDate: effectiveConfirmationDate,
            contractDuration: contractLabel || 'Permanent',
            contractDurationMonths: finalContractMetadata.months,
            contractExpiryDate: effectiveContractExpiryDate,
            contractIsPermanent: finalContractMetadata.isPermanent,
            terminationDate: finalEmployee.terminationDate || null,
            terminationLastWorkingDay:
              finalEmployee.terminationLastWorkingDay ||
              finalEmployee.terminationDate ||
              null,
            terminationRecordedAt: finalEmployee.terminationRecordedAt || null,
            terminationReason: finalEmployee.terminationReason || null,
            terminatedBy: finalEmployee.terminatedBy
              ? {
                  id: finalEmployee.terminatedBy.id,
                  name: `${finalEmployee.terminatedBy.firstName} ${finalEmployee.terminatedBy.lastName}`,
                  email: finalEmployee.terminatedBy.email,
                }
              : null,
            workMode: finalEmployee.workMode,
          },
          lineManager: finalEmployee.manager
            ? {
                id: finalEmployee.manager.id,
                name: `${finalEmployee.manager.firstName} ${finalEmployee.manager.lastName}`,
                email: finalEmployee.manager.email,
                phone: finalEmployee.manager.phone || null,
                designation: finalEmployee.manager.designation,
              }
            : null,
          managerId: finalEmployee.managerId,
        },

        // Payment Information Tab
        paymentInfo: {
          salaryDetails: {
            baseSalary: finalEmployee.baseSalary,
            telephoneAllowance: finalEmployee.telephoneAllowance,
            housingAllowance: finalEmployee.housingAllowance,
            transportationAllowance: finalEmployee.transportationAllowance,
            totalSalary: finalEmployee.totalSalary,
            currency: finalEmployee.currency,
          },
          bankDetails: finalEmployee.bankDetails
            ? {
                paymentMethod: finalEmployee.bankDetails.paymentMethod,
                bankName: finalEmployee.bankDetails.bankName,
                accountHolderName: finalEmployee.bankDetails.accountHolderName,
                iban: finalEmployee.bankDetails.iban,
                routingNumber: finalEmployee.bankDetails.routingNumber,
              }
            : null,
          salaryHistory: finalEmployee.payroll.map((payroll) => ({
            id: payroll.id,
            month: payroll.month,
            year: payroll.year,
            baseSalary: finalEmployee.baseSalary, // Use employee's actual base salary, not prorated payroll baseSalary
            allowances: payroll.allowances,
            deductions: payroll.deductions,
            taxDeduction: payroll.taxDeduction,
            netSalary: payroll.netSalary,
            status: payroll.status,
            paidDate: payroll.paidDate,
          })),
        },

        // Documents Tab
        documents: {
          passportCopy: finalEmployee.documents.find((d) => d.documentType === 'PASSPORT') || null,
          emiratesId: finalEmployee.documents.find((d) => d.documentType === 'EMIRATES_ID') || null,
          certificates: finalEmployee.documents.filter((d) => d.documentType === 'CERTIFICATE'),
          otherDocuments: finalEmployee.documents.filter((d) => d.documentType === 'OTHER'),
        },

        // Metadata
        metadata: {
          createdAt: finalEmployee.createdAt,
          updatedAt: finalEmployee.updatedAt,
        },
      },
      message: 'Employee updated successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Patch update employee error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};

/**
 * Delete employee
 * DELETE /employees/:id
 */
export const deleteEmployee = async (req: Request, res: Response): Promise<Response | void> => {
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

    // Delete employee
    await prisma.employee.delete({ where: { id } });

    const response: IApiResponse<null> = {
      success: true,
      message: 'Employee deleted successfully',
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Delete employee error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as IApiResponse<null>);
  }
};


