// Email notifications queue and sender (minimal implementation)
import nodemailer from 'nodemailer';
import logger from '@ecomm/logger';

// In-memory queue for notifications (replace with database in production)
const notificationQueue = [];

// Create transporter for Maildev (local dev)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '1025', 10),
  secure: process.env.NODE_ENV === 'production',
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  } : undefined,
});

export async function sendWelcomeEmail(user) {
  try {
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@ecomm.local',
      to: user.email,
      subject: 'Welcome to Ecomm!',
      html: `
        <h1>Welcome ${user.first_name}!</h1>
        <p>Your account has been created successfully.</p>
        <p>You can now start shopping on our platform.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Welcome email sent to ${user.email}`);
  } catch (error) {
    logger.error(`Failed to send welcome email to ${user.email}`, { error: error.message });
    throw error;
  }
}

export async function sendOrderConfirmationEmail(order, userEmail) {
  try {
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@ecomm.local',
      to: userEmail,
      subject: `Order Confirmation #${order.order_id}`,
      html: `
        <h1>Order Confirmed</h1>
        <p>Your order #${order.order_id} has been confirmed.</p>
        <p>Total: $${order.total}</p>
        <p>We will send you a shipping confirmation once your order ships.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Order confirmation email sent for order ${order.order_id}`);
  } catch (error) {
    logger.error(`Failed to send order confirmation email`, { error: error.message });
    throw error;
  }
}

export async function sendPaymentSuccessEmail(payment, userEmail) {
  try {
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@ecomm.local',
      to: userEmail,
      subject: `Payment Confirmed - Order #${payment.order_id}`,
      html: `
        <h1>Payment Confirmed</h1>
        <p>Your payment of $${payment.amount} has been successfully processed.</p>
        <p>Order ID: ${payment.order_id}</p>
        <p>Transaction ID: ${payment.transaction_id}</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Payment confirmation email sent for order ${payment.order_id}`);
  } catch (error) {
    logger.error(`Failed to send payment confirmation email`, { error: error.message });
    throw error;
  }
}

export async function sendPaymentFailedEmail(payment, userEmail) {
  try {
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@ecomm.local',
      to: userEmail,
      subject: `Payment Failed - Order #${payment.order_id}`,
      html: `
        <h1>Payment Failed</h1>
        <p>Unfortunately, your payment for order #${payment.order_id} could not be processed.</p>
        <p>Amount: $${payment.amount}</p>
        <p>Reason: ${payment.reason || 'Payment processing error'}</p>
        <p>Please try again or contact support if the issue persists.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Payment failure email sent for order ${payment.order_id}`);
  } catch (error) {
    logger.error(`Failed to send payment failure email`, { error: error.message });
    throw error;
  }
}

export function queueNotification(notification) {
  notificationQueue.push({
    ...notification,
    created_at: new Date().toISOString(),
    sent: false,
  });
  logger.debug('Notification queued', { type: notification.type });
}

export function getQueuedNotifications() {
  return notificationQueue;
}

export function clearQueue() {
  notificationQueue.length = 0;
}
