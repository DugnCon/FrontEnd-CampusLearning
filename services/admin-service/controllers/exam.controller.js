/*-----------------------------------------------------------------
* File: exam.controller.js
* Author: Quyen Nguyen Duc
* Date: 2025-07-24
* Description: This file is part of the admin backend service.
* Apache 2.0 License - Copyright 2025 Quyen Nguyen Duc
-----------------------------------------------------------------*/
const { poolPromise, sql } = require('../config/database');

const examController = {
  // Get all exams
  getAllExams: async (req, res) => {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .query(`
          SELECT e.*, u.FullName as CreatorName,
                 (SELECT COUNT(*) FROM ExamQuestions WHERE ExamID = e.ExamID) as QuestionCount
          FROM Exams e
          LEFT JOIN Users u ON e.CreatedBy = u.UserID
          ORDER BY e.CreatedAt DESC
        `);
      
      res.json(result.recordset);
    } catch (error) {
      console.error('Error getting exams:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Get exam by ID
  getExamById: async (req, res) => {
    try {
      const { id } = req.params;
      const pool = await poolPromise;
      const result = await pool.request()
        .input('examId', sql.BigInt, id)
        .query(`
          SELECT e.*, u.FullName as CreatorName
          FROM Exams e
          LEFT JOIN Users u ON e.CreatedBy = u.UserID
          WHERE e.ExamID = @examId
        `);

      if (!result.recordset[0]) {
        return res.status(404).json({ message: 'Exam not found' });
      }

      res.json(result.recordset[0]);
    } catch (error) {
      console.error('Error getting exam:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Create exam
  createExam: async (req, res) => {
    try {
      const {
        title,
        description,
        type,
        duration,
        totalPoints,
        passingScore,
        startTime,
        endTime,
        instructions,
        allowReview,
        shuffleQuestions,
        courseId,
        status
      } = req.body;

      // Validate exam type
      const validTypes = ['multiple_choice', 'essay', 'coding', 'mixed'];
      const examType = validTypes.includes(type) ? type : 'multiple_choice';

      // Validate status value - convert ACTIVE to upcoming
      const validStatuses = ['upcoming', 'ongoing', 'completed', 'cancelled'];
      let examStatus = status?.toLowerCase() === 'active' ? 'upcoming' : status?.toLowerCase();
      examStatus = validStatuses.includes(examStatus) ? examStatus : 'upcoming';

      const pool = await poolPromise;
      const result = await pool.request()
        .input('title', sql.NVarChar(255), title)
        .input('description', sql.NVarChar(sql.MAX), description)
        .input('type', sql.VarChar(50), examType)
        .input('duration', sql.Int, duration)
        .input('totalPoints', sql.Int, totalPoints || 100)
        .input('passingScore', sql.Int, passingScore || 60)
        .input('startTime', sql.DateTime, startTime ? new Date(startTime) : null)
        .input('endTime', sql.DateTime, endTime ? new Date(endTime) : null)
        .input('instructions', sql.NVarChar(sql.MAX), instructions)
        .input('allowReview', sql.Bit, allowReview !== false)
        .input('shuffleQuestions', sql.Bit, shuffleQuestions !== false)
        .input('courseId', sql.BigInt, courseId)
        .input('createdBy', sql.BigInt, req.user.UserID)
        .input('status', sql.VarChar(20), examStatus)
        .query(`
          INSERT INTO Exams (
            Title, Description, Type, Duration,
            TotalPoints, PassingScore, StartTime,
            EndTime, Instructions, AllowReview,
            ShuffleQuestions, CourseID, CreatedBy,
            Status
          )
          VALUES (
            @title, @description, @type, @duration,
            @totalPoints, @passingScore, @startTime,
            @endTime, @instructions, @allowReview,
            @shuffleQuestions, @courseId, @createdBy,
            @status
          );
          SELECT SCOPE_IDENTITY() as ExamID;
        `);

      res.status(201).json({
        message: 'Exam created successfully',
        examId: result.recordset[0].ExamID
      });
    } catch (error) {
      console.error('Error creating exam:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Update exam
  updateExam: async (req, res) => {
    try {
      const { id } = req.params;
      const {
        title,
        description,
        type,
        duration,
        totalPoints,
        passingScore,
        startTime,
        endTime,
        instructions,
        allowReview,
        shuffleQuestions,
        courseId,
        status
      } = req.body;

      // Validate status value
      const validStatuses = ['upcoming', 'ongoing', 'completed', 'cancelled'];
      const examStatus = validStatuses.includes(status) ? status : 'upcoming';

      const pool = await poolPromise;
      await pool.request()
        .input('examId', sql.BigInt, id)
        .input('title', sql.NVarChar(255), title)
        .input('description', sql.NVarChar(sql.MAX), description)
        .input('type', sql.VarChar(50), type)
        .input('duration', sql.Int, duration)
        .input('totalPoints', sql.Int, totalPoints)
        .input('passingScore', sql.Int, passingScore)
        .input('startTime', sql.DateTime, startTime ? new Date(startTime) : null)
        .input('endTime', sql.DateTime, endTime ? new Date(endTime) : null)
        .input('instructions', sql.NVarChar(sql.MAX), instructions)
        .input('allowReview', sql.Bit, allowReview)
        .input('shuffleQuestions', sql.Bit, shuffleQuestions)
        .input('courseId', sql.BigInt, courseId)
        .input('status', sql.VarChar(20), examStatus)
        .input('updatedAt', sql.DateTime, new Date())
        .query(`
          UPDATE Exams
          SET Title = @title,
              Description = @description,
              Type = @type,
              Duration = @duration,
              TotalPoints = @totalPoints,
              PassingScore = @passingScore,
              StartTime = @startTime,
              EndTime = @endTime,
              Instructions = @instructions,
              AllowReview = @allowReview,
              ShuffleQuestions = @shuffleQuestions,
              CourseID = @courseId,
              Status = @status,
              UpdatedAt = @updatedAt
          WHERE ExamID = @examId
        `);

      res.json({ message: 'Exam updated successfully' });
    } catch (error) {
      console.error('Error updating exam:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Delete exam
  deleteExam: async (req, res) => {
    try {
      const { id } = req.params;
      const pool = await poolPromise;
      await pool.request()
        .input('examId', sql.BigInt, id)
        .query(`
          UPDATE Exams
          SET DeletedAt = GETDATE()
          WHERE ExamID = @examId AND DeletedAt IS NULL
        `);

      res.json({ message: 'Exam deleted successfully' });
    } catch (error) {
      console.error('Error deleting exam:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Get exam questions
  getExamQuestions: async (req, res) => {
    try {
      const { examId } = req.params;
      const pool = await poolPromise;
      const result = await pool.request()
        .input('examId', sql.BigInt, examId)
        .query(`
          SELECT 
            QuestionID,
            ExamID,
            Type,
            Content as QuestionText,
            Points,
            OrderIndex,
            Options,
            CorrectAnswer,
            Explanation,
            CreatedAt,
            UpdatedAt
          FROM ExamQuestions
          WHERE ExamID = @examId
          ORDER BY OrderIndex, QuestionID
        `);

      // Chuyển đổi Options từ chuỗi JSON sang object nếu có
      const questions = result.recordset.map(q => ({
        ...q,
        Options: q.Options ? JSON.parse(q.Options) : null
      }));

      res.json(questions);
    } catch (error) {
      console.error('Error getting exam questions:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Add question to exam
  addQuestion: async (req, res) => {
    try {
      const { examId } = req.params;
      const {
        type,
        content,
        points,
        orderIndex,
        options,
        correctAnswer,
        explanation,
        scoringCriteria
      } = req.body;

      // Validate question type
      const validTypes = ['multiple_choice', 'essay', 'coding'];
      const questionType = validTypes.includes(type) ? type : 'multiple_choice';

      const pool = await poolPromise;
      
      // Bắt đầu transaction
      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        // Thêm câu hỏi vào ExamQuestions
        const result = await transaction.request()
          .input('examId', sql.BigInt, examId)
          .input('type', sql.VarChar(50), questionType)
          .input('content', sql.NVarChar(sql.MAX), content)
          .input('points', sql.Int, points || 1)
          .input('orderIndex', sql.Int, orderIndex)
          .input('options', sql.NVarChar(sql.MAX), options ? JSON.stringify(options) : null)
          .input('correctAnswer', sql.NVarChar(sql.MAX), correctAnswer)
          .input('explanation', sql.NVarChar(sql.MAX), explanation)
          .query(`
            INSERT INTO ExamQuestions (
              ExamID, Type, Content, Points,
              OrderIndex, Options, CorrectAnswer,
              Explanation
            )
            VALUES (
              @examId, @type, @content, @points,
              @orderIndex, @options, @correctAnswer,
              @explanation
            );
            SELECT SCOPE_IDENTITY() as QuestionID;
          `);

        const questionId = result.recordset[0].QuestionID;

        // Nếu là câu hỏi essay, thêm template chấm điểm
        if (questionType === 'essay' && scoringCriteria) {
          await transaction.request()
            .input('examId', sql.BigInt, examId)
            .input('questionId', sql.BigInt, questionId)
            .input('scoringCriteria', sql.NVarChar(sql.MAX), JSON.stringify(scoringCriteria))
            .query(`
              INSERT INTO ExamAnswerTemplates (
                ExamID, QuestionID, ScoringCriteria,
                CreatedAt, UpdatedAt
              )
              VALUES (
                @examId, @questionId, @scoringCriteria,
                GETDATE(), GETDATE()
              )
            `);
        }

        await transaction.commit();

        // Get the created question with full details
        const questionResult = await pool.request()
          .input('questionId', sql.BigInt, questionId)
          .query(`
            SELECT q.*,
                   CASE WHEN q.Type = 'essay' 
                        THEN (SELECT TOP 1 t.* FROM ExamAnswerTemplates t WHERE t.QuestionID = q.QuestionID)
                        ELSE NULL
                   END as Template
            FROM ExamQuestions q
            WHERE q.QuestionID = @questionId
          `);

        const createdQuestion = questionResult.recordset[0];

        res.status(201).json({
          message: 'Question added successfully',
          question: {
            ...createdQuestion,
            Options: createdQuestion.Options ? JSON.parse(createdQuestion.Options) : null,
            Template: createdQuestion.Template ? JSON.parse(createdQuestion.Template) : null
          }
        });
      } catch (err) {
        await transaction.rollback();
        throw err;
      }
    } catch (error) {
      console.error('Error adding question:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Update question
  updateQuestion: async (req, res) => {
    try {
      const { examId, questionId } = req.params;
      const {
        questionType,
        questionText,
        options,
        correctAnswer,
        points,
        difficulty,
        questionOrder
      } = req.body;

      const pool = await poolPromise;
      await pool.request()
        .input('questionId', sql.BigInt, questionId)
        .input('examId', sql.BigInt, examId)
        .input('questionType', sql.VarChar(50), questionType)
        .input('questionText', sql.NVarChar(sql.MAX), questionText)
        .input('options', sql.NVarChar(sql.MAX), JSON.stringify(options || []))
        .input('correctAnswer', sql.NVarChar(sql.MAX), correctAnswer)
        .input('points', sql.Int, points || 1)
        .input('difficulty', sql.VarChar(20), difficulty || 'MEDIUM')
        .input('questionOrder', sql.Int, questionOrder)
        .query(`
          UPDATE ExamQuestions
          SET QuestionType = @questionType,
              QuestionText = @questionText,
              Options = @options,
              CorrectAnswer = @correctAnswer,
              Points = @points,
              Difficulty = @difficulty,
              QuestionOrder = @questionOrder,
              UpdatedAt = GETDATE()
          WHERE QuestionID = @questionId AND ExamID = @examId
        `);

      res.json({ message: 'Question updated successfully' });
    } catch (error) {
      console.error('Error updating question:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Delete question
  deleteQuestion: async (req, res) => {
    try {
      const { examId, questionId } = req.params;
      const pool = await poolPromise;
      await pool.request()
        .input('questionId', sql.BigInt, questionId)
        .input('examId', sql.BigInt, examId)
        .query(`
          DELETE FROM ExamQuestions
          WHERE QuestionID = @questionId AND ExamID = @examId
        `);

      res.json({ message: 'Question deleted successfully' });
    } catch (error) {
      console.error('Error deleting question:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Create answer template
  createAnswerTemplate: async (req, res) => {
    try {
      const { examId } = req.params;
      const { questionId, templateText, keywords, scoringCriteria } = req.body;

      const pool = await poolPromise;
      const result = await pool.request()
        .input('examId', sql.BigInt, examId)
        .input('questionId', sql.BigInt, questionId)
        .input('templateText', sql.NVarChar(sql.MAX), templateText)
        .input('keywords', sql.NVarChar(sql.MAX), JSON.stringify(keywords || []))
        .input('scoringCriteria', sql.NVarChar(sql.MAX), scoringCriteria)
        .query(`
          INSERT INTO ExamAnswerTemplates (
            ExamID, QuestionID, TemplateText, Keywords, ScoringCriteria
          )
          VALUES (
            @examId, @questionId, @templateText, @keywords, @scoringCriteria
          );
          SELECT SCOPE_IDENTITY() as TemplateID;
        `);

      res.status(201).json({
        message: 'Answer template created successfully',
        templateId: result.recordset[0].TemplateID
      });
    } catch (error) {
      console.error('Error creating answer template:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Update answer template
  updateAnswerTemplate: async (req, res) => {
    try {
      const { examId, templateId } = req.params;
      const { templateText, keywords, scoringCriteria } = req.body;

      const pool = await poolPromise;
      await pool.request()
        .input('templateId', sql.BigInt, templateId)
        .input('examId', sql.BigInt, examId)
        .input('templateText', sql.NVarChar(sql.MAX), templateText)
        .input('keywords', sql.NVarChar(sql.MAX), JSON.stringify(keywords || []))
        .input('scoringCriteria', sql.NVarChar(sql.MAX), scoringCriteria)
        .query(`
          UPDATE ExamAnswerTemplates
          SET TemplateText = @templateText,
              Keywords = @keywords,
              ScoringCriteria = @scoringCriteria,
              UpdatedAt = GETDATE()
          WHERE TemplateID = @templateId AND ExamID = @examId
        `);

      res.json({ message: 'Answer template updated successfully' });
    } catch (error) {
      console.error('Error updating answer template:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Add essay template
  addEssayTemplate: async (req, res) => {
    try {
      const { examId, questionId } = req.params;
      const { content, keywords, minimumMatchPercentage } = req.body;

      const pool = await poolPromise;

      // Kiểm tra câu hỏi tồn tại và là loại essay
      const questionCheck = await pool.request()
        .input('examId', sql.BigInt, examId)
        .input('questionId', sql.BigInt, questionId)
        .query(
          `SELECT * FROM ExamQuestions WHERE QuestionID = @questionId AND ExamID = @examId AND Type = 'essay'`
        );

      if (questionCheck.recordset.length === 0) {
        return res.status(404).json({
          message: 'Essay question not found or question is not essay type'
        });
      }

      // Kiểm tra template đã tồn tại
      const templateCheck = await pool.request()
        .input('examId', sql.BigInt, examId)
        .input('questionId', sql.BigInt, questionId)
        .query(
          `SELECT * FROM ExamAnswerTemplates WHERE ExamID = @examId AND QuestionID = @questionId`
        );

      if (templateCheck.recordset.length > 0) {
        // Cập nhật template
        await pool.request()
          .input('examId', sql.BigInt, examId)
          .input('questionId', sql.BigInt, questionId)
          .input('content', sql.NVarChar(sql.MAX), content)
          .input('keywords', sql.NVarChar(sql.MAX), JSON.stringify(keywords || []))
          .input('minimumMatchPercentage', sql.Decimal(5, 2), minimumMatchPercentage)
          .query(
            `UPDATE ExamAnswerTemplates
             SET Content = @content,
                 Keywords = @keywords,
                 MinimumMatchPercentage = @minimumMatchPercentage,
                 UpdatedAt = GETDATE()
             WHERE ExamID = @examId AND QuestionID = @questionId`
          );

        return res.status(200).json({ message: 'Essay template updated successfully' });
      }

      // Tạo mới template
      await pool.request()
        .input('examId', sql.BigInt, examId)
        .input('questionId', sql.BigInt, questionId)
        .input('content', sql.NVarChar(sql.MAX), content)
        .input('keywords', sql.NVarChar(sql.MAX), JSON.stringify(keywords || []))
        .input('minimumMatchPercentage', sql.Decimal(5, 2), minimumMatchPercentage)
        .query(
          `INSERT INTO ExamAnswerTemplates (
             ExamID, QuestionID, Content,
             Keywords, MinimumMatchPercentage, CreatedAt, UpdatedAt
           )
           VALUES (
             @examId, @questionId, @content,
             @keywords, @minimumMatchPercentage, GETDATE(), GETDATE()
           )`
        );

      res.status(201).json({ message: 'Essay template created successfully' });
    } catch (error) {
      console.error('Error creating/updating essay template:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Get participants for a specific exam (including attempt stats)
  getExamParticipants: async (req, res) => {
    try {
      const { examId } = req.params;
      const pool = await poolPromise;

      // Build a result that numbers each user's attempts so that
      // the latest attempt can be distinguished from the previous ones.
      const result = await pool.request()
        .input('examId', sql.BigInt, examId)
        .query(`
          WITH UserAttempts AS (
            SELECT 
              ep.*,                                      -- All participant fields
              u.FullName,
              u.Email,
              u.Image,
              ROW_NUMBER() OVER (PARTITION BY ep.UserID ORDER BY ep.StartedAt)        AS AttemptNumber,
              COUNT(*)    OVER (PARTITION BY ep.UserID)                               AS TotalAttempts
            FROM ExamParticipants ep
            JOIN Users u ON ep.UserID = u.UserID
            WHERE ep.ExamID = @examId
          )
          SELECT *
          FROM UserAttempts
          ORDER BY UserID, StartedAt DESC;
        `);

      return res.status(200).json({ participants: result.recordset });
    } catch (error) {
      console.error('[getExamParticipants] Error:', error);
      return res.status(500).json({ message: 'Server error while getting exam participants' });
    }
  },

  // Get all answers (and essay analysis, if any) for a participant
  getParticipantAnswers: async (req, res) => {
    try {
      const { participantId } = req.params;
      const pool = await poolPromise;

      // 1. Basic participant info
      const participantRs = await pool.request()
        .input('participantId', sql.BigInt, participantId)
        .query(`
          SELECT ep.*, e.Title AS ExamTitle, u.FullName, u.Email
          FROM ExamParticipants ep
          JOIN Exams e ON ep.ExamID = e.ExamID
          JOIN Users u  ON ep.UserID = u.UserID
          WHERE ep.ParticipantID = @participantId;
        `);

      if (participantRs.recordset.length === 0) {
        return res.status(404).json({ message: 'Participant not found' });
      }

      // 2. Answers list
      const answersRs = await pool.request()
        .input('participantId', sql.BigInt, participantId)
        .query(`
          SELECT ea.*, 
                 eq.Content          AS QuestionContent, 
                 eq.Type             AS QuestionType, 
                 eq.Options          AS QuestionOptions, 
                 eq.CorrectAnswer, 
                 eq.Points           AS QuestionPoints
          FROM ExamAnswers ea
          JOIN ExamQuestions eq ON ea.QuestionID = eq.QuestionID
          WHERE ea.ParticipantID = @participantId
          ORDER BY eq.OrderIndex;
        `);

      // 3. Essay analysis (if exists)
      const analysisRs = await pool.request()
        .input('participantId', sql.BigInt, participantId)
        .query(`
          SELECT esa.*
          FROM EssayAnswerAnalysis esa
          JOIN ExamAnswers ea ON esa.AnswerID = ea.AnswerID
          WHERE ea.ParticipantID = @participantId;
        `);

      return res.status(200).json({
        participant: participantRs.recordset[0],
        answers: answersRs.recordset,
        analysis: analysisRs.recordset,
      });
    } catch (error) {
      console.error('[getParticipantAnswers] Error:', error);
      return res.status(500).json({ message: 'Server error while getting participant answers' });
    }
  },

  // Grade an essay answer for a participant (manual review)
  gradeEssayAnswer: async (req, res) => {
    try {
      const { answerId } = req.params;
      const { score, reviewerComments, isCorrect } = req.body;
      const reviewerId = req.user?.UserID;

      const pool = await poolPromise;

      // Ensure the answer exists & collect some meta.
      const answerCheckRs = await pool.request()
        .input('answerId', sql.BigInt, answerId)
        .query(`
          SELECT ea.*, ep.ParticipantID, eq.ExamID
          FROM ExamAnswers ea
          JOIN ExamParticipants ep ON ea.ParticipantID = ep.ParticipantID
          JOIN ExamQuestions   eq ON ea.QuestionID     = eq.QuestionID
          WHERE ea.AnswerID = @answerId;
        `);

      if (answerCheckRs.recordset.length === 0) {
        return res.status(404).json({ message: 'Answer not found' });
      }

      const participantId = answerCheckRs.recordset[0].ParticipantID;

      // 1. Update answer
      await pool.request()
        .input('answerId', sql.BigInt, answerId)
        .input('score', sql.Int, score)
        .input('isCorrect', sql.Bit, isCorrect)
        .input('reviewerComments', sql.NVarChar(sql.MAX), reviewerComments)
        .query(`
          UPDATE ExamAnswers
          SET Score = @score,
              IsCorrect = @isCorrect,
              ReviewerComments = @reviewerComments,
              UpdatedAt = GETDATE()
          WHERE AnswerID = @answerId;
        `);

      // 2. Update essay analysis table if entry exists
      const hasAnalysisRs = await pool.request()
        .input('answerId', sql.BigInt, answerId)
        .query('SELECT 1 FROM EssayAnswerAnalysis WHERE AnswerID = @answerId');

      if (hasAnalysisRs.recordset.length > 0) {
        await pool.request()
          .input('answerId', sql.BigInt, answerId)
          .input('finalScore', sql.Int, score)
          .input('reviewerComments', sql.NVarChar(sql.MAX), reviewerComments)
          .query(`
            UPDATE EssayAnswerAnalysis
            SET FinalScore = @finalScore,
                ReviewerComments = @reviewerComments,
                UpdatedAt = GETDATE()
            WHERE AnswerID = @answerId;
          `);
      }

      // 3. Refresh participant aggregate score & status
      await pool.request()
        .input('participantId', sql.BigInt, participantId)
        .input('reviewedBy', sql.BigInt, reviewerId)
        .query(`
          UPDATE ep
          SET Score = (SELECT AVG(Score) FROM ExamAnswers WHERE ParticipantID = @participantId),
              Status = 'reviewed',
              ReviewedBy = @reviewedBy,
              ReviewedAt = GETDATE()
          FROM ExamParticipants ep
          WHERE ep.ParticipantID = @participantId;
        `);

      return res.status(200).json({ message: 'Answer reviewed successfully' });
    } catch (error) {
      console.error('[gradeEssayAnswer] Error:', error);
      return res.status(500).json({ message: 'Server error while grading essay answer' });
    }
  }
};

module.exports = examController; 
