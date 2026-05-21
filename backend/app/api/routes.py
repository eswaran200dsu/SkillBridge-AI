from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from typing import List, Optional
import json
import re
import os
import uuid
from datetime import datetime
from pathlib import Path
from urllib.parse import quote_plus

from app.core.config import settings
from app.models.schemas import (
    AIDecision,
    ATSAnalysis,
    BulletImprovement,
    CareerRoadmap,
    FocusArea,
    InterviewAnswer,
    InterviewFeedback,
    InterviewQuestion,
    InterviewSession,
    JDMatchResult,
    JobListing,
    JobSearchPreferences,
    ParsedResume,
    QuizAnswer,
    QuizPerformance,
    QuizQuestion,
    QuizResult,
    RoadmapTask,
    ResumeAnalysisResult,
    ResumeProblem,
    SkillGap,
)
from app.services import ai_service, job_service, parser
from app.services.supabase_service import supabase_service
router = APIRouter()
resume_store = {}
progress_store = {}
interview_sessions = {}
interview_session_contexts = {}


def _restore_interview_session_from_db(session_id: str) -> bool:
    """Reload interview session from Supabase when in-memory cache is empty (e.g., after restart)."""
    if session_id in interview_sessions:
        return True

    if not _supabase_enabled():
        return False

    ok, bundle, _ = supabase_service.get_interview_session_bundle(session_id)
    if not ok or not isinstance(bundle, dict):
        return False

    session_row = bundle.get("session", {}) if isinstance(bundle.get("session"), dict) else {}
    raw_questions = bundle.get("questions", []) if isinstance(bundle.get("questions"), list) else []

    questions: List[InterviewQuestion] = []
    for idx, row in enumerate(raw_questions):
        if not isinstance(row, dict):
            continue
        order = row.get("question_order")
        try:
            order_num = int(order)
        except Exception:
            order_num = idx + 1

        question_payload = {
            "id": f"int-{order_num}",
            "type": row.get("type", "Technical"),
            "difficulty": row.get("difficulty", "Medium"),
            "question": row.get("question", ""),
            "expected_keywords": row.get("expected_keywords", []) or [],
            "evaluation_criteria": row.get("evaluation_criteria", []) or [],
        }
        try:
            questions.append(InterviewQuestion(**question_payload))
        except Exception:
            continue

    if not questions:
        return False

    restored_session = InterviewSession(
        session_id=session_id,
        mode=str(session_row.get("mode", "Technical") or "Technical"),
        questions=questions,
        overall_score=float(session_row.get("score", 0) or 0) if session_row.get("score") is not None else None,
        readiness=str(session_row.get("readiness", "") or "") or None,
    )
    interview_sessions[session_id] = restored_session
    interview_session_contexts[session_id] = {
        "job_description": str(bundle.get("job_description", "") or ""),
        "resume_text": "",
        "quiz_context": session_row.get("quiz_context", {}) if isinstance(session_row.get("quiz_context"), dict) else {},
        "roadmap_context": session_row.get("roadmap_context", []) if isinstance(session_row.get("roadmap_context"), list) else [],
        "project_context": [],
        "mode": restored_session.mode,
    }
    return True


def _resolve_interview_question(session: InterviewSession, question_id: str) -> Optional[InterviewQuestion]:
    """Resolve question by exact id, normalized id, numeric suffix, or next unanswered fallback."""
    questions = session.questions or []
    if not questions:
        return None

    qid = str(question_id or "").strip()
    if not qid:
        return None

    exact_match = next((q for q in questions if str(q.id) == qid), None)
    if exact_match:
        return exact_match

    normalized_qid = qid.lower()
    case_match = next((q for q in questions if str(q.id).strip().lower() == normalized_qid), None)
    if case_match:
        return case_match

    match = re.search(r"(\d+)$", qid)
    if match:
        try:
            index = int(match.group(1)) - 1
            if 0 <= index < len(questions):
                return questions[index]
        except Exception:
            pass

    answered_ids = {str(item.question_id).strip().lower() for item in (session.answers or [])}
    for question in questions:
        if str(question.id).strip().lower() not in answered_ids:
            return question

    return questions[0]


def _normalize_user_api_key(raw_key: str) -> str:
    value = str(raw_key or "").strip().strip('"').strip("'")
    if value.lower().startswith("bearer "):
        value = value[7:].strip()
    return value


def _mask_api_key(api_key: str) -> str:
    key = _normalize_user_api_key(api_key)
    if len(key) <= 8:
        return "*" * len(key)
    return f"{key[:4]}...{key[-4:]}"


def _resolve_current_runtime_api_key() -> str:
    candidates = [
        getattr(settings, "OXLO_API_KEY", ""),
        getattr(settings, "ATS_API_KEY", ""),
        getattr(settings, "JD_API_KEY", ""),
        getattr(settings, "ROADMAP_API_KEY", ""),
        getattr(settings, "QUIZ_API_KEY", ""),
        getattr(settings, "INTERVIEW_API_KEY", ""),
    ]
    for value in candidates:
        normalized = _normalize_user_api_key(str(value or ""))
        if normalized:
            return normalized
    return ""


def _api_key_db_scope() -> str:
    return "global"


def _api_key_encryption_secret() -> str:
    return str(getattr(settings, "API_KEY_ENCRYPTION_SECRET", "") or "").strip()


def _update_env_file_value(env_file_path: Path, env_key: str, env_value: str) -> None:
    if env_file_path.exists():
        lines = env_file_path.read_text(encoding="utf-8").splitlines()
    else:
        lines = []

    updated = False
    updated_lines: List[str] = []
    key_prefix = f"{env_key}="

    for line in lines:
        if line.startswith(key_prefix):
            updated_lines.append(f"{env_key}={env_value}")
            updated = True
        else:
            updated_lines.append(line)

    if not updated:
        if updated_lines and updated_lines[-1].strip() != "":
            updated_lines.append("")
        updated_lines.append(f"{env_key}={env_value}")

    env_file_path.write_text("\n".join(updated_lines) + "\n", encoding="utf-8")


def _supabase_enabled() -> bool:
    """Safely resolve Supabase availability across import styles."""
    enabled_attr = getattr(supabase_service, "enabled", False)
    if callable(enabled_attr):
        try:
            return bool(enabled_attr())
        except Exception:
            return False
    return bool(enabled_attr)


def _get_resume_or_404(resume_id: str) -> ParsedResume:
    """Resolve resume from in-memory store, sample fallback, or Supabase cache."""
    if resume_id in resume_store:
        return resume_store[resume_id]

    if resume_id == "sample_demo":
        sample = parser.get_sample_resume()
        resume_store[resume_id] = sample
        return sample

    if _supabase_enabled():
        ok, row, err = supabase_service.get_resume(resume_id)
        if ok and row:
            parsed_data = row.get("parsed_data") or {}
            if isinstance(parsed_data, dict):
                parsed_data = dict(parsed_data)
                if not parsed_data.get("raw_text"):
                    parsed_data["raw_text"] = row.get("raw_text", "")
                try:
                    resume = ParsedResume(**parsed_data)
                    resume_store[resume_id] = resume
                    return resume
                except Exception as parse_error:
                    raise HTTPException(500, f"Resume data is corrupted: {str(parse_error)}")

        if err and err != "Resume not found":
            raise HTTPException(500, f"Failed to load resume from storage: {err}")

    raise HTTPException(404, "Resume not found. Please upload your resume again.")


def _build_roadmap_context_from_match(match_data: dict) -> List[dict]:
    """Build lightweight roadmap context without invoking roadmap generation."""
    if not isinstance(match_data, dict):
        return []

    tasks: List[dict] = []
    focus_areas = match_data.get("focus_areas", []) if isinstance(match_data.get("focus_areas"), list) else []
    missing_skills = match_data.get("missing_skills", []) if isinstance(match_data.get("missing_skills"), list) else []

    ordered_skills: List[str] = []
    for area in focus_areas:
        if isinstance(area, dict):
            skill = str(area.get("skill", "")).strip()
            if skill and skill not in ordered_skills:
                ordered_skills.append(skill)

    for skill in missing_skills:
        value = str(skill).strip()
        if value and value not in ordered_skills:
            ordered_skills.append(value)

    for idx, skill in enumerate(ordered_skills[:6], start=1):
        tasks.append({
            "week": idx,
            "skill": skill,
            "task": f"Build and document one outcome-focused mini-project for {skill} mapped to JD requirements.",
            "resources": [f"{skill} official docs", "Role-aligned implementation guide"],
        })

    return tasks


def _build_quiz_context_fast(resume_text: str, job_description: str) -> List[dict]:
    """Build lightweight quiz context without any model calls for speed/cost control."""
    text = f"{resume_text or ''} {job_description or ''}".lower()
    skill_bank = [
        "Python", "Java", "JavaScript", "TypeScript", "React", "Node.js", "SQL", "PostgreSQL",
        "MongoDB", "Docker", "Kubernetes", "AWS", "GCP", "Azure", "System Design", "Microservices",
        "TensorFlow", "PyTorch", "MLOps", "Data Structures", "Algorithms", "REST API", "Testing",
    ]

    found: List[str] = []
    for skill in skill_bank:
        aliases = [skill.lower()]
        if skill == "Node.js":
            aliases.extend(["node", "nodejs"])
        if skill == "REST API":
            aliases.extend(["rest", "restful", "api"])
        if skill == "System Design":
            aliases.extend(["system design", "distributed systems"])
        if any(re.search(rf"(?<!\\w){re.escape(alias)}(?!\\w)", text) for alias in aliases):
            found.append(skill)

    if not found:
        found = ["Data Structures", "Algorithms", "System Design", "REST API", "Testing", "SQL"]

    tasks: List[dict] = []
    for idx, skill in enumerate(found[:8], start=1):
        tasks.append({
            "week": idx,
            "skill": skill,
            "task": f"Master {skill} basics and complete one role-aligned practical problem.",
            "resources": [f"{skill} official documentation", f"{skill} interview questions", f"{skill} hands-on tutorial"],
        })

    return tasks


def _build_fast_roadmap_match_data(resume_text: str, job_description: str, resume_data: Optional[dict] = None) -> dict:
    """Build a fast local roadmap match payload without an extra AI request."""
    combined_text = f"{resume_text or ''} {job_description or ''}".lower()
    skill_bank = [
        "Python", "Java", "JavaScript", "TypeScript", "React", "Node.js", "SQL", "PostgreSQL",
        "MongoDB", "Docker", "Kubernetes", "AWS", "GCP", "Azure", "System Design",
        "Microservices", "REST API", "Testing", "MLOps", "Machine Learning", "AI",
    ]

    def _has_skill(skill: str) -> bool:
        aliases = [skill.lower()]
        if skill == "Node.js":
            aliases.extend(["node", "nodejs"])
        if skill == "REST API":
            aliases.extend(["rest", "restful", "api"])
        if skill == "System Design":
            aliases.extend(["system design", "distributed systems", "architecture"])
        if skill == "Machine Learning":
            aliases.extend(["ml", "machine learning"])
        return any(re.search(rf"(?<!\\w){re.escape(alias)}(?!\\w)", combined_text) for alias in aliases)

    resume_skills: List[str] = []
    if isinstance(resume_data, dict):
        for skill in resume_data.get("skills", []):
            if isinstance(skill, dict):
                name = str(skill.get("name", "")).strip()
                if name:
                    resume_skills.append(name)

    matched_skills = []
    for skill in skill_bank:
        if _has_skill(skill) or skill in resume_skills:
            matched_skills.append(skill)

    missing_skills = [skill for skill in skill_bank if skill not in matched_skills]
    if not missing_skills:
        missing_skills = ["System Design", "REST API", "Testing", "Docker"]

    focus_skills = missing_skills[:5]
    focus_areas = []
    for index, skill in enumerate(focus_skills):
        focus_areas.append({
            "skill": skill,
            "priority": "HIGH" if index < 2 else "MEDIUM",
            "weight": float(max(8, 28 - index * 4)),
            "reason": f"{skill} is underrepresented in the resume compared with the JD.",
            "study_time": "1 week" if index < 2 else "1-2 weeks",
        })

    match_ratio = len(matched_skills) / max(1, len(skill_bank))
    match_percentage = round(max(20.0, min(90.0, 30.0 + match_ratio * 55.0)), 1)

    strengths = [f"Resume already shows {', '.join(matched_skills[:3])}"] if matched_skills else ["Resume parsed successfully"]
    weaknesses = [f"Missing or weak coverage for {', '.join(missing_skills[:4])}", "Roadmap should focus on the highest-priority missing skills"]

    return {
        "match_percentage": match_percentage,
        "hire_probability": "High" if match_percentage >= 80 else "Medium" if match_percentage >= 60 else "Low",
        "matched_skills": matched_skills[:10],
        "missing_skills": missing_skills[:10],
        "focus_areas": focus_areas,
        "interview_topics": focus_skills[:4],
        "strengths": strengths,
        "weaknesses": weaknesses,
        "suggestions": [
            f"Build one practical project around {focus_skills[0]}.",
            "Rewrite one resume bullet with a measurable outcome.",
            "Practice explaining architecture and trade-offs in under 60 seconds.",
        ],
        "source": "fast_roadmap_match",
    }


def _build_fast_roadmap_match_data(resume_text: str, job_description: str, resume_data: Optional[dict] = None) -> dict:
    """Fast local JD-match approximation for roadmap generation.

    This avoids an extra AI call before roadmap generation and keeps the
    roadmap endpoint responsive under load.
    """
    combined_text = f"{resume_text or ''} {job_description or ''}".lower()
    skill_bank = [
        "Python", "Java", "JavaScript", "TypeScript", "React", "Node.js", "SQL", "PostgreSQL",
        "MongoDB", "Docker", "Kubernetes", "AWS", "GCP", "Azure", "System Design",
        "Microservices", "REST API", "Testing", "MLOps", "Machine Learning", "AI",
    ]

    def _has_skill(skill: str) -> bool:
        aliases = [skill.lower()]
        if skill == "Node.js":
            aliases.extend(["node", "nodejs"])
        if skill == "REST API":
            aliases.extend(["rest", "restful", "api"])
        if skill == "System Design":
            aliases.extend(["system design", "distributed systems", "architecture"])
        if skill == "Machine Learning":
            aliases.extend(["ml", "machine learning"])
        return any(re.search(rf"(?<!\\w){re.escape(alias)}(?!\\w)", combined_text) for alias in aliases)

    resume_skills = []
    if isinstance(resume_data, dict):
        for skill in resume_data.get("skills", []):
            if isinstance(skill, dict):
                name = str(skill.get("name", "")).strip()
                if name:
                    resume_skills.append(name)

    matched_skills = []
    for skill in skill_bank:
        if _has_skill(skill) or skill in resume_skills:
            matched_skills.append(skill)

    missing_skills = [skill for skill in skill_bank if skill not in matched_skills]
    if not missing_skills:
        missing_skills = ["System Design", "REST API", "Testing", "Docker"]

    focus_skills = missing_skills[:5]
    focus_areas = []
    for index, skill in enumerate(focus_skills):
        focus_areas.append({
            "skill": skill,
            "priority": "HIGH" if index < 2 else "MEDIUM",
            "weight": float(max(8, 28 - index * 4)),
            "reason": f"{skill} is underrepresented in the resume compared with the JD.",
            "study_time": "1 week" if index < 2 else "1-2 weeks",
        })

    total = len(skill_bank)
    match_ratio = len(matched_skills) / max(1, total)
    match_percentage = round(max(20.0, min(90.0, 30.0 + match_ratio * 55.0)), 1)

    strengths = []
    if matched_skills:
        strengths.append(f"Resume already shows {', '.join(matched_skills[:3])}")
    if any(skill in matched_skills for skill in ["React", "Python", "JavaScript", "Java"]):
        strengths.append("Core development skills are present")

    weaknesses = []
    if missing_skills:
        weaknesses.append(f"Missing or weak coverage for {', '.join(missing_skills[:4])}")
    weaknesses.append("Roadmap should focus on the highest-priority missing skills")

    suggestions = [
        f"Build one practical project around {focus_skills[0]}.",
        "Rewrite one resume bullet with a measurable outcome.",
        "Practice explaining architecture and trade-offs in under 60 seconds.",
    ]

    return {
        "match_percentage": match_percentage,
        "hire_probability": "High" if match_percentage >= 80 else "Medium" if match_percentage >= 60 else "Low",
        "matched_skills": matched_skills[:10],
        "missing_skills": missing_skills[:10],
        "focus_areas": focus_areas,
        "interview_topics": focus_skills[:4],
        "strengths": strengths or ["Resume parsed successfully"],
        "weaknesses": weaknesses,
        "suggestions": suggestions,
        "source": "fast_roadmap_match",
    }


def _to_clickable_resource(resource: str, topic: str = "") -> Optional[dict]:
    value = str(resource or "").strip()
    if not value:
        return None

    lowered = value.lower()
    if lowered.startswith("http://") or lowered.startswith("https://"):
        return {"label": value, "url": value}

    query = value
    if topic and topic.lower() not in lowered:
        query = f"{topic} {value}".strip()

    return {
        "label": value,
        "url": f"https://www.google.com/search?q={quote_plus(query)}",
    }


def _build_quiz_study_materials(questions_data: List[dict], roadmap_context: List[dict]) -> List[dict]:
    """Create right-panel study materials tied to generated quiz topics."""
    topic_order: List[str] = []
    for item in questions_data or []:
        if not isinstance(item, dict):
            continue
        topic = str(item.get("topic", "")).strip()
        if topic and topic.lower() not in {t.lower() for t in topic_order}:
            topic_order.append(topic)

    materials: List[dict] = []
    for idx, topic in enumerate(topic_order[:8], start=1):
        topic_l = topic.lower()
        matched_task = None
        for task in roadmap_context or []:
            skill = str(task.get("skill", "")).strip().lower()
            if skill and (skill in topic_l or topic_l in skill):
                matched_task = task
                break

        if matched_task:
            raw_resources = matched_task.get("resources", [])
            what_to_study = str(matched_task.get("task", f"Practice {topic} with one interview-focused exercise.")).strip()
        else:
            raw_resources = [
                f"{topic} official documentation",
                f"{topic} interview questions",
                f"{topic} hands-on tutorial",
            ]
            what_to_study = f"Review core {topic} concepts, then solve one practical implementation problem."

        clickable_resources: List[dict] = []
        for raw in raw_resources[:3]:
            resource = _to_clickable_resource(str(raw), topic)
            if resource:
                clickable_resources.append(resource)

        materials.append({
            "week": idx,
            "title": topic,
            "what_to_study": what_to_study,
            "resources": clickable_resources,
        })

    if materials:
        return materials

    # Fallback if model omitted topic labels.
    return [{
        "week": 1,
        "title": "Core Revision",
        "what_to_study": "Review key quiz areas and retry weak questions.",
        "resources": [
            _to_clickable_resource("technical interview preparation"),
            _to_clickable_resource("problem solving patterns"),
            _to_clickable_resource("coding practice roadmap"),
        ],
    }]

# ============ Health & Status ============

@router.get("/api/test-ai")
async def test_ai_connection(task: str = "ats"):
    """Test AI API connection for ATS or JD model route."""
    normalized_task = (task or "ats").strip().lower()
    messages = [{"role": "user", "content": "Say 'API is working!'"}]

    try:
        if normalized_task == "roadmap":
            response_text = await ai_service.call_roadmap_chat(messages, temperature=0.0, max_tokens=60)
            return {
                "task": "roadmap",
                "endpoint": settings.ROADMAP_CHAT_ENDPOINT,
                "model": settings.ROADMAP_MODEL,
                "response": response_text,
            }

        if normalized_task == "jd":
            response_text = await ai_service.call_jd_chat(messages, temperature=0.0, max_tokens=60)
            return {
                "task": "jd",
                "endpoint": settings.JD_CHAT_ENDPOINT,
                "model": settings.JD_MODEL,
                "response": response_text,
            }

        response_text = await ai_service.call_ats_chat(messages, temperature=0.0, max_tokens=60)
        return {
            "task": "ats",
            "endpoint": settings.ATS_CHAT_ENDPOINT,
            "model": settings.ATS_MODEL,
            "response": response_text,
        }
    except Exception as e:
        return {"task": normalized_task, "error": str(e)}


@router.post("/api/settings/api-key")
async def set_runtime_api_key(
    api_key: str = Form(...),
    apply_to_all_routes: bool = Form(True),
):
    """Save user-provided Oxlo API key and apply immediately to active model routes."""
    normalized_key = _normalize_user_api_key(api_key)
    if not normalized_key:
        raise HTTPException(status_code=400, detail="API key is required")

    if len(normalized_key) < 16:
        raise HTTPException(status_code=400, detail="API key looks too short. Please paste a valid key.")

    settings.OXLO_API_KEY = normalized_key
    settings.ATS_API_KEY = normalized_key

    applied_env_keys = ["OXLO_API_KEY", "ATS_API_KEY"]
    if apply_to_all_routes:
        settings.JD_API_KEY = normalized_key
        settings.ROADMAP_API_KEY = normalized_key
        settings.QUIZ_API_KEY = normalized_key
        settings.INTERVIEW_API_KEY = normalized_key
        applied_env_keys.extend(["JD_API_KEY", "ROADMAP_API_KEY", "QUIZ_API_KEY", "INTERVIEW_API_KEY"])

    # Ensure current process uses the new key immediately.
    for env_key in applied_env_keys:
        os.environ[env_key] = normalized_key

    persisted_to_db = False
    db_warning = ""
    if _supabase_enabled() and _api_key_encryption_secret():
        db_ok, db_err = supabase_service.save_runtime_api_key(
            scope_key=_api_key_db_scope(),
            api_key=normalized_key,
            encryption_secret=_api_key_encryption_secret(),
        )
        persisted_to_db = db_ok
        if not db_ok:
            db_warning = f"DB persistence failed: {db_err}"
    elif _supabase_enabled() and not _api_key_encryption_secret():
        db_warning = "DB persistence skipped: API_KEY_ENCRYPTION_SECRET is not configured"

    env_file_path = Path(__file__).resolve().parents[2] / ".env"
    persisted_to_env_file = True
    persistence_warning = ""
    try:
        for env_key in applied_env_keys:
            _update_env_file_value(env_file_path, env_key, normalized_key)
    except Exception as persistence_error:
        persisted_to_env_file = False
        persistence_warning = f"Runtime key applied, but .env persistence failed: {str(persistence_error)}"

    response = {
        "success": True,
        "message": "API key saved and applied.",
        "masked_key": _mask_api_key(normalized_key),
        "applied_to": applied_env_keys,
        "storage_source": "db" if persisted_to_db else "runtime",
        "persisted_to_db": persisted_to_db,
        "persisted_to_env_file": persisted_to_env_file,
    }

    if db_warning:
        response["db_warning"] = db_warning

    if persistence_warning:
        response["warning"] = persistence_warning

    return response


@router.get("/api/settings/api-key/status")
async def get_runtime_api_key_status():
    """Return masked API key status so UI can show if a key is already configured."""
    current_key = ""
    user_key = ""
    source = "runtime"

    if _supabase_enabled() and _api_key_encryption_secret():
        db_ok, db_key, _ = supabase_service.get_runtime_api_key(
            scope_key=_api_key_db_scope(),
            encryption_secret=_api_key_encryption_secret(),
        )
        if db_ok and db_key:
            user_key = _normalize_user_api_key(db_key)
            current_key = user_key
            source = "db"

    if not current_key:
        current_key = _resolve_current_runtime_api_key()
        if not current_key:
            source = "none"

    return {
        # `configured` reflects user-saved configuration only (DB), not env defaults.
        "configured": bool(user_key),
        "masked_key": _mask_api_key(user_key) if user_key else "",
        "user_configured": bool(user_key),
        "user_masked_key": _mask_api_key(user_key) if user_key else "",
        "runtime_configured": bool(current_key),
        "runtime_masked_key": _mask_api_key(current_key) if current_key else "",
        "source": source,
        "storage_source": "db" if source == "db" else "runtime",
        "routes": {
            "ats": bool(_normalize_user_api_key(getattr(settings, "ATS_API_KEY", ""))),
            "jd": bool(_normalize_user_api_key(getattr(settings, "JD_API_KEY", ""))),
            "roadmap": bool(_normalize_user_api_key(getattr(settings, "ROADMAP_API_KEY", ""))),
            "quiz": bool(_normalize_user_api_key(getattr(settings, "QUIZ_API_KEY", ""))),
            "interview": bool(_normalize_user_api_key(getattr(settings, "INTERVIEW_API_KEY", ""))),
        },
    }

@router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@router.get("/")
async def root():
    return {
        "name": "SkillBridge AI API",
        "version": "1.0.0",
        "description": "Agentic Career Operating System",
        "docs": "/docs"
    }

# ============ Resume Operations ============

@router.post("/api/resume/upload")
async def upload_resume(file: UploadFile = File(...)):
    """Upload and parse resume"""
    try:
        if not file or not file.filename:
            raise HTTPException(400, "No file was uploaded")

        # Validate file type
        _, ext = os.path.splitext(file.filename.lower())
        if ext not in ('.pdf', '.docx', '.txt'):
            raise HTTPException(400, "Only PDF, DOCX, and TXT files are supported")
        
        # Save file
        file_id = str(uuid.uuid4())
        file_path = os.path.join(settings.UPLOAD_DIR, f"{file_id}_{file.filename}")
        
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Parse resume
        parsed_resume = parser.parse_resume(file_path)
        
        # Store in memory
        resume_store[file_id] = parsed_resume

        # Persist to Supabase (best-effort, non-blocking for user flow)
        if _supabase_enabled():
            ok, err = supabase_service.save_resume(
                resume_id=file_id,
                filename=file.filename,
                file_type=file.content_type or "application/octet-stream",
                raw_text=parsed_resume.raw_text,
                parsed_data=parsed_resume.dict(),
                user_id=None,
            )
            if not ok:
                print(f"Warning: failed to persist resume in Supabase: {err}")
        
        # Clean up file
        os.remove(file_path)
        
        return {
            "resume_id": file_id,
            "resume": parsed_resume.dict(),
            "message": "Resume uploaded and parsed successfully"
        }

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Error processing resume: {str(e)}")

@router.get("/api/resume/sample")
async def get_sample_resume():
    """Get sample resume for demo"""
    sample = parser.get_sample_resume()
    resume_id = "sample_demo"
    resume_store[resume_id] = sample
    
    return {
        "resume_id": resume_id,
        "resume": sample.dict()
    }


@router.post("/api/resume/analyze")
async def analyze_resume(
    resume_id: str = Form(...),
    target_role: str = Form("Software Engineer"),
    job_description: str = Form("")
):
    """Analyze resume for comprehensive ATS score and insights"""
    try:
        resume = _get_resume_or_404(resume_id)
        
        # Get comprehensive ATS analysis
        ats_result = await ai_service.calculate_ats_score(
            resume.raw_text,
            target_role,
            job_description,
            resume.dict(),
        )
        
        # Convert to structured format
        problems = [
            ResumeProblem(
                category="content",
                severity="high" if "critical" in weakness.lower() else "medium",
                issue=weakness,
                suggestion=ats_result.get("suggestions", {}).get("improve_keywords", ["Review and improve"])[0] if ats_result.get("suggestions", {}).get("improve_keywords") else "Review and improve"
            )
            for weakness in ats_result.get("analysis", {}).get("weaknesses", [])
        ]
        
        # Add missing keywords as problems
        for keyword in ats_result.get("missing_keywords", [])[:5]:
            problems.append(ResumeProblem(
                category="keywords",
                severity="medium",
                issue=f"Missing keyword: {keyword}",
                suggestion=f"Consider adding '{keyword}' if relevant to your experience"
            ))
        
        score_breakdown = ats_result.get("score_breakdown", {})
        
        ats_analysis = ATSAnalysis(
            score=ats_result.get("ats_score", 0),
            keyword_match=score_breakdown.get("keyword_match", 0) / 100,
            formatting_score=score_breakdown.get("resume_structure", 0),
            readability_score=score_breakdown.get("ats_compatibility", 0),
            problems=problems,
            missing_keywords=ats_result.get("missing_keywords", []),
            strong_points=ats_result.get("analysis", {}).get("strengths", [])
        )
        
        # Optional bullet improvements can be expensive and slow.
        # Keep disabled by default for faster, lower-token ATS responses.
        bullet_improvements: List[BulletImprovement] = []
        bullet_improvement_error = None
        if settings.ENABLE_BULLET_IMPROVEMENTS:
            try:
                improvements_data = await ai_service.improve_resume_bullets(
                    [exp.dict() for exp in resume.experiences],
                    job_description or target_role
                )
                bullet_improvements = [
                    BulletImprovement(**imp) for imp in improvements_data[:5]
                ]
            except Exception as e:
                bullet_improvement_error = str(e)
        
        result = ResumeAnalysisResult(
            ats_analysis=ats_analysis,
            problems=problems,
            bullet_improvements=bullet_improvements,
            recruiter_view=ats_result.get("final_verdict", "Resume analysis complete"),
            overall_rating="Excellent" if ats_result.get("ats_score", 0) >= 80 else "Good" if ats_result.get("ats_score", 0) >= 60 else "Needs Improvement"
        )
        
        # Add the detailed ATS result to response
        response = result.dict()
        response["detailed_ats_analysis"] = ats_result
        response["analysis_source"] = {
            "ats_scoring": ats_result.get("source", "unknown"),
            "bullet_improvements": "model" if not bullet_improvement_error else "unavailable",
        }
        fallback_reason = str(ats_result.get("fallback_reason") or "").strip()
        if fallback_reason and fallback_reason.lower() not in {"ai provider unavailable", "model unavailable"}:
            response["ats_model_warning"] = fallback_reason
        if bullet_improvement_error:
            response["bullet_improvement_warning"] = bullet_improvement_error
        
        return response

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error analyzing resume: {str(e)}")

# ============ JD Matching ============

@router.post("/api/jd/match")
async def match_jd(
    resume_id: str = Form(...),
    job_description: str = Form(...)
):
    """Match resume to job description with focus areas"""
    try:
        resume = _get_resume_or_404(resume_id)
        
        # Match with AI
        match_data = await ai_service.match_resume_to_jd(
            resume.raw_text,
            job_description,
            resume.dict(),
        )

        raw_focus_areas = match_data.get("focus_areas", [])
        if isinstance(raw_focus_areas, list):
            for item in raw_focus_areas:
                if not isinstance(item, dict):
                    continue
                if "skill_name" in item and not item.get("skill"):
                    item["skill"] = item.pop("skill_name")
                if "studyTime" in item and not item.get("study_time"):
                    item["study_time"] = item.pop("studyTime")
                if "estimated_study_time" in item and not item.get("study_time"):
                    item["study_time"] = item.pop("estimated_study_time")
                if "dy_time" in item and not item.get("study_time"):
                    item["study_time"] = item.pop("dy_time")
                if "_dy_time" in item and not item.get("study_time"):
                    item["study_time"] = item.pop("_dy_time")
        
        # Convert to structured format with alias-safe normalization.
        focus_areas: List[FocusArea] = []
        for index, area in enumerate(raw_focus_areas if isinstance(raw_focus_areas, list) else []):
            if not isinstance(area, dict):
                continue

            normalized_area = {
                "skill": area.get("skill") or area.get("skill_name") or area.get("name"),
                "priority": area.get("priority", "MEDIUM"),
                "weight": area.get("weight", float(max(8, 30 - index * 4))),
                "reason": area.get("reason", "Important focus area for improving JD fit."),
                "study_time": area.get("study_time") or area.get("studyTime") or area.get("estimated_study_time") or "1-2 weeks",
            }

            if not normalized_area["skill"]:
                continue

            try:
                focus_areas.append(FocusArea(**normalized_area))
            except Exception:
                continue
        
        def _ensure_list(value):
            if isinstance(value, list):
                return [str(v).strip() for v in value if str(v).strip()]
            if isinstance(value, str):
                text = value.strip()
                if not text:
                    return []
                if "\n" in text:
                    return [part.strip(" -•\t") for part in text.splitlines() if part.strip()]
                if ";" in text:
                    return [part.strip() for part in text.split(";") if part.strip()]
                return [text]
            return []

        result = JDMatchResult(
            match_percentage=match_data.get("match_percentage", 68),
            hire_probability=match_data.get("hire_probability", "Medium"),
            matched_skills=_ensure_list(match_data.get("matched_skills", [])),
            missing_skills=_ensure_list(match_data.get("missing_skills", [])),
            focus_areas=focus_areas,
            interview_topics=_ensure_list(match_data.get("interview_topics", [])),
            strengths=_ensure_list(match_data.get("strengths", [])),
            weaknesses=_ensure_list(match_data.get("weaknesses", [])),
            suggestions=_ensure_list(match_data.get("suggestions", [])),
        )

        # Persist JD + match details to Supabase (best-effort)
        if _supabase_enabled():
            job_description_id = str(uuid.uuid4())
            jd_ok, jd_err = supabase_service.save_job_description(
                job_description_id=job_description_id,
                raw_text=job_description,
            )
            if not jd_ok:
                print(f"Warning: failed to persist job description: {jd_err}")
            else:
                match_ok, match_err = supabase_service.save_jd_match(
                    resume_id=resume_id,
                    job_description_id=job_description_id,
                    match_data=match_data,
                )
                if not match_ok:
                    print(f"Warning: failed to persist jd match: {match_err}")
        
        return result.dict()
        
    except ai_service.AIServiceError as e:
        raise HTTPException(503, f"JD model unavailable: {str(e)}")
    except Exception as e:
        raise HTTPException(500, f"Error matching JD: {str(e)}")


# ============ Skill Gap & Roadmap ============

@router.post("/api/skill-gap")
async def analyze_skill_gap(
    resume_id: str = Form(...),
    job_description: str = Form(...)
):
    """Analyze skill gaps"""
    try:
        resume = _get_resume_or_404(resume_id)
        match_data = await ai_service.match_resume_to_jd(
            resume.raw_text,
            job_description,
            resume.dict(),
        )
        
        missing_skills = match_data.get("missing_skills", [])
        
        skill_gaps = [
            SkillGap(
                skill=skill,
                current_level="None",
                required_level="Intermediate",
                gap_severity="Important",
                learning_resources=[f"Learn {skill} tutorial", f"{skill} documentation"]
            )
            for skill in missing_skills
        ]
        
        return {"skill_gaps": [gap.dict() for gap in skill_gaps]}
        
    except Exception as e:
        raise HTTPException(500, f"Error analyzing skill gap: {str(e)}")

@router.post("/api/roadmap")
async def generate_roadmap(
    resume_id: str = Form(...),
    job_description: str = Form(...),
    daily_hours: int = Form(2)
):
    """Generate personalized learning roadmap"""
    try:
        resume = _get_resume_or_404(resume_id)

        # Use a fast local match approximation to avoid an extra slow AI call.
        match_data = _build_fast_roadmap_match_data(resume.raw_text, job_description, resume.dict())
        missing_skills = match_data.get("missing_skills", [])
        
        # Generate roadmap with strict model enforcement when enabled
        roadmap_data = await ai_service.generate_roadmap(
            resume.raw_text,
            job_description,
            missing_skills,
            resume.dict(),
            match_data,
        )
        
        tasks = [RoadmapTask(**task) for task in roadmap_data.get("tasks", [])]
        
        roadmap = CareerRoadmap(
            duration_weeks=roadmap_data.get("duration_weeks", 12),
            daily_hours=daily_hours,
            tasks=tasks,
            milestones=roadmap_data.get("milestones", []),
            completion_criteria=roadmap_data.get("completion_criteria", "Complete all tasks")
        )

        # Persist roadmap + tasks to Supabase (best-effort)
        if _supabase_enabled():
            job_description_id = str(uuid.uuid4())
            jd_ok, jd_err = supabase_service.save_job_description(
                job_description_id=job_description_id,
                raw_text=job_description,
            )
            if not jd_ok:
                print(f"Warning: failed to persist roadmap job description: {jd_err}")
            else:
                roadmap_id = str(uuid.uuid4())
                roadmap_ok, roadmap_err = supabase_service.save_roadmap(
                    roadmap_id=roadmap_id,
                    resume_id=resume_id,
                    job_description_id=job_description_id,
                    roadmap_data=roadmap.dict(),
                )
                if not roadmap_ok:
                    print(f"Warning: failed to persist roadmap: {roadmap_err}")
        
        response_payload = roadmap.dict()
        response_payload["generation_source"] = roadmap_data.get("source", "unknown")
        if roadmap_data.get("warning"):
            response_payload["generation_warning"] = roadmap_data.get("warning")
        return response_payload
        
    except HTTPException:
        raise
    except ai_service.AIServiceError as e:
        raise HTTPException(503, f"Roadmap model unavailable: {str(e)}")
    except Exception as e:
        print(f"Error generating roadmap: {str(e)}")
        raise HTTPException(500, "Error generating roadmap. Please try again.")

# ============ Quiz System ============

@router.post("/api/quiz/generate")
async def generate_quiz(
    topic: str = Form("Adaptive Quiz"),
    difficulty: str = Form("Easy"),
    count: int = Form(10),
    domain: str = Form("Coding DSA"),
    resume_id: Optional[str] = Form(None),
    job_description: str = Form(""),
):
    """Generate adaptive quiz questions with study material from resume/JD/roadmap context."""
    normalized_count = max(10, count)
    resume_text = ""
    if resume_id and resume_id in resume_store:
        resume_text = resume_store[resume_id].raw_text
    roadmap_context = _build_quiz_context_fast(resume_text, job_description)

    try:
        generation_meta = {}

        questions_data = await ai_service.generate_quiz_questions(
            topic=topic,
            difficulty=difficulty,
            count=normalized_count,
            domain=domain,
            resume_text=resume_text,
            jd_text=job_description,
            roadmap_context=roadmap_context,
            generation_meta=generation_meta,
        )
        
        questions = [QuizQuestion(**q) for q in questions_data]

        study_materials = _build_quiz_study_materials(questions_data, roadmap_context)

        rules = [
            "Read every question carefully before selecting an answer.",
            "No tab switching or external assistance during the quiz.",
            "Each section contains 10 questions.",
            "Passing criteria is 80% or higher.",
            "Review explanations after submission to improve weak areas.",
        ]
        
        return {
            "domain": domain,
            "difficulty": difficulty,
            "generation_source": generation_meta.get("source", "model"),
            "passing_percentage": 80,
            "rules": rules,
            "study_materials": study_materials,
            "questions": [q.dict() for q in questions[:normalized_count]],
            **({"generation_warning": generation_meta["warning"]} if generation_meta.get("warning") else {}),
        }
        
    except Exception as e:
        is_rate_limited = isinstance(e, ai_service.AIServiceError) and e.code == "rate_limit"
        if is_rate_limited:
            raise HTTPException(429, "Quiz API is rate-limited right now. Please wait a few seconds and retry.")
        raise HTTPException(503, f"Quiz model unavailable: {str(e)}")

@router.post("/api/quiz/evaluate")
async def evaluate_quiz(answers: List[QuizAnswer]):
    """Evaluate quiz answers and detect weak areas"""
    try:
        results = []
        weak_topics = []
        
        for answer in answers:
            # In real implementation, fetch question from storage
            result_data = await ai_service.evaluate_quiz_answer(
                "Sample question",
                "Correct answer",
                answer.user_answer
            )
            
            result = QuizResult(
                question_id=answer.question_id,
                is_correct=result_data.get("is_correct", False),
                score=result_data.get("score", 0),
                explanation=result_data.get("explanation", ""),
                weak_area=result_data.get("weak_area")
            )
            
            results.append(result)
            
            if result.weak_area:
                weak_topics.append(result.weak_area)
        
        correct = sum(1 for r in results if r.is_correct)
        
        performance = QuizPerformance(
            total_questions=len(answers),
            correct_answers=correct,
            score_percentage=(correct / len(answers)) * 100 if answers else 0,
            weak_topics=list(set(weak_topics)),
            strong_topics=[],
            topic_scores={},
            recommendation="Focus on weak areas identified"
        )
        
        return {
            "results": [r.dict() for r in results],
            "performance": performance.dict()
        }
        
    except Exception as e:
        raise HTTPException(500, f"Error evaluating quiz: {str(e)}")


# ============ Interview System ============

@router.post("/api/interview/start")
async def start_interview(
    job_description: str = Form(""),
    mode: str = Form("Technical"),
    count: int = Form(4),
    resume_id: Optional[str] = Form(None),
    quiz_context: str = Form(""),
):
    """Start mock interview session"""
    try:
        resume_text = ""
        resume_data = {}
        if resume_id:
            resume = _get_resume_or_404(resume_id)
            resume_text = resume.raw_text
            try:
                resume_data = resume.dict()
            except Exception:
                resume_data = {}

        parsed_quiz_context = {}
        if quiz_context:
            try:
                parsed_quiz_context = json.loads(quiz_context)
            except Exception:
                parsed_quiz_context = {}

        # Keep interview start fast by reusing existing roadmap signals when available.
        roadmap_context = parsed_quiz_context.get("roadmap_context", []) if isinstance(parsed_quiz_context, dict) else []
        if not isinstance(roadmap_context, list):
            roadmap_context = []

        interview_generation_meta = {}

        questions_data = await ai_service.generate_interview_questions(
            job_description,
            mode,
            max(1, min(4, count)),
            resume_text=resume_text,
            resume_data=resume_data,
            quiz_context=parsed_quiz_context,
            roadmap_context=roadmap_context,
            generation_meta=interview_generation_meta,
        )

        if not questions_data:
            raise HTTPException(500, "Interview model returned no questions")
        
        questions = [InterviewQuestion(**q) for q in questions_data]
        
        session_id = str(uuid.uuid4())
        session = InterviewSession(
            session_id=session_id,
            mode=mode,
            questions=questions
        )
        
        interview_sessions[session_id] = session
        project_context = []
        if isinstance(resume_data, dict):
            for project in (resume_data.get("projects", []) or [])[:8]:
                if isinstance(project, dict):
                    name = str(project.get("name", "")).strip()
                    if name:
                        project_context.append(name)

        interview_session_contexts[session_id] = {
            "job_description": job_description,
            "resume_text": resume_text,
            "quiz_context": parsed_quiz_context,
            "roadmap_context": roadmap_context,
            "project_context": project_context,
            "mode": mode,
        }

        # Persist interview session + generated questions to Supabase (best-effort)
        if _supabase_enabled():
            job_description_id = None
            if job_description:
                generated_id = str(uuid.uuid4())
                jd_ok, jd_err = supabase_service.save_job_description(
                    job_description_id=generated_id,
                    raw_text=job_description,
                )
                if jd_ok:
                    job_description_id = generated_id
                else:
                    print(f"Warning: failed to persist interview job description: {jd_err}")

            interview_ok, interview_err = supabase_service.save_interview_session(
                session_id=session_id,
                resume_id=resume_id,
                job_description_id=job_description_id,
                mode=mode,
                quiz_context=parsed_quiz_context,
                roadmap_context=roadmap_context,
                questions=[question.dict() for question in questions],
            )
            if not interview_ok:
                print(f"Warning: failed to persist interview session: {interview_err}")
        
        payload = session.dict()
        payload["generation_source"] = interview_generation_meta.get("source", "model")
        if interview_generation_meta.get("warning"):
            payload["generation_warning"] = interview_generation_meta.get("warning")
        return payload
        
    except HTTPException:
        raise
    except ai_service.AIServiceError as e:
        if e.code == "rate_limit":
            raise HTTPException(429, "Interview API is rate-limited right now. Please wait 5-10 seconds and try again.")
        if e.code in {"auth", "config"}:
            raise HTTPException(502, "Interview model is temporarily unavailable due to configuration/auth issue.")
        raise HTTPException(500, f"Error starting interview: {str(e)}")
    except Exception as e:
        raise HTTPException(500, f"Error starting interview: {str(e)}")

@router.post("/api/interview/evaluate")
async def evaluate_interview_answer(
    session_id: str = Form(...),
    question_id: str = Form(...),
    answer: str = Form(...),
    time_taken: int = Form(...)
):
    """Evaluate interview answer"""
    try:
        if session_id not in interview_sessions and not _restore_interview_session_from_db(session_id):
            raise HTTPException(404, "Interview session not found")
        
        session = interview_sessions[session_id]
        
        # Find question
        question = _resolve_interview_question(session, question_id)
        if not question:
            raise HTTPException(404, "Question not found")
        
        # Evaluate with AI
        context = interview_session_contexts.get(session_id, {})
        feedback_data = await ai_service.evaluate_interview_answer(
            question.question,
            answer,
            question.expected_keywords,
            jd_text=str(context.get("job_description", "")),
            resume_text=str(context.get("resume_text", "")),
            quiz_context=context.get("quiz_context", {}),
            roadmap_context=context.get("roadmap_context", []),
            project_context=context.get("project_context", []),
            mode=str(context.get("mode", session.mode)),
        )
        
        feedback = InterviewFeedback(
            question_id=question_id,
            score=feedback_data.get("score", 7),
            strengths=feedback_data.get("strengths", []),
            weaknesses=feedback_data.get("weaknesses", []),
            model_answer=feedback_data.get("model_answer", ""),
            confidence_level=feedback_data.get("confidence_level", "Medium"),
            improvement_tips=feedback_data.get("improvement_tips", [])
        )
        
        # Store answer and feedback
        session.answers.append(InterviewAnswer(
            question_id=question_id,
            answer=answer,
            time_taken_seconds=time_taken
        ))
        session.feedbacks.append(feedback)
        
        # Calculate overall score
        if len(session.feedbacks) == len(session.questions):
            avg_score = sum(f.score for f in session.feedbacks) / len(session.feedbacks)
            session.overall_score = avg_score
            session.readiness = "Ready" if avg_score >= 7 else "Needs Practice"
        
        return feedback.dict()
        
    except HTTPException:
        raise
    except ai_service.AIServiceError as e:
        if e.code == "rate_limit":
            raise HTTPException(429, "Interview API is rate-limited right now. Please wait a few seconds and retry your answer.")
        if e.code in {"auth", "config"}:
            raise HTTPException(502, "Interview model evaluation is temporarily unavailable.")
        raise HTTPException(500, f"Error evaluating answer: {str(e)}")
    except Exception as e:
        raise HTTPException(500, f"Error evaluating answer: {str(e)}")

@router.get("/api/interview/session/{session_id}")
async def get_interview_session(session_id: str):
    """Get interview session details"""
    if session_id not in interview_sessions and not _restore_interview_session_from_db(session_id):
        raise HTTPException(404, "Interview session not found")
    
    return interview_sessions[session_id].dict()


# ============ Progress Tracking ============

@router.post("/api/progress/track")
async def track_progress(
    resume_id: str = Form(...),
    quiz_score: Optional[float] = Form(None),
    interview_score: Optional[float] = Form(None),
    completed_task: Optional[str] = Form(None)
):
    """Track learning progress"""
    try:
        if resume_id not in progress_store:
            progress_store[resume_id] = ProgressMetrics()
        
        progress = progress_store[resume_id]
        
        if quiz_score is not None:
            progress.quiz_scores.append(quiz_score)
        
        if interview_score is not None:
            progress.interview_scores.append(interview_score)
        
        if completed_task:
            progress.completed_tasks += 1
        
        progress.last_updated = datetime.now()
        
        # AI decision on next steps
        avg_quiz = sum(progress.quiz_scores) / len(progress.quiz_scores) if progress.quiz_scores else 0
        avg_interview = sum(progress.interview_scores) / len(progress.interview_scores) if progress.interview_scores else 0
        
        if avg_quiz >= 80 and avg_interview >= 7:
            decision = AIDecision(
                decision="ready_for_interviews",
                reason="Strong performance in quizzes and mock interviews",
                next_action="Start applying to jobs",
                confidence=0.9
            )
        elif avg_quiz < 60:
            decision = AIDecision(
                decision="revise",
                topic="Core concepts",
                reason="Quiz scores indicate knowledge gaps",
                next_action="Review weak topics and retake quizzes",
                confidence=0.85
            )
        else:
            decision = AIDecision(
                decision="move_ahead",
                reason="Good progress, continue learning",
                next_action="Complete next roadmap tasks",
                confidence=0.75
            )
        
        return {
            "progress": progress.dict(),
            "ai_decision": decision.dict()
        }
        
    except Exception as e:
        raise HTTPException(500, f"Error tracking progress: {str(e)}")

@router.get("/api/progress/{resume_id}")
async def get_progress(resume_id: str):
    """Get progress metrics"""
    if resume_id not in progress_store:
        raise HTTPException(404, "Progress not found")
    
    return progress_store[resume_id].dict()

# ============ Job Search ============

@router.post("/api/jobs/search")
async def search_jobs(
    resume_id: str = Form(...),
    role: str = Form(...),
    location: str = Form("India"),
    remote: bool = Form(False)
):
    """Search for matching jobs"""
    try:
        resume = _get_resume_or_404(resume_id)
        
        preferences = {
            "role": role,
            "location": location,
            "remote": remote
        }
        
        jobs = await job_service.find_matching_jobs(resume, preferences)

        if _supabase_enabled():
            for job in jobs:
                job_description_id = str(uuid.uuid4())
                job_payload = {
                    "source": "job_recommendation",
                    "resume_id": resume_id,
                    "role": role,
                    "location": location,
                    "match_percentage": job.match_percentage,
                    "salary": job.salary,
                    "description": job.description,
                    "required_skills": job.required_skills,
                    "apply_link": job.apply_link,
                    "posted_date": job.posted_date,
                    "job_source": job.source,
                }
                jd_ok, jd_err = supabase_service.save_job_description(
                    job_description_id=job_description_id,
                    raw_text=job.description,
                    user_id=resume_id,
                    title=job.title,
                    company=job.company,
                    location=job.location,
                    parsed_data=job_payload,
                )
                if not jd_ok:
                    print(f"Warning: failed to persist job recommendation: {jd_err}")
        
        return {"jobs": [job.dict() for job in jobs]}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error searching jobs: {str(e)}")

# ============ Daily Coaching ============

@router.get("/api/coach/daily")
async def get_daily_coaching(resume_id: str):
    """Get daily coaching message"""
    try:
        today = datetime.now().strftime("%Y-%m-%d")
        
        coaching = DailyCoaching(
            date=today,
            reminder="Complete today's roadmap task",
            motivation="You're making great progress! Keep going!",
            suggestion="Practice coding for 30 minutes today",
            focus_topic="Docker containerization"
        )
        
        return coaching.dict()
        
    except Exception as e:
        raise HTTPException(500, f"Error getting coaching: {str(e)}")

# ============ Portfolio Projects ============

@router.post("/api/portfolio/suggest")
async def suggest_portfolio_projects(
    resume_id: str = Form(...),
    target_role: str = Form(...)
):
    """Suggest portfolio projects"""
    try:
        # Sample suggestions based on role
        if "frontend" in target_role.lower():
            projects = [
                ProjectSuggestion(
                    name="Real-time Chat Application",
                    description="Build a chat app with WebSocket, user authentication, and message history",
                    difficulty="Medium",
                    technologies=["React", "Node.js", "Socket.io", "MongoDB"],
                    estimated_days=14,
                    learning_outcomes=["Real-time communication", "WebSocket", "State management"],
                    resources=["Socket.io docs", "React tutorial"]
                ),
                ProjectSuggestion(
                    name="Netflix Clone",
                    description="Streaming platform UI with movie browsing and video playback",
                    difficulty="Hard",
                    technologies=["React", "TypeScript", "Tailwind", "Firebase"],
                    estimated_days=21,
                    learning_outcomes=["Complex UI", "API integration", "Authentication"],
                    resources=["React docs", "Firebase tutorial"]
                )
            ]
        else:
            projects = [
                ProjectSuggestion(
                    name="REST API with Authentication",
                    description="Build a secure API with JWT authentication and CRUD operations",
                    difficulty="Medium",
                    technologies=["Python", "FastAPI", "PostgreSQL", "JWT"],
                    estimated_days=10,
                    learning_outcomes=["API design", "Security", "Database"],
                    resources=["FastAPI docs", "JWT tutorial"]
                )
            ]
        
        return {"projects": [p.dict() for p in projects]}
        
    except Exception as e:
        raise HTTPException(500, f"Error suggesting projects: {str(e)}")
