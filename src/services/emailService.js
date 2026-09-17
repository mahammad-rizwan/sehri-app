const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// Create transporter — configured via environment variables
// Supports Gmail (SMTP) or any SMTP provider
function createTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    logger.warn('[Email] EMAIL_USER or EMAIL_PASS not set — email sending disabled');
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // Gmail App Password (not your login password)
    },
  });
}

/**
 * Send donation receipt email to donor
 */
async function sendDonationReceipt({ to, donorName, amount, paymentId, orderId, message, date }) {
  const transporter = createTransporter();
  if (!transporter) return; // silently skip if not configured

  const formattedAmount = `₹${Number(amount).toLocaleString('en-IN')}`;
  const formattedDate = new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Donation Receipt</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0D1B2A 0%,#152336 100%);padding:36px 40px;text-align:center;">
            <div style="font-size:40px;margin-bottom:8px;">🌙</div>
            <h1 style="color:#C9A84C;margin:0;font-size:26px;font-weight:800;letter-spacing:1px;">Sehri Connect</h1>
            <p style="color:#8899AA;margin:8px 0 0;font-size:14px;">Donation Receipt</p>
          </td>
        </tr>

        <!-- Thank You -->
        <tr>
          <td style="padding:36px 40px 24px;text-align:center;border-bottom:1px solid #f0f0f0;">
            <div style="font-size:36px;margin-bottom:12px;">🎁</div>
            <h2 style="color:#1a1a2e;margin:0 0 8px;font-size:22px;">JazakAllahu Khayran!</h2>
            <p style="color:#555;margin:0;font-size:15px;line-height:1.6;">
              Dear <strong>${donorName || 'Donor'}</strong>, your generous donation has been received.<br/>
              May Allah bless you and your family abundantly.
            </p>
          </td>
        </tr>

        <!-- Amount Highlight -->
        <tr>
          <td style="padding:28px 40px;text-align:center;background:#fafafa;border-bottom:1px solid #f0f0f0;">
            <p style="color:#888;margin:0 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Amount Donated</p>
            <p style="color:#C9A84C;font-size:40px;font-weight:800;margin:0;">${formattedAmount}</p>
          </td>
        </tr>

        <!-- Details Table -->
        <tr>
          <td style="padding:28px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
                  <span style="color:#888;font-size:13px;">Date & Time</span><br/>
                  <span style="color:#1a1a2e;font-size:14px;font-weight:600;">${formattedDate}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
                  <span style="color:#888;font-size:13px;">Payment ID</span><br/>
                  <span style="color:#1a1a2e;font-size:14px;font-weight:600;font-family:monospace;">${paymentId}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
                  <span style="color:#888;font-size:13px;">Order ID</span><br/>
                  <span style="color:#1a1a2e;font-size:14px;font-weight:600;font-family:monospace;">${orderId}</span>
                </td>
              </tr>
              ${message ? `
              <tr>
                <td style="padding:10px 0;">
                  <span style="color:#888;font-size:13px;">Your Message</span><br/>
                  <span style="color:#1a1a2e;font-size:14px;font-style:italic;">"${message}"</span>
                </td>
              </tr>` : ''}
            </table>
          </td>
        </tr>

        <!-- Purpose -->
        <tr>
          <td style="padding:0 40px 28px;">
            <div style="background:linear-gradient(135deg,rgba(201,168,76,0.12),rgba(201,168,76,0.04));border:1px solid rgba(201,168,76,0.3);border-radius:10px;padding:18px;text-align:center;">
              <p style="color:#C9A84C;font-size:13px;font-weight:700;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px;">Purpose</p>
              <p style="color:#333;font-size:14px;margin:0;">Sehri Food Distribution for Students</p>
            </div>
          </td>
        </tr>

        <!-- Hadith -->
        <tr>
          <td style="padding:0 40px 28px;text-align:center;">
            <p style="color:#888;font-size:13px;font-style:italic;margin:0;line-height:1.7;">
              "The Prophet ﷺ said: 'Charity does not decrease wealth.'"<br/>
              <span style="font-size:12px;">— Sahih Muslim</span>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#0D1B2A;padding:24px 40px;text-align:center;">
            <p style="color:#556;font-size:12px;margin:0;line-height:1.6;">
              This is an automated receipt from Sehri Connect.<br/>
              Please keep this for your records.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: `"Sehri Connect 🌙" <${process.env.EMAIL_USER}>`,
      to,
      subject: `🎁 Donation Receipt — ${formattedAmount} | Sehri Connect`,
      html,
    });
    logger.info(`[Email] Donation receipt sent to ${to} for ${formattedAmount}`);
  } catch (err) {
    // Never crash the payment flow if email fails
    logger.error(`[Email] Failed to send receipt to ${to}: ${err.message}`);
  }
}

module.exports = { sendDonationReceipt };
