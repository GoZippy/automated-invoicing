const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

let io = null;

// Setup WebSocket server
const setupWebSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      
      next();
    } catch (error) {
      logger.error('WebSocket authentication failed', {
        error: error.message,
        socketId: socket.id,
      });
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    logger.info('WebSocket client connected', {
      socketId: socket.id,
      userId: socket.userId,
      userRole: socket.userRole,
    });

    // Join user-specific room
    socket.join(`user:${socket.userId}`);

    // Join admin room if user is admin
    if (socket.userRole === 'admin') {
      socket.join('admin');
    }

    // Handle invoice processing updates
    socket.on('subscribe_invoice_updates', (invoiceId) => {
      socket.join(`invoice:${invoiceId}`);
      logger.info('Client subscribed to invoice updates', {
        socketId: socket.id,
        userId: socket.userId,
        invoiceId,
      });
    });

    // Handle chat session
    socket.on('join_chat_session', (sessionId) => {
      socket.join(`chat:${sessionId}`);
      logger.info('Client joined chat session', {
        socketId: socket.id,
        userId: socket.userId,
        sessionId,
      });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info('WebSocket client disconnected', {
        socketId: socket.id,
        userId: socket.userId,
        reason,
      });
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error('WebSocket error', {
        socketId: socket.id,
        userId: socket.userId,
        error: error.message,
      });
    });
  });

  logger.info('WebSocket server initialized');
};

// Get WebSocket instance
const getIO = () => {
  if (!io) {
    throw new Error('WebSocket server not initialized');
  }
  return io;
};

// Send notification to user
const sendToUser = (userId, event, data) => {
  if (!io) return;
  
  io.to(`user:${userId}`).emit(event, {
    ...data,
    timestamp: new Date().toISOString(),
  });

  logger.info('WebSocket message sent to user', {
    userId,
    event,
    dataKeys: Object.keys(data),
  });
};

// Send notification to admin
const sendToAdmin = (event, data) => {
  if (!io) return;
  
  io.to('admin').emit(event, {
    ...data,
    timestamp: new Date().toISOString(),
  });

  logger.info('WebSocket message sent to admin', {
    event,
    dataKeys: Object.keys(data),
  });
};

// Send notification to all users
const sendToAll = (event, data) => {
  if (!io) return;
  
  io.emit(event, {
    ...data,
    timestamp: new Date().toISOString(),
  });

  logger.info('WebSocket message sent to all users', {
    event,
    dataKeys: Object.keys(data),
  });
};

// Send invoice processing update
const sendInvoiceUpdate = (invoiceId, data) => {
  if (!io) return;
  
  io.to(`invoice:${invoiceId}`).emit('invoice_processing_update', {
    invoice_id: invoiceId,
    ...data,
    timestamp: new Date().toISOString(),
  });

  logger.info('Invoice processing update sent', {
    invoiceId,
    updateType: data.type,
  });
};

// Send chat message
const sendChatMessage = (sessionId, data) => {
  if (!io) return;
  
  io.to(`chat:${sessionId}`).emit('chat_message', {
    session_id: sessionId,
    ...data,
    timestamp: new Date().toISOString(),
  });

  logger.info('Chat message sent', {
    sessionId,
    messageType: data.type,
  });
};

// Send system notification
const sendNotification = (userId, notification) => {
  if (!io) return;
  
  io.to(`user:${userId}`).emit('notification', {
    ...notification,
    timestamp: new Date().toISOString(),
  });

  logger.info('System notification sent', {
    userId,
    notificationType: notification.type,
  });
};

module.exports = {
  setupWebSocket,
  getIO,
  sendToUser,
  sendToAdmin,
  sendToAll,
  sendInvoiceUpdate,
  sendChatMessage,
  sendNotification,
};