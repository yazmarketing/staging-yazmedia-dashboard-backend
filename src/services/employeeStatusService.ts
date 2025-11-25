import { prisma } from '../index';

/**
 * Calculate employee status based on contract expiry and current status
 * Rules:
 * - If status is TERMINATED: Keep TERMINATED (never auto-change)
 * - If contractExpiryDate exists and has passed: Set to EXPIRED
 * - If contractExpiryDate exists and is in future: Set to ACTIVE
 * - If no contractExpiryDate: Keep current status (ACTIVE by default)
 */
export const calculateEmployeeStatus = (employee: {
  status: string;
  contractExpiryDate: Date | null;
  terminationDate: Date | null;
}): string => {
  // Never auto-change TERMINATED status
  if (employee.status === 'TERMINATED') {
    return 'TERMINATED';
  }

  // If contract has expired, set to EXPIRED
  if (employee.contractExpiryDate) {
    const now = new Date();
    const expiryDate = new Date(employee.contractExpiryDate);
    
    // If contract expired (past midnight of expiry date)
    if (expiryDate < now) {
      return 'EXPIRED';
    }
  }

  // Otherwise, keep current status (ACTIVE, ON_LEAVE, etc.)
  return employee.status;
};

/**
 * Auto-update employee statuses based on contract expiry
 * This should be run periodically (via cron job)
 */
export const autoUpdateEmployeeStatuses = async () => {
  try {
    // Get all employees with contracts (not TERMINATED)
    const employees = await prisma.employee.findMany({
      where: {
        status: { not: 'TERMINATED' },
        contractExpiryDate: { not: null },
      },
      select: {
        id: true,
        status: true,
        contractExpiryDate: true,
        terminationDate: true,
      },
    });

    let updated = 0;

    for (const employee of employees) {
      if (!employee.contractExpiryDate) continue;

      const calculatedStatus = calculateEmployeeStatus({
        status: employee.status,
        contractExpiryDate: employee.contractExpiryDate,
        terminationDate: employee.terminationDate,
      });

      // Only update if status needs to change
      if (calculatedStatus !== employee.status) {
        await prisma.employee.update({
          where: { id: employee.id },
          data: { status: calculatedStatus as any },
        });
        updated++;
      }
    }

    return { updated };
  } catch (error) {
    console.error('❌ Error auto-updating employee statuses:', error);
    throw error;
  }
};

