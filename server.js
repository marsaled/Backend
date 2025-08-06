// server.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3001;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// PostgreSQL connection pool - using your exact connection string
const pool = new Pool({
  host: 'ep-solitary-mode-a8ypv5sf-pooler.eastus2.azure.neon.tech',
  database: 'fingerprintvoting',
  user: 'neondb_owner',
  password: 'npg_cAYaLME9ip3Q',
  port: 5432,
  ssl: {
    require: true,
    rejectUnauthorized: false
  }
});

// Test database connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Database connection error:', err);
});

// API Routes

// Get total votes count
app.get('/api/votes/total', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM vote');
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Error fetching total votes:', error);
    res.status(500).json({ error: 'Failed to fetch total votes' });
  }
});

// Get total voters count
app.get('/api/voters/total', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM voter');
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Error fetching total voters:', error);
    res.status(500).json({ error: 'Failed to fetch total voters' });
  }
});

// Get candidates with their vote counts and photos - matching your C# query
app.get('/api/candidates/results', async (req, res) => {
  try {
    const query = `
      SELECT 
        c.referenceNo,
        c.name,
        c.course,
        c.photo,
        COUNT(v.voteId) AS votes
      FROM candidate c
      LEFT JOIN vote v ON c.referenceNo = v.candidateReferenceNo
      GROUP BY c.referenceNo, c.name, c.course, c.photo
      ORDER BY votes DESC
    `;
    
    const result = await pool.query(query);
    
    // Process the results to convert photo binary data to base64
    const candidates = result.rows.map(row => ({
      referenceNo: row.referenceno,
      name: row.name,
      course: row.course,
      votes: parseInt(row.votes),
      photo: row.photo ? Buffer.from(row.photo).toString('base64') : null
    }));
    
    res.json(candidates);
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({ error: 'Failed to fetch candidates' });
  }
});

// Get winner information - matching your C# query
app.get('/api/winner', async (req, res) => {
  try {
    const query = `
      SELECT 
        c.name,
        c.course,
        c.photo,
        COUNT(v.voteId) AS votes
      FROM candidate c
      JOIN vote v ON c.referenceNo = v.candidateReferenceNo
      GROUP BY c.referenceNo, c.name, c.course, c.photo
      ORDER BY votes DESC
      LIMIT 1
    `;
    
    const result = await pool.query(query);
    
    if (result.rows.length > 0) {
      const winner = {
        name: result.rows[0].name,
        course: result.rows[0].course,
        votes: parseInt(result.rows[0].votes),
        photo: result.rows[0].photo ? Buffer.from(result.rows[0].photo).toString('base64') : null
      };
      res.json(winner);
    } else {
      res.json(null);
    }
  } catch (error) {
    console.error('Error fetching winner:', error);
    res.status(500).json({ error: 'Failed to fetch winner' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Voting API is running' });
});

// Start the server
app.listen(port, () => {
  console.log(`Voting API server running on port ${port}`);
  console.log(`Health check: http://localhost:${port}/api/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  pool.end(() => {
    console.log('Database pool closed');
    process.exit(0);
  });
});

module.exports = app;