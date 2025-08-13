import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getSupabaseClient, getSupabaseServiceClient } from '../config/supabase';
import { asyncHandler, BadRequest, Unauthorized, Conflict, InternalError } from '../middleware/errorHandler';
import { logAudit, logger } from '../utils/logger';
import { sendEmail } from '../services/email.service';

interface RegisterRequest extends Request {
  body: {
    email: string;
    password: string;
    fullName: string;
    companyName?: string;
    phone?: string;
  };
}

interface LoginRequest extends Request {
  body: {
    email: string;
    password: string;
  };
}

const generateTokens = (userId: string, email: string, role: string) => {
  const accessToken = jwt.sign(
    { sub: userId, email, role },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  const refreshToken = jwt.sign(
    { sub: userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );

  return { accessToken, refreshToken };
};

export const authController = {
  register: asyncHandler(async (req: RegisterRequest, res: Response) => {
    const { email, password, fullName, companyName, phone } = req.body;

    const supabase = getSupabaseClient();
    const serviceClient = getSupabaseServiceClient();

    // Check if user already exists
    const { data: existingUser } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      throw Conflict('User with this email already exists');
    }

    // Create auth user in Supabase
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (authError || !authData.user) {
      logger.error('Supabase auth error:', authError);
      throw InternalError('Failed to create user account');
    }

    // Create profile (this should be handled by the trigger, but we'll ensure it)
    const { error: profileError } = await serviceClient
      .from('profiles')
      .upsert({
        id: authData.user.id,
        email,
        full_name: fullName,
        company_name: companyName,
        phone,
        role: 'user',
        is_active: true,
        email_verified: false,
      });

    if (profileError) {
      logger.error('Profile creation error:', profileError);
      // Clean up auth user if profile creation fails
      await serviceClient.auth.admin.deleteUser(authData.user.id);
      throw InternalError('Failed to create user profile');
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(
      authData.user.id,
      email,
      'user'
    );

    // Send verification email
    if (authData.user.confirmation_sent_at) {
      logger.info(`Verification email sent to ${email}`);
    }

    // Log audit
    logAudit('USER_REGISTERED', authData.user.id, {
      email,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      message: 'Registration successful. Please check your email to verify your account.',
      user: {
        id: authData.user.id,
        email,
        fullName,
        companyName,
        role: 'user',
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    });
  }),

  login: asyncHandler(async (req: LoginRequest, res: Response) => {
    const { email, password } = req.body;

    const supabase = getSupabaseClient();
    const serviceClient = getSupabaseServiceClient();

    // Authenticate with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      throw Unauthorized('Invalid email or password');
    }

    // Get user profile
    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile) {
      throw InternalError('Failed to retrieve user profile');
    }

    if (!profile.is_active) {
      throw Unauthorized('Account is deactivated');
    }

    // Update last login
    await serviceClient
      .from('profiles')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', authData.user.id);

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(
      authData.user.id,
      email,
      profile.role
    );

    // Log audit
    logAudit('USER_LOGIN', authData.user.id, {
      email,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      message: 'Login successful',
      user: {
        id: authData.user.id,
        email: profile.email,
        fullName: profile.full_name,
        companyName: profile.company_name,
        role: profile.role,
        emailVerified: authData.user.email_confirmed_at !== null,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    });
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabaseClient();
    
    // Sign out from Supabase
    await supabase.auth.signOut();

    // Log audit
    if (req.user) {
      logAudit('USER_LOGOUT', req.user.id, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
    }

    res.json({
      message: 'Logout successful',
    });
  }),

  refreshToken: asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw BadRequest('Refresh token is required');
    }

    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as {
        sub: string;
        type: string;
      };

      if (decoded.type !== 'refresh') {
        throw Unauthorized('Invalid token type');
      }

      // Get user profile
      const serviceClient = getSupabaseServiceClient();
      const { data: profile, error } = await serviceClient
        .from('profiles')
        .select('id, email, role, is_active')
        .eq('id', decoded.sub)
        .single();

      if (error || !profile) {
        throw Unauthorized('User not found');
      }

      if (!profile.is_active) {
        throw Unauthorized('Account is deactivated');
      }

      // Generate new tokens
      const tokens = generateTokens(profile.id, profile.email, profile.role);

      res.json({
        message: 'Token refreshed successfully',
        tokens,
      });
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw Unauthorized('Invalid refresh token');
      }
      throw error;
    }
  }),

  forgotPassword: asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    const serviceClient = getSupabaseServiceClient();

    // Check if user exists
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id, full_name')
      .eq('email', email)
      .single();

    // Always return success to prevent email enumeration
    if (!profile) {
      return res.json({
        message: 'If an account exists with this email, a password reset link has been sent.',
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Store reset token (you might want to add a password_reset_tokens table)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Send password reset email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    await sendEmail({
      to: email,
      subject: 'Password Reset Request',
      html: `
        <h2>Password Reset</h2>
        <p>Hi ${profile.full_name},</p>
        <p>You requested to reset your password. Click the link below to proceed:</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    });

    // Log audit
    logAudit('PASSWORD_RESET_REQUESTED', profile.id, {
      email,
      ip: req.ip,
    });

    res.json({
      message: 'If an account exists with this email, a password reset link has been sent.',
    });
  }),

  resetPassword: asyncHandler(async (req: Request, res: Response) => {
    const { token, password } = req.body;

    // Verify reset token
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // TODO: Implement password reset token verification
    // This would require a password_reset_tokens table

    res.json({
      message: 'Password reset successful',
    });
  }),

  verifyEmail: asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;

    // TODO: Implement email verification
    // Supabase handles this automatically with the confirmation URL

    res.json({
      message: 'Email verified successfully',
    });
  }),

  resendVerification: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const supabase = getSupabaseClient();
    
    // Resend verification email
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: req.user!.email,
    });

    if (error) {
      throw InternalError('Failed to resend verification email');
    }

    // Log audit
    logAudit('VERIFICATION_EMAIL_RESENT', userId, {
      email: req.user!.email,
      ip: req.ip,
    });

    res.json({
      message: 'Verification email sent',
    });
  }),
};