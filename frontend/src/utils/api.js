import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const uploadResume = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/api/resume/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const getSampleResume = async () => {
  const response = await api.get('/api/resume/sample');
  return response.data;
};

export const analyzeResume = async (resumeId) => {
  const formData = new FormData();
  formData.append('resume_id', resumeId);
  const response = await api.post('/api/resume/analyze', formData);
  return response.data;
};

export const matchJD = async (resumeId, jobDescription) => {
  const formData = new FormData();
  formData.append('resume_id', resumeId);
  formData.append('job_description', jobDescription);
  const response = await api.post('/api/jd/match', formData);
  return response.data;
};

export const generateRoadmap = async (resumeId, jobDescription, dailyHours = 2) => {
  const formData = new FormData();
  formData.append('resume_id', resumeId);
  formData.append('job_description', jobDescription);
  formData.append('daily_hours', dailyHours);
  const response = await api.post('/api/roadmap', formData);
  return response.data;
};

export const generateQuiz = async (topic, difficulty = 'Adaptive', count = 10, resumeId = null, jobDescription = '') => {
  const formData = new FormData();
  formData.append('topic', topic);
  formData.append('difficulty', difficulty);
  formData.append('count', count);
  if (resumeId) formData.append('resume_id', resumeId);
  if (jobDescription) formData.append('job_description', jobDescription);
  const response = await api.post('/api/quiz/generate', formData);
  return response.data;
};

export const startInterview = async (jobDescription, mode = 'Technical', count = 5) => {
  const formData = new FormData();
  formData.append('job_description', jobDescription);
  formData.append('mode', mode);
  formData.append('count', count);
  const response = await api.post('/api/interview/start', formData);
  return response.data;
};

export const evaluateInterviewAnswer = async (sessionId, questionId, answer, timeTaken) => {
  const formData = new FormData();
  formData.append('session_id', sessionId);
  formData.append('question_id', questionId);
  formData.append('answer', answer);
  formData.append('time_taken', timeTaken);
  const response = await api.post('/api/interview/evaluate', formData);
  return response.data;
};

export const searchJobs = async (resumeId, role, location = 'India') => {
  const formData = new FormData();
  formData.append('resume_id', resumeId);
  formData.append('role', role);
  formData.append('location', location);
  const response = await api.post('/api/jobs/search', formData);
  return response.data;
};

export const trackProgress = async (resumeId, quizScore, interviewScore) => {
  const formData = new FormData();
  formData.append('resume_id', resumeId);
  if (quizScore !== null) formData.append('quiz_score', quizScore);
  if (interviewScore !== null) formData.append('interview_score', interviewScore);
  const response = await api.post('/api/progress/track', formData);
  return response.data;
};

export default api;
