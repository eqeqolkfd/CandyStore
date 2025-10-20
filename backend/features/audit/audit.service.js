const pool = require('../../db');

async function getAuditLogs({ page, limit, action, user, sortBy, sortOrder }) {
  const client = await pool.connect();
  try {
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'audit_logs'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      throw new Error('Таблица audit_logs не существует. Выполните SQL скрипт shop.sql');
    }
    let query = `
      SELECT 
        al.audit_id as id,
        al."timestamp",
        al."action",
        al.user_id,
        TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) as user_name,
        al.target_type,
        al.target_id,
        al.target_name,
        al.details,
        al.before_data,
        al.after_data,
        al.severity,
        al.ip_address,
        al.user_agent
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.user_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (action) {
      query += ` AND al."action" = $${paramIndex++}`;
      params.push(action);
    }
    
    if (user) {
      query += ` AND (u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex})`;
      params.push(`%${user}%`);
      paramIndex++;
    }

    const validSortFields = ['timestamp', 'action', 'user_name', 'severity'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'timestamp';
    const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const sortFieldWithQuotes = (sortField === 'timestamp' || sortField === 'action') 
      ? `"${sortField}"` 
      : sortField;
    
    query += ` ORDER BY ${sortFieldWithQuotes} ${sortDirection}`;

    const offset = (page - 1) * limit;
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);
    
    const result = await client.query(query, params);

    let countQuery = `
      SELECT COUNT(*) as total
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.user_id
      WHERE 1=1
    `;
    
    const countParams = [];
    let countParamIndex = 1;
    
    if (action) {
      countQuery += ` AND al."action" = $${countParamIndex++}`;
      countParams.push(action);
    }
    
    if (user) {
      countQuery += ` AND (u.first_name ILIKE $${countParamIndex} OR u.last_name ILIKE $${countParamIndex})`;
      countParams.push(`%${user}%`);
      countParamIndex++;
    }
    
    const countResult = await client.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);
    
    return {
      logs: result.rows.map(row => ({
        id: row.id,
        timestamp: row.timestamp,
        action: row.action,
        userId: row.user_id,
        userName: row.user_name,
        targetType: row.target_type,
        targetId: row.target_id,
        targetName: row.target_name,
        details: row.details,
        before_data: row.before_data,
        after_data: row.after_data,
        severity: row.severity,
        ipAddress: row.ip_address,
        userAgent: row.user_agent
      })),
      totalPages,
      currentPage: page,
      totalRecords: total
    };
  } finally {
    client.release();
  }
}

async function createAuditLog({ action, userId, targetType, targetId, targetName, details, severity, ipAddress, userAgent, beforeData = null, afterData = null }) {
  const client = await pool.connect();
  try {
    const query = `
      INSERT INTO audit_logs (
        "action", user_id, target_type, target_id, target_name,
        details, before_data, after_data, severity, ip_address, user_agent
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    
    
    const result = await client.query(query, [
      action,
      userId,
      targetType,
      targetId,
      targetName,
      JSON.stringify(details),
      beforeData ? JSON.stringify(beforeData) : null,
      afterData ? JSON.stringify(afterData) : null,
      severity,
      ipAddress,
      userAgent
    ]);
    
    return result.rows[0];
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
}

async function getAuditStats() {
  const client = await pool.connect();
  try {
    const queries = [
      'SELECT COUNT(*) as total FROM audit_logs',
      'SELECT severity, COUNT(*) as count FROM audit_logs GROUP BY severity',
      'SELECT action, COUNT(*) as count FROM audit_logs GROUP BY action ORDER BY count DESC LIMIT 10',
      'SELECT COUNT(*) as last_week FROM audit_logs WHERE timestamp >= NOW() - INTERVAL \'7 days\'',
      'SELECT COUNT(*) as last_day FROM audit_logs WHERE timestamp >= NOW() - INTERVAL \'24 hours\''
    ];
    
    const results = await Promise.all(queries.map(query => client.query(query)));
    
    return {
      total: parseInt(results[0].rows[0].total),
      severity: results[1].rows.reduce((acc, row) => {
        acc[row.severity] = parseInt(row.count);
        return acc;
      }, {}),
      topActions: results[2].rows.map(row => ({
        action: row.action,
        count: parseInt(row.count)
      })),
      lastWeek: parseInt(results[3].rows[0].last_week),
      lastDay: parseInt(results[4].rows[0].last_day)
    };
  } finally {
    client.release();
  }
}

module.exports = {
  getAuditLogs,
  createAuditLog,
  getAuditStats
};
