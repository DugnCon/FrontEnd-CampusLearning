/*-----------------------------------------------------------------
* File: examRegistrationRoutes.js
* Author: Quyen Nguyen Duc
* Date: 2025-07-24
* Description: This file is part of the student user backend service.
* Apache 2.0 License - Copyright 2025 Quyen Nguyen Duc
-----------------------------------------------------------------*/
const express = require('express');
const router = express.Router();
const examRegistrationController = require('../controllers/examRegistrationController');
const { body } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Configure rate limiter: maximum of 100 requests per 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Static routes (must come before dynamic userId routes)
/**
 * @route GET /api/exam-registration/semesters
 * @desc Get active semesters for exam registration
 * @access Private
 */
router.get(
  '/semesters',
  limiter, // Apply rate limiter middleware
  authMiddleware.authenticate,
  authMiddleware.authorize(),
  examRegistrationController.getActiveSemesters
);

/**
 * @route GET /api/exam-registration/fee-info
 * @desc Get exam registration fee information
 * @access Public
 */
router.get(
  '/fee-info',
  examRegistrationController.getExamFeeInfo
);

// Dynamic routes
/**
 * @route GET /api/exam-registration/:userId
 * @desc Get available exams for improvement for a specific student
 * @access Private
 */
router.get(
  '/:userId',
  authMiddleware.authenticate,
  authMiddleware.authorize(),
  examRegistrationController.getAvailableExams
);

/**
 * @route GET /api/exam-registration/:userId/history
 * @desc Get a student's exam registration history
 * @access Private
 */
router.get(
  '/:userId/history',
  authMiddleware.authenticate,
  authMiddleware.authorize(),
  examRegistrationController.getRegistrationHistory
);

/**
 * @route POST /api/exam-registration/:userId/register
 * @desc Register for improvement exams
 * @access Private
 */
router.post(
  '/:userId/register',
  authMiddleware.authenticate,
  authMiddleware.authorize(),
  [
    body('examIds').isArray().withMessage('examIds must be an array'),
    body('examIds.*').isInt().withMessage('Each exam ID must be an integer'),
    body('semesterId').isInt().withMessage('semesterId must be an integer')
  ],
  examRegistrationController.registerForExams
);

/**
 * @route DELETE /api/exam-registration/:userId/:registrationId
 * @desc Cancel exam registration
 * @access Private
 */
router.delete(
  '/:userId/:registrationId',
  authMiddleware.authenticate,
  authMiddleware.authorize(),
  examRegistrationController.cancelRegistration
);

module.exports = router; 
