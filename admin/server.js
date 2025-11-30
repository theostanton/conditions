const express = require('express');
const { Pool } = require('pg');
const { Storage } = require('@google-cloud/storage');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT || 5432,
});

// Google Cloud Storage
const storage = new Storage({
  projectId: process.env.GOOGLE_PROJECT_ID,
});
const bucketName = process.env.STORAGE_BUCKET_NAME || 'conditions-450312-functions';

// Serve static files
app.use(express.static('public'));

// API Endpoints

// Subscribers metrics
app.get('/api/subscribers', async (req, res) => {
  try {
    const totalQuery = 'SELECT COUNT(*) as total FROM recipients';
    const recentQuery = `
      SELECT
        DATE(created_at) as date,
        COUNT(*) as count
      FROM recipients
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    const [totalResult, recentResult] = await Promise.all([
      pool.query(totalQuery),
      pool.query(recentQuery)
    ]);

    res.json({
      total: parseInt(totalResult.rows[0].total),
      recent: recentResult.rows
    });
  } catch (error) {
    console.error('Error fetching subscribers:', error);
    res.status(500).json({ error: 'Failed to fetch subscribers' });
  }
});

// Subscriptions by massif
app.get('/api/massifs/popular', async (req, res) => {
  try {
    const query = `
      SELECT
        m.name,
        m.code,
        m.departement,
        m.mountain,
        COUNT(DISTINCT bs.recipient) as subscriber_count
      FROM massifs m
      LEFT JOIN bra_subscriptions bs ON m.code = bs.massif
      GROUP BY m.code, m.name, m.departement, m.mountain
      ORDER BY subscriber_count DESC
      LIMIT 20
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching popular massifs:', error);
    res.status(500).json({ error: 'Failed to fetch massif statistics' });
  }
});

// Delivery statistics
app.get('/api/deliveries', async (req, res) => {
  try {
    const totalQuery = 'SELECT COUNT(*) as total FROM deliveries_bras';
    const recentQuery = `
      SELECT
        DATE(delivery_timestamp) as date,
        COUNT(*) as count
      FROM deliveries_bras
      WHERE delivery_timestamp >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(delivery_timestamp)
      ORDER BY date DESC
    `;
    const last24hQuery = `
      SELECT COUNT(*) as count
      FROM deliveries_bras
      WHERE delivery_timestamp >= NOW() - INTERVAL '24 hours'
    `;

    const [totalResult, recentResult, last24hResult] = await Promise.all([
      pool.query(totalQuery),
      pool.query(recentQuery),
      pool.query(last24hQuery)
    ]);

    res.json({
      total: parseInt(totalResult.rows[0].total),
      last24h: parseInt(last24hResult.rows[0].count),
      recent: recentResult.rows
    });
  } catch (error) {
    console.error('Error fetching deliveries:', error);
    res.status(500).json({ error: 'Failed to fetch delivery statistics' });
  }
});

// Cron execution history
app.get('/api/cron/executions', async (req, res) => {
  try {
    const query = `
      SELECT
        id,
        executed_at,
        status,
        subscriber_count,
        massifs_with_subscribers_count,
        updated_bulletins_count,
        bulletins_delivered_count,
        duration_ms,
        summary,
        error_message
      FROM cron_executions
      ORDER BY executed_at DESC
      LIMIT 50
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching cron executions:', error);
    res.status(500).json({ error: 'Failed to fetch cron executions' });
  }
});

// Cron statistics
app.get('/api/cron/stats', async (req, res) => {
  try {
    const query = `
      SELECT
        COUNT(*) as total_executions,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed,
        AVG(duration_ms) as avg_duration_ms,
        MAX(executed_at) as last_execution
      FROM cron_executions
      WHERE executed_at >= NOW() - INTERVAL '7 days'
    `;

    const result = await pool.query(query);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching cron stats:', error);
    res.status(500).json({ error: 'Failed to fetch cron statistics' });
  }
});

// Storage bucket files
app.get('/api/storage/files', async (req, res) => {
  try {
    const [files] = await storage.bucket(bucketName).getFiles();

    const fileList = files.map(file => ({
      name: file.name,
      size: file.metadata.size,
      contentType: file.metadata.contentType,
      updated: file.metadata.updated,
      timeCreated: file.metadata.timeCreated
    }));

    // Sort by most recent first
    fileList.sort((a, b) => new Date(b.updated) - new Date(a.updated));

    res.json({
      bucket: bucketName,
      count: fileList.length,
      files: fileList.slice(0, 100) // Limit to 100 most recent
    });
  } catch (error) {
    console.error('Error fetching storage files:', error);
    res.status(500).json({ error: 'Failed to fetch storage files' });
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Admin dashboard running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing connections...');
  await pool.end();
  process.exit(0);
});
