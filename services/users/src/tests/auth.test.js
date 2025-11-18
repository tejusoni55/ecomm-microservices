// Unit tests for authentication logic in users service
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

describe('Authentication Logic', () => {
  describe('Password Hashing', () => {
    test('bcrypt should hash passwords correctly', async () => {
      const password = 'testPassword123';
      const hashed = await bcrypt.hash(password, 10);
      
      expect(hashed).not.toBe(password);
      const match = await bcrypt.compare(password, hashed);
      expect(match).toBe(true);
    });

    test('bcrypt should not match incorrect passwords', async () => {
      const password = 'testPassword123';
      const hashed = await bcrypt.hash(password, 10);
      
      const match = await bcrypt.compare('wrongPassword', hashed);
      expect(match).toBe(false);
    });
  });

  describe('JWT Token', () => {
    test('jwt should sign and verify tokens correctly', () => {
      const payload = { id: 1, email: 'test@example.com', role: 'consumer' };
      const secret = 'test-secret';
      
      const token = jwt.sign(payload, secret, { expiresIn: '24h' });
      expect(token).toBeDefined();
      
      const decoded = jwt.verify(token, secret);
      expect(decoded.id).toBe(payload.id);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
    });

    test('jwt should fail on expired tokens', () => {
      const payload = { id: 1, email: 'test@example.com' };
      const secret = 'test-secret';
      
      const token = jwt.sign(payload, secret, { expiresIn: '-1h' }); // Already expired
      
      expect(() => {
        jwt.verify(token, secret);
      }).toThrow();
    });

    test('jwt should fail on invalid signatures', () => {
      const payload = { id: 1, email: 'test@example.com' };
      const token = jwt.sign(payload, 'original-secret', { expiresIn: '24h' });
      
      expect(() => {
        jwt.verify(token, 'different-secret');
      }).toThrow();
    });
  });
});
