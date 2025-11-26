import { PrismaClient } from '@prisma/client';

// Try to import Resend (optional - only if configured)
let resend: any = null;
try {
  resend = require('resend');
} catch (e) {
  // Resend not installed - will try other services
}

// Try to import SendGrid (optional - only if configured)
let sendgrid: any = null;
try {
  sendgrid = require('@sendgrid/mail');
} catch (e) {
  // SendGrid not installed - will try other services
}

// Email service type
type EmailServiceType = 'RESEND' | 'SENDGRID' | 'AWS_SES' | 'NONE';

let emailServiceType: EmailServiceType = 'NONE';

let resendClient: any = null;

/**
 * Initialize email service based on available configuration
 * Priority: Resend > SendGrid > AWS SES
 */
export const initializeEmailTransporter = (): void => {
  // Check for Resend API key (highest priority)
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey && resend) {
    try {
      resendClient = new resend.Resend(resendApiKey);
      emailServiceType = 'RESEND';
      console.log('✅ Email service initialized: Resend');
      return; // Resend doesn't use nodemailer transporter
    } catch (error) {
      console.error('❌ Error initializing Resend:', error);
    }
  }

  // Check for SendGrid API key
  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  if (sendgridApiKey && sendgrid) {
    try {
      sendgrid.setApiKey(sendgridApiKey);
      emailServiceType = 'SENDGRID';
      console.log('✅ Email service initialized: SendGrid');
      return; // SendGrid doesn't use nodemailer transporter
    } catch (error) {
      console.error('❌ Error initializing SendGrid:', error);
    }
  }

  // Check for AWS SES credentials
  // Note: AWS SES requires additional setup. For now, we'll skip it.
  // To enable AWS SES, install: npm install aws-sdk
  // and uncomment the code below or use a different email service.
  const awsRegion = process.env.AWS_SES_REGION;
  const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (awsRegion && awsAccessKeyId && awsSecretAccessKey) {
    console.warn('⚠️  AWS SES is configured but not fully implemented. Please use Resend or SendGrid instead.');
    // AWS SES integration requires aws-sdk package and additional setup
    // Uncomment and implement when ready
  }

  // No email service configured
  console.warn('⚠️  Email service not configured. Please set up Resend or SendGrid credentials.');
  emailServiceType = 'NONE';
};

/**
 * Verify email service connection
 */
export const verifyEmailConnection = async (): Promise<boolean> => {
  if (emailServiceType === 'NONE') {
    return false;
  }

  if (emailServiceType === 'RESEND' || emailServiceType === 'SENDGRID') {
    // Resend and SendGrid verification happens on first send
    return true;
  }

  return false;
};

/**
 * Get HR and Management email addresses
 */
export const getHRManagementEmails = async (prisma: PrismaClient): Promise<string[]> => {
  try {
    const hrManagementEmployees = await prisma.employee.findMany({
      where: {
        role: {
          in: ['HR', 'MANAGEMENT'],
        },
        userStatus: 'ACTIVE',
        status: {
          not: 'TERMINATED',
        },
      },
      select: {
        email: true,
      },
    });

    const emails = hrManagementEmployees
      .map((emp) => emp.email)
      .filter((email): email is string => email !== null && email !== '');

    // Log details about who was found
    console.log('📋 HR/Management Employees Found for Email Notification:');
    console.log('   Total employees with HR/MANAGEMENT role:', hrManagementEmployees.length);
    console.log('   Valid email addresses:', emails.length);
    
    if (hrManagementEmployees.length > 0) {
      hrManagementEmployees.forEach((emp, index) => {
        const emailStatus = emp.email ? '✅' : '❌ (no email)';
        console.log(`   ${index + 1}. ${emp.email || 'N/A'} ${emailStatus}`);
      });
    }

    return emails;
  } catch (error) {
    console.error('Error fetching HR/Management emails:', error);
    return [];
  }
};

/**
 * Send email using Resend
 */
const sendEmailViaResend = async (
  to: string | string[],
  subject: string,
  htmlContent: string,
  from?: string
): Promise<boolean> => {
  if (!resend || !resendClient) {
    console.error('❌ Resend package not installed or client not initialized. Please install: npm install resend');
    return false;
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.error('❌ RESEND_API_KEY not configured in environment variables');
    return false;
  }

  try {
    const fromEmail = from || process.env.RESEND_FROM || 'noreply@yazmedia.com';
    const fromName = process.env.RESEND_FROM_NAME || 'YAZ Media';

    // Resend supports array of recipients
    const recipients = Array.isArray(to) ? to : [to];

    const { data, error } = await resendClient.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: recipients,
      subject: subject,
      html: htmlContent,
    });

    if (error) {
      console.error('❌ Error sending email via Resend:', error);
      return false;
    }

    console.log(`✅ Email sent successfully via Resend to: ${recipients.join(', ')}`);
    if (data?.id) {
      console.log(`   Email ID: ${data.id}`);
    }
    return true;
  } catch (error: any) {
    console.error('❌ Error sending email via Resend:', error);
    if (error.message) {
      console.error('   Error message:', error.message);
    }
    return false;
  }
};

/**
 * Send email using SendGrid
 */
const sendEmailViaSendGrid = async (
  to: string | string[],
  subject: string,
  htmlContent: string,
  from?: string
): Promise<boolean> => {
  if (!sendgrid) {
    console.error('❌ SendGrid package not installed or not available. Please install: npm install @sendgrid/mail');
    return false;
  }

  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  if (!sendgridApiKey) {
    console.error('❌ SENDGRID_API_KEY not configured in environment variables');
    return false;
  }

  try {
    // Ensure API key is set (in case it wasn't set during initialization)
    if (sendgridApiKey) {
      sendgrid.setApiKey(sendgridApiKey);
    }

    const fromEmail = from || process.env.SENDGRID_FROM || 'noreply@yazmedia.com';
    const fromName = process.env.SENDGRID_FROM_NAME || 'YAZ Media';

    const recipients = Array.isArray(to) ? to : [to];

    const msg = {
      to: recipients,
      from: {
        email: fromEmail,
        name: fromName,
      },
      subject: subject,
      html: htmlContent,
    };

    await sendgrid.send(msg);
    console.log(`✅ Email sent successfully via SendGrid to: ${recipients.join(', ')}`);
    return true;
  } catch (error: any) {
    console.error('❌ Error sending email via SendGrid:', error);
    if (error.response) {
      console.error('SendGrid error details:', error.response.body);
      console.error('SendGrid error status:', error.response.statusCode);
    }
    return false;
  }
};

/**
 * Send email using configured service (Resend, SendGrid, AWS SES, or SMTP)
 */
export const sendEmail = async (
  to: string | string[],
  subject: string,
  htmlContent: string,
  from?: string
): Promise<boolean> => {
  console.log('');
  console.log('📮 Email Service - Sending Email');
  console.log('   Service Type:', emailServiceType);
  console.log('   Recipients:', Array.isArray(to) ? to.join(', ') : to);
  console.log('   Subject:', subject);
  
  // Validate recipients
  if (!to || (Array.isArray(to) && to.length === 0)) {
    console.error('❌ No email recipients provided');
    return false;
  }

  // Use Resend if configured (highest priority)
  if (emailServiceType === 'RESEND') {
    console.log('   Using Resend service...');
    return sendEmailViaResend(to, subject, htmlContent, from);
  }

  // Use SendGrid if configured
  if (emailServiceType === 'SENDGRID') {
    console.log('   Using SendGrid service...');
    return sendEmailViaSendGrid(to, subject, htmlContent, from);
  }

  // No email service configured
  console.warn('⚠️  Email service not available. Email not sent.');
  console.warn('⚠️  Email service type:', emailServiceType);
  if (emailServiceType === 'NONE') {
    console.warn('⚠️  Please configure email service (Resend or SendGrid) in environment variables');
    console.warn('⚠️  Add RESEND_API_KEY or SENDGRID_API_KEY to your environment variables');
  }
  return false;
};
