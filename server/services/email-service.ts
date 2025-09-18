import sgMail from '@sendgrid/mail';
import { z } from 'zod';

// Email configuration schema
const emailConfigSchema = z.object({
  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_FROM_EMAIL: z.string().default('noreply@teacherportal.com'),
  SENDGRID_FROM_NAME: z.string().default('Teacher Portal Assam'),
  EMAIL_ENABLED: z.string().transform(val => val === 'true').default('true')
});

// Parse configuration from environment
const config = emailConfigSchema.parse({
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL,
  SENDGRID_FROM_NAME: process.env.SENDGRID_FROM_NAME,
  EMAIL_ENABLED: process.env.EMAIL_ENABLED
});

// Email queue types
interface EmailQueueItem {
  id: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  templateType: EmailTemplateType;
  data: any;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: Date;
  error?: string;
}

// Email template types
export enum EmailTemplateType {
  APPLICATION_CONFIRMATION = 'application_confirmation',
  STATUS_UPDATE = 'status_update',
  INTERVIEW_SCHEDULED = 'interview_scheduled',
  JOB_ALERT = 'job_alert',
  WELCOME = 'welcome',
  PASSWORD_RESET = 'password_reset'
}

// Email notification preferences
export interface EmailPreferences {
  applicationUpdates: boolean;
  jobAlerts: boolean;
  interviewReminders: boolean;
  weeklyDigest: boolean;
  marketingEmails: boolean;
}

// Default email preferences
export const DEFAULT_EMAIL_PREFERENCES: EmailPreferences = {
  applicationUpdates: true,
  jobAlerts: true,
  interviewReminders: true,
  weeklyDigest: false,
  marketingEmails: false
};

class EmailService {
  private queue: EmailQueueItem[] = [];
  private isProcessing = false;
  private rateLimitWindow = 60000; // 1 minute
  private maxEmailsPerWindow = 10;
  private emailsSentInWindow: { timestamp: number }[] = [];
  private initialized = false;

  constructor() {
    // Initialize SendGrid if API key is available
    if (config.SENDGRID_API_KEY && config.EMAIL_ENABLED) {
      sgMail.setApiKey(config.SENDGRID_API_KEY);
      this.initialized = true;
      console.log('✅ SendGrid email service initialized');
    } else {
      if (!config.EMAIL_ENABLED) {
        console.log('⚠️ Email service is disabled (EMAIL_ENABLED=false)');
      } else {
        console.warn('⚠️ SENDGRID_API_KEY not set - emails will be logged to console only');
      }
    }
    
    // Start queue processor
    this.startQueueProcessor();
  }

  // Check rate limit
  private checkRateLimit(): boolean {
    const now = Date.now();
    // Remove old entries outside the window
    this.emailsSentInWindow = this.emailsSentInWindow.filter(
      entry => now - entry.timestamp < this.rateLimitWindow
    );
    
    return this.emailsSentInWindow.length < this.maxEmailsPerWindow;
  }

  // Add email to queue
  async queueEmail(
    to: string,
    templateType: EmailTemplateType,
    data: any,
    userId?: number
  ): Promise<string> {
    const emailId = `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const { subject, html, text } = this.renderTemplate(templateType, data);
    
    const queueItem: EmailQueueItem = {
      id: emailId,
      to,
      subject,
      html,
      text,
      templateType,
      data,
      attempts: 0,
      maxAttempts: 3
    };
    
    this.queue.push(queueItem);
    
    // Log the queued email
    console.log(`📧 Email queued: ${templateType} to ${to} (ID: ${emailId})`);
    
    return emailId;
  }

  // Process email queue
  private async startQueueProcessor() {
    setInterval(async () => {
      if (this.isProcessing || this.queue.length === 0) {
        return;
      }
      
      this.isProcessing = true;
      
      try {
        // Process emails in queue
        const itemsToProcess = [...this.queue];
        this.queue = [];
        
        for (const item of itemsToProcess) {
          if (!this.checkRateLimit()) {
            // Put back in queue if rate limited
            this.queue.push(item);
            console.log(`⏸️ Rate limited, requeuing email ${item.id}`);
            continue;
          }
          
          const success = await this.sendEmailInternal(item);
          
          if (!success && item.attempts < item.maxAttempts) {
            // Retry with exponential backoff
            item.attempts++;
            item.lastAttemptAt = new Date();
            const delay = Math.min(1000 * Math.pow(2, item.attempts), 30000);
            
            setTimeout(() => {
              this.queue.push(item);
              console.log(`🔄 Retrying email ${item.id} (attempt ${item.attempts}/${item.maxAttempts})`);
            }, delay);
          }
        }
      } catch (error) {
        console.error('Error processing email queue:', error);
      } finally {
        this.isProcessing = false;
      }
    }, 5000); // Process queue every 5 seconds
  }

  // Internal send email method
  private async sendEmailInternal(item: EmailQueueItem): Promise<boolean> {
    try {
      if (!config.EMAIL_ENABLED) {
        console.log('📧 Email sending disabled, skipping:', item.subject);
        return true;
      }

      // Add unsubscribe link to HTML
      const htmlWithUnsubscribe = this.addUnsubscribeLink(item.html, item.to);
      
      if (this.initialized && config.SENDGRID_API_KEY) {
        // Send via SendGrid
        await sgMail.send({
          to: item.to,
          from: {
            email: config.SENDGRID_FROM_EMAIL,
            name: config.SENDGRID_FROM_NAME
          },
          subject: item.subject,
          text: item.text || this.stripHtml(item.html),
          html: htmlWithUnsubscribe
        });
        
        // Track rate limit
        this.emailsSentInWindow.push({ timestamp: Date.now() });
        
        console.log(`✅ Email sent successfully: ${item.subject} to ${item.to}`);
        return true;
      } else {
        // Fallback to console.log
        console.log('📧 EMAIL (Console Mode):');
        console.log('  To:', item.to);
        console.log('  From:', `${config.SENDGRID_FROM_NAME} <${config.SENDGRID_FROM_EMAIL}>`);
        console.log('  Subject:', item.subject);
        console.log('  Template:', item.templateType);
        console.log('  Data:', JSON.stringify(item.data, null, 2));
        console.log('  Preview:', item.text || this.stripHtml(item.html).substring(0, 200) + '...');
        console.log('---');
        return true;
      }
    } catch (error: any) {
      item.error = error.message;
      console.error(`❌ Failed to send email ${item.id}:`, error.message);
      
      // Log SendGrid specific errors
      if (error.response?.body?.errors) {
        console.error('SendGrid errors:', error.response.body.errors);
      }
      
      return false;
    }
  }

  // Render email template
  private renderTemplate(
    templateType: EmailTemplateType,
    data: any
  ): { subject: string; html: string; text?: string } {
    const baseStyles = `
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
        .email-container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .header h1 { color: white; margin: 0; font-size: 28px; }
        .content { background: white; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #718096; font-size: 14px; }
        .info-box { background: #f7fafc; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 4px; }
        h2 { color: #2d3748; margin-top: 0; }
        p { color: #4a5568; line-height: 1.6; }
        .status-badge { display: inline-block; padding: 6px 12px; border-radius: 4px; font-weight: 600; font-size: 14px; }
        .status-pending { background: #fed7aa; color: #c05621; }
        .status-shortlisted { background: #c6f6d5; color: #22543d; }
        .status-rejected { background: #fed7d7; color: #9b2c2c; }
        .status-accepted { background: #bee3f8; color: #2c5282; }
      </style>
    `;

    switch (templateType) {
      case EmailTemplateType.APPLICATION_CONFIRMATION:
        return {
          subject: `Application Received - ${data.jobTitle}`,
          html: `
            ${baseStyles}
            <div class="email-container">
              <div class="header">
                <h1>Application Received! 🎉</h1>
              </div>
              <div class="content">
                <h2>Dear ${data.applicantName},</h2>
                <p>Thank you for applying for the position of <strong>${data.jobTitle}</strong> at <strong>${data.organization}</strong>.</p>
                
                <div class="info-box">
                  <p><strong>Application Details:</strong></p>
                  <p>Position: ${data.jobTitle}<br/>
                  Organization: ${data.organization}<br/>
                  Location: ${data.location}<br/>
                  Application Date: ${new Date(data.appliedAt).toLocaleDateString()}<br/>
                  Application ID: #${data.applicationId}</p>
                </div>
                
                <p>Your application has been successfully submitted and is currently under review. We will notify you of any updates regarding your application status.</p>
                
                <p><strong>What happens next?</strong></p>
                <ul>
                  <li>Your application will be reviewed by the hiring team</li>
                  <li>You'll receive updates on your application status</li>
                  <li>If shortlisted, you'll be contacted for further steps</li>
                </ul>
                
                <a href="${data.dashboardUrl}" class="button">View Application Status</a>
                
                <p>Best of luck with your application!</p>
              </div>
              <div class="footer">
                <p>© 2025 Teacher Portal Assam. All rights reserved.</p>
              </div>
            </div>
          `
        };

      case EmailTemplateType.STATUS_UPDATE:
        const statusColors = {
          pending: 'status-pending',
          shortlisted: 'status-shortlisted',
          rejected: 'status-rejected',
          accepted: 'status-accepted'
        };
        
        return {
          subject: `Application Status Update - ${data.jobTitle}`,
          html: `
            ${baseStyles}
            <div class="email-container">
              <div class="header">
                <h1>Application Status Update</h1>
              </div>
              <div class="content">
                <h2>Dear ${data.applicantName},</h2>
                <p>We have an update regarding your application for <strong>${data.jobTitle}</strong> at <strong>${data.organization}</strong>.</p>
                
                <div class="info-box">
                  <p><strong>Status Update:</strong></p>
                  <p>Your application status has been changed to: <span class="status-badge ${statusColors[data.newStatus] || 'status-pending'}">${data.newStatus.toUpperCase()}</span></p>
                  ${data.note ? `<p><strong>Note from recruiter:</strong> ${data.note}</p>` : ''}
                </div>
                
                ${data.newStatus === 'shortlisted' ? `
                  <p><strong>Congratulations!</strong> You have been shortlisted for this position. The hiring team will contact you soon with next steps.</p>
                ` : ''}
                
                ${data.newStatus === 'rejected' ? `
                  <p>Thank you for your interest in this position. While your application was not selected at this time, we encourage you to apply for other positions that match your qualifications.</p>
                ` : ''}
                
                ${data.newStatus === 'accepted' ? `
                  <p><strong>Congratulations!</strong> Your application has been accepted! You will receive detailed information about the next steps shortly.</p>
                ` : ''}
                
                <a href="${data.applicationUrl}" class="button">View Application Details</a>
              </div>
              <div class="footer">
                <p>© 2025 Teacher Portal Assam. All rights reserved.</p>
              </div>
            </div>
          `
        };

      case EmailTemplateType.INTERVIEW_SCHEDULED:
        return {
          subject: `Interview Scheduled - ${data.jobTitle}`,
          html: `
            ${baseStyles}
            <div class="email-container">
              <div class="header">
                <h1>Interview Scheduled! 📅</h1>
              </div>
              <div class="content">
                <h2>Dear ${data.applicantName},</h2>
                <p>Great news! Your interview has been scheduled for the position of <strong>${data.jobTitle}</strong> at <strong>${data.organization}</strong>.</p>
                
                <div class="info-box">
                  <p><strong>Interview Details:</strong></p>
                  <p>Date: ${new Date(data.interviewDate).toLocaleDateString()}<br/>
                  Time: ${new Date(data.interviewDate).toLocaleTimeString()}<br/>
                  Location: ${data.location || 'To be confirmed'}<br/>
                  Type: ${data.interviewType || 'In-person'}</p>
                </div>
                
                <p><strong>Preparation Tips:</strong></p>
                <ul>
                  <li>Review the job description and requirements</li>
                  <li>Prepare examples of your relevant experience</li>
                  <li>Research the organization</li>
                  <li>Prepare questions to ask the interviewer</li>
                  <li>Arrive 10-15 minutes early</li>
                </ul>
                
                <a href="${data.applicationUrl}" class="button">View Full Details</a>
                
                <p>Best wishes for your interview!</p>
              </div>
              <div class="footer">
                <p>© 2025 Teacher Portal Assam. All rights reserved.</p>
              </div>
            </div>
          `
        };

      case EmailTemplateType.JOB_ALERT:
        const jobListHtml = data.jobs?.map((job: any) => `
          <div style="border: 1px solid #e2e8f0; padding: 15px; margin: 10px 0; border-radius: 6px;">
            <h3 style="margin-top: 0; color: #2d3748;">${job.title}</h3>
            <p style="margin: 5px 0; color: #718096;">${job.organization} • ${job.location}</p>
            <p style="margin: 10px 0; color: #4a5568;">${job.description?.substring(0, 150)}...</p>
            <a href="${data.portalUrl}/jobs/${job.id}" style="color: #667eea; text-decoration: none; font-weight: 600;">View Details →</a>
          </div>
        `).join('') || '<p>No matching jobs this week.</p>';

        return {
          subject: `Weekly Job Alert - ${data.jobs?.length || 0} New Opportunities`,
          html: `
            ${baseStyles}
            <div class="email-container">
              <div class="header">
                <h1>Your Weekly Job Alert 📢</h1>
              </div>
              <div class="content">
                <h2>Dear ${data.userName},</h2>
                <p>Here are the latest teaching opportunities matching your preferences:</p>
                
                ${jobListHtml}
                
                <a href="${data.portalUrl}/jobs" class="button">View All Jobs</a>
                
                <p>Don't miss out on these opportunities!</p>
              </div>
              <div class="footer">
                <p>© 2025 Teacher Portal Assam. All rights reserved.</p>
              </div>
            </div>
          `
        };

      default:
        return {
          subject: 'Notification from Teacher Portal Assam',
          html: `
            ${baseStyles}
            <div class="email-container">
              <div class="header">
                <h1>Teacher Portal Assam</h1>
              </div>
              <div class="content">
                <p>${JSON.stringify(data)}</p>
              </div>
              <div class="footer">
                <p>© 2025 Teacher Portal Assam. All rights reserved.</p>
              </div>
            </div>
          `
        };
    }
  }

  // Add unsubscribe link
  private addUnsubscribeLink(html: string, email: string): string {
    const unsubscribeUrl = `${process.env.APP_URL || 'http://localhost:5000'}/unsubscribe?email=${encodeURIComponent(email)}`;
    const unsubscribeHtml = `
      <div style="text-align: center; padding: 20px; color: #718096; font-size: 12px;">
        <p>You're receiving this email because you're registered with Teacher Portal Assam.</p>
        <p><a href="${unsubscribeUrl}" style="color: #667eea;">Unsubscribe</a> | <a href="${process.env.APP_URL || 'http://localhost:5000'}/profile" style="color: #667eea;">Update Email Preferences</a></p>
      </div>
    `;
    
    // Insert before closing body tag if it exists, otherwise append
    if (html.includes('</body>')) {
      return html.replace('</body>', `${unsubscribeHtml}</body>`);
    } else if (html.includes('</div>')) {
      // Find the last closing div and insert before it
      const lastDivIndex = html.lastIndexOf('</div>');
      return html.slice(0, lastDivIndex) + unsubscribeHtml + html.slice(lastDivIndex);
    } else {
      return html + unsubscribeHtml;
    }
  }

  // Strip HTML for text version
  private stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>.*?<\/style>/gs, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Public method to send email immediately (bypasses queue)
  async sendEmail(
    to: string,
    templateType: EmailTemplateType,
    data: any
  ): Promise<boolean> {
    const { subject, html, text } = this.renderTemplate(templateType, data);
    
    const item: EmailQueueItem = {
      id: `direct-${Date.now()}`,
      to,
      subject,
      html,
      text,
      templateType,
      data,
      attempts: 0,
      maxAttempts: 1
    };
    
    return this.sendEmailInternal(item);
  }

  // Get queue status
  getQueueStatus(): { queued: number; processing: boolean } {
    return {
      queued: this.queue.length,
      processing: this.isProcessing
    };
  }

  // Check if service is available
  isAvailable(): boolean {
    return config.EMAIL_ENABLED && (this.initialized || !config.SENDGRID_API_KEY);
  }
}

// Export singleton instance
export const emailService = new EmailService();

// Export types and utilities
export { EmailService, config as emailConfig };