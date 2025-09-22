/*-----------------------------------------------------------------
* File: students.js
* Author: Quyen Nguyen Duc
* Date: 2025-07-24
* Description: This file is part of the student admin backend service.
* Apache 2.0 License - Copyright 2025 Quyen Nguyen Duc
-----------------------------------------------------------------*/
const express = require('express');
const router = express.Router();
const studentsController = require('../controllers/studentsController');
const multer = require('multer');

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Get all students directly without pagination (for admin use)
router.get('/all', studentsController.getAllStudentsDirectly);

// Alternative endpoint for getting all users
router.get('/users/all', async (req, res) => {
  try {
    // Create a direct connection to avoid any middleware issues
    const { getPool } = require('../config/db');
    const pool = await getPool();
    
    // Simple query that just pulls all students with minimal joins
    const query = `
      SELECT * FROM Users 
    `;
    
    const result = await pool.request().query(query);
    
    return res.status(200).json({
      success: true,
      data: result.recordset,
      totalCount: result.recordset.length
    });
  } catch (error) {
    console.error('Error in alternative endpoint:', error);
    return res.status(500).json({
      success: false,
      message: 'Could not retrieve student data'
    });
  }
});

// Import students from CSV file
router.post('/import-csv', upload.single('file'), studentsController.importStudentsFromCsv);

// Get all students with pagination and filtering
router.get('/', studentsController.getAllStudents);

// Get student by ID with detailed information
router.get('/:id', studentsController.getStudentById);

// Create a new student
router.post('/', studentsController.createStudent);

// Update student information
router.put('/:id', studentsController.updateStudent);

// Reset student password
router.post('/:id/reset-password', studentsController.resetPassword);

// Get student's academic results
router.get('/:id/results', studentsController.getStudentResults);

module.exports = router; 
