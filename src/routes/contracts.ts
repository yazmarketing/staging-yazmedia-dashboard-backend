import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { prisma } from '../index';

const router = Router();

// Get all employee contracts (view-only dashboard)
router.get('/', authMiddleware, requireRole('HR', 'MANAGEMENT'), async (req, res) => {
  try {
    const { page = '1', pageSize = '10', status, employmentType } = req.query;
    const pageNum = parseInt(page as string);
    const size = parseInt(pageSize as string);
    const skip = (pageNum - 1) * size;

    const where: any = {};
    if (employmentType && employmentType !== 'all') {
      where.employmentType = employmentType;
    }
    
    // Status filtering will be done after calculating contract status
    // We need to fetch all employees first, then filter by calculated status, then paginate

    const employees = await prisma.employee.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeId: true,
        email: true,
        designation: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        joinDate: true,
        probationPeriod: true,
        confirmationDate: true,
        contractDuration: true,
        contractExpiryDate: true,
        employmentType: true,
        status: true,
        baseSalary: true,
        telephoneAllowance: true,
        housingAllowance: true,
        transportationAllowance: true,
        totalSalary: true,
        currency: true,
        workMode: true,
      },
      orderBy: { contractExpiryDate: 'asc' },
    });

    // Calculate confirmation dates and contract expiry dates if not set
    const contracts = employees.map((emp) => {
      let calculatedConfirmationDate = emp.confirmationDate;
      let calculatedExpiryDate = emp.contractExpiryDate;

      // Calculate confirmation date (joinDate + probationPeriod)
      if (emp.joinDate && emp.probationPeriod && !calculatedConfirmationDate) {
        const probationDays = parseInt(emp.probationPeriod) || 0;
        if (probationDays > 0) {
          calculatedConfirmationDate = new Date(emp.joinDate);
          calculatedConfirmationDate.setDate(calculatedConfirmationDate.getDate() + probationDays);
        }
      }

      // Calculate contract expiry date (joinDate + contractDuration)
      // Always recalculate from duration if available, since contracts are derived from employee records
      if (emp.joinDate && emp.contractDuration && emp.contractDuration !== 'Permanent') {
        // Parse contract duration (e.g., "80", "12 months", "2 years", etc.)
        const duration = emp.contractDuration.toLowerCase().trim();
        let months = 0;
        
        // Try to match patterns
        const monthsMatch = duration.match(/(\d+)\s*month/i);
        const yearsMatch = duration.match(/(\d+)\s*year/i);
        const justNumber = duration.match(/^\d+$/);
        
        if (monthsMatch) {
          months = parseInt(monthsMatch[1]);
        } else if (yearsMatch) {
          months = parseInt(yearsMatch[1]) * 12;
        } else if (justNumber) {
          // If it's just a number, treat it as months
          months = parseInt(justNumber[0]);
        }
        
        if (months > 0) {
          calculatedExpiryDate = new Date(emp.joinDate);
          calculatedExpiryDate.setMonth(calculatedExpiryDate.getMonth() + months);
        }
      }

      // Determine contract status
      let contractStatus = 'ACTIVE';
      if (emp.status === 'TERMINATED' || emp.status === 'EXPIRED') {
        contractStatus = emp.status;
      } else if (calculatedExpiryDate && new Date(calculatedExpiryDate) < new Date()) {
        contractStatus = 'EXPIRED';
      }

      // Calculate days until expiry for "expiring soon" filter
      let daysUntilExpiry: number | null = null;
      if (calculatedExpiryDate) {
        const diffMs = new Date(calculatedExpiryDate).getTime() - new Date().getTime();
        daysUntilExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      }

      return {
        id: emp.id,
        employeeId: emp.employeeId,
        employee: {
          id: emp.id,
          firstName: emp.firstName,
          lastName: emp.lastName,
          employeeId: emp.employeeId,
          email: emp.email,
        },
        joinDate: emp.joinDate,
        confirmationDate: calculatedConfirmationDate || emp.confirmationDate,
        contractExpiryDate: calculatedExpiryDate || emp.contractExpiryDate,
        contractDuration: emp.contractDuration || 'Permanent',
        employmentType: emp.employmentType,
        status: contractStatus,
        baseSalary: emp.baseSalary,
        telephoneAllowance: emp.telephoneAllowance || 0,
        housingAllowance: emp.housingAllowance || 0,
        transportationAllowance: emp.transportationAllowance || 0,
        totalSalary: emp.totalSalary,
        currency: emp.currency,
        workMode: emp.workMode,
        designation: emp.designation,
        department: emp.department,
        probationPeriod: emp.probationPeriod,
        daysUntilExpiry,
      };
    });

    // Apply status filter after calculating contract status
    let filteredContracts = contracts;
    if (status && status !== 'all') {
      if (status === 'EXPIRING_SOON') {
        filteredContracts = contracts.filter(c => 
          c.daysUntilExpiry !== null && c.daysUntilExpiry > 0 && c.daysUntilExpiry <= 30
        );
      } else {
        filteredContracts = contracts.filter(c => c.status === status);
      }
    }

    // Apply pagination to filtered results
    const paginatedContracts = filteredContracts.slice(skip, skip + size);

    return res.json({
      success: true,
      data: {
        data: paginatedContracts,
        total: filteredContracts.length,
        page: pageNum,
        pageSize: size,
        totalPages: Math.ceil(filteredContracts.length / size),
      },
    });
  } catch (error: any) {
    console.error('Error fetching contracts:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch contracts',
    });
  }
});

// Get contract by employee ID
router.get('/employee/:id', authMiddleware, requireRole('HR', 'MANAGEMENT'), async (req, res) => {
  try {
    const employeeId = req.params.id;

    // Try to find by employeeId first, then by id
    const employee = await prisma.employee.findFirst({
      where: {
        OR: [
          { employeeId: employeeId },
          { id: employeeId }
        ]
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeId: true,
        email: true,
        designation: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        joinDate: true,
        probationPeriod: true,
        confirmationDate: true,
        contractDuration: true,
        contractExpiryDate: true,
        employmentType: true,
        status: true,
        baseSalary: true,
        telephoneAllowance: true,
        housingAllowance: true,
        transportationAllowance: true,
        totalSalary: true,
        currency: true,
        workMode: true,
      },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found',
      });
    }

    // Calculate dates
    let calculatedConfirmationDate = employee.confirmationDate;
    let calculatedExpiryDate = employee.contractExpiryDate;

    if (employee.joinDate && employee.probationPeriod && !calculatedConfirmationDate) {
      const probationDays = parseInt(employee.probationPeriod) || 0;
      if (probationDays > 0) {
        calculatedConfirmationDate = new Date(employee.joinDate);
        calculatedConfirmationDate.setDate(calculatedConfirmationDate.getDate() + probationDays);
      }
    }

    if (employee.joinDate && employee.contractDuration && employee.contractDuration !== 'Permanent') {
      // Parse contract duration (e.g., "80", "12 months", "2 years", etc.)
      const duration = employee.contractDuration.toLowerCase().trim();
      let months = 0;
      
      // Try to match patterns
      const monthsMatch = duration.match(/(\d+)\s*month/i);
      const yearsMatch = duration.match(/(\d+)\s*year/i);
      const justNumber = duration.match(/^\d+$/);
      
      if (monthsMatch) {
        months = parseInt(monthsMatch[1]);
      } else if (yearsMatch) {
        months = parseInt(yearsMatch[1]) * 12;
      } else if (justNumber) {
        // If it's just a number, treat it as months
        months = parseInt(justNumber[0]);
      }
      
      if (months > 0) {
        calculatedExpiryDate = new Date(employee.joinDate);
        calculatedExpiryDate.setMonth(calculatedExpiryDate.getMonth() + months);
      }
    }

    let contractStatus = 'ACTIVE';
    if (employee.status === 'TERMINATED' || employee.status === 'EXPIRED') {
      contractStatus = employee.status;
    } else if (calculatedExpiryDate && new Date(calculatedExpiryDate) < new Date()) {
      contractStatus = 'EXPIRED';
    }

    return res.json({
      success: true,
      data: {
        id: employee.id,
        employeeId: employee.employeeId,
        employee: {
          id: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          employeeId: employee.employeeId,
          email: employee.email,
        },
        joinDate: employee.joinDate,
        confirmationDate: calculatedConfirmationDate || employee.confirmationDate,
        contractExpiryDate: calculatedExpiryDate || employee.contractExpiryDate,
        contractDuration: employee.contractDuration || 'Permanent',
        employmentType: employee.employmentType,
        status: contractStatus,
        baseSalary: employee.baseSalary,
        telephoneAllowance: employee.telephoneAllowance || 0,
        housingAllowance: employee.housingAllowance || 0,
        transportationAllowance: employee.transportationAllowance || 0,
        totalSalary: employee.totalSalary,
        currency: employee.currency,
        workMode: employee.workMode,
        designation: employee.designation,
        department: employee.department,
        probationPeriod: employee.probationPeriod,
      },
    });
  } catch (error: any) {
    console.error('Error fetching contract:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch contract',
    });
  }
});

// Renew contract
router.post('/renew', authMiddleware, requireRole('HR', 'MANAGEMENT'), async (req, res) => {
  try {
    const { employeeId, newStartDate, contractDurationMonths } = req.body;

    if (!employeeId || !newStartDate || !contractDurationMonths) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: employeeId, newStartDate, contractDurationMonths',
      });
    }

    const employee = await prisma.employee.findFirst({
      where: {
        OR: [
          { employeeId: employeeId },
          { id: employeeId }
        ]
      },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found',
      });
    }

    // Calculate new expiry date
    const startDate = new Date(newStartDate);
    const expiryDate = new Date(startDate);
    expiryDate.setMonth(expiryDate.getMonth() + parseInt(contractDurationMonths));

    // Update employee contract
    const updated = await prisma.employee.update({
      where: { id: employee.id },
      data: {
        joinDate: startDate,
        contractDuration: `${contractDurationMonths} months`,
        contractExpiryDate: expiryDate,
        // Reset confirmation date - will be recalculated from new join date
        confirmationDate: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeId: true,
        joinDate: true,
        contractDuration: true,
        contractExpiryDate: true,
      },
    });

    return res.json({
      success: true,
      data: updated,
      message: 'Contract renewed successfully',
    });
  } catch (error: any) {
    console.error('Error renewing contract:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to renew contract',
    });
  }
});

// Get expiring contracts
router.get('/expiring', authMiddleware, requireRole('HR', 'MANAGEMENT'), async (req, res) => {
  try {
    const { days = '30' } = req.query;
    const daysNum = parseInt(days as string);
    const expiryThreshold = new Date();
    expiryThreshold.setDate(expiryThreshold.getDate() + daysNum);

    const employees = await prisma.employee.findMany({
      where: {
        contractExpiryDate: {
          lte: expiryThreshold,
          gte: new Date(),
        },
        status: {
          notIn: ['TERMINATED', 'EXPIRED'],
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeId: true,
        email: true,
        contractExpiryDate: true,
        contractDuration: true,
        department: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { contractExpiryDate: 'asc' },
    });

    return res.json({
      success: true,
      data: employees,
    });
  } catch (error: any) {
    console.error('Error fetching expiring contracts:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch expiring contracts',
    });
  }
});

export default router;
