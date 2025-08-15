// server.js
const express = require('express');
const cors = require('cors');

const app = express();

// Enable CORS for all routes
app.use(cors({
   origin: ['https://votingresult.netlify.app', 'http://localhost:3000', '*'],
   credentials: true
}));

app.use(express.json());

const { Pool } = require('pg');

const port = process.env.PORT || 3008;

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cAYaLME9ip3Q@ep-solitary-mode-a8ypv5sf-pooler.eastus2.azure.neon.tech/fingerprintvoting?sslmode=require',
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

// Basic root route - IMPORTANT!
app.get('/', (req, res) => {
  res.json({ 
    message: 'Voting System API is running!', 
    status: 'active',
    endpoints: {
      health: '/api/health',
      totalVotes: '/api/votes/total',
      totalVoters: '/api/voters/total',
      candidates: '/api/candidates/results',
      winner: '/api/winner'
    }
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Voting API is running' });
});

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

// Get candidates with their vote counts and photos
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

// Get winner information
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

// 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found', 
    message: `The route ${req.originalUrl} does not exist`,
    availableRoutes: ['/', '/api/health', '/api/votes/total', '/api/voters/total', '/api/candidates/results', '/api/winner']
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Voting API server running on port ${port}`);
  console.log(`Health check: http://localhost:${port}/api/health`);
  console.log(`Root endpoint: http://localhost:${port}/`);
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