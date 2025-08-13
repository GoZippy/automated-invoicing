import request from 'supertest';
import express from 'express';
import { authController } from '../auth.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { body } from 'express-validator';
import { createClient } from '@supabase/supabase-js';
import emailService from '../../services/email.service';

// Create test app
const app = express();
app.use(express.json());

// Mount auth routes for testing
app.post('/register', 
  [
    body('email').isEmail(),
    body('password').isLength({ min: 8 }),
    body('fullName').notEmpty(),
  ],
  validate,
  authController.register
);

app.post('/login',
  [
    body('email').isEmail(),
    body('password').notEmpty(),
  ],
  validate,
  authController.login
);

app.post('/logout', authenticate, authController.logout);
app.post('/refresh', body('refreshToken').notEmpty(), validate, authController.refreshToken);
app.get('/me', authenticate, authController.getCurrentUser);

// Mock Supabase responses
const mockSupabaseAuth = {
  signUp: jest.fn(),
  signInWithPassword: jest.fn(),
  signOut: jest.fn(),
  getUser: jest.fn(),
  refreshSession: jest.fn(),
  updateUser: jest.fn(),
};

const mockSupabaseFrom = jest.fn(() => ({
  insert: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: mockSupabaseAuth,
    from: mockSupabaseFrom,
  })),
}));

describe('Auth Controller Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /register', () => {
    it('should register a new user successfully', async () => {
      const newUser = {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        fullName: 'New User',
        companyName: 'Test Company',
      };

      mockSupabaseAuth.signUp.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: newUser.email,
            created_at: new Date().toISOString(),
          },
          session: {
            access_token: 'test-access-token',
            refresh_token: 'test-refresh-token',
            expires_in: 3600,
          },
        },
        error: null,
      });

      mockSupabaseFrom().single.mockResolvedValue({
        data: {
          id: 'user-123',
          email: newUser.email,
          full_name: newUser.fullName,
          company_name: newUser.companyName,
          role: 'user',
        },
        error: null,
      });

      const response = await request(app)
        .post('/register')
        .send(newUser)
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        user: expect.objectContaining({
          id: 'user-123',
          email: newUser.email,
          role: 'user',
        }),
        token: 'test-access-token',
        refreshToken: 'test-refresh-token',
      });

      expect(mockSupabaseAuth.signUp).toHaveBeenCalledWith({
        email: newUser.email,
        password: newUser.password,
        options: {
          data: {
            full_name: newUser.fullName,
            company_name: newUser.companyName,
          },
        },
      });

      expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith(
        newUser.email,
        newUser.fullName
      );
    });

    it('should handle registration with existing email', async () => {
      mockSupabaseAuth.signUp.mockResolvedValue({
        data: null,
        error: {
          message: 'User already registered',
          status: 400,
        },
      });

      const response = await request(app)
        .post('/register')
        .send({
          email: 'existing@example.com',
          password: 'Password123!',
          fullName: 'Existing User',
        })
        .expect(400);

      expect(response.body.error).toEqual(
        expect.objectContaining({
          message: 'User already registered',
        })
      );
    });

    it('should validate registration input', async () => {
      const response = await request(app)
        .post('/register')
        .send({
          email: 'invalid-email',
          password: 'short',
          fullName: '',
        })
        .expect(400);

      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'email' }),
          expect.objectContaining({ field: 'password' }),
          expect.objectContaining({ field: 'fullName' }),
        ])
      );
    });
  });

  describe('POST /login', () => {
    it('should login user successfully', async () => {
      const credentials = {
        email: 'user@example.com',
        password: 'Password123!',
      };

      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: credentials.email,
            user_metadata: {
              full_name: 'Test User',
            },
          },
          session: {
            access_token: 'test-access-token',
            refresh_token: 'test-refresh-token',
            expires_in: 3600,
          },
        },
        error: null,
      });

      mockSupabaseFrom().single.mockResolvedValue({
        data: {
          id: 'user-123',
          email: credentials.email,
          full_name: 'Test User',
          role: 'user',
          is_active: true,
        },
        error: null,
      });

      const response = await request(app)
        .post('/login')
        .send(credentials)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        user: expect.objectContaining({
          id: 'user-123',
          email: credentials.email,
          role: 'user',
        }),
        token: 'test-access-token',
        refreshToken: 'test-refresh-token',
      });

      expect(mockSupabaseAuth.signInWithPassword).toHaveBeenCalledWith({
        email: credentials.email,
        password: credentials.password,
      });
    });

    it('should handle invalid credentials', async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: null,
        error: {
          message: 'Invalid login credentials',
          status: 400,
        },
      });

      const response = await request(app)
        .post('/login')
        .send({
          email: 'user@example.com',
          password: 'WrongPassword',
        })
        .expect(401);

      expect(response.body.error.message).toBe('Invalid login credentials');
    });

    it('should handle inactive user account', async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'user-123', email: 'user@example.com' },
          session: { access_token: 'token', refresh_token: 'refresh' },
        },
        error: null,
      });

      mockSupabaseFrom().single.mockResolvedValue({
        data: {
          id: 'user-123',
          email: 'user@example.com',
          is_active: false,
        },
        error: null,
      });

      const response = await request(app)
        .post('/login')
        .send({
          email: 'user@example.com',
          password: 'Password123!',
        })
        .expect(403);

      expect(response.body.error.message).toBe('Account is disabled');
    });
  });

  describe('POST /logout', () => {
    it('should logout user successfully', async () => {
      mockSupabaseAuth.signOut.mockResolvedValue({ error: null });

      const response = await request(app)
        .post('/logout')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Logged out successfully',
      });

      expect(mockSupabaseAuth.signOut).toHaveBeenCalled();
    });
  });

  describe('POST /refresh', () => {
    it('should refresh token successfully', async () => {
      mockSupabaseAuth.refreshSession.mockResolvedValue({
        data: {
          session: {
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            expires_in: 3600,
          },
          user: {
            id: 'user-123',
            email: 'user@example.com',
          },
        },
        error: null,
      });

      const response = await request(app)
        .post('/refresh')
        .send({ refreshToken: 'old-refresh-token' })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        token: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });

    it('should handle invalid refresh token', async () => {
      mockSupabaseAuth.refreshSession.mockResolvedValue({
        data: null,
        error: {
          message: 'Invalid refresh token',
          status: 400,
        },
      });

      const response = await request(app)
        .post('/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.error.message).toBe('Invalid refresh token');
    });
  });

  describe('GET /me', () => {
    it('should get current user profile', async () => {
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'user@example.com',
            user_metadata: {
              full_name: 'Test User',
            },
          },
        },
        error: null,
      });

      mockSupabaseFrom().single.mockResolvedValue({
        data: {
          id: 'user-123',
          email: 'user@example.com',
          full_name: 'Test User',
          company_name: 'Test Company',
          role: 'user',
          created_at: '2024-01-01T00:00:00Z',
        },
        error: null,
      });

      const response = await request(app)
        .get('/me')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        user: expect.objectContaining({
          id: 'user-123',
          email: 'user@example.com',
          fullName: 'Test User',
          role: 'user',
        }),
      });
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/me')
        .expect(401);

      expect(response.body.error.message).toBe('No token provided');
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit excessive login attempts', async () => {
      // Simulate multiple login attempts
      const attempts = Array(6).fill(null).map(() =>
        request(app)
          .post('/login')
          .send({
            email: 'user@example.com',
            password: 'Password123!',
          })
      );

      const responses = await Promise.all(attempts);
      const rateLimited = responses.some(r => r.status === 429);

      expect(rateLimited).toBe(true);
    });
  });
});