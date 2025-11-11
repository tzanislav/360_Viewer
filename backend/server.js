require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const TestRecord = require('./models/TestRecord');
const panophotoRoutes = require('./routes/panophotos');
const projectRoutes = require('./routes/projects');

const app = express();
const PORT = process.env.PORT || 5000;
const { MONGODB_URI } = process.env;
function normalizeOrigin(origin) {
  return origin ? origin.trim().replace(/\/$/, '') : origin;
}

const configuredOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN
      .split(',')
      .map(normalizeOrigin)
      .filter(Boolean)
  : [];

if ((process.env.NODE_ENV || 'development') !== 'production') {
  configuredOrigins.push('http://localhost:3000', 'http://localhost:5000');
}

const allowedOrigins = Array.from(new Set(configuredOrigins.map(normalizeOrigin))).filter(Boolean);

if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI environment variable.');
  process.exit(1);
}

// Middleware
app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = normalizeOrigin(origin);

    if (allowedOrigins.length === 0 || allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    if ((process.env.NODE_ENV || 'development') !== 'production') {
      console.warn(`Blocked CORS request from origin ${origin}`);
    }

    return callback(null, false);
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, '../pano-viewer/build')));

// API routes
app.get('/api/health', (req, res) => {
  res.json({ 
    message: 'Server is running!', 
    timestamp: new Date().toISOString() 
  });
});

// Demo route: write a simple record into MongoDB so you can confirm connectivity
app.get('/api/test', async (req, res) => {
  try {
    const count = Number.parseInt(req.query.count, 10);
    const testRecord = await TestRecord.create({
      name: req.query.name || 'Sample entry',
      count: Number.isNaN(count) ? 0 : count,
    });

    res.status(201).json({
      message: 'Test record stored successfully',
      record: testRecord,
    });
  } catch (error) {
    console.error('Failed to write test record:', error);
    res.status(500).json({ message: 'Failed to store test record' });
  }
});

// API routes placeholder
app.use('/api/panophotos', panophotoRoutes);
app.use('/api/projects', projectRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ message: 'API endpoint not found' });
});

// Catch all handler: send back React's index.html file for any non-API routes
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../pano-viewer/build/index.html'));
});

mongoose.connection.on('connected', () => {
  console.log('Connected to MongoDB');
});

mongoose.connection.on('error', (error) => {
  console.error('MongoDB connection error:', error);
});

async function startServer() {
  try {
    await mongoose.connect(MONGODB_URI);
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server because MongoDB connection failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;