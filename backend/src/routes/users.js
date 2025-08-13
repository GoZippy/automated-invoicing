const express = require('express');
const { dbUtils } = require('../database/connection');
const { asyncHandler, NotFoundError } = require('../middleware/errorHandler');
const { requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// @route   GET /api/users
// @desc    Get all users (admin only)
// @access  Private/Admin
router.get('/', requireRole('admin'), asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, role, is_active } = req.query;
  const offset = (page - 1) * limit;

  // Build query conditions
  const conditions = {};
  if (role) conditions.role = role;
  if (is_active !== undefined) conditions.is_active = is_active === 'true';

  // Get users
  const users = await dbUtils.find('users', conditions, {
    orderBy: 'created_at DESC',
    limit: parseInt(limit),
    offset: parseInt(offset),
  });

  // Get total count
  const totalCount = await dbUtils.count('users', conditions);

  // Calculate pagination info
  const totalPages = Math.ceil(totalCount / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  res.json({
    success: true,
    data: {
      users: users.map(user => ({
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        company_name: user.company_name,
        role: user.role,
        is_active: user.is_active,
        email_verified: user.email_verified,
        created_at: user.created_at,
        updated_at: user.updated_at,
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total_count: totalCount,
        total_pages: totalPages,
        has_next_page: hasNextPage,
        has_prev_page: hasPrevPage,
      },
    },
  });
}));

// @route   GET /api/users/:id
// @desc    Get user by ID (admin only)
// @access  Private/Admin
router.get('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await dbUtils.findById('users', id);
  
  if (!user) {
    throw new NotFoundError('User');
  }

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        company_name: user.company_name,
        role: user.role,
        is_active: user.is_active,
        email_verified: user.email_verified,
        avatar_url: user.avatar_url,
        timezone: user.timezone,
        language: user.language,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    },
  });
}));

// @route   PUT /api/users/:id
// @desc    Update user (admin only)
// @access  Private/Admin
router.put('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    first_name,
    last_name,
    company_name,
    role,
    is_active,
    email_verified,
    timezone,
    language,
  } = req.body;

  // Get user
  const user = await dbUtils.findById('users', id);
  
  if (!user) {
    throw new NotFoundError('User');
  }

  // Build update data
  const updateData = {};
  
  if (first_name !== undefined) updateData.first_name = first_name;
  if (last_name !== undefined) updateData.last_name = last_name;
  if (company_name !== undefined) updateData.company_name = company_name;
  if (role !== undefined) updateData.role = role;
  if (is_active !== undefined) updateData.is_active = is_active;
  if (email_verified !== undefined) updateData.email_verified = email_verified;
  if (timezone !== undefined) updateData.timezone = timezone;
  if (language !== undefined) updateData.language = language;

  // Update user
  const updatedUser = await dbUtils.update('users', id, {
    ...updateData,
    updated_at: new Date(),
  });

  // Log user update
  logger.info('User updated by admin', {
    adminId: req.user.id,
    userId: id,
    updatedFields: Object.keys(updateData),
  });

  res.json({
    success: true,
    message: 'User updated successfully',
    data: {
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        company_name: updatedUser.company_name,
        role: updatedUser.role,
        is_active: updatedUser.is_active,
        email_verified: updatedUser.email_verified,
        avatar_url: updatedUser.avatar_url,
        timezone: updatedUser.timezone,
        language: updatedUser.language,
        created_at: updatedUser.created_at,
        updated_at: updatedUser.updated_at,
      },
    },
  });
}));

// @route   DELETE /api/users/:id
// @desc    Delete user (admin only)
// @access  Private/Admin
router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get user
  const user = await dbUtils.findById('users', id);
  
  if (!user) {
    throw new NotFoundError('User');
  }

  // Prevent admin from deleting themselves
  if (id === req.user.id) {
    return res.status(400).json({
      success: false,
      error: 'Cannot delete own account',
      message: 'You cannot delete your own account',
    });
  }

  // Delete user (this will cascade to related records)
  await dbUtils.delete('users', id);

  // Log user deletion
  logger.info('User deleted by admin', {
    adminId: req.user.id,
    userId: id,
    userEmail: user.email,
  });

  res.json({
    success: true,
    message: 'User deleted successfully',
  });
}));

module.exports = router;