/*-----------------------------------------------------------------
* File: CodingExamPage.jsx
* Author: Quyen Nguyen Duc
* Date: 2025-07-24
* Description: This file is a component/module for the admin application.
* Apache 2.0 License - Copyright 2025 Quyen Nguyen Duc
-----------------------------------------------------------------*/
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Typography, Box, Paper, Stepper, Step, StepLabel,
  Button, TextField, MenuItem, FormControl, FormControlLabel,
  Switch, Grid, Card, CardContent, CircularProgress, Divider,
  Accordion, AccordionSummary, AccordionDetails, IconButton,
  Chip, Alert
} from '@mui/material';
import {
  Add, Delete, ArrowBack, ArrowForward, Save,
  ExpandMore, Code
} from '@mui/icons-material';
import { createExam, addQuestionToExam, addCodingExercise } from '../../api/exams';
import axios from 'axios';
import adminApi from '../../api/config';

const steps = ['Thông tin bài thi', 'Câu hỏi', 'Xem lại'];

const CodingExamPage = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState([]);
  const [modules, setModules] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [error, setError] = useState(null);
  const [createdExamId, setCreatedExamId] = useState(null);
  const [success, setSuccess] = useState(null);
  const apiUrl = adminApi.defaults.baseURL;

  const [examData, setExamData] = useState({
    title: '',
    description: '',
    type: 'coding',
    duration: 120,
    totalPoints: 100,
    passingScore: 60,
    startTime: '',
    endTime: '',
    instructions: '',
    allowReview: true,
    shuffleQuestions: false,
    courseId: '',
    moduleId: '',
    lessonId: '',
    status: 'ACTIVE'
  });

  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState({
    type: 'coding',
    content: '',
    points: 10,
    orderIndex: 1,
    codingExercise: {
      programmingLanguage: 'javascript',
      initialCode: '',
      solutionCode: '',
      testCases: [{ input: '', output: '', description: '' }],
      timeLimit: 1000,
      memoryLimit: 256,
      difficulty: 'medium'
    }
  });

  // Fetch courses
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${apiUrl}/courses`);
        console.log('Courses response:', response.data);
        const coursesData = (response.data.courses || response.data).map(course => ({
          CourseID: course.CourseID,
          Title: course.Title
        }));
        setCourses(coursesData);
      } catch (err) {
        setError('Không thể tải danh sách khóa học. Vui lòng thử lại sau.');
        console.error('Lỗi fetch courses:', err.response ? err.response.data : err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, [apiUrl]);

  // Fetch modules when courseId changes
  useEffect(() => {
    if (examData.courseId) {
      const fetchModules = async () => {
        try {
          setLoading(true);
          const response = await axios.get(`${apiUrl}/courses/${examData.courseId}/modules`);
          console.log('Modules response:', response.data);
          const modulesData = response.data.modules.map(module => ({
            moduleId: module.ModuleID,
            title: module.Title
          }));
          setModules(modulesData);
          setExamData(prev => ({ ...prev, moduleId: modulesData.length > 0 ? modulesData[0].moduleId : '' }));
        } catch (err) {
          setError('Không thể tải danh sách module. Vui lòng thử lại sau.');
          console.error('Lỗi fetch modules:', err.response ? err.response.data : err.message);
        } finally {
          setLoading(false);
        }
      };
      fetchModules();
    } else {
      setModules([]);
      setExamData(prev => ({ ...prev, moduleId: '', lessonId: '' }));
    }
  }, [examData.courseId, apiUrl]);

  // Fetch lessons when moduleId changes
  useEffect(() => {
    if (examData.moduleId) {
      const fetchLessons = async () => {
        try {
          setLoading(true);
          const response = await axios.get(`${apiUrl}/modules/${examData.moduleId}/lessons`);
          console.log('Lessons response:', response.data);
          const lessonsData = response.data.lessons.map(lesson => ({
            lessonId: lesson.LessonID,
            title: lesson.Title
          }));
          setLessons(lessonsData);
          setExamData(prev => ({ ...prev, lessonId: lessonsData.length > 0 ? lessonsData[0].lessonId : '' }));
        } catch (err) {
          setError('Không thể tải danh sách lesson. Vui lòng thử lại sau.');
          console.error('Lỗi fetch lessons:', err.response ? err.response.data : err.message);
        } finally {
          setLoading(false);
        }
      };
      fetchLessons();
    } else {
      setLessons([]);
      setExamData(prev => ({ ...prev, lessonId: '' }));
    }
  }, [examData.moduleId, apiUrl]);

  const handleExamDataChange = (e) => {
    const { name, value, checked } = e.target;
    const newValue = e.target.type === 'checkbox' ? checked : value;
    console.log('Changing examData:', name, value); // Debug
    setExamData({ ...examData, [name]: newValue });
  };

  const handleQuestionChange = (e) => {
    const { name, value } = e.target;
    setCurrentQuestion({ ...currentQuestion, [name]: value });
  };

  const handleCodingExerciseChange = (field, value) => {
    setCurrentQuestion({
      ...currentQuestion,
      codingExercise: {
        ...currentQuestion.codingExercise,
        [field]: value
      }
    });
  };

  const handleTestCaseChange = (index, field, value) => {
    const updatedTestCases = [...currentQuestion.codingExercise.testCases];
    updatedTestCases[index] = {
      ...updatedTestCases[index],
      [field]: value
    };
    handleCodingExerciseChange('testCases', updatedTestCases);
  };

  const addTestCase = () => {
    const updatedTestCases = [...currentQuestion.codingExercise.testCases, {
      input: '',
      output: '',
      description: ''
    }];
    handleCodingExerciseChange('testCases', updatedTestCases);
  };

  const removeTestCase = (index) => {
    if (currentQuestion.codingExercise.testCases.length <= 1) {
      setError('Cần có ít nhất một test case');
      return;
    }
    const updatedTestCases = [...currentQuestion.codingExercise.testCases];
    updatedTestCases.splice(index, 1);
    handleCodingExerciseChange('testCases', updatedTestCases);
  };

  const addQuestion = () => {
    if (!currentQuestion.content) {
      setError('Vui lòng nhập nội dung câu hỏi');
      return;
    }
    if (!currentQuestion.codingExercise.solutionCode) {
      setError('Vui lòng nhập mã giải pháp');
      return;
    }
    if (!currentQuestion.codingExercise.testCases.some(tc => tc.input && tc.output)) {
      setError('Vui lòng nhập ít nhất một test case đầy đủ');
      return;
    }
    setQuestions([...questions, { ...currentQuestion, id: Date.now() }]);
    setError(null);
    setSuccess('Đã thêm câu hỏi thành công');
    setCurrentQuestion({
      type: 'coding',
      content: '',
      points: 10,
      orderIndex: questions.length + 2,
      codingExercise: {
        programmingLanguage: 'javascript',
        initialCode: '',
        solutionCode: '',
        testCases: [{ input: '', output: '', description: '' }],
        timeLimit: 1000,
        memoryLimit: 256,
        difficulty: 'medium'
      }
    });
    setTimeout(() => {
      setSuccess(null);
    }, 3000);
  };

  const removeQuestion = (questionIndex) => {
    const updatedQuestions = [...questions];
    updatedQuestions.splice(questionIndex, 1);
    setQuestions(updatedQuestions);
  };

  const handleNext = () => {
    console.log('Active Step:', activeStep);
    if (activeStep === 0) {
      if (!examData.title) {
        setError('Vui lòng nhập tiêu đề bài thi');
        return;
      }
      if (!examData.duration || examData.duration <= 0) {
        setError('Vui lòng nhập thời gian làm bài hợp lệ');
        return;
      }
      if (!examData.startTime || !examData.endTime) {
        setError('Vui lòng nhập thời gian bắt đầu và kết thúc');
        return;
      }
      handleCreateExam();
    } else if (activeStep === 1) {
      console.log('Questions length:', questions.length);
      if (questions.length === 0) {
        setError('Vui lòng thêm ít nhất một câu hỏi');
        return;
      }
      setActiveStep(activeStep + 1);
      setError(null);
    } else if (activeStep === 2) {
      handleFinish();
    }
  };

  const handleBack = () => {
    setActiveStep(prevStep => prevStep - 1);
    setError(null);
  };

  const handleCreateExam = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Creating exam with data:', examData);

      if (!examData.title.trim()) {
        setError('Tiêu đề bài thi không được để trống');
        setLoading(false);
        return;
      }

      if (!examData.duration || examData.duration <= 0) {
        setError('Thời gian làm bài phải lớn hơn 0');
        setLoading(false);
        return;
      }

      const start = new Date(examData.startTime);
      const end = new Date(examData.endTime);

      if (isNaN(start.getTime())) {
        setError('Thời gian bắt đầu không hợp lệ');
        setLoading(false);
        return;
      }

      if (isNaN(end.getTime())) {
        setError('Thời gian kết thúc không hợp lệ');
        setLoading(false);
        return;
      }

      if (start >= end) {
        setError('Thời gian kết thúc phải sau thời gian bắt đầu');
        setLoading(false);
        return;
      }

      const formattedExamData = {
        ...examData,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        courseId: examData.courseId || null,
        moduleId: examData.moduleId || null,
        lessonId: examData.lessonId || null
      };

      console.log('Sending exam data:', formattedExamData);
      const response = await createExam(formattedExamData);
      console.log('Exam creation response:', response);
      setCreatedExamId(response.examId);
      setActiveStep(activeStep + 1);
    } catch (err) {
      console.error('Exam creation error:', err);
      if (err.response) {
        if (err.response.status === 400) {
          setError('Dữ liệu không hợp lệ: ' + (err.response.data.message || 'Vui lòng kiểm tra các trường thông tin'));
        } else if (err.response.status === 401) {
          setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        } else if (err.response.status === 403) {
          setError('Bạn không có quyền thực hiện hành động này');
        } else if (err.response.status === 500) {
          setError('Lỗi máy chủ: ' + (err.response.data.message || 'Vui lòng thử lại sau'));
        } else {
          setError('Không thể tạo bài thi: ' + (err.response.data.message || 'Vui lòng thử lại sau'));
        }
      } else if (err.request) {
        setError('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.');
      } else {
        setError('Lỗi: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    try {
      setLoading(true);
      setError(null);

      for (const question of questions) {
        const questionData = {
          type: question.type,
          content: question.content,
          points: question.points,
          orderIndex: question.orderIndex,
          lessonId: examData.lessonId
        };

        const questionResponse = await addQuestionToExam(createdExamId, questionData);
        const questionId = questionResponse.questionId;

        if (question.codingExercise) {
        const exerciseData = {
          ...question.codingExercise,
          lessonId: questionResponse.lessonId || examData.lessonId // Fallback nếu response không có lessonId
        };
        console.log('Sending exercise data:', exerciseData); // Debug
        await addCodingExercise(createdExamId, questionId, exerciseData);
        }
      }

      navigate('/exams', {
        state: {
          success: 'Bài thi lập trình đã được tạo thành công'
        }
      });
    } catch (err) {
      setError('Lỗi khi lưu câu hỏi. Vui lòng thử lại.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate('/exams/create')}
            sx={{ mr: 2 }}
          >
            Quay lại
          </Button>
          <Typography variant="h4">
            Tạo bài thi lập trình
          </Typography>
        </Box>

        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {success}
          </Alert>
        )}

        <Paper elevation={3} sx={{ p: 3 }}>
          {activeStep === 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Thông tin bài thi
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    required
                    fullWidth
                    label="Tiêu đề bài thi"
                    name="title"
                    value={examData.title}
                    onChange={handleExamDataChange}
                    margin="normal"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    fullWidth
                    label="Trạng thái"
                    name="status"
                    value={examData.status}
                    onChange={handleExamDataChange}
                    margin="normal"
                  >
                    <MenuItem value="DRAFT">Bản nháp</MenuItem>
                    <MenuItem value="PUBLISHED">Đã xuất bản</MenuItem>
                    <MenuItem value="UPCOMING">Sắp diễn ra</MenuItem>
                    <MenuItem value="ACTIVE">Hoạt động</MenuItem>
                    <MenuItem value="INACTIVE">Không hoạt động</MenuItem>
                    <MenuItem value="COMPLETED">Hoàn thành</MenuItem>
                    <MenuItem value="CANCELED">Đã hủy</MenuItem>
                    <MenuItem value="INREVIEW">Đang xét duyệt</MenuItem>
                  </TextField>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Loại bài thi"
                    value="Lập trình"
                    margin="normal"
                    InputProps={{
                      readOnly: true,
                    }}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    fullWidth
                    label="Khóa học (tùy chọn)"
                    name="courseId"
                    value={examData.courseId}
                    onChange={handleExamDataChange}
                    margin="normal"
                    disabled={loading || courses.length === 0}
                  >
                    <MenuItem value="">Không thuộc khóa học</MenuItem>
                    {courses.map((course) => (
                      <MenuItem key={course.CourseID} value={course.CourseID}>
                        {course.Title}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                {examData.courseId && (
                  <Grid item xs={12} sm={6}>
                    <TextField
                      select
                      fullWidth
                      label="Module"
                      name="moduleId"
                      value={examData.moduleId}
                      onChange={handleExamDataChange}
                      margin="normal"
                      disabled={loading || modules.length === 0}
                    >
                      {modules.map((module) => (
                        <MenuItem key={module.moduleId} value={module.moduleId}>
                          {module.title}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                )}

                {examData.moduleId && (
                  <Grid item xs={12} sm={6}>
                    <TextField
                      select
                      fullWidth
                      label="Lesson"
                      name="lessonId"
                      value={examData.lessonId}
                      onChange={handleExamDataChange}
                      margin="normal"
                      disabled={loading || lessons.length === 0}
                    >
                      {lessons.map((lesson) => (
                        <MenuItem key={lesson.lessonId} value={lesson.lessonId}>
                          {lesson.title}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                )}

                <Grid item xs={12} sm={6}>
                  <TextField
                    required
                    fullWidth
                    label="Thời gian làm bài (phút)"
                    name="duration"
                    type="number"
                    value={examData.duration}
                    onChange={handleExamDataChange}
                    margin="normal"
                    InputProps={{ inputProps: { min: 1 } }}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    required
                    fullWidth
                    label="Tổng điểm"
                    name="totalPoints"
                    type="number"
                    value={examData.totalPoints}
                    onChange={handleExamDataChange}
                    margin="normal"
                    InputProps={{ inputProps: { min: 1 } }}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    required
                    fullWidth
                    label="Điểm đạt"
                    name="passingScore"
                    type="number"
                    value={examData.passingScore}
                    onChange={handleExamDataChange}
                    margin="normal"
                    InputProps={{ inputProps: { min: 0, max: examData.totalPoints } }}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    required
                    fullWidth
                    label="Thời gian bắt đầu"
                    name="startTime"
                    type="datetime-local"
                    value={examData.startTime}
                    onChange={handleExamDataChange}
                    margin="normal"
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    required
                    fullWidth
                    label="Thời gian kết thúc"
                    name="endTime"
                    type="datetime-local"
                    value={examData.endTime}
                    onChange={handleExamDataChange}
                    margin="normal"
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Hướng dẫn làm bài"
                    name="instructions"
                    multiline
                    rows={4}
                    value={examData.instructions}
                    onChange={handleExamDataChange}
                    margin="normal"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={examData.allowReview}
                        onChange={handleExamDataChange}
                        name="allowReview"
                        color="primary"
                      />
                    }
                    label="Cho phép xem lại bài làm"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={examData.shuffleQuestions}
                        onChange={handleExamDataChange}
                        name="shuffleQuestions"
                        color="primary"
                      />
                    }
                    label="Xáo trộn câu hỏi"
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Mô tả bài thi"
                    name="description"
                    multiline
                    rows={3}
                    value={examData.description}
                    onChange={handleExamDataChange}
                    margin="normal"
                  />
                </Grid>
              </Grid>
            </Box>
          )}

          {activeStep === 1 && (
            <Box>
              {console.log('Rendering activeStep 1')}
              <Typography variant="h6" gutterBottom>
                Thêm câu hỏi lập trình
              </Typography>

              {questions.length > 0 && (
                <Box sx={{ mb: 4 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Câu hỏi đã thêm: {questions.length}
                  </Typography>
                  {questions.map((question, index) => (
                    <Accordion key={question.id || index}>
                      <AccordionSummary expandIcon={<ExpandMore />}>
                        <Typography>
                          {index + 1}. Bài tập lập trình: {question.content.substring(0, 50)}... ({question.points} điểm)
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Typography gutterBottom><strong>Nội dung:</strong> {question.content}</Typography>

                        <Typography gutterBottom sx={{ mt: 2 }}>
                          <strong>Ngôn ngữ lập trình:</strong> {question.codingExercise.programmingLanguage}
                        </Typography>

                        <Typography gutterBottom>
                          <strong>Độ khó:</strong> {
                            question.codingExercise.difficulty === 'easy' ? 'Dễ' :
                            question.codingExercise.difficulty === 'medium' ? 'Trung bình' :
                            question.codingExercise.difficulty === 'hard' ? 'Khó' : question.codingExercise.difficulty
                          }
                        </Typography>

                        <Typography gutterBottom>
                          <strong>Số lượng test cases:</strong> {question.codingExercise.testCases.length}
                        </Typography>

                        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                          <Button
                            variant="outlined"
                            color="error"
                            startIcon={<Delete />}
                            onClick={() => removeQuestion(index)}
                          >
                            Xóa
                          </Button>
                        </Box>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </Box>
              )}

              <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Thêm bài tập lập trình mới
                </Typography>

                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      required
                      fullWidth
                      label="Điểm"
                      name="points"
                      type="number"
                      value={currentQuestion.points}
                      onChange={handleQuestionChange}
                      margin="normal"
                      InputProps={{ inputProps: { min: 1 } }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      select
                      fullWidth
                      label="Ngôn ngữ lập trình"
                      value={currentQuestion.codingExercise.programmingLanguage}
                      onChange={(e) => handleCodingExerciseChange('programmingLanguage', e.target.value)}
                      margin="normal"
                    >
                      <MenuItem value="javascript">JavaScript</MenuItem>
                      <MenuItem value="python">Python</MenuItem>
                      <MenuItem value="java">Java</MenuItem>
                      <MenuItem value="cpp">C++</MenuItem>
                    </TextField>
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      required
                      fullWidth
                      label="Tên và mô tả bài tập"
                      name="content"
                      multiline
                      rows={3}
                      value={currentQuestion.content}
                      onChange={handleQuestionChange}
                      margin="normal"
                      placeholder="Nhập tên và yêu cầu của bài tập lập trình..."
                    />
                  </Grid>
                </Grid>

                <Box sx={{ mt: 3 }}>
                  {console.log('Rendering Chip')}
                  <Divider sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
                    <Chip icon={<Code />} label="Mã và kiểm thử" />
                  </Divider>

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        select
                        fullWidth
                        label="Độ khó"
                        value={currentQuestion.codingExercise.difficulty}
                        onChange={(e) => handleCodingExerciseChange('difficulty', e.target.value)}
                        margin="normal"
                      >
                        <MenuItem value="easy">Dễ</MenuItem>
                        <MenuItem value="medium">Trung bình</MenuItem>
                        <MenuItem value="hard">Khó</MenuItem>
                      </TextField>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Thời gian chạy tối đa (ms)"
                        type="number"
                        value={currentQuestion.codingExercise.timeLimit}
                        onChange={(e) => handleCodingExerciseChange('timeLimit', Number(e.target.value))}
                        margin="normal"
                        InputProps={{ inputProps: { min: 100 } }}
                      />
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Giới hạn bộ nhớ (MB)"
                        type="number"
                        value={currentQuestion.codingExercise.memoryLimit}
                        onChange={(e) => handleCodingExerciseChange('memoryLimit', Number(e.target.value))}
                        margin="normal"
                        InputProps={{ inputProps: { min: 16 } }}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Mã khởi tạo"
                        multiline
                        rows={5}
                        value={currentQuestion.codingExercise.initialCode}
                        onChange={(e) => handleCodingExerciseChange('initialCode', e.target.value)}
                        margin="normal"
                        placeholder={`// Mã khởi tạo cho học viên\nfunction solve(input) {\n  // Mã của học viên\n}`}
                        helperText="Mã này sẽ được hiển thị cho học viên khi bắt đầu làm bài"
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        required
                        fullWidth
                        label="Mã giải pháp"
                        multiline
                        rows={5}
                        value={currentQuestion.codingExercise.solutionCode}
                        onChange={(e) => handleCodingExerciseChange('solutionCode', e.target.value)}
                        margin="normal"
                        placeholder={`// Giải pháp mẫu\nfunction solve(input) {\n  // Mã giải pháp\n  return output;\n}`}
                        helperText="Mã giải pháp chính xác cho bài tập (không hiển thị cho học viên)"
                      />
                    </Grid>
                  </Grid>

                  <Box sx={{ mt: 3 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Test Cases
                    </Typography>

                    {currentQuestion.codingExercise.testCases.map((testCase, index) => (
                      <Paper key={index} variant="outlined" sx={{ p: 2, mb: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="subtitle2">
                            Test Case #{index + 1}
                          </Typography>
                          <IconButton
                            color="error"
                            onClick={() => removeTestCase(index)}
                            disabled={currentQuestion.codingExercise.testCases.length <= 1}
                          >
                            <Delete />
                          </IconButton>
                        </Box>

                        <Grid container spacing={2}>
                          <Grid item xs={12}>
                            <TextField
                              fullWidth
                              label="Mô tả test case"
                              value={testCase.description}
                              onChange={(e) => handleTestCaseChange(index, 'description', e.target.value)}
                              margin="dense"
                              placeholder="Ví dụ: Kiểm tra với mảng rỗng"
                            />
                          </Grid>

                          <Grid item xs={12} md={6}>
                            <TextField
                              fullWidth
                              required
                              label="Input"
                              multiline
                              rows={3}
                              value={testCase.input}
                              onChange={(e) => handleTestCaseChange(index, 'input', e.target.value)}
                              margin="dense"
                              placeholder="Nhập dữ liệu đầu vào"
                            />
                          </Grid>

                          <Grid item xs={12} md={6}>
                            <TextField
                              fullWidth
                              required
                              label="Expected Output"
                              multiline
                              rows={3}
                              value={testCase.output}
                              onChange={(e) => handleTestCaseChange(index, 'output', e.target.value)}
                              margin="dense"
                              placeholder="Nhập kết quả mong đợi"
                            />
                          </Grid>
                        </Grid>
                      </Paper>
                    ))}

                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                      <Button
                        variant="outlined"
                        startIcon={<Add />}
                        onClick={addTestCase}
                      >
                        Thêm test case mới
                      </Button>
                    </Box>
                  </Box>
                </Box>

                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<Add />}
                    onClick={addQuestion}
                    disabled={loading || !currentQuestion.content || !currentQuestion.codingExercise.solutionCode}
                  >
                    Thêm bài tập
                  </Button>
                </Box>
              </Paper>
            </Box>
          )}

          {activeStep === 2 && (
            <Box>
              {console.log('Rendering activeStep 2')}
              <Typography variant="h6" gutterBottom>
                Xem lại và xác nhận
              </Typography>

              <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6">Thông tin bài thi</Typography>
                  <Grid container spacing={2} sx={{ mt: 1 }}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2"><strong>Tiêu đề:</strong> {examData.title}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2"><strong>Loại bài thi:</strong> Lập trình</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2"><strong>Thời gian làm bài:</strong> {examData.duration} phút</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2"><strong>Tổng điểm:</strong> {examData.totalPoints}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2"><strong>Điểm đạt:</strong> {examData.passingScore}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2">
                        <strong>Trạng thái:</strong> {
                          examData.status === 'DRAFT' ? 'Bản nháp' :
                          examData.status === 'PUBLISHED' ? 'Đã xuất bản' :
                          examData.status === 'UPCOMING' ? 'Sắp diễn ra' :
                          examData.status === 'ACTIVE' ? 'Hoạt động' :
                          examData.status === 'INACTIVE' ? 'Không hoạt động' :
                          examData.status === 'COMPLETED' ? 'Hoàn thành' :
                          examData.status === 'CANCELED' ? 'Đã hủy' :
                          examData.status === 'INREVIEW' ? 'Đang xét duyệt' : examData.status
                        }
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2">
                        <strong>Khóa học:</strong> {
                          examData.courseId ?
                          courses.find(c => c.CourseID.toString() === examData.courseId.toString())?.Title || 'Không xác định' :
                          'Không thuộc khóa học'
                        }
                      </Typography>
                    </Grid>
                    {examData.moduleId && (
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2">
                          <strong>Module:</strong> {
                            modules.find(m => m.moduleId.toString() === examData.moduleId.toString())?.title || 'Không xác định'
                          }
                        </Typography>
                      </Grid>
                    )}
                    {examData.lessonId && (
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2">
                          <strong>Lesson:</strong> {
                            lessons.find(l => l.lessonId.toString() === examData.lessonId.toString())?.title || 'Không xác định'
                          }
                        </Typography>
                      </Grid>
                    )}
                    <Grid item xs={12}>
                      <Typography variant="body2"><strong>Mô tả:</strong> {examData.description || 'Không có mô tả'}</Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              <Typography variant="h6" gutterBottom>
                Bài tập lập trình ({questions.length})
              </Typography>

              {questions.map((question, index) => (
                <Card key={index} variant="outlined" sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle1">
                      {index + 1}. Bài tập lập trình ({question.points} điểm)
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      <strong>Nội dung:</strong> {question.content}
                    </Typography>

                    <Box sx={{ mt: 2 }}>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={4}>
                          <Typography variant="body2">
                            <strong>Ngôn ngữ:</strong> {question.codingExercise.programmingLanguage}
                          </Typography>
                        </Grid>

                        <Grid item xs={12} sm={4}>
                          <Typography variant="body2">
                            <strong>Độ khó:</strong> {
                              question.codingExercise.difficulty === 'easy' ? 'Dễ' :
                              question.codingExercise.difficulty === 'medium' ? 'Trung bình' :
                              question.codingExercise.difficulty === 'hard' ? 'Khó' : question.codingExercise.difficulty
                            }
                          </Typography>
                        </Grid>

                        <Grid item xs={12} sm={4}>
                          <Typography variant="body2">
                            <strong>Test cases:</strong> {question.codingExercise.testCases.length}
                          </Typography>
                        </Grid>

                        <Grid item xs={12} sm={6}>
                          <Typography variant="body2">
                            <strong>Thời gian chạy tối đa:</strong> {question.codingExercise.timeLimit} ms
                          </Typography>
                        </Grid>

                        <Grid item xs={12} sm={6}>
                          <Typography variant="body2">
                            <strong>Giới hạn bộ nhớ:</strong> {question.codingExercise.memoryLimit} MB
                          </Typography>
                        </Grid>
                      </Grid>

                      <Accordion sx={{ mt: 2 }}>
                        <AccordionSummary expandIcon={<ExpandMore />}>
                          <Typography variant="body2">
                            <strong>Chi tiết test cases</strong>
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          {question.codingExercise.testCases.map((testCase, tcIndex) => (
                            <Box key={tcIndex} sx={{ mb: 2, p: 1, border: '1px solid #eee', borderRadius: 1 }}>
                              <Typography variant="body2">
                                <strong>Test #{tcIndex + 1}:</strong> {testCase.description || 'Không có mô tả'}
                              </Typography>
                              <Grid container spacing={2} sx={{ mt: 1 }}>
                                <Grid item xs={12} sm={6}>
                                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                    <strong>Input:</strong> {testCase.input || 'Không có'}
                                  </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                    <strong>Output:</strong> {testCase.output || 'Không có'}
                                  </Typography>
                                </Grid>
                              </Grid>
                            </Box>
                          ))}
                        </AccordionDetails>
                      </Accordion>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
            <Button
              variant="outlined"
              onClick={handleBack}
              startIcon={<ArrowBack />}
              disabled={activeStep === 0 || loading}
            >
              Quay lại
            </Button>

            <Button
              variant="contained"
              color="primary"
              onClick={handleNext}
              endIcon={activeStep === steps.length - 1 ? <Save /> : <ArrowForward />}
              disabled={loading}
            >
              {loading ? (
                <CircularProgress size={24} />
              ) : (
                activeStep === steps.length - 1 ? 'Hoàn thành' : 'Tiếp tục'
              )}
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default CodingExamPage;