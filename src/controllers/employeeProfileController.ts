import { Request, Response } from 'express';
import { prisma } from '../index';
import { IApiResponse } from '../types';
import { getUserInfo, ensureOwnership } from '../utils/ownershipValidation';
import { calculateEmployeeStatus } from '../services/employeeStatusService';
import {
  parseMonthsMetadata,
  formatMonthsLabel,
  computeConfirmationDate,
  computeContractExpiryDate,
} from './employeeController';

// Get comprehensive employee profile with all tabs
export const getEmployeeProfile = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { userId, role } = getUserInfo(req);

    const employee = await prisma.employee.findUnique({
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
          take: 12, // Last 12 months
        },
      },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: `Employee with ID '${id}' not found`,
      });
    }

    // RBAC: EMPLOYEE can only access their own profile
    if (!ensureOwnership(employee.id, userId, role)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You can only access your own data',
      });
    }

    // Format the response
    const joinDate = employee.joinDate ? new Date(employee.joinDate) : null;
    const probationMetadata = parseMonthsMetadata(employee.probationPeriod);
    const contractMetadata = parseMonthsMetadata(employee.contractDuration);
    const effectiveConfirmationDate =
      employee.confirmationDate || computeConfirmationDate(joinDate, probationMetadata.months);
    const effectiveContractExpiryDate = contractMetadata.isPermanent
      ? null
      : employee.contractExpiryDate || computeContractExpiryDate(joinDate, contractMetadata.months);
    const probationLabel =
      probationMetadata.months !== null
        ? formatMonthsLabel(probationMetadata.months)
        : employee.probationPeriod || null;
    const contractLabel = contractMetadata.isPermanent
      ? 'Permanent'
      : contractMetadata.months !== null
        ? formatMonthsLabel(contractMetadata.months)
        : employee.contractDuration || null;

    const profileResponse: IApiResponse<any> = {
      success: true,
      data: {
        // Basic Info
        id: employee.id,
        employeeId: employee.employeeId,
        firstName: employee.firstName,
        lastName: employee.lastName,
        fullName: `${employee.firstName} ${employee.lastName}`,
        avatar: `${employee.firstName.charAt(0)}${employee.lastName.charAt(0)}`.toUpperCase(),

        // Personal Information Tab
        personalInfo: {
          workEmail: employee.email,
          personalEmail: employee.personalEmail || null,
          phone: employee.phone || null,
          dateOfBirth: employee.dateOfBirth || null,
          gender: employee.gender || null,
          molId: employee.molId || null,
          address: employee.address || null,
          city: employee.city || null,
          state: employee.state || null,
          zipCode: employee.zipCode || null,
          country: employee.country || null,
        },

        // Employment Details Tab
        employmentDetails: {
          positionInfo: {
            // Calculate actual status (check contract expiry)
            status: calculateEmployeeStatus({
              status: employee.status,
              contractExpiryDate: employee.contractExpiryDate,
              terminationDate: employee.terminationDate,
            }),
            employmentStatus: employee.status,
            userStatus: employee.userStatus,
            employmentType: employee.employmentType,
            department: employee.department
              ? {
                  id: employee.department.id,
                  name: employee.department.name,
                  code: employee.department.code,
                }
              : null,
            designation: employee.designation,
            joinDate: employee.joinDate,
            probationPeriod: probationLabel,
            probationPeriodMonths: probationMetadata.months,
            confirmationDate: effectiveConfirmationDate,
            contractDuration: contractLabel || 'Permanent',
            contractDurationMonths: contractMetadata.months,
            contractIsPermanent: contractMetadata.isPermanent,
            contractExpiryDate: effectiveContractExpiryDate,
            terminationDate: employee.terminationDate || null,
            terminationLastWorkingDay:
              employee.terminationLastWorkingDay || employee.terminationDate || null,
            terminationReason: employee.terminationReason || null,
            terminationRecordedAt: employee.terminationRecordedAt || null,
            terminatedBy: employee.terminatedBy
              ? {
                  id: employee.terminatedBy.id,
                  name: `${employee.terminatedBy.firstName} ${employee.terminatedBy.lastName}`,
                  email: employee.terminatedBy.email,
                }
              : null,
            workMode: employee.workMode,
          },
          lineManager: employee.manager
            ? {
                id: employee.manager.id,
                name: `${employee.manager.firstName} ${employee.manager.lastName}`,
                email: employee.manager.email,
                phone: employee.manager.phone || null,
                designation: employee.manager.designation,
              }
            : null,
          managerId: employee.managerId,
        },

        // Payment Information Tab
        paymentInfo: {
          salaryDetails: {
            baseSalary: employee.baseSalary,
            totalSalary: employee.totalSalary,
            currency: employee.currency,
          },
          bankDetails: employee.bankDetails
            ? {
                paymentMethod: employee.bankDetails.paymentMethod,
                bankName: employee.bankDetails.bankName,
                accountHolderName: employee.bankDetails.accountHolderName,
                iban: employee.bankDetails.iban,
                routingNumber: employee.bankDetails.routingNumber,
              }
            : null,
          salaryHistory: employee.payroll.map((payroll) => ({
            id: payroll.id,
            month: payroll.month,
            year: payroll.year,
            baseSalary: employee.baseSalary, // Use employee's actual base salary, not prorated payroll baseSalary
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
          passportCopy: employee.documents.find((d) => d.documentType === 'PASSPORT') || null,
          emiratesId: employee.documents.find((d) => d.documentType === 'EMIRATES_ID') || null,
          certificates: employee.documents.filter((d) => d.documentType === 'CERTIFICATE'),
          otherDocuments: employee.documents.filter((d) => d.documentType === 'OTHER'),
        },

        // Metadata
        metadata: {
          createdAt: employee.createdAt,
          updatedAt: employee.updatedAt,
        },
      },
      message: 'Employee profile retrieved successfully',
    };

    return res.status(200).json(profileResponse);
  } catch (error) {
    console.error('Error fetching employee profile:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to retrieve employee profile',
    });
  }
};

