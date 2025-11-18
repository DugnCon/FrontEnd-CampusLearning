/*-----------------------------------------------------------------
* File: ProblemForm.jsx (COMPLETE VERSION)
* Author: Quyen Nguyen Duc
* Date: 2025-07-24  
* Description: Complete version with Test Cases for Judge0 integration
* Apache 2.0 License - Copyright 2025 Quyen Nguyen Duc
-----------------------------------------------------------------*/
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Form, Input, InputNumber, Select, Button, Card, Typography,
  Space, Divider, message, Row, Col, Upload, Spin, Collapse,
  Table, Tag, Modal
} from 'antd';
import {
  ArrowLeftOutlined, SaveOutlined, UploadOutlined,
  CodeOutlined, FileTextOutlined, ReloadOutlined,
  PlusOutlined, DeleteOutlined, EyeOutlined, EyeInvisibleOutlined
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import MainCard from '../../components/MainCard';
import { competitionsAPI } from '../../api/competitions';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { Panel } = Collapse;

// Debug flag - set to true to see debug information
const DEBUG = false;

const ProblemForm = () => {
  const navigate = useNavigate();
  const { id: competitionId, problemId } = useParams();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [currentProblem, setCurrentProblem] = useState(null);
  const [testCasesVisible, setTestCasesVisible] = useState([]);
  const [testCasesHidden, setTestCasesHidden] = useState([]);
  const [isTestCasesModalVisible, setIsTestCasesModalVisible] = useState(false);
  const [editingTestCase, setEditingTestCase] = useState(null);
  const [editingTestCaseType, setEditingTestCaseType] = useState('visible');

  const initialValues = {
    title: '',
    description: '',
    difficulty: 'Trung bình',
    points: 100,
    timeLimit: 1,
    memoryLimit: 256,
    inputFormat: '',
    outputFormat: '',
    constraints: '',
    sampleInput: '',
    sampleOutput: '',
    explanation: '',
    tags: '',
    starterCode: '',
    instructions: '',
    imageURL: '',
    testCasesVisible: '[]',
    testCasesHidden: '[]'
  };

  const isEditMode = !!problemId;

  useEffect(() => {
    if (isEditMode) {
      fetchProblemData();
    } else {
      form.resetFields();
      setTestCasesVisible([]);
      setTestCasesHidden([]);
    }
  }, [competitionId, problemId, form]);

  const fetchProblemData = async () => {
    try {
      setDataLoading(true);
      const response = await competitionsAPI.getProblem(competitionId, problemId);
      
      if (DEBUG) {
        console.log('Problem API response:', response);
      }
      
      if (response && response.problem) {
        const problem = response.problem;
        setCurrentProblem(problem);
        
        // Parse test cases
        try {
          const visibleCases = problem.testCasesVisible ? JSON.parse(problem.testCasesVisible) : [];
          const hiddenCases = problem.testCasesHidden ? JSON.parse(problem.testCasesHidden) : [];
          setTestCasesVisible(Array.isArray(visibleCases) ? visibleCases : []);
          setTestCasesHidden(Array.isArray(hiddenCases) ? hiddenCases : []);
        } catch (error) {
          console.error('Error parsing test cases:', error);
          setTestCasesVisible([]);
          setTestCasesHidden([]);
        }
        
        const formData = {
          ...initialValues,
          title: problem.title || '',
          description: problem.description || '',
          difficulty: problem.difficulty || 'Trung bình',
          points: problem.points || 100,
          timeLimit: problem.timeLimit || 1,
          memoryLimit: problem.memoryLimit || 256,
          inputFormat: problem.inputFormat || '',
          outputFormat: problem.outputFormat || '',
          constraints: problem.constraints || '',
          sampleInput: problem.sampleInput || '',
          sampleOutput: problem.sampleOutput || '',
          explanation: problem.explanation || '',
          tags: problem.tags || '',
          starterCode: problem.starterCode || '',
          instructions: problem.instructions || '',
          imageURL: problem.imageURL || ''
        };
        
        setTimeout(() => {
          form.setFieldsValue(formData);
        }, 100);
      } else {
        message.error('Không tìm thấy thông tin bài tập');
        navigate(`/competitions/${competitionId}`);
      }
    } catch (error) {
      console.error('Error fetching problem data:', error);
      message.error('Không thể tải thông tin bài tập');
    } finally {
      setDataLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      // Prepare test cases data
      const submitData = {
        ...values,
        testCasesVisible: JSON.stringify(testCasesVisible),
        testCasesHidden: JSON.stringify(testCasesHidden)
      };

      if (DEBUG) {
        console.log('Submitting data:', submitData);
        console.log('Visible test cases:', testCasesVisible);
        console.log('Hidden test cases:', testCasesHidden);
      }

      if (isEditMode) {
        await competitionsAPI.updateProblem(competitionId, problemId, submitData);
        message.success('Cập nhật bài tập thành công');
      } else {
        await competitionsAPI.createProblem(competitionId, submitData);
        message.success('Tạo bài tập mới thành công');
      }
      navigate(`/competitions/${competitionId}`);
    } catch (error) {
      console.error('Form submission error:', error);
      message.error(isEditMode ? 'Cập nhật bài tập thất bại' : 'Tạo bài tập mới thất bại');
    } finally {
      setLoading(false);
    }
  };

  // Test Cases Management
  const showAddTestCaseModal = (type = 'visible') => {
    setEditingTestCase(null);
    setEditingTestCaseType(type);
    setIsTestCasesModalVisible(true);
  };

  const showEditTestCaseModal = (testCase, index, type) => {
    setEditingTestCase({ ...testCase, index });
    setEditingTestCaseType(type);
    setIsTestCasesModalVisible(true);
  };

  const handleAddTestCase = (values) => {
    const newTestCase = {
      input: values.input,
      output: values.output,
      explanation: values.explanation || ''
    };

    if (editingTestCase) {
      // Edit existing test case
      const targetArray = editingTestCaseType === 'visible' ? testCasesVisible : testCasesHidden;
      const newArray = [...targetArray];
      newArray[editingTestCase.index] = newTestCase;
      
      if (editingTestCaseType === 'visible') {
        setTestCasesVisible(newArray);
      } else {
        setTestCasesHidden(newArray);
      }
      message.success('Cập nhật test case thành công');
    } else {
      // Add new test case
      if (editingTestCaseType === 'visible') {
        setTestCasesVisible([...testCasesVisible, newTestCase]);
      } else {
        setTestCasesHidden([...testCasesHidden, newTestCase]);
      }
      message.success('Thêm test case thành công');
    }

    setIsTestCasesModalVisible(false);
    setEditingTestCase(null);
  };

  const handleDeleteTestCase = (index, type) => {
    if (type === 'visible') {
      const newVisibleCases = testCasesVisible.filter((_, i) => i !== index);
      setTestCasesVisible(newVisibleCases);
    } else {
      const newHiddenCases = testCasesHidden.filter((_, i) => i !== index);
      setTestCasesHidden(newHiddenCases);
    }
    message.success('Xóa test case thành công');
  };

  const testCaseColumns = (type) => [
    {
      title: 'Input',
      dataIndex: 'input',
      key: 'input',
      render: (text) => (
        <pre style={{ margin: 0, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {text}
        </pre>
      ),
    },
    {
      title: 'Output',
      dataIndex: 'output',
      key: 'output',
      render: (text) => (
        <pre style={{ margin: 0, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {text}
        </pre>
      ),
    },
    {
      title: 'Giải thích',
      dataIndex: 'explanation',
      key: 'explanation',
      render: (text) => text || '-',
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_, record, index) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => showEditTestCaseModal(record, index, type)}
          >
            Sửa
          </Button>
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteTestCase(index, type)}
          >
            Xóa
          </Button>
        </Space>
      ),
    },
  ];

  const togglePreview = () => {
    setPreviewMode(!previewMode);
  };

  const uploadProps = {
    name: 'image',
    action: `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:8081'}/api/upload`,
    headers: {
      authorization: `Bearer ${localStorage.getItem('token') || localStorage.getItem('admin_token')}`,
    },
    onChange(info) {
      if (info.file.status === 'done') {
        const imageUrl = info.file.response.url || info.file.response.data?.url;
        message.success(`${info.file.name} tải lên thành công`);
        form.setFieldsValue({ 
          imageURL: imageUrl 
        });
      } else if (info.file.status === 'error') {
        message.error(`${info.file.name} tải lên thất bại`);
      }
    },
  };

  if (isEditMode && dataLoading) {
    return (
      <MainCard
        title={
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate(`/competitions/${competitionId}`)}
            />
            Đang tải thông tin bài tập
          </Space>
        }
      >
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
          <p style={{ marginTop: '16px' }}>Đang tải thông tin bài tập...</p>
        </div>
      </MainCard>
    );
  }

  return (
    <MainCard
      title={
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(`/competitions/${competitionId}`)}
          />
          {isEditMode ? 'Chỉnh sửa bài tập' : 'Thêm bài tập mới'}
        </Space>
      }
      extra={
        <Space>
          {isEditMode && (
            <Button 
              icon={<ReloadOutlined />} 
              onClick={fetchProblemData}
              loading={dataLoading}
            >
              Tải lại
            </Button>
          )}
          <Button onClick={togglePreview}>
            {previewMode ? 'Chỉnh sửa' : 'Xem trước'}
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={loading}
            onClick={() => form.submit()}
          >
            Lưu
          </Button>
        </Space>
      }
    >
      {/* Test Cases Modal */}
      <Modal
        title={editingTestCase ? 'Sửa Test Case' : 'Thêm Test Case Mới'}
        open={isTestCasesModalVisible}
        onCancel={() => {
          setIsTestCasesModalVisible(false);
          setEditingTestCase(null);
        }}
        footer={null}
        width={700}
      >
        <Form
          layout="vertical"
          initialValues={editingTestCase || {}}
          onFinish={handleAddTestCase}
        >
          <Form.Item
            name="input"
            label="Đầu vào"
            rules={[{ required: true, message: 'Vui lòng nhập đầu vào' }]}
          >
            <TextArea
              rows={4}
              placeholder="Nhập đầu vào test case"
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>

          <Form.Item
            name="output"
            label="Đầu ra mong đợi"
            rules={[{ required: true, message: 'Vui lòng nhập đầu ra mong đợi' }]}
          >
            <TextArea
              rows={4}
              placeholder="Nhập đầu ra mong đợi"
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>

          <Form.Item
            name="explanation"
            label="Giải thích (tuỳ chọn)"
          >
            <Input placeholder="Nhập giải thích cho test case này" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingTestCase ? 'Cập nhật' : 'Thêm'}
              </Button>
              <Button onClick={() => {
                setIsTestCasesModalVisible(false);
                setEditingTestCase(null);
              }}>
                Hủy
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {previewMode ? (
        <Card>
          <Title level={3}>{form.getFieldValue('title')}</Title>
          <Space wrap style={{ marginBottom: 16 }}>
            <Text type="secondary">Độ khó: {form.getFieldValue('difficulty')}</Text>
            <Text type="secondary">Điểm: {form.getFieldValue('points')}</Text>
            <Text type="secondary">Thời gian: {form.getFieldValue('timeLimit')} giây</Text>
            <Text type="secondary">Bộ nhớ: {form.getFieldValue('memoryLimit')} MB</Text>
          </Space>

          <Divider orientation="left">Mô tả</Divider>
          <ReactMarkdown>{form.getFieldValue('description')}</ReactMarkdown>

          <Divider orientation="left">Định dạng đầu vào</Divider>
          <ReactMarkdown>{form.getFieldValue('inputFormat')}</ReactMarkdown>

          <Divider orientation="left">Định dạng đầu ra</Divider>
          <ReactMarkdown>{form.getFieldValue('outputFormat')}</ReactMarkdown>

          <Divider orientation="left">Ràng buộc</Divider>
          <ReactMarkdown>{form.getFieldValue('constraints')}</ReactMarkdown>

          <Divider orientation="left">Ví dụ</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Card title="Đầu vào" bordered>
                <pre>{form.getFieldValue('sampleInput')}</pre>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="Đầu ra" bordered>
                <pre>{form.getFieldValue('sampleOutput')}</pre>
              </Card>
            </Col>
          </Row>

          {form.getFieldValue('explanation') && (
            <>
              <Divider orientation="left">Giải thích</Divider>
              <ReactMarkdown>{form.getFieldValue('explanation')}</ReactMarkdown>
            </>
          )}

          {form.getFieldValue('starterCode') && (
            <>
              <Divider orientation="left">Mã khởi tạo</Divider>
              <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 4 }}>
                {form.getFieldValue('starterCode')}
              </pre>
            </>
          )}

          {/* Test Cases Preview */}
          {(testCasesVisible.length > 0 || testCasesHidden.length > 0) && (
            <>
              <Divider orientation="left">Test Cases</Divider>
              <Text type="secondary">
                Có {testCasesVisible.length} test case hiển thị và {testCasesHidden.length} test case ẩn
              </Text>
            </>
          )}
        </Card>
      ) : (
        <Form
          form={form}
          layout="vertical"
          initialValues={initialValues}
          onFinish={handleSubmit}
        >
          <Row gutter={16}>
            <Col xs={24} md={16}>
              <Card title="Thông tin bài tập" style={{ marginBottom: 16 }}>
                <Form.Item
                  name="title"
                  label="Tiêu đề"
                  rules={[{ required: true, message: 'Vui lòng nhập tiêu đề bài tập' }]}
                >
                  <Input placeholder="Nhập tiêu đề bài tập" />
                </Form.Item>

                <Form.Item
                  name="description"
                  label="Mô tả"
                  rules={[{ required: true, message: 'Vui lòng nhập mô tả bài tập' }]}
                >
                  <TextArea
                    placeholder="Nhập mô tả bài tập (hỗ trợ Markdown)"
                    autoSize={{ minRows: 4, maxRows: 8 }}
                  />
                </Form.Item>

                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      name="difficulty"
                      label="Độ khó"
                      rules={[{ required: true, message: 'Vui lòng chọn độ khó' }]}
                    >
                      <Select placeholder="Chọn độ khó">
                        <Option value="Dễ">Dễ</Option>
                        <Option value="Trung bình">Trung bình</Option>
                        <Option value="Khó">Khó</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name="points"
                      label="Điểm"
                      rules={[{ required: true, message: 'Vui lòng nhập điểm' }]}
                    >
                      <InputNumber
                        min={1}
                        max={1000}
                        style={{ width: '100%' }}
                        placeholder="Nhập điểm"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name="tags"
                      label="Thẻ"
                    >
                      <Input placeholder="Nhập thẻ (phân cách bằng dấu phẩy)" />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="timeLimit"
                      label="Giới hạn thời gian (giây)"
                      rules={[{ required: true, message: 'Vui lòng nhập giới hạn thời gian' }]}
                    >
                      <InputNumber
                        min={0.1}
                        max={10}
                        step={0.1}
                        style={{ width: '100%' }}
                        placeholder="Nhập giới hạn thời gian"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="memoryLimit"
                      label="Giới hạn bộ nhớ (MB)"
                      rules={[{ required: true, message: 'Vui lòng nhập giới hạn bộ nhớ' }]}
                    >
                      <InputNumber
                        min={16}
                        max={1024}
                        style={{ width: '100%' }}
                        placeholder="Nhập giới hạn bộ nhớ"
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  name="inputFormat"
                  label="Định dạng đầu vào"
                  rules={[{ required: true, message: 'Vui lòng nhập định dạng đầu vào' }]}
                >
                  <TextArea
                    placeholder="Nhập định dạng đầu vào (hỗ trợ Markdown)"
                    autoSize={{ minRows: 3, maxRows: 5 }}
                  />
                </Form.Item>

                <Form.Item
                  name="outputFormat"
                  label="Định dạng đầu ra"
                  rules={[{ required: true, message: 'Vui lòng nhập định dạng đầu ra' }]}
                >
                  <TextArea
                    placeholder="Nhập định dạng đầu ra (hỗ trợ Markdown)"
                    autoSize={{ minRows: 3, maxRows: 5 }}
                  />
                </Form.Item>

                <Form.Item
                  name="constraints"
                  label="Ràng buộc"
                  rules={[{ required: true, message: 'Vui lòng nhập ràng buộc' }]}
                >
                  <TextArea
                    placeholder="Nhập ràng buộc (hỗ trợ Markdown)"
                    autoSize={{ minRows: 3, maxRows: 5 }}
                  />
                </Form.Item>
              </Card>

              <Card title="Ví dụ" style={{ marginBottom: 16 }}>
                <Form.Item
                  name="sampleInput"
                  label="Đầu vào mẫu"
                  rules={[{ required: true, message: 'Vui lòng nhập đầu vào mẫu' }]}
                >
                  <TextArea
                    placeholder="Nhập đầu vào mẫu"
                    autoSize={{ minRows: 3, maxRows: 5 }}
                  />
                </Form.Item>

                <Form.Item
                  name="sampleOutput"
                  label="Đầu ra mẫu"
                  rules={[{ required: true, message: 'Vui lòng nhập đầu ra mẫu' }]}
                >
                  <TextArea
                    placeholder="Nhập đầu ra mẫu"
                    autoSize={{ minRows: 3, maxRows: 5 }}
                  />
                </Form.Item>

                <Form.Item
                  name="explanation"
                  label="Giải thích"
                >
                  <TextArea
                    placeholder="Nhập giải thích cho ví dụ (hỗ trợ Markdown)"
                    autoSize={{ minRows: 3, maxRows: 5 }}
                  />
                </Form.Item>
              </Card>

              {/* Test Cases Section */}
              <Card title="Test Cases" style={{ marginBottom: 16 }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                  Test cases dùng để chấm bài tự động với Judge0
                </Text>

                <Collapse defaultActiveKey={['visible']}>
                  <Panel 
                    header={
                      <Space>
                        <EyeOutlined />
                        <span>Test Cases Hiển Thị ({testCasesVisible.length})</span>
                        <Tag color="blue">User có thể xem</Tag>
                      </Space>
                    } 
                    key="visible"
                  >
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Button
                        type="dashed"
                        icon={<PlusOutlined />}
                        onClick={() => showAddTestCaseModal('visible')}
                        style={{ width: '100%' }}
                      >
                        Thêm Test Case Hiển Thị
                      </Button>
                      {testCasesVisible.length > 0 ? (
                        <Table
                          dataSource={testCasesVisible.map((testCase, index) => ({
                            ...testCase,
                            key: index
                          }))}
                          columns={testCaseColumns('visible')}
                          pagination={false}
                          size="small"
                        />
                      ) : (
                        <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                          Chưa có test case hiển thị
                        </div>
                      )}
                    </Space>
                  </Panel>

                  <Panel 
                    header={
                      <Space>
                        <EyeInvisibleOutlined />
                        <span>Test Cases Ẩn ({testCasesHidden.length})</span>
                        <Tag color="red">Chỉ để chấm bài</Tag>
                      </Space>
                    } 
                    key="hidden"
                  >
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Button
                        type="dashed"
                        icon={<PlusOutlined />}
                        onClick={() => showAddTestCaseModal('hidden')}
                        style={{ width: '100%' }}
                      >
                        Thêm Test Case Ẩn
                      </Button>
                      {testCasesHidden.length > 0 ? (
                        <Table
                          dataSource={testCasesHidden.map((testCase, index) => ({
                            ...testCase,
                            key: index
                          }))}
                          columns={testCaseColumns('hidden')}
                          pagination={false}
                          size="small"
                        />
                      ) : (
                        <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                          Chưa có test case ẩn
                        </div>
                      )}
                    </Space>
                  </Panel>
                </Collapse>
              </Card>
            </Col>

            <Col xs={24} md={8}>
              <Card title="Hình ảnh" style={{ marginBottom: 16 }}>
                <Form.Item
                  name="imageURL"
                  label="URL hình ảnh"
                >
                  <Input placeholder="Nhập URL hình ảnh" />
                </Form.Item>

                {form.getFieldValue('imageURL') && (
                  <div style={{ marginBottom: 16, textAlign: 'center' }}>
                    <img 
                      src={form.getFieldValue('imageURL')} 
                      alt="Preview" 
                      style={{ 
                        maxWidth: '100%', 
                        maxHeight: '200px', 
                        marginBottom: 8,
                        borderRadius: 4,
                        border: '1px solid #d9d9d9',
                        padding: 4
                      }} 
                    />
                    <div>
                      <Button 
                        size="small" 
                        danger
                        onClick={() => form.setFieldsValue({ imageURL: '' })}
                      >
                        Xóa ảnh
                      </Button>
                    </div>
                  </div>
                )}

                <Upload {...uploadProps}>
                  <Button icon={<UploadOutlined />}>Tải lên hình ảnh</Button>
                </Upload>
              </Card>

              <Card title="Mã nguồn" style={{ marginBottom: 16 }}>
                <Form.Item
                  name="starterCode"
                  label="Mã khởi tạo"
                >
                  <TextArea
                    placeholder="Nhập mã khởi tạo cho bài tập"
                    autoSize={{ minRows: 5, maxRows: 10 }}
                    style={{ fontFamily: 'monospace' }}
                  />
                </Form.Item>

                <Form.Item
                  name="instructions"
                  label="Hướng dẫn"
                >
                  <TextArea
                    placeholder="Nhập hướng dẫn cho bài tập (hỗ trợ Markdown)"
                    autoSize={{ minRows: 3, maxRows: 5 }}
                  />
                </Form.Item>
              </Card>
            </Col>
          </Row>
        </Form>
      )}
    </MainCard>
  );
};

export default ProblemForm;