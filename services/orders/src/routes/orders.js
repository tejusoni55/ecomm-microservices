// Orders service routes
import express from 'express';
import { getDb } from '../db.js';
import logger from '@ecomm/logger';
import { requireAuth } from '../middleware/auth.js';
import { publishOrderCreated, publishOrderUpdated } from '../kafka-producer.js';
import { getUser } from '../grpc-client.js';

const router = express.Router();

// POST /orders - Create a new order (authenticated)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { items, shipping_address } = req.body;
    const userId = req.user.id; // From JWT token

    // Validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array is required and cannot be empty' });
    }

    // Validate each item
    for (const item of items) {
      if (!item.product_id || !item.quantity) {
        return res.status(400).json({ error: 'Each item must have product_id and quantity' });
      }
      if (item.quantity <= 0) {
        return res.status(400).json({ error: 'Item quantity must be greater than 0' });
      }
    }

    const db = getDb();

    // Start transaction
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');

      // Verify user exists via gRPC
      let user;
      try {
        user = await getUser(userId);
      } catch (error) {
        logger.error('Failed to get user via gRPC', { error: error.message, userId });
        // Continue without gRPC verification for now (graceful degradation)
        user = { id: userId };
      }

      // Get products and verify stock
      const productIds = items.map(item => item.product_id);
      const placeholders = productIds.map((_, i) => `$${i + 1}`).join(', ');
      const productsQuery = `SELECT id, name, price, stock FROM products WHERE id IN (${placeholders})`;
      const { rows: products } = await client.query(productsQuery, productIds);

      if (products.length !== productIds.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'One or more products not found' });
      }

      // Create product map for quick lookup
      const productMap = {};
      products.forEach(product => {
        productMap[product.id] = product;
      });

      // Check stock and calculate totals
      let total = 0;
      const orderItems = [];

      for (const item of items) {
        const product = productMap[item.product_id];
        if (!product) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Product ${item.product_id} not found` });
        }

        if (product.stock < item.quantity) {
          await client.query('ROLLBACK');
          return res.status(400).json({ 
            error: `Insufficient stock for product ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}` 
          });
        }

        const unitPrice = parseFloat(product.price);
        const subtotal = unitPrice * item.quantity;
        total += subtotal;

        orderItems.push({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: unitPrice,
          subtotal: subtotal,
        });
      }

      // Create order
      const orderInsert = `
        INSERT INTO orders (user_id, total, status, notes)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      const { rows: orderRows } = await client.query(orderInsert, [
        userId,
        total,
        'pending',
        shipping_address ? JSON.stringify(shipping_address) : null,
      ]);

      const order = orderRows[0];

      // Create order items and update product stock
      for (const item of orderItems) {
        // Insert order item
        await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
           VALUES ($1, $2, $3, $4, $5)`,
          [order.id, item.product_id, item.quantity, item.unit_price, item.subtotal]
        );

        // Update product stock
        await client.query(
          `UPDATE products SET stock = stock - $1, updated_at = NOW() WHERE id = $2`,
          [item.quantity, item.product_id]
        );
      }

      await client.query('COMMIT');

      // Get order with items for event
      const orderWithItems = {
        ...order,
        items: orderItems,
      };

      // Publish order.created event
      await publishOrderCreated(orderWithItems);

      logger.info(`Order created: ${order.id} for user ${userId}, total: $${total}`);

      res.status(201).json({
        message: 'Order created successfully',
        order: {
          id: order.id,
          user_id: order.user_id,
          total: parseFloat(order.total),
          status: order.status,
          items: orderItems,
          created_at: order.created_at,
        },
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Error creating order', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /orders/:id - Get order details
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.user.id;

    const db = getDb();

    // Get order
    const { rows: orderRows } = await db.query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    );

    if (orderRows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderRows[0];

    // Check if user owns this order (unless admin)
    if (order.user_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get order items
    const { rows: items } = await db.query(
      `SELECT oi.*, p.name as product_name, p.sku
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [orderId]
    );

    res.json({
      order: {
        ...order,
        total: parseFloat(order.total),
        items,
      },
    });
  } catch (error) {
    logger.error('Error getting order', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /orders/user/:userId - List user's orders
router.get('/user/:userId', requireAuth, async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.userId, 10);
    const currentUserId = req.user.id;

    // Check if user can access these orders
    if (targetUserId !== currentUserId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const db = getDb();

    const { rows: orders } = await db.query(
      `SELECT o.*, COUNT(oi.id) as items_count
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.user_id = $1
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [targetUserId]
    );

    res.json({
      orders: orders.map(order => ({
        ...order,
        total: parseFloat(order.total),
        items_count: parseInt(order.items_count, 10),
      })),
    });
  } catch (error) {
    logger.error('Error listing user orders', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /orders/:id/status - Update order status (admin only)
router.put('/:id/status', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { status } = req.body;
    const orderId = req.params.id;

    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: `Status must be one of: ${validStatuses.join(', ')}` 
      });
    }

    const db = getDb();

    // Update order status
    const { rows } = await db.query(
      `UPDATE orders 
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, orderId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = rows[0];

    // Publish order.updated event
    await publishOrderUpdated(order);

    logger.info(`Order status updated: ${order.id} -> ${status}`);

    res.json({
      message: 'Order status updated successfully',
      order: {
        ...order,
        total: parseFloat(order.total),
      },
    });
  } catch (error) {
    logger.error('Error updating order status', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

