/*-----------------------------------------------------------------
* File: ProblemDetail.jsx
* Author: Quyen Nguyen Duc
* Date: 2025-07-24
* Description: This file is a component/module for the student application.
* Apache 2.0 License - Copyright 2025 Quyen Nguyen Duc
-----------------------------------------------------------------*/
import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getProblemDetails, submitSolution, getSubmissionDetails, getCompetitionDetails, startCompetition } from '@/api/competitionService';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import Avatar from '../../components/common/Avatar';

// Import CodeMirror (nhẹ hơn Monaco)
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { python } from '@codemirror/lang-python';

const ProblemDetail = () => {
  const { competitionId, problemId } = useParams();
  const navigate = useNavigate();
  const [competitionData, setCompetitionData] = useState(null);
  const [problem, setProblem] = useState(null);
  const [problemList, setProblemList] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('cpp');
  const [tabActive, setTabActive] = useState('problem');
  const [results, setResults] = useState(null);
  const [viewingSubmission, setViewingSubmission] = useState(null);
  
  const isViewingSubmission = viewingSubmission !== null;
  const editorHeight = results ? '500px' : '700px';

  // Language options
  const languages = [
    { id: 'cpp', name: 'C++', extension: 'cpp' },
    { id: 'c', name: 'C', extension: 'c' },
    { id: 'java', name: 'Java', extension: 'java' },
    { id: 'python', name: 'Python', extension: 'py' },
    { id: 'javascript', name: 'JavaScript', extension: 'js' },
  ];

  // Language-specific starter code
  const starterCodes = {
    cpp: `#include <iostream>
using namespace std;

int main() {
    // Viết code của bạn tại đây
    
    return 0;
}`,
    c: `#include <stdio.h>

int main() {
    // Viết code của bạn tại đây
    
    return 0;
}`,
    java: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        // Viết code của bạn tại đây
    }
}`,
    python: `# Viết code của bạn tại đây
`,
    javascript: `// Viết code của bạn tại đây
`
  };

  // Get CodeMirror language extension
  const getLanguageExtension = (lang) => {
    switch (lang) {
      case 'cpp':
      case 'c':
        return cpp();
      case 'java':
        return java();
      case 'python':
        return python();
      case 'javascript':
        return javascript();
      default:
        return cpp();
    }
  };

  // Normalize data from BE (UPPERCASE) to FE (lowercase)
  const normalizeProblemData = (problemData) => {
    if (!problemData) return null;
    
    return {
      // Problem details
      title: problemData.Title || problemData.title || 'Không có tiêu đề',
      description: problemData.Description || problemData.description || '',
      difficulty: problemData.Difficulty || problemData.difficulty || 'Trung bình',
      points: problemData.Points || problemData.points || 0,
      inputFormat: problemData.InputFormat || problemData.inputFormat || '',
      outputFormat: problemData.OutputFormat || problemData.outputFormat || '',
      constraints: problemData.Constraints || problemData.constraints || '',
      sampleInput: problemData.SampleInput || problemData.sampleInput || '',
      sampleOutput: problemData.SampleOutput || problemData.sampleOutput || '',
      explanation: problemData.Explanation || problemData.explanation || '',
      starterCode: problemData.StarterCode || problemData.starterCode || '',
      timeLimit: problemData.TimeLimit || problemData.timeLimit || 1,
      memoryLimit: problemData.MemoryLimit || problemData.memoryLimit || 256,
      
      // Handle test cases
      testCasesVisible: (() => {
        try {
          const testCases = problemData.TestCasesVisible || problemData.testCasesVisible;
          if (!testCases) return [];
          if (typeof testCases === 'string') {
            return JSON.parse(testCases);
          }
          return Array.isArray(testCases) ? testCases : [];
        } catch (error) {
          console.error('Lỗi phân tích test cases:', error);
          return [];
        }
      })()
    };
  };

  const normalizeSubmissionData = (submissionData) => {
    if (!submissionData) return null;
    
    return {
      submissionID: submissionData.SubmissionID || submissionData.submissionID,
      status: submissionData.Status || submissionData.status || 'pending',
      score: submissionData.Score || submissionData.score || 0,
      language: submissionData.Language || submissionData.language || 'cpp',
      executionTime: submissionData.ExecutionTime || submissionData.executionTime,
      memoryUsed: submissionData.MemoryUsed || submissionData.memoryUsed,
      submittedAt: submissionData.SubmittedAt || submissionData.submittedAt,
      errorMessage: submissionData.ErrorMessage || submissionData.errorMessage,
      sourceCode: submissionData.SourceCode || submissionData.sourceCode,
      userName: submissionData.UserName || submissionData.userName,
      userImage: submissionData.UserImage || submissionData.userImage
    };
  };

  // Fetch competition details for problem list and data
  useEffect(() => {
    const fetchCompetitionDetails = async () => {
      try {
        console.log('🔄 Fetching competition details...');
        const response = await getCompetitionDetails(competitionId);
        
        if (response.success && response.data && response.data.problems) {
          setProblemList(response.data.problems);
          setCompetitionData(response.data);
          console.log('✅ Competition details loaded:', response.data.problems.length, 'problems');
        } else {
          console.error('❌ Không thể tải danh sách bài tập:', response);
        }
      } catch (err) {
        console.error('❌ Lỗi khi tải chi tiết cuộc thi:', err);
      }
    };

    fetchCompetitionDetails();
  }, [competitionId]);

  // Determine if competition has ended
  const isCompetitionEnded = competitionData && new Date() > new Date(competitionData.endTime);

  // Fetch problem details
  useEffect(() => {
    const fetchProblemDetails = async () => {
      try {
        setLoading(true);
        console.log('🔄 Fetching problem details...');
        
        const response = await getProblemDetails(competitionId, problemId);
        console.log('📥 Problem API response:', response);
        
        // Handle different error types
        if (!response.success) {
          if (response.isAuthError) {
            toast.error('Vui lòng đăng nhập để xem chi tiết bài tập');
            navigate('/login', { state: { from: `/competitions/${competitionId}/problems/${problemId}` } });
            return;
          }
          
          if (response.isPermissionError) {
            toast.error(response.message || 'Bạn không có quyền xem bài tập này');
            return;
          }
          
          if (response.isServerError) {
            toast.error(response.message || 'Lỗi máy chủ xảy ra');
            return;
          }
          
          toast.error(response.message || 'Không thể tải chi tiết bài tập');
          return;
        }
        
        // Normalize problem data
        const normalizedProblem = normalizeProblemData(response.data);
        console.log('✅ Normalized problem:', normalizedProblem);
        setProblem(normalizedProblem);
        
        // Normalize submissions data
        const submissionsData = response.userSubmissions || [];
        const normalizedSubmissions = submissionsData.map(normalizeSubmissionData).filter(Boolean);
        console.log('✅ Normalized submissions:', normalizedSubmissions);
        setSubmissions(normalizedSubmissions);
        
        // Set initial code
        if (normalizedProblem.starterCode) {
          setCode(normalizedProblem.starterCode);
        } else {
          setCode(starterCodes[language]);
        }
        
      } catch (err) {
        console.error('❌ Lỗi khi tải chi tiết bài tập:', err);
        toast.error('Đã xảy ra lỗi khi tải chi tiết bài tập');
      } finally {
        setLoading(false);
      }
    };

    fetchProblemDetails();
  }, [competitionId, problemId, language, navigate]);

  // Handle language change
  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value;
    setLanguage(newLanguage);
    
    if (!code || code === starterCodes[language]) {
      setCode(starterCodes[newLanguage]);
    }
  };

  // Submit solution
  const handleSubmit = async () => {
    if (!code.trim()) {
      toast.warning('Vui lòng viết code trước khi nộp bài');
      return;
    }

    try {
      setSubmitting(true);
      setResults(null);
      
      console.log('🔄 Submitting solution...');
      let response = await submitSolution(competitionId, problemId, code, language);
      
      // If backend indicates competition hasn't started, attempt to start automatically then retry ONCE
      if (!response.success && response.message && response.message.toLowerCase().includes('not started')) {
        console.warn('Detected "not started" error, attempting to start competition automatically...');
        const startRes = await startCompetition(competitionId);
        if (startRes.success) {
          console.log('Competition started programmatically. Retrying submission...');
          response = await submitSolution(competitionId, problemId, code, language);
        } else {
          toast.error(startRes.message || 'Không thể bắt đầu cuộc thi.');
          setSubmitting(false);
          return;
        }
      }
      
      if (response.success) {
        toast.success('Nộp bài thành công');
        
        // Polling for submission results
        let attempts = 0;
        const maxAttempts = 10;
        const pollingInterval = 2000;
        
        const checkSubmissionStatus = async () => {
          try {
            attempts++;
            console.log(`🔄 Kiểm tra trạng thái bài nộp (lần ${attempts}/${maxAttempts})...`);
            
            const problemData = await getProblemDetails(competitionId, problemId);
            
            if (!problemData.success) {
              toast.error(problemData.message || 'Không thể kiểm tra trạng thái bài nộp');
              setSubmitting(false);
              return;
            }
            
            // Normalize submissions data
            const submissionsData = problemData.userSubmissions || [];
            const normalizedSubmissions = submissionsData.map(normalizeSubmissionData).filter(Boolean);
            
            // Find the latest submission
            const latestSubmission = normalizedSubmissions[0];
            
            if (!latestSubmission) {
              console.error('Không tìm thấy bài nộp nào sau khi gửi code');
              setSubmitting(false);
              return;
            }
            
            console.log('📊 Trạng thái bài nộp mới nhất:', latestSubmission.status);
            const submissionStatus = latestSubmission.status.toLowerCase();
            
            // Update UI with the latest submission
            setSubmissions(normalizedSubmissions);
            
            // If still pending/running and we haven't exceeded max attempts, poll again
            if (['pending', 'running', 'compiling'].includes(submissionStatus) && attempts < maxAttempts) {
              setTimeout(checkSubmissionStatus, pollingInterval);
            } else {
              // Final status update
              setSubmitting(false);
              
              // Handle the final submission status
              const statusMessages = {
                'accepted': 'Bài làm được chấm nhận! 🎉',
                'wrong_answer': 'Sai đáp án. Hãy thử lại!',
                'compilation_error': 'Lỗi biên dịch. Kiểm tra cú pháp code của bạn.',
                'runtime_error': 'Lỗi thực thi. Kiểm tra logic code của bạn.',
                'time_limit_exceeded': 'Quá thời gian giới hạn. Hãy tối ưu giải pháp của bạn.',
                'memory_limit_exceeded': 'Quá bộ nhớ giới hạn. Hãy tối ưu giải pháp của bạn.'
              };
              
              toast[submissionStatus === 'accepted' ? 'success' : 'error'](
                statusMessages[submissionStatus] || 'Đã xảy ra lỗi khi chấm bài của bạn.'
              );
              
              // Display detailed results
              setResults({
                status: submissionStatus,
                message: latestSubmission.errorMessage || null,
                score: latestSubmission.score || 0,
                executionTime: latestSubmission.executionTime,
                memoryUsed: latestSubmission.memoryUsed
              });
            }
          } catch (error) {
            console.error('❌ Lỗi khi kiểm tra trạng thái bài nộp:', error);
            setSubmitting(false);
            toast.error('Không thể kiểm tra trạng thái bài nộp');
          }
        };
        
        // Start polling
        setTimeout(checkSubmissionStatus, 1000);
      } else {
        toast.error(response.message || 'Nộp bài không thành công');
        setSubmitting(false);
      }
    } catch (error) {
      console.error('❌ Lỗi khi nộp code:', error);
      toast.error(error.response?.data?.message || 'Lỗi khi nộp code');
      setSubmitting(false);
    }
  };

  // View a specific submission
  const handleViewSubmission = async (submissionId) => {
    try {
      console.log('🔄 Fetching submission details...');
      const response = await getSubmissionDetails(submissionId);
      
      if (response.success) {
        const normalizedSubmission = normalizeSubmissionData(response.data);
        setViewingSubmission(normalizedSubmission);
        setTabActive('submissions');
        console.log('✅ Submission details loaded:', normalizedSubmission);
      } else {
        toast.error('Không thể tải chi tiết bài nộp');
      }
    } catch (err) {
      console.error('❌ Lỗi khi tải chi tiết bài nộp:', err);
      toast.error('Lỗi khi tải chi tiết bài nộp');
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'accepted': { color: 'green', text: 'Đạt' },
      'wrong_answer': { color: 'red', text: 'Sai đáp án' },
      'compilation_error': { color: 'yellow', text: 'Lỗi biên dịch' },
      'runtime_error': { color: 'orange', text: 'Lỗi thực thi' },
      'time_limit_exceeded': { color: 'purple', text: 'Quá thời gian' },
      'memory_limit_exceeded': { color: 'indigo', text: 'Quá bộ nhớ' },
      'pending': { color: 'blue', text: 'Đang chờ' },
      'running': { color: 'blue', text: 'Đang chạy' },
      'compiling': { color: 'blue', text: 'Đang biên dịch' }
    };
    
    const config = statusConfig[status] || { color: 'gray', text: status };
    
    if (['pending', 'running', 'compiling'].includes(status)) {
      return (
        <span className={`px-2 py-1 text-xs font-medium rounded-full bg-${config.color}-100 text-${config.color}-800 flex items-center`}>
          <svg className="w-3 h-3 mr-1 animate-spin" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {config.text}
        </span>
      );
    }
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full bg-${config.color}-100 text-${config.color}-800`}>
        {config.text}
      </span>
    );
  };

  const formatDateTime = (dateTime) => {
    try {
      if (!dateTime) return '-';
      return format(new Date(dateTime), 'HH:mm:ss dd/MM/yyyy');
    } catch (error) {
      return 'Ngày không hợp lệ';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center py-32">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
        <div className="text-center text-gray-500">Đang tải bài tập...</div>
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 text-red-700 p-4 rounded-md">
          Không tìm thấy bài tập
        </div>
        <div className="mt-4">
          <Link to={`/competitions/${competitionId}`} className="text-blue-600 hover:text-blue-800">
            ← Quay lại cuộc thi
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-4">
        <Link to={`/competitions/${competitionId}`} className="text-blue-600 hover:text-blue-800">
          ← Quay lại cuộc thi
        </Link>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Problem description */}
        <div className="lg:col-span-4 bg-white rounded-lg shadow-md overflow-hidden">
          <div className="flex border-b">
            <button
              className={`flex-1 py-3 px-4 text-center ${
                tabActive === 'problem'
                  ? 'border-b-2 border-blue-500 font-medium text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              onClick={() => setTabActive('problem')}
            >
              Đề bài
            </button>
            <button
              className={`flex-1 py-3 px-4 text-center ${
                tabActive === 'submissions'
                  ? 'border-b-2 border-blue-500 font-medium text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              onClick={() => setTabActive('submissions')}
            >
              Bài nộp
            </button>
          </div>
          
          <div className="p-4 overflow-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
            {tabActive === 'problem' ? (
              <>
                <div className="flex justify-between items-start mb-4">
                  <h1 className="text-2xl font-bold">{problem.title}</h1>
                  <div className="flex items-center">
                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                      (problem.difficulty === 'Dễ' || problem.difficulty === 'Easy') ? 'bg-green-100 text-green-800' : 
                      (problem.difficulty === 'Trung bình' || problem.difficulty === 'Medium') ? 'bg-yellow-100 text-yellow-800' : 
                      'bg-red-100 text-red-800'
                    }`}>
                      {problem.difficulty}
                    </span>
                    <span className="ml-2 text-sm text-gray-500">{problem.points} điểm</span>
                  </div>
                </div>
                
                {/* Problem list navigation */}
                <div className="mb-6 border-b pb-4">
                  <h3 className="text-md font-semibold mb-2">Danh sách bài tập</h3>
                  <div className="flex flex-wrap gap-2">
                    {problemList && problemList.map((p) => (
                      <button
                        key={p.problemID}
                        onClick={() => p.problemID !== parseInt(problemId) && navigate(`/competitions/${competitionId}/problems/${p.problemID}`)}
                        className={`px-3 py-1 text-sm rounded-full ${
                          p.problemID === parseInt(problemId)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                      >
                        {p.title}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="prose max-w-none">
                  <div className="mb-6">
                    <p>{problem.description}</p>
                  </div>
                  
                  {problem.inputFormat && (
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold mb-2">Định dạng đầu vào</h3>
                      <p>{problem.inputFormat}</p>
                    </div>
                  )}
                  
                  {problem.outputFormat && (
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold mb-2">Định dạng đầu ra</h3>
                      <p>{problem.outputFormat}</p>
                    </div>
                  )}
                  
                  {problem.constraints && (
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold mb-2">Ràng buộc</h3>
                      <p>{problem.constraints}</p>
                    </div>
                  )}
                  
                  {(problem.sampleInput || problem.sampleOutput) && (
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold mb-2">Ví dụ</h3>
                      <div className="grid grid-cols-1 gap-4">
                        {problem.sampleInput && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">Đầu vào mẫu</h4>
                            <pre className="bg-gray-50 p-3 rounded-md text-sm overflow-x-auto">{problem.sampleInput}</pre>
                          </div>
                        )}
                        
                        {problem.sampleOutput && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">Đầu ra mẫu</h4>
                            <pre className="bg-gray-50 p-3 rounded-md text-sm overflow-x-auto">{problem.sampleOutput}</pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {problem.explanation && (
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold mb-2">Giải thích</h3>
                      <p>{problem.explanation}</p>
                    </div>
                  )}
                  
                  {problem.testCasesVisible && problem.testCasesVisible.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold mb-2">Test Case</h3>
                      <div className="space-y-4">
                        {problem.testCasesVisible.map((testCase, index) => (
                          <div key={index} className="border rounded-md p-4">
                            <div className="grid grid-cols-1 gap-4">
                              <div>
                                <h4 className="text-sm font-medium mb-2">Đầu vào</h4>
                                <pre className="bg-gray-50 p-3 rounded-md text-sm overflow-x-auto">{testCase.input}</pre>
                              </div>
                              <div>
                                <h4 className="text-sm font-medium mb-2">Đầu ra mong đợi</h4>
                                <pre className="bg-gray-50 p-3 rounded-md text-sm overflow-x-auto">{testCase.output}</pre>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold mb-4">Bài nộp của bạn</h2>
                
                {viewingSubmission ? (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center">
                        <Avatar 
                          src={viewingSubmission.userImage} 
                          alt={viewingSubmission.userName || "Người dùng"} 
                          name={viewingSubmission.userName || "Người dùng"}
                          size="small" 
                          className="mr-3" 
                        />
                        <h3 className="text-lg font-semibold">Bài nộp #{viewingSubmission.submissionID}</h3>
                      </div>
                      <button 
                        onClick={() => setViewingSubmission(null)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Quay lại danh sách
                      </button>
                    </div>
                    
                    <div className="mb-4 grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm text-gray-500">Trạng thái:</span>
                        <div className="mt-1">{getStatusBadge(viewingSubmission.status)}</div>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Điểm:</span>
                        <div className="mt-1 font-medium">{viewingSubmission.score} điểm</div>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Thời gian:</span>
                        <div className="mt-1">{viewingSubmission.executionTime ? `${viewingSubmission.executionTime} giây` : '-'}</div>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Bộ nhớ:</span>
                        <div className="mt-1">{viewingSubmission.memoryUsed ? `${viewingSubmission.memoryUsed} KB` : '-'}</div>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Ngôn ngữ:</span>
                        <div className="mt-1">{viewingSubmission.language}</div>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Thời gian nộp:</span>
                        <div className="mt-1">{formatDateTime(viewingSubmission.submittedAt)}</div>
                      </div>
                    </div>
                    
                    {viewingSubmission.errorMessage && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-red-600 mb-2">Lỗi:</h4>
                        <pre className="bg-red-50 p-3 rounded-md text-sm overflow-x-auto whitespace-pre-wrap text-red-700">
                          {viewingSubmission.errorMessage}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : submissions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Chưa có bài nộp</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            ID
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Trạng thái
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Điểm
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Ngôn ngữ
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Thời gian
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Bộ nhớ
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Đã nộp
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {submissions.map((submission) => (
                          <tr key={submission.submissionID} 
                              className="hover:bg-gray-50 cursor-pointer" 
                              onClick={() => handleViewSubmission(submission.submissionID)}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              <div className="flex items-center">
                                <Avatar 
                                  src={submission.userImage} 
                                  alt={submission.userName || "Người dùng"} 
                                  name={submission.userName || "Người dùng"}
                                  size="small" 
                                  className="mr-2" 
                                />
                                {submission.submissionID}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {getStatusBadge(submission.status)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {submission.score}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {submission.language}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {submission.executionTime ? `${submission.executionTime} s` : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {submission.memoryUsed ? `${submission.memoryUsed} KB` : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDateTime(submission.submittedAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        
        {/* Code editor với CodeMirror */}
        <div className="lg:col-span-8 bg-white rounded-lg shadow-md overflow-hidden">
          <div className="border-b px-4 py-3 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <label htmlFor="language" className="text-sm font-medium text-gray-700">Ngôn ngữ:</label>
              <select
                id="language"
                value={isViewingSubmission ? viewingSubmission.language : language}
                onChange={handleLanguageChange}
                disabled={isViewingSubmission || isCompetitionEnded}
                className="block w-32 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                {languages.map((lang) => (
                  <option key={lang.id} value={lang.id}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>
            
            <button
              onClick={handleSubmit}
              disabled={submitting || isViewingSubmission || isCompetitionEnded}
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${
                submitting
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {submitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Đang nộp...
                </>
              ) : (
                'Nộp bài'
              )}
            </button>
          </div>
          
          <div className="border-b">
            <CodeMirror
              value={isViewingSubmission ? viewingSubmission.sourceCode : code}
              height={editorHeight}
              extensions={[getLanguageExtension(isViewingSubmission ? viewingSubmission.language : language)]}
              onChange={isViewingSubmission || isCompetitionEnded ? undefined : setCode}
              readOnly={isViewingSubmission || isCompetitionEnded}
              theme="light"
              basicSetup={{
                lineNumbers: true,
                highlightActiveLine: true,
                highlightSelectionMatches: true,
                indentOnInput: true,
                syntaxHighlighting: true,
                bracketMatching: true,
                autocompletion: true,
                foldGutter: true,
                dropCursor: true,
                allowMultipleSelections: true,
                indentUnit: 4,
                tabSize: 4,
              }}
              style={{
                fontSize: '14px',
                fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace'
              }}
            />
          </div>
          
          {/* Results */}
          {results && (
            <div className="p-4" style={{ marginTop: '-10px' }}>
              <h3 className="text-lg font-semibold mb-2">Kết quả</h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <span className="text-sm font-medium mr-2">Trạng thái:</span>
                  {getStatusBadge(results.status)}
                </div>
                
                <div className="flex items-center">
                  <span className="text-sm font-medium mr-2">Điểm:</span>
                  <span className="text-sm font-medium">{results.score} / {problem.points}</span>
                </div>
                
                {results.executionTime && (
                  <div>
                    <span className="text-sm font-medium mr-2">Thời gian thực thi:</span>
                    <span className="text-sm">{results.executionTime} giây</span>
                  </div>
                )}
                
                {results.memoryUsed && (
                  <div>
                    <span className="text-sm font-medium mr-2">Bộ nhớ sử dụng:</span>
                    <span className="text-sm">{results.memoryUsed} KB</span>
                  </div>
                )}
                
                {results.message && (
                  <div>
                    <span className="text-sm font-medium text-red-600 mb-1 block">Lỗi:</span>
                    <pre className="bg-red-50 p-3 rounded-md text-sm overflow-x-auto whitespace-pre-wrap text-red-700">
                      {results.message}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProblemDetail;