import { ArrowBack } from '@mui/icons-material';
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  Container,
  Link,
  Paper,
  Typography
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getEssayTemplate, getExamById } from '../../api/exams';
import EssayQuestionForm from '../../components/exams/EssayQuestionForm';

const EditEssayQuestion = () => {
  const { examId, questionId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exam, setExam] = useState(null);
  const [question, setQuestion] = useState(null);
  const [templates, setTemplates] = useState([]); // <-- đổi từ 1 id sang list

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        console.log(`Đang tải dữ liệu bài thi ${examId} và câu hỏi ${questionId}`);

        const examData = await getExamById(examId);
        if (!isMounted) return;

        if (!examData || Object.keys(examData).length === 0) {
          throw new Error('Không thể tải thông tin bài thi');
        }
        setExam(examData);

        const normalizedId = questionId?.toString();
        const foundQuestion = examData.questions?.find(
          q => q._id?.toString() === normalizedId || q.questionID?.toString() === normalizedId
        );

        if (!foundQuestion) {
          throw new Error(`Không tìm thấy câu hỏi trong bài thi (ID: ${questionId})`);
        }

        const questionType = foundQuestion.Type?.toLowerCase() || foundQuestion.type?.toLowerCase();
        if (questionType !== 'essay') {
          throw new Error('Đây không phải là câu hỏi tự luận');
        }

        setQuestion(foundQuestion);

        // Gọi API lấy tất cả essay templates
        try {
          const questionIdentifier = (foundQuestion.questionID || foundQuestion._id)?.toString();
          const templateList = await getEssayTemplate(examId, questionIdentifier);

          if (Array.isArray(templateList)) {
            setTemplates(templateList);
          } else if (templateList) {
            // nếu BE vẫn trả 1 object thì bọc vào mảng
            setTemplates([templateList]);
          }
        } catch (err) {
          console.warn('Không thể tải essay templates:', err.message);
          setTemplates([]);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Không thể tải dữ liệu câu hỏi');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    return () => { isMounted = false; };
  }, [examId, questionId]);

  const handleBack = () => navigate(`/exams/edit/${examId}`);
  const handleSaveSuccess = () => {
    console.log("Lưu template thành công");
  };

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 10 }}>
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>Đang tải thông tin câu hỏi...</Typography>
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ my: 3 }}>
          <Button startIcon={<ArrowBack />} onClick={handleBack} sx={{ mb: 2 }}>
            Quay lại bài thi
          </Button>
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        </Box>
      </Container>
    );
  }

  const questionText = question?.content || question?.text || question?.QuestionText || 'Câu hỏi tự luận';
  const questionDescription = question?.Description || question?.description || '';
  const questionPoints = question?.Points || question?.points || 0;

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 3 }}>
        <Button startIcon={<ArrowBack />} onClick={handleBack} sx={{ mb: 2 }}>
          Quay lại bài thi
        </Button>

        <Breadcrumbs sx={{ mb: 2 }}>
          <Link color="inherit" onClick={() => navigate('/exams')}>
            Bài thi
          </Link>
          <Link color="inherit" onClick={handleBack}>
            {exam?.Title || exam?.title || 'Bài thi'}
          </Link>
          <Typography color="text.primary">Chỉnh sửa câu hỏi tự luận</Typography>
        </Breadcrumbs>

        <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
          <Typography variant="h5" gutterBottom>{questionText}</Typography>
          {questionDescription && (
            <Typography variant="body1" color="text.secondary" paragraph>
              {questionDescription}
            </Typography>
          )}
          <Typography variant="body2" gutterBottom>
            Điểm: {questionPoints}
          </Typography>
        </Paper>

        {templates.length === 0 ? (
          <Alert severity="info">Chưa có template nào cho câu hỏi này</Alert>
        ) : (
          templates.map(template => (
            <Paper key={template.templateId || template.id || template._id} sx={{ p: 2, mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Mẫu {template.templateId || template.id || template._id}
              </Typography>
              <EssayQuestionForm
                examId={examId}
                questionId={(question?.questionID || question?._id || questionId)?.toString()}
                templateId={template.templateId || template.id || template._id}
                initialData={template}
                onSaveSuccess={handleSaveSuccess}
              />
            </Paper>
          ))
        )}
      </Box>
    </Container>
  );
};

export default EditEssayQuestion;
