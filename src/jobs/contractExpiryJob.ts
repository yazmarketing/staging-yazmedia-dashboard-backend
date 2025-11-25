import { autoCheckExpiredContracts, getExpiringContracts } from '../services/contract/contractService';
import { checkAndSendReminders } from '../services/contract/contractNotificationService';
import { autoRenewContract } from '../services/contract/contractRenewalService';
import cron from 'node-cron';

/**
 * Daily job to check for expired contracts and update their status
 * Runs at midnight daily
 */
export const startContractExpiryJob = () => {
  cron.schedule('0 0 * * *', async () => {
    try {
      // Check and mark expired contracts
      await autoCheckExpiredContracts();
      
      // Check and send renewal reminders
      await checkAndSendReminders();
      
      // TODO: Send email notifications for reminders
      
    } catch (error) {
      console.error('❌ Error in contract expiry job:', error);
    }
  });
};

/**
 * Auto-renew contracts that have autoRenewal enabled
 * Runs daily at 1 AM
 */
export const startAutoRenewalJob = () => {
  cron.schedule('0 1 * * *', async () => {
    try {
      // Get contracts expiring today with autoRenewal enabled
      const expiringToday = await getExpiringContracts(1);
      
      for (const contract of expiringToday) {
        if (contract.autoRenewal) {
          try {
            await autoRenewContract(contract.id);
          } catch (error) {
            console.error(`❌ Error auto-renewing contract ${contract.contractNumber}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error in auto-renewal job:', error);
    }
  });
};





