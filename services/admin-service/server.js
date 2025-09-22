/*-----------------------------------------------------------------
* File: server.js
* Author: Quyen Nguyen Duc
* Date: 2025-07-24
* Description: This file is part of the admin backend service.
* Apache 2.0 License - Copyright 2025 Quyen Nguyen Duc
-----------------------------------------------------------------*/
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const fileUpload = require('express-fileupload');
const { poolPromise } = require('./config/database');
const auth = require('./middleware/auth');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');

const { enableCORS } = require('./middleware/auth');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5002;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: ['http://localhost:5005', 'http://127.0.0.1:5005'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'Cache-Control']
}));
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(morgan('dev'));
app.use(enableCORS);

// File upload middleware
app.use(fileUpload({
  createParentPath: true,
  limits: { 
    fileSize: 10 * 1024 * 1024 // 10MB max file size
  },
  abortOnLimit: true,
  responseOnLimit: 'File size is too large. Max size is 10MB'
}));

// Static file serving for uploads
app.use('/uploads', express.static('uploads'));

// Database connection check
app.use(async (req, res, next) => {
  try {
    await poolPromise;
    next();
  } catch (error) {
    console.error('Database connection failed:', error);
    res.status(500).json({ message: 'Database connection error' });
  }
});

// Import routes
const authRoutes = require('./routes/auth.routes');
const courseRoutes = require('./routes/courses.routes');
const eventRoutes = require('./routes/events.routes');
const userRoutes = require('./routes/users.routes');
const examRoutes = require('./routes/exams.routes');
const reportRoutes = require('./routes/reports.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const competitionsRoutes = require('./routes/competitions.routes');
const uploadRoutes = require('./routes/upload.routes');
const settingsRoutes = require('./routes/settingsRoutes');
const refreshRoutes = require('./routes/refresh.routes');

// Auth routes (without middleware)
app.use('/api/auth', authRoutes);

// Add a dedicated refresh token route
app.use('/api/refresh', refreshRoutes);

// Protected routes
// Note: the verifyAdmin middleware is no longer needed here since we're using the authenticateToken middleware in each route file
app.use('/api/courses', courseRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/users', userRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/competitions', competitionsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/settings', settingsRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Campus Campus Learning Admin API Service' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ 
    message: 'Internal server error', 
    error: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await poolPromise;
    console.log('Database connected successfully');

    app.listen(PORT, () => {
      console.log(`Admin service running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

module.exports = app; 
