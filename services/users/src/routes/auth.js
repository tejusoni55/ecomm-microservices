// Authentication routes for users service: signup and login
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getDb } from '../db.js';
import logger from '../logger.js';
import { publishUserCreated } from '../kafka-producer.js';

const router = express.Router();

// POST /signup - Create new user account
router.post('/signup', async (req, res) => {
  try {
    const { email, password, first_name, last_name } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const db = getDb();

    // Check if user already exists
    const existingUser = await db('users').where('email', email).first();
    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user
    const [userId] = await db('users').insert({
      email,
      password_hash,
      first_name: first_name || null,
      last_name: last_name || null,
      role: 'consumer',
      is_active: true,
    });

    const user = await db('users').where('id', userId).first();

    // Publish user.created event to Kafka
    await publishUserCreated(user);

    logger.info(`User created: ${email} (ID: ${userId})`);

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: process.env.JWT_EXPIRY || '24h' }
    );

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    logger.error('Error in signup endpoint', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /login - Authenticate user and return JWT
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const db = getDb();

    // Find user
    const user = await db('users').where('email', email).first();
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'User account is deactivated' });
    }

    logger.info(`User logged in: ${email}`);

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: process.env.JWT_EXPIRY || '24h' }
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    logger.error('Error in login endpoint', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /me - Get current user (requires valid JWT)
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const db = getDb();
    const user = await db('users').where('id', decoded.id).first();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
      },
    });
  } catch (error) {
    logger.error('Error in /me endpoint', { error: error.message });
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

export default router;
