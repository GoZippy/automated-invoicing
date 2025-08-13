const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

// PostgreSQL connection pool
let pool = null;

// Supabase client
let supabase = null;

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'intelligent_invoicing',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
};

// Initialize database connections
async function connectDatabase() {
  try {
    // Initialize PostgreSQL pool
    pool = new Pool(dbConfig);
    
    // Test PostgreSQL connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    
    logger.info('PostgreSQL connection established successfully');
    
    // Initialize Supabase client
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY,
        {
          auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
          },
        }
      );
      
      logger.info('Supabase client initialized successfully');
    }
    
    return { pool, supabase };
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
}

// Get database pool
function getPool() {
  if (!pool) {
    throw new Error('Database not connected. Call connectDatabase() first.');
  }
  return pool;
}

// Get Supabase client
function getSupabase() {
  if (!supabase) {
    throw new Error('Supabase not configured. Check environment variables.');
  }
  return supabase;
}

// Execute a query with logging
async function executeQuery(query, params = [], context = '') {
  const startTime = Date.now();
  const pool = getPool();
  
  try {
    const result = await pool.query(query, params);
    const duration = Date.now() - startTime;
    
    logger.logDatabase(
      'QUERY',
      context || 'unknown',
      duration,
      {
        query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
        rowCount: result.rowCount,
        params: params.length,
      }
    );
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Database query failed', {
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      params,
      duration: `${duration}ms`,
      error: error.message,
      context,
    });
    throw error;
  }
}

// Execute a transaction
async function executeTransaction(callback) {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Close database connections
async function closeDatabase() {
  try {
    if (pool) {
      await pool.end();
      logger.info('PostgreSQL connection pool closed');
    }
  } catch (error) {
    logger.error('Error closing database connections:', error);
  }
}

// Health check for database
async function healthCheck() {
  try {
    const result = await executeQuery('SELECT NOW() as timestamp, version() as version');
    return {
      status: 'healthy',
      timestamp: result.rows[0].timestamp,
      version: result.rows[0].version.split(' ')[0],
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
    };
  }
}

// Database utilities
const dbUtils = {
  // Insert a record and return the inserted data
  async insert(table, data) {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
    
    const query = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;
    
    const result = await executeQuery(query, values, `INSERT_${table.toUpperCase()}`);
    return result.rows[0];
  },
  
  // Update a record and return the updated data
  async update(table, id, data) {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const setClause = columns.map((col, index) => `${col} = $${index + 2}`).join(', ');
    
    const query = `
      UPDATE ${table}
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await executeQuery(query, [id, ...values], `UPDATE_${table.toUpperCase()}`);
    return result.rows[0];
  },
  
  // Delete a record
  async delete(table, id) {
    const query = `DELETE FROM ${table} WHERE id = $1 RETURNING *`;
    const result = await executeQuery(query, [id], `DELETE_${table.toUpperCase()}`);
    return result.rows[0];
  },
  
  // Find a record by ID
  async findById(table, id) {
    const query = `SELECT * FROM ${table} WHERE id = $1`;
    const result = await executeQuery(query, [id], `FIND_${table.toUpperCase()}`);
    return result.rows[0];
  },
  
  // Find records with conditions
  async find(table, conditions = {}, options = {}) {
    let query = `SELECT * FROM ${table}`;
    const values = [];
    let paramIndex = 1;
    
    if (Object.keys(conditions).length > 0) {
      const whereClause = Object.keys(conditions)
        .map(key => {
          values.push(conditions[key]);
          return `${key} = $${paramIndex++}`;
        })
        .join(' AND ');
      query += ` WHERE ${whereClause}`;
    }
    
    if (options.orderBy) {
      query += ` ORDER BY ${options.orderBy}`;
    }
    
    if (options.limit) {
      values.push(options.limit);
      query += ` LIMIT $${paramIndex++}`;
    }
    
    if (options.offset) {
      values.push(options.offset);
      query += ` OFFSET $${paramIndex++}`;
    }
    
    const result = await executeQuery(query, values, `FIND_${table.toUpperCase()}`);
    return result.rows;
  },
  
  // Count records with conditions
  async count(table, conditions = {}) {
    let query = `SELECT COUNT(*) as count FROM ${table}`;
    const values = [];
    let paramIndex = 1;
    
    if (Object.keys(conditions).length > 0) {
      const whereClause = Object.keys(conditions)
        .map(key => {
          values.push(conditions[key]);
          return `${key} = $${paramIndex++}`;
        })
        .join(' AND ');
      query += ` WHERE ${whereClause}`;
    }
    
    const result = await executeQuery(query, values, `COUNT_${table.toUpperCase()}`);
    return parseInt(result.rows[0].count, 10);
  },
};

module.exports = {
  connectDatabase,
  getPool,
  getSupabase,
  executeQuery,
  executeTransaction,
  closeDatabase,
  healthCheck,
  dbUtils,
};