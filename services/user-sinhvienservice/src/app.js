/*-----------------------------------------------------------------
* File: app.js
* Author: Quyen Nguyen Duc
* Date: 2025-07-24
* Description: This file is part of the student user backend service.
* Apache 2.0 License - Copyright 2025 Quyen Nguyen Duc
-----------------------------------------------------------------*/
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const { apiPrefix } = require('./config/app');
const { sqlConnection, isSqlServerRunning, dbConfig } = require('./config/database');

// Import routes
const profileRoutes = require('./routes/profileRoutes');
const academicRoutes = require('./routes/academicRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');
const tuitionRoutes = require('./routes/tuitionRoutes');
const authRoutes = require('./routes/authRoutes');
const notificationsRoutes = require('./routes/notificationsRoutes');
const examRegistrationRoutes = require('./routes/examRegistrationRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const onlineServicesRoutes = require('./routes/onlineServicesRoutes');
const courseRegistrationRoutes = require('./routes/courseRegistrationRoutes');
const secondMajorRoutes = require('./routes/secondMajorRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const internshipRoutes = require('./routes/internshipRoutes');

// Initialize Express app
const app = express();

// Initialize database connection
(async () => {
  try {
    // Check if SQL Server is reachable
    const sqlHost = dbConfig.server;
    const sqlPort = 1433; // Default SQL Server port
    const isServerRunning = await isSqlServerRunning(sqlHost, sqlPort);
    
    if (!isServerRunning) {
      console.warn(`SQL Server doesn't appear to be running at ${sqlHost}:${sqlPort}`);
      console.warn('Starting in demo mode with limited functionality.');
      app.locals.demoMode = true;
    } else {
      // Try to connect to database
      await sqlConnection.connect();
      console.log('Database connection successful.');
      app.locals.demoMode = false;
    }
  } catch (err) {
    console.error('Failed to connect to database:', err.message);
    console.warn('Starting in demo mode with limited functionality.');
    app.locals.demoMode = true;
  }
})();

// Set up middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(helmet());
app.use(compression());
app.use(morgan('dev'));

// Root route for API health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Student API is running',
    version: '1.0.0',
    demoMode: app.locals.demoMode || false
  });
});

// API version route
app.get('/api/version', (req, res) => {
  res.json({
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    serverTime: new Date().toISOString(),
    demoMode: app.locals.demoMode || false
  });
});

// Register API routes
app.use(`${apiPrefix}/profile`, profileRoutes);
app.use(`${apiPrefix}/academic`, academicRoutes);
app.use(`${apiPrefix}/schedule`, scheduleRoutes);
app.use(`${apiPrefix}/tuition`, tuitionRoutes);
app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/notifications`, notificationsRoutes);
app.use(`${apiPrefix}/exam-registration`, examRegistrationRoutes);
app.use(`${apiPrefix}/feedback`, feedbackRoutes);
app.use(`${apiPrefix}/services`, onlineServicesRoutes);
app.use(`${apiPrefix}/course-registration`, courseRegistrationRoutes);
app.use(`${apiPrefix}/second-major`, secondMajorRoutes);
app.use(`${apiPrefix}/attendance`, attendanceRoutes);
app.use(`${apiPrefix}/internship`, internshipRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  
  // Handle specific error types
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
  
  // Generic error response
  return res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 404 handler (for routes that don't match any of the above)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

module.exports = app; 
