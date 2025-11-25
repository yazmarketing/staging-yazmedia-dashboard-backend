/**
 * Email Templates Utility
 * Provides reusable email templates with fixed header and footer
 */

/**
 * Get email header HTML
 */
export const getEmailHeader = (): string => {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8f9fa; padding: 20px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px 8px 0 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <tr>
              <td style="padding: 30px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 28px; font-weight: 700; letter-spacing: 1px;">
                  YAZ MEDIA
                </h1>
                <p style="margin: 10px 0 0 0; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; opacity: 0.9;">
                  HR Management Notification
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
};

/**
 * Get email footer HTML
 */
export const getEmailFooter = (): string => {
  const currentYear = new Date().getFullYear();
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8f9fa;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <tr>
              <td style="padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
                <p style="margin: 0 0 10px 0; color: #6c757d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 12px; line-height: 1.6;">
                  This is an automated notification. Please do not reply to this email.
                </p>
                <p style="margin: 0; color: #6c757d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 12px; line-height: 1.6;">
                  For inquiries, contact HR or Management through the internal system.
                </p>
                <p style="margin: 15px 0 0 0; color: #adb5bd; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 11px;">
                  © ${currentYear} YAZ Media. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
};

/**
 * Format leave type for display
 */
const formatLeaveType = (leaveType: string): string => {
  const leaveTypeMap: { [key: string]: string } = {
    ANNUAL: 'Annual Leave',
    SICK: 'Sick Leave',
    MATERNITY: 'Maternity Leave',
    EMERGENCY: 'Emergency Leave',
    WFH: 'Work From Home',
    TOIL: 'Time Off In Lieu',
    BEREAVEMENT: 'Bereavement Leave',
  };
  return leaveTypeMap[leaveType] || leaveType;
};

/**
 * Format date for display
 */
const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

/**
 * Generate leave request notification email body
 */
interface LeaveRequestEmailData {
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

export const generateLeaveRequestEmailBody = (data: LeaveRequestEmailData): string => {
  const { employeeName, employeeId, employeeEmail, leaveType, startDate, endDate, numberOfDays, reason, status } = data;

  const bodyContent = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8f9fa;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <tr>
              <td style="padding: 40px 30px;">
                <h2 style="margin: 0 0 20px 0; color: #212529; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 24px; font-weight: 600;">
                  Leave Request Submitted
                </h2>
                
                <div style="margin-bottom: 30px;">
                  <h3 style="margin: 0 0 15px 0; color: #495057; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; font-weight: 600;">
                    Employee Information
                  </h3>
                  <table width="100%" cellpadding="8" cellspacing="0" border="0" style="background-color: #f8f9fa; border-radius: 6px;">
                    <tr>
                      <td style="padding: 12px; color: #6c757d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; font-weight: 600; width: 150px; vertical-align: top;">
                        Employee:
                      </td>
                      <td style="padding: 12px; color: #212529; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px;">
                        ${employeeName}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 12px; color: #6c757d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; font-weight: 600; width: 150px; vertical-align: top;">
                        Employee ID:
                      </td>
                      <td style="padding: 12px; color: #212529; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px;">
                        ${employeeId}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 12px; color: #6c757d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; font-weight: 600; width: 150px; vertical-align: top;">
                        Email:
                      </td>
                      <td style="padding: 12px; color: #212529; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px;">
                        ${employeeEmail}
                      </td>
                    </tr>
                  </table>
                </div>

                <div style="margin-bottom: 30px;">
                  <h3 style="margin: 0 0 15px 0; color: #495057; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; font-weight: 600;">
                    Leave Details
                  </h3>
                  <table width="100%" cellpadding="8" cellspacing="0" border="0" style="background-color: #f8f9fa; border-radius: 6px;">
                    <tr>
                      <td style="padding: 12px; color: #6c757d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; font-weight: 600; width: 150px; vertical-align: top;">
                        Leave Type:
                      </td>
                      <td style="padding: 12px; color: #212529; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px;">
                        ${formatLeaveType(leaveType)}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 12px; color: #6c757d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; font-weight: 600; width: 150px; vertical-align: top;">
                        Start Date:
                      </td>
                      <td style="padding: 12px; color: #212529; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px;">
                        ${formatDate(startDate)}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 12px; color: #6c757d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; font-weight: 600; width: 150px; vertical-align: top;">
                        End Date:
                      </td>
                      <td style="padding: 12px; color: #212529; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px;">
                        ${formatDate(endDate)}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 12px; color: #6c757d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; font-weight: 600; width: 150px; vertical-align: top;">
                        Duration:
                      </td>
                      <td style="padding: 12px; color: #212529; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px;">
                        ${numberOfDays} ${numberOfDays === 1 ? 'day' : 'days'}
                      </td>
                    </tr>
                    ${status ? `
                    <tr>
                      <td style="padding: 12px; color: #6c757d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; font-weight: 600; width: 150px; vertical-align: top;">
                        Status:
                      </td>
                      <td style="padding: 12px; color: #212529; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px;">
                        <span style="display: inline-block; padding: 4px 12px; background-color: #fff3cd; color: #856404; border-radius: 4px; font-weight: 600; font-size: 12px;">
                          ${status}
                        </span>
                      </td>
                    </tr>
                    ` : ''}
                  </table>
                </div>

                ${reason ? `
                <div style="margin-bottom: 30px;">
                  <h3 style="margin: 0 0 15px 0; color: #495057; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; font-weight: 600;">
                    Reason
                  </h3>
                  <div style="padding: 15px; background-color: #f8f9fa; border-radius: 6px; border-left: 4px solid #667eea;">
                    <p style="margin: 0; color: #212529; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6;">
                      ${reason}
                    </p>
                  </div>
                </div>
                ` : ''}

                <div style="margin-top: 30px; padding: 20px; background-color: #e7f3ff; border-radius: 6px; border-left: 4px solid #0066cc;">
                  <h3 style="margin: 0 0 10px 0; color: #004085; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; font-weight: 600;">
                    Next Steps
                  </h3>
                  <ul style="margin: 0; padding-left: 20px; color: #004085; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.8;">
                    <li>Review the leave request details above</li>
                    <li>Check the employee's leave balance if needed</li>
                    <li>Approve or reject the request through the internal system</li>
                    <li>The employee will be automatically notified of your decision</li>
                  </ul>
                </div>

                <p style="margin: 30px 0 0 0; color: #6c757d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6;">
                  Please process this request as soon as possible. The employee will be notified once you make a decision.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  // Combine header, body, and footer
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Leave Request</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8f9fa;">
      ${getEmailHeader()}
      ${bodyContent}
      ${getEmailFooter()}
    </body>
    </html>
  `;
};



