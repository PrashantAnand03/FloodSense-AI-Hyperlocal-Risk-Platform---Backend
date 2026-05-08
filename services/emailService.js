import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

/**
 * Emergency Email Alert Service
 * Dispatches highly informative emergency alerts
 */
export async function sendAlertEmail(userEmail, locationName, riskLevel, riskPercentage, weatherInfo = {}, aiCommentary = '') {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS?.replace(/\s/g, ''), // Clean spaces from app password
      },
    });

    const isHigh = riskLevel === 'HIGH';
    const alertColor = isHigh ? '#dc2626' : '#ea580c';
    const emoji = isHigh ? '🚨' : '⚠️';
    const statusText = isHigh ? 'IMMEDIATE EVACUATION ADVISED' : 'ENHANCED MONITORING REQUIRED';

    const mailOptions = {
      from: `"FloodSense AI — Emergency Response" <${process.env.SMTP_USER}>`,
      to: userEmail,
      subject: `${emoji} URGENT: Flood Alert for ${locationName.split('(')[0].trim()}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 20px auto; border: 1px solid #e1e1e1; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .header { background-color: ${alertColor}; color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; background-color: #ffffff; }
            .location-card { background-color: #f1f5f9; border-left: 5px solid ${alertColor}; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
            .risk-meter { background: #e2e8f0; border-radius: 10px; height: 12px; margin: 15px 0; position: relative; overflow: hidden; }
            .risk-fill { background: ${alertColor}; height: 100%; width: ${riskPercentage}%; }
            .action-item { margin-bottom: 15px; display: flex; align-items: flex-start; }
            .action-icon { margin-right: 12px; font-size: 20px; }
            .footer { background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
            .btn { display: inline-block; padding: 12px 24px; background-color: ${alertColor}; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <p style="margin: 0; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; font-size: 14px;">Official Emergency Notification</p>
              <h1 style="margin: 10px 0;">${emoji} ${riskLevel} RISK ALERT</h1>
              <p style="margin: 0; font-size: 18px; font-weight: 500;">${statusText}</p>
            </div>
            
            <div class="content">
              <p style="font-size: 16px;">Our Hyperlocal AI models have detected a significant increase in flood risk for your registered location.</p>
              
              <div class="location-card">
                <p style="margin: 0 0 5px 0; color: #64748b; font-size: 12px; font-weight: bold; text-transform: uppercase;">AFFECTED AREA</p>
                <p style="margin: 0; font-size: 20px; font-weight: bold; color: #0f172a;">📍 ${locationName}</p>
                <p style="margin: 10px 0 0 0; font-size: 14px;"><b>Calculated Risk Score:</b> ${riskPercentage}%</p>
                <div class="risk-meter"><div class="risk-fill"></div></div>
              </div>

              ${weatherInfo.precip_mm !== undefined ? `
                <div style="background-color: #fffbeb; border: 1px solid #fde68a; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                  <p style="margin: 0; font-weight: bold; color: #92400e;">🌤️ Real-Time Weather Conditions:</p>
                  <p style="margin: 5px 0 0 0; font-size: 14px;">
                    Current Condition: <b>${weatherInfo.condition || 'Monitoring'}</b><br/>
                    Rainfall Intensity: <b>${weatherInfo.precip_mm} mm/hr</b><br/>
                    Humidity: <b>${weatherInfo.humidity}%</b>
                  </p>
                </div>
              ` : ''}

              ${aiCommentary ? `
                <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px; margin-bottom: 20px;">
                  <p style="margin: 0; font-weight: bold; color: #166534; font-size: 14px;">🤖 AI Emergency Assessment:</p>
                  <p style="margin: 5px 0 0 0; font-size: 15px; font-style: italic; color: #14532d;">"${aiCommentary}"</p>
                </div>
              ` : ''}

              <h2 style="color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px; margin-top: 30px;">Critical Action Plan</h2>
              
              <div class="action-item">
                <span class="action-icon">📋</span>
                <div><b>Follow Local Guidance:</b> Tune in to local news or emergency radio for the latest updates from disaster management authorities.</div>
              </div>

              ${isHigh ? `
                <div class="action-item">
                  <span class="action-icon">🏃‍♂️</span>
                  <div><b>Evacuate Immediately:</b> Move to higher ground if you are in a low-lying area. Do not wait for instructions if you feel unsafe.</div>
                </div>
                <div class="action-item">
                  <span class="action-icon">🚫</span>
                  <div><b>Avoid Flood Waters:</b> Never attempt to drive or walk through moving water. 6 inches of water can knock you down.</div>
                </div>
              ` : `
                <div class="action-item">
                  <span class="action-icon">📦</span>
                  <div><b>Prepare Supplies:</b> Gather water, non-perishable food, flashlights, and a first-aid kit. Charge all mobile devices.</div>
                </div>
                <div class="action-item">
                  <span class="action-icon">⬆️</span>
                  <div><b>Protect Property:</b> Move expensive electronics and documents to higher floors or high shelves.</div>
                </div>
              `}

              <div style="text-align: center; margin-top: 40px;">
                <p style="margin-bottom: 10px; font-weight: bold;">Need more details?</p>
                <a href="http://localhost:5173/dashboard" style="display: inline-block; padding: 14px 30px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">View Live Risk Dashboard</a>
                <p style="margin-top: 15px; font-size: 11px; color: #94a3b8;">If button doesn't work, copy this: http://localhost:5173/dashboard</p>
              </div>
            </div>

            <div class="footer">
              <p><b>FloodSense AI — Hyperlocal Disaster Prevention System</b></p>
              <p>This is an automated emergency alert based on real-time sensor data and AI modeling. Please do not reply to this email.</p>
              <p style="margin-top: 15px; color: #94a3b8;">&copy; 2026 Cognizant Blue Bolt Hackathon Project</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email Service] ✅ High-Info alert email sent to ${userEmail}. ID: ${info.messageId}`);

    const logEntry = `[${new Date().toISOString()}] MAIL_SENT to ${userEmail} | Loc: ${locationName} | Score: ${riskPercentage}% | MsgId: ${info.messageId}\n`;
    fs.appendFileSync(path.join(process.cwd(), 'alerts_email_log.txt'), logEntry);

    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[Email Service] ❌ Failed to send informative email:', err.message);
    return { success: false, error: err.message };
  }
}
