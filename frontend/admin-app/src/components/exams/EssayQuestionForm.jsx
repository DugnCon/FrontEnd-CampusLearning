import { Add, Delete, Description, NoteAdd, Save } from '@mui/icons-material';
import {
  Alert,
  Box, Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  List, ListItem, ListItemText,
  Paper,
  TextField,
  Typography,
  MenuItem,
  Select,
  FormControl,
  InputLabel
} from '@mui/material';
import { useEffect, useState } from 'react';
import { getEssayTemplates, addEssayContent, updateEssayContent } from '../../api/exams';

const EssayQuestionForm = ({ examId, questionId, onSaveSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [fileMap, setFileMap] = useState({});
  const [errorMap, setErrorMap] = useState({});
  const [successMap, setSuccessMap] = useState({});
  const [newKeywordMap, setNewKeywordMap] = useState({});

  // Load templates chỉ 1 lần khi component mount
  useEffect(() => {
    let isMounted = true;
    const fetchTemplates = async () => {
      if (!questionId) return;
      try {
        setLoading(true);
        const allTemplates = await getEssayTemplates(examId, questionId);
        if (!isMounted) return;

        const parsedTemplates = (allTemplates || []).map(t => ({
          ...t,
          keywords: t.keywords ? t.keywords.split(',').filter(Boolean) : [],
          minimumMatchPercentage: t.minimumMatchPercentage ?? 60
        }));

        setTemplates(parsedTemplates);
        if (parsedTemplates.length > 0) setSelectedTemplateId(parsedTemplates[0].templateID);
      } catch (err) {
        console.error('Cannot load templates:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchTemplates();
    return () => { isMounted = false; };
  }, [examId, questionId]);

  const selectedTemplate = templates.find(t => t.templateID === selectedTemplateId);

  // Template selection
  const handleTemplateChange = (event) => {
    setSelectedTemplateId(event.target.value);
  };

  const handleFieldChange = (templateId, field, value) => {
    setTemplates(prev =>
      prev.map(t => t.templateID === templateId ? { ...t, [field]: value } : t)
    );
    setSuccessMap(prev => ({ ...prev, [templateId]: false }));
    setErrorMap(prev => ({ ...prev, [templateId]: null }));
  };

  const handleFileChange = (templateId, e) => {
    if (e.target.files && e.target.files[0]) {
      setFileMap(prev => ({ ...prev, [templateId]: e.target.files[0] }));
      const reader = new FileReader();
      reader.onload = (event) => handleFieldChange(templateId, 'content', event.target.result);
      reader.readAsText(e.target.files[0]);
    }
  };

  const addKeyword = (templateId) => {
    const newKw = newKeywordMap[templateId]?.trim();
    if (newKw) {
      handleFieldChange(templateId, 'keywords', [...(selectedTemplate.keywords || []), newKw]);
      setNewKeywordMap(prev => ({ ...prev, [templateId]: '' }));
    }
  };

  const removeKeyword = (templateId, idx) => {
    handleFieldChange(templateId, 'keywords', selectedTemplate.keywords.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (templateId) => {
    const tpl = templates.find(t => t.templateID === templateId);
    if (!tpl) return;

    try {
      setLoading(true);
      setErrorMap(prev => ({ ...prev, [templateId]: null }));
      setSuccessMap(prev => ({ ...prev, [templateId]: false }));

      if (!tpl.content?.trim()) {
        setErrorMap(prev => ({ ...prev, [templateId]: 'Vui lòng nhập nội dung mẫu đáp án' }));
        return;
      }

      if (tpl.templateID) {
        await updateEssayContent(examId, questionId, tpl.templateID, {
          content: tpl.content,
          keywords: tpl.keywords,
          minimumMatchPercentage: tpl.minimumMatchPercentage
        });
      } else {
        const newTpl = await addEssayContent(examId, questionId, {
          ...tpl,
          keywords: tpl.keywords
        });
        setTemplates(prev => prev.map(t => t.templateID === templateId ? { ...t, templateID: newTpl.templateID } : t));
      }

      setSuccessMap(prev => ({ ...prev, [templateId]: true }));
      if (onSaveSuccess) onSaveSuccess(tpl);
    } catch (err) {
      setErrorMap(prev => ({ ...prev, [templateId]: 'Không thể lưu nội dung mẫu. Vui lòng thử lại.' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box mt={3}>
      <Divider sx={{ mb: 3 }}>
        <Chip icon={<Description />} label="Mẫu câu hỏi tự luận" />
      </Divider>

      {loading && <Box textAlign="center" sx={{ my: 4 }}><CircularProgress /></Box>}

      {templates.length > 0 && (
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Chọn template</InputLabel>
          <Select value={selectedTemplateId || ''} label="Chọn template" onChange={handleTemplateChange}>
            {templates.map(t => (
              <MenuItem key={t.templateID} value={t.templateID}>
                {t.content.slice(0, 30)}...
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {selectedTemplate && (
        <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
          {errorMap[selectedTemplate.templateID] && <Alert severity="error" sx={{ mb: 2 }}>{errorMap[selectedTemplate.templateID]}</Alert>}
          {successMap[selectedTemplate.templateID] && <Alert severity="success" sx={{ mb: 2 }}>Đã lưu mẫu câu hỏi tự luận thành công!</Alert>}

          <TextField
            fullWidth
            label="Nội dung mẫu câu hỏi tự luận"
            multiline
            rows={8}
            value={selectedTemplate.content}
            onChange={(e) => handleFieldChange(selectedTemplate.templateID, 'content', e.target.value)}
            placeholder="Nhập nội dung mẫu"
            required
          />

          <Button
            variant="outlined"
            component="label"
            startIcon={<NoteAdd />}
            sx={{ mt: 2 }}
          >
            Tải tệp văn bản
            <input type="file" hidden accept=".txt,.doc,.docx" onChange={e => handleFileChange(selectedTemplate.templateID, e)} />
          </Button>
          {fileMap[selectedTemplate.templateID] && (
            <Typography variant="body2" sx={{ ml: 2, display: 'inline' }}>
              Tệp: {fileMap[selectedTemplate.templateID].name}
            </Typography>
          )}

          <TextField
            fullWidth
            label="Thêm từ khóa"
            value={newKeywordMap[selectedTemplate.templateID] || ''}
            onChange={e => setNewKeywordMap(prev => ({ ...prev, [selectedTemplate.templateID]: e.target.value }))}
            onKeyPress={e => e.key === 'Enter' && addKeyword(selectedTemplate.templateID)}
            placeholder="Nhập từ khóa và nhấn Enter"
            sx={{ mt: 2 }}
          />
          <Button
            variant="outlined"
            startIcon={<Add />}
            onClick={() => addKeyword(selectedTemplate.templateID)}
            disabled={!newKeywordMap[selectedTemplate.templateID]?.trim()}
            sx={{ mt: 1 }}
          >
            Thêm từ khóa
          </Button>

          <List dense sx={{ mt: 2 }}>
            {selectedTemplate.keywords.map((kw, idx) => (
              <ListItem key={idx} secondaryAction={
                <IconButton edge="end" onClick={() => removeKeyword(selectedTemplate.templateID, idx)}>
                  <Delete />
                </IconButton>
              }>
                <ListItemText primary={kw} />
              </ListItem>
            ))}
          </List>

          <TextField
            fullWidth
            type="number"
            label="Tỷ lệ phần trăm tương đồng tối thiểu"
            value={selectedTemplate.minimumMatchPercentage}
            onChange={(e) =>
              handleFieldChange(selectedTemplate.templateID, 'minimumMatchPercentage', Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))
            }
            sx={{ mt: 2 }}
          />

          <Box display="flex" justifyContent="flex-end" mt={3}>
            <Button
              variant="contained"
              color="primary"
              startIcon={loading ? <CircularProgress size={20} /> : <Save />}
              onClick={() => handleSubmit(selectedTemplate.templateID)}
              disabled={loading || !selectedTemplate.content.trim()}
            >
              {loading ? 'Đang lưu...' : 'Lưu mẫu câu hỏi'}
            </Button>
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default EssayQuestionForm;
