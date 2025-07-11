import nodemailer from 'nodemailer';
import logger from './logger.js';

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

const sendEmail = async (emailContent) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"News and Niche" <${process.env.SMTP_USER}>`,
      to: emailContent.to,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error(`Email sending failed: ${error.message}`);
    throw error;
  }
};

export { sendEmail }; 