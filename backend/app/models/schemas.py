from pydantic import BaseModel, Field, model_validator
from typing import List, Optional, Dict, Any
from datetime import datetime

# ============ Resume Models ============

class Skill(BaseModel):
    name: str
    level: Optional[str] = None
    years: Optional[float] = None

class Experience(BaseModel):
    title: str
    company: str
    duration: Optional[str] = None
    description: List[str] = []
    skills_used: List[str] = []

class Education(BaseModel):
    degree: str
    institution: str
    year: Optional[str] = None
    gpa: Optional[str] = None

class Project(BaseModel):
    name: str
    description: str
    technologies: List[str] = []
    link: Optional[str] = None

class ParsedResume(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    skills: List[Skill] = []
    experiences: List[Experience] = []
    education: List[Education] = []
    projects: List[Project] = []
    summary: Optional[str] = None
    raw_text: str = ""

# ============ Resume Analysis Models ============

class ResumeProblem(BaseModel):
    category: str  # "formatting", "content", "keywords", "grammar"
    severity: str  # "high", "medium", "low"
    issue: str
    suggestion: str
    location: Optional[str] = None

class ATSAnalysis(BaseModel):
    score: int = Field(..., ge=0, le=100)
    keyword_match: float
    formatting_score: int
    readability_score: int
    problems: List[ResumeProblem] = []
    missing_keywords: List[str] = []
    strong_points: List[str] = []

class BulletImprovement(BaseModel):
    original: str
    improved: str
    reason: str
    impact_score: int = Field(..., ge=1, le=10)

class ResumeAnalysisResult(BaseModel):
    ats_analysis: ATSAnalysis
    problems: List[ResumeProblem]
    bullet_improvements: List[BulletImprovement]
    recruiter_view: str
    overall_rating: str  # "Excellent", "Good", "Needs Improvement", "Poor"

# ============ Job Description Models ============

class JobDescription(BaseModel):
    title: str
    company: Optional[str] = None
    required_skills: List[str] = []
    preferred_skills: List[str] = []
    experience_required: Optional[str] = None
    education_required: Optional[str] = None
    responsibilities: List[str] = []
    raw_text: str = ""

# ============ JD Matching Models ============

class FocusArea(BaseModel):
    skill: str
    priority: str  # "HIGH", "MEDIUM", "LOW"
    weight: float  # % of JD weight
    reason: str
    study_time: str  # e.g., "2-3 weeks"

    @model_validator(mode="before")
    @classmethod
    def _normalize_aliases(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data

        normalized = dict(data)

        if not normalized.get("skill"):
            normalized["skill"] = (
                normalized.get("skill_name")
                or normalized.get("name")
                or ""
            )

        if not normalized.get("study_time"):
            normalized["study_time"] = (
                normalized.get("studyTime")
                or normalized.get("estimated_study_time")
                or normalized.get("time_to_study")
                or "1-2 weeks"
            )

        return normalized

class JDMatchResult(BaseModel):
    match_percentage: float = Field(..., ge=0, le=100)
    hire_probability: str  # "High", "Medium", "Low"
    matched_skills: List[str]
    missing_skills: List[str]
    focus_areas: List[FocusArea]
    interview_topics: List[str]
    strengths: List[str]
    weaknesses: List[str]
    suggestions: List[str] = []

# ============ Skill Gap & Roadmap Models ============

class SkillGap(BaseModel):
    skill: str
    current_level: str  # "None", "Beginner", "Intermediate", "Advanced"
    required_level: str
    gap_severity: str  # "Critical", "Important", "Nice to have"
    learning_resources: List[str] = []

class RoadmapTask(BaseModel):
    week: int
    task: str
    skill: str
    difficulty: str  # "Easy", "Medium", "Hard"
    estimated_hours: int
    resources: List[str] = []
    milestone: bool = False

class CareerRoadmap(BaseModel):
    duration_weeks: int
    daily_hours: int
    tasks: List[RoadmapTask]
    milestones: List[str]
    completion_criteria: str

# ============ Quiz Models ============

class QuizOption(BaseModel):
    text: str
    is_correct: bool

class QuizQuestion(BaseModel):
    id: str
    topic: str
    difficulty: str  # "Easy", "Medium", "Hard"
    question_type: str  # "MCQ", "Coding", "Theory"
    question: str
    options: Optional[List[QuizOption]] = None
    correct_answer: str
    explanation: str
    code_template: Optional[str] = None

class QuizAnswer(BaseModel):
    question_id: str
    user_answer: str
    time_taken_seconds: int

class QuizResult(BaseModel):
    question_id: str
    is_correct: bool
    score: int
    explanation: str
    weak_area: Optional[str] = None

class QuizPerformance(BaseModel):
    total_questions: int
    correct_answers: int
    score_percentage: float
    weak_topics: List[str]
    strong_topics: List[str]
    topic_scores: Dict[str, float]
    recommendation: str

# ============ Interview Models ============

class InterviewQuestion(BaseModel):
    id: str
    type: str  # "HR", "Technical", "Behavioral"
    difficulty: str
    question: str
    expected_keywords: List[str] = []
    evaluation_criteria: List[str] = []

class InterviewAnswer(BaseModel):
    question_id: str
    answer: str
    time_taken_seconds: int

class InterviewFeedback(BaseModel):
    question_id: str
    score: int = Field(..., ge=0, le=10)
    strengths: List[str]
    weaknesses: List[str]
    model_answer: str
    confidence_level: str  # "High", "Medium", "Low"
    improvement_tips: List[str]

class InterviewSession(BaseModel):
    session_id: str
    mode: str  # "HR", "Technical"
    questions: List[InterviewQuestion]
    answers: List[InterviewAnswer] = []
    feedbacks: List[InterviewFeedback] = []
    overall_score: Optional[float] = None
    readiness: Optional[str] = None

# ============ Progress Tracking Models ============

class ProgressMetrics(BaseModel):
    quiz_scores: List[float] = []
    interview_scores: List[float] = []
    completed_tasks: int = 0
    total_tasks: int = 0
    weak_areas: List[str] = []
    improved_areas: List[str] = []
    last_updated: datetime = Field(default_factory=datetime.now)

class AIDecision(BaseModel):
    decision: str  # "revise", "move_ahead", "ready_for_interviews"
    topic: Optional[str] = None
    reason: str
    next_action: str
    confidence: float = Field(..., ge=0, le=1)

# ============ Job Search Models ============

class JobListing(BaseModel):
    id: str
    title: str
    company: str
    location: str
    match_percentage: float
    salary: Optional[str] = None
    description: str
    required_skills: List[str] = []
    apply_link: str
    posted_date: Optional[str] = None
    source: str  # "LinkedIn", "Naukri", "Adzuna"

class JobSearchPreferences(BaseModel):
    role: str
    location: str = "India"
    experience_level: Optional[str] = None
    remote: bool = False

# ============ Coaching Models ============

class DailyCoaching(BaseModel):
    date: str
    reminder: str
    motivation: str
    suggestion: str
    focus_topic: str

# ============ Portfolio Models ============

class ProjectSuggestion(BaseModel):
    name: str
    description: str
    difficulty: str
    technologies: List[str]
    estimated_days: int
    learning_outcomes: List[str]
    resources: List[str]
