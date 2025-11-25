import { PrismaClient } from '@prisma/client';
import { getHRManagementEmails, sendEmail } from '../services/emailService';
import { generateLeaveRequestEmailBody } from './emailTemplates';

/**
 * Send leave request notification email to HR/Management
 */
export const sendLeaveRequestNotification = async (
  prisma: PrismaClient,
  leaveRequestData: {
    employeeName: string;
    employeeId: string;
    employeeEmail: string;
    leaveType: string;
    startDate: Date | string;
    endDate: Date | string;
    numberOfDays: number;
    reason?: string | null;
    status?: string;
  }
): Promise<boolean> => {
  try {
    console.log('');
    console.log('='.repeat(70));
    console.log('📧 LEAVE REQUEST EMAIL NOTIFICATION PROCESS');
    console.log('='.repeat(70));
    console.log('Employee:', leaveRequestData.employeeName);
    console.log('Leave Type:', leaveRequestData.leaveType);
    console.log('Start Date:', leaveRequestData.startDate);
    console.log('End Date:', leaveRequestData.endDate);
    console.log('Number of Days:', leaveRequestData.numberOfDays);
    console.log('');

    // Get HR and Management email addresses
    console.log('🔍 Step 1: Fetching HR/Management email addresses...');
    const hrManagementEmails = await getHRManagementEmails(prisma);

    if (hrManagementEmails.length === 0) {
      console.warn('⚠️  No HR/Management email addresses found. Email not sent.');
      return false;
    }

    // Log the email addresses that will receive the notification
    console.log('📧 Leave Request Notification - Recipients:');
    console.log('   Total recipients:', hrManagementEmails.length);
    hrManagementEmails.forEach((email, index) => {
      console.log(`   ${index + 1}. ${email}`);
    });

    // Generate email HTML content
    console.log('');
    console.log('📝 Step 2: Generating email HTML content...');
    const emailHtml = generateLeaveRequestEmailBody({
      employeeName: leaveRequestData.employeeName,
      employeeId: leaveRequestData.employeeId,
      employeeEmail: leaveRequestData.employeeEmail,
      leaveType: leaveRequestData.leaveType,
      startDate: leaveRequestData.startDate,
      endDate: leaveRequestData.endDate,
      numberOfDays: leaveRequestData.numberOfDays,
      reason: leaveRequestData.reason,
      status: leaveRequestData.status || 'PENDING',
    });
    console.log('✅ Email HTML content generated');

    // Send email
    console.log('');
    console.log('📤 Step 3: Sending email via email service...');
    const emailSubject = `New Leave Request - ${leaveRequestData.employeeName}`;
    console.log('   Subject:', emailSubject);
    console.log('   Recipients:', hrManagementEmails.join(', '));
    
    const success = await sendEmail(hrManagementEmails, emailSubject, emailHtml);

    console.log('');
    if (success) {
      console.log('✅ Email sent successfully!');
    } else {
      console.error('❌ Email sending failed (check email service logs above)');
    }
    console.log('='.repeat(70));
    console.log('');

    return success;
  } catch (error) {
    console.error('❌ Error sending leave request notification email:', error);
    return false;
  }
};



