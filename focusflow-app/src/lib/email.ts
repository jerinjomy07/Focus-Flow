// src/lib/email.ts
// FocusFlow — Transactional Email & Security OTP Dispatcher

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  devOtp?: string;
  error?: string;
}

export async function sendPasswordResetOtpEmail(
  toEmail: string,
  otp: string
): Promise<SendEmailResult> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || 'FocusFlow <onboarding@resend.dev>';

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
        console.error('[EMAIL] Resend delivery error:', errJson);
        return { success: false, error: errJson.message || 'Email delivery failed' };
      }

      const json = await res.json();
      console.log(`[EMAIL] Password reset OTP sent to ${toEmail} via Resend. ID: ${json.id}`);
      return { success: true, messageId: json.id };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Network error delivering email';
      console.error('[EMAIL] Failed to dispatch via Resend:', err);
      return { success: false, error: errorMessage };
    }
  }

  // 2. Fallback / Dev mode: Log cleanly to console and provide devOtp for instant testing
  console.log(`\n==================================================`);
  console.log(`[EMAIL DISPATCHER (DEV/TEST/NO-API-KEY)]`);
  console.log(`To: ${toEmail}`);
  console.log(`OTP Code: ${otp}`);
  console.log(`Expires in: 10 minutes`);
  console.log(`Tip: Set RESEND_API_KEY environment variable in Vercel for real inbox delivery.`);
  console.log(`==================================================\n`);

  return {
    success: true,
    devOtp: otp,
  };
}
