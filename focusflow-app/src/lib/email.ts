import { logger } from './logger';

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  devOtp?: string;
  error?: string;
  statusCode?: number;
}

/** Safely masks an email for structured logging, e.g. "al***@domain.com" */
function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length <= 2 ? `${name[0]}*` : `${name.slice(0, 2)}***`;
  return `${maskedName}@${domain}`;
}

export async function sendPasswordResetOtpEmail(
  toEmail: string,
  otp: string
): Promise<SendEmailResult> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || 'FocusFlow <onboarding@resend.dev>';
  const maskedRecipient = maskEmail(toEmail);

  const subject = `FocusFlow Security: Your Verification Code is ${otp}`;
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #080E1A; color: #E2E8F0; margin: 0; padding: 24px; }
          .container { max-width: 520px; margin: 0 auto; background: #131A2A; border-radius: 16px; padding: 32px; border: 1px solid rgba(255,255,255,0.08); }
          .header { display: flex; align-items: center; margin-bottom: 24px; }
          .logo { font-size: 20px; font-weight: 800; color: #4CD7F6; letter-spacing: 1.5px; }
          .title { font-size: 22px; font-weight: 700; color: #FFFFFF; margin-bottom: 8px; }
          .description { font-size: 14px; color: #94A3B8; line-height: 1.6; margin-bottom: 24px; }
          .otp-box { background: rgba(76, 215, 246, 0.1); border: 1.5px dashed #4CD7F6; border-radius: 12px; padding: 18px; text-align: center; margin-bottom: 24px; }
          .otp-code { font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #4CD7F6; font-family: monospace; }
          .footer { font-size: 12px; color: #64748B; line-height: 1.5; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <span class="logo">● FOCUSFLOW</span>
          </div>
          <div class="title">Password Reset Verification</div>
          <div class="description">
            We received a request to reset your FocusFlow account password. Enter the 6-digit verification code below to authorize the change:
          </div>
          <div class="otp-box">
            <span class="otp-code">${otp}</span>
          </div>
          <div class="description">
            This verification code is valid for <strong>10 minutes</strong>. If you did not request this password reset, please ignore this email or contact support.
          </div>
          <div class="footer">
            FocusFlow Autonomous Systems • High-Performance Workspaces<br>
            Secure Single-Use Authentication Protocol
          </div>
        </div>
      </body>
    </html>
  `;

  // 1. If Resend API Key is available, dispatch via Resend REST API
  if (resendApiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [toEmail],
          subject,
          html: htmlContent,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const statusMessage = typeof errJson?.message === 'string' ? errJson.message : 'Email delivery rejected by provider';
        logger.error(
          { recipient: maskedRecipient, statusCode: res.status, providerMessage: statusMessage },
          '[EMAIL] Transactional OTP delivery rejected by provider'
        );
        return {
          success: false,
          statusCode: res.status,
          error: statusMessage,
        };
      }

      const json = await res.json().catch(() => ({}));
      logger.info(
        { recipient: maskedRecipient, messageId: json?.id },
        '[EMAIL] Transactional password reset OTP dispatched successfully'
      );
      return { success: true, messageId: json?.id };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Network error delivering email';
      logger.error(
        { recipient: maskedRecipient, error: errorMessage },
        '[EMAIL] Failed to dispatch via Resend REST API'
      );
      return { success: false, error: errorMessage };
    }
  }

  // 2. Fallback / Dev mode: Log cleanly to console (masked) and provide devOtp for instant testing
  logger.info(
    { recipient: maskedRecipient },
    '[EMAIL] Dispatcher running in dev/test fallback mode'
  );

  return {
    success: true,
    devOtp: otp,
  };
}
