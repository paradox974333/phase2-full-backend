// errorNotifier.js
const nodemailer = require('nodemailer');

// Configure the email transporter using environment variables
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT, 10),
  secure: parseInt(process.env.EMAIL_PORT, 10) === 465, // Use true for port 465, false for others
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Sends an email notification to the admin about a critical error.
 * @param {string} subject - The subject of the error email.
 * @param {Error} error - The error object.
 * @param {string} [context] - Optional additional context about the error.
 */
async function notifyAdminOfError(subject, error, context = '') {
  // Prevent sending alerts if email is not configured
  if (!process.env.EMAIL_HOST || !process.env.ADMIN_EMAIL_RECIPIENT) {
    console.error(`Email notification for "${subject}" suppressed because EMAIL_HOST is not configured.`);
    return;
  }
  
  try {
    const mailOptions = {
      from: `"API Server Alert" <${process.env.EMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL_RECIPIENT,
      subject: `🚨 CRITICAL ERROR: ${subject}`,
      html: `
        <h1>A Critical Error Occurred in the Application</h1>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        ${context ? `<p><strong>Context:</strong> ${context}</p>` : ''}
        <hr>
        <h2>Error Details:</h2>
        <p><strong>Message:</strong> ${error.message}</p>
        <pre style="background-color: #f0f0f0; padding: 10px; border: 1px solid #ccc; border-radius: 5px;">${error.stack || 'No stack trace available'}</pre>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Admin error notification sent for: ${subject}`);
  } catch (emailError) {
    console.error('❌ FATAL: Could not send error notification email.', emailError);
  }
}

module.exports = { notifyAdminOfError };