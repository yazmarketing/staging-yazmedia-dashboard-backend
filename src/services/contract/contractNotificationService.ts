import { prisma } from '../../index';
import { getExpiringContracts } from './contractService';

/**
 * Send renewal reminders for contracts expiring soon
 */
export const sendRenewalReminders = async (days: number = 30) => {
  const expiringContracts = await getExpiringContracts(days);
  
  // In a real implementation, this would send emails/notifications
  // For now, we'll just return the list
  return expiringContracts.map(contract => ({
    contractId: contract.id,
    contractNumber: contract.contractNumber,
    employeeName: `${contract.employee.firstName} ${contract.employee.lastName}`,
    employeeEmail: contract.employee.email,
    endDate: contract.endDate,
    daysUntilExpiry: contract.endDate
      ? Math.ceil((contract.endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      : null,
  }));
};

/**
 * Check and send reminders based on contract renewalReminderDays
 */
export const checkAndSendReminders = async () => {
  const today = new Date();
  const contracts = await prisma.contract.findMany({
    where: {
      status: 'ACTIVE',
      endDate: { not: null },
    },
    include: {
      employee: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
  
  const reminders = [];
  
  for (const contract of contracts) {
    if (!contract.endDate) continue;
    
    const daysUntilExpiry = Math.ceil(
      (contract.endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // Check if we need to send a reminder based on renewalReminderDays
    if (daysUntilExpiry <= contract.renewalReminderDays && daysUntilExpiry > 0) {
      reminders.push({
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        employeeName: `${contract.employee.firstName} ${contract.employee.lastName}`,
        employeeEmail: contract.employee.email,
        endDate: contract.endDate,
        daysUntilExpiry,
      });
    }
  }
  
  return reminders;
};










