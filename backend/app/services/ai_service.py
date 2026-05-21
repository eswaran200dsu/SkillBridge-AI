import asyncio
import httpx
import json
import re
import hashlib
import importlib
from collections import Counter
from typing import List, Dict, Any, Optional
from app.core.config import settings

try:
    redis_async = importlib.import_module("redis.asyncio")
except Exception:
    redis_async = None


STOPWORDS = {
    "and", "the", "for", "with", "that", "this", "from", "you", "your", "are", "our", "will", "have",
    "has", "had", "but", "not", "all", "any", "can", "may", "into", "onto", "using", "use", "used",
    "about", "role", "job", "description", "requirement", "requirements", "preferred", "must", "should",
    "years", "year", "experience", "responsibilities", "ability", "skills", "skill", "strong", "good",
    "work", "working", "team", "teams", "candidate", "position", "plus", "including", "knowledge",
}

SKILL_ALIASES: Dict[str, List[str]] = {
    "Python": ["python"],
    "Java": ["java"],
    "JavaScript": ["javascript", "js"],
    "TypeScript": ["typescript", "ts"],
    "React": ["react", "reactjs", "react.js"],
    "Node.js": ["node", "node.js", "nodejs", "express"],
    "HTML": ["html", "html5"],
    "CSS": ["css", "css3"],
    "SQL": ["sql"],
    "PostgreSQL": ["postgres", "postgresql"],
    "MySQL": ["mysql"],
    "MongoDB": ["mongodb", "mongo"],
    "Docker": ["docker"],
    "Kubernetes": ["kubernetes", "k8s"],
    "AWS": ["aws", "amazon web services"],
    "GCP": ["gcp", "google cloud"],
    "Azure": ["azure"],
    "Git": ["git", "github", "gitlab"],
    "REST API": ["rest", "restful", "api", "apis"],
    "GraphQL": ["graphql"],
    "Machine Learning": ["machine learning", "ml"],
    "NLP": ["nlp", "natural language processing"],
    "Data Structures": ["data structures", "dsa"],
    "Algorithms": ["algorithms", "algorithmic"],
    "System Design": ["system design", "scalability", "distributed systems"],
    "Testing": ["testing", "unit test", "integration test", "pytest", "jest"],
    "CI/CD": ["ci/cd", "ci", "cd", "pipeline"],
}

ROLE_DEFAULT_SKILLS: Dict[str, List[str]] = {
    "software engineer": ["Python", "JavaScript", "SQL", "Git", "REST API", "Testing"],
    "frontend": ["HTML", "CSS", "JavaScript", "React", "TypeScript", "Testing"],
    "backend": ["Python", "Node.js", "SQL", "PostgreSQL", "REST API", "Docker"],
    "full stack": ["React", "Node.js", "JavaScript", "SQL", "REST API", "Git"],
    "data": ["Python", "SQL", "Machine Learning", "NLP"],
    "ai": ["Python", "Machine Learning", "NLP", "SQL"],
}

_cache_client = None


def _cache_ttl_seconds() -> int:
    return max(60, int(getattr(settings, "CACHE_TTL_MINUTES", 15)) * 60)


def _stable_hash(value: Any) -> str:
    if isinstance(value, (dict, list)):
        text = json.dumps(value, sort_keys=True, ensure_ascii=True)
    else:
        text = str(value or "")
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:24]


async def _get_cache_client():
    global _cache_client

    if redis_async is None:
        return None

    if _cache_client is not None:
        return _cache_client

    try:
        _cache_client = redis_async.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
        return _cache_client
    except Exception:
        _cache_client = None
        return None


async def _cache_get_json(key: str) -> Optional[Any]:
    client = await _get_cache_client()
    if client is None:
        return None
    try:
        raw = await client.get(key)
        if not raw:
            return None
        return json.loads(raw)
    except Exception:
        return None


async def _cache_set_json(key: str, value: Any):
    client = await _get_cache_client()
    if client is None:
        return
    try:
        await client.setex(key, _cache_ttl_seconds(), json.dumps(value, ensure_ascii=True))
    except Exception:
        return


def _normalize_space(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def _contains_alias(text_lower: str, alias: str) -> bool:
    escaped = re.escape(alias.lower())
    return re.search(rf"(?<!\w){escaped}(?!\w)", text_lower) is not None


def _extract_skills(text: str) -> List[str]:
    text_lower = (text or "").lower()
    found: List[str] = []
    for canonical, aliases in SKILL_ALIASES.items():
        if any(_contains_alias(text_lower, alias) for alias in aliases):
            found.append(canonical)
    return found


def _extract_required_years(jd_text: str, target_role: str) -> float:
    jd = (jd_text or "").lower()
    range_match = re.search(r"(\d+(?:\.\d+)?)\s*[-to]{1,3}\s*(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:years?|yrs?)", jd)
    if range_match:
        return float(range_match.group(1))

    direct_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:years?|yrs?)", jd)
    if direct_match:
        return float(direct_match.group(1))

    role_lower = (target_role or "software engineer").lower()
    if "intern" in role_lower or "fresher" in role_lower or "junior" in role_lower:
        return 0.0
    if "senior" in role_lower or "lead" in role_lower:
        return 5.0
    return 2.0


def _years_from_duration(duration: str) -> float:
    if not duration:
        return 0.0

    text = duration.lower()
    years = 0.0
    y_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:years?|yrs?)", text)
    if y_match:
        years += float(y_match.group(1))

    m_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:months?|mos?)", text)
    if m_match:
        years += float(m_match.group(1)) / 12.0

    if years > 0:
        return years

    date_match = re.findall(r"(20\d{2})", text)
    if len(date_match) >= 2:
        start_year = int(date_match[0])
        end_year = int(date_match[-1])
        if end_year >= start_year:
            return float(end_year - start_year)

    return 0.0


def _extract_candidate_years(resume_text: str, resume_data: Optional[Dict[str, Any]]) -> float:
    text_lower = (resume_text or "").lower()

    explicit = re.search(r"(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:years?|yrs?)\s+(?:of\s+)?experience", text_lower)
    if explicit:
        return float(explicit.group(1))

    total = 0.0
    experiences = (resume_data or {}).get("experiences", []) if isinstance(resume_data, dict) else []
    for exp in experiences:
        if isinstance(exp, dict):
            total += _years_from_duration(str(exp.get("duration", "")))

    if total > 0:
        return min(total, 25.0)

    if experiences:
        return float(min(len(experiences), 10))

    return 0.0


def _extract_education_requirements(jd_text: str) -> Dict[str, str]:
    jd_lower = (jd_text or "").lower()
    level = "any"
    if "phd" in jd_lower or "doctorate" in jd_lower:
        level = "phd"
    elif "master" in jd_lower or "m.tech" in jd_lower or "ms" in jd_lower:
        level = "master"
    elif "bachelor" in jd_lower or "b.tech" in jd_lower or "bs" in jd_lower or "b.e" in jd_lower:
        level = "bachelor"

    field = ""
    for candidate in ["computer science", "software engineering", "information technology", "data science", "electronics"]:
        if candidate in jd_lower:
            field = candidate
            break

    return {"level": level, "field": field}


def _education_score(resume_data: Optional[Dict[str, Any]], jd_text: str) -> float:
    requirements = _extract_education_requirements(jd_text)
    level_required = requirements["level"]
    field_required = requirements["field"]

    education = (resume_data or {}).get("education", []) if isinstance(resume_data, dict) else []
    edu_text = " ".join([_normalize_space(str(e.get("degree", ""))) for e in education if isinstance(e, dict)]).lower()

    if not edu_text:
        return 3.0

    has_tech_field = any(keyword in edu_text for keyword in ["computer", "software", "information", "it", "electronics", "data"])
    level_match = (
        level_required == "any"
        or (level_required == "bachelor" and any(k in edu_text for k in ["bachelor", "b.tech", "be", "b.e", "bs"]))
        or (level_required == "master" and any(k in edu_text for k in ["master", "m.tech", "ms", "m.s"]))
        or (level_required == "phd" and ("phd" in edu_text or "doctorate" in edu_text))
    )
    field_match = (not field_required) or (field_required in edu_text)

    if level_match and field_match:
        return 10.0
    if has_tech_field:
        return 7.0
    return 3.0


def _extract_keywords(jd_text: str, required_skills: List[str]) -> List[str]:
    tokens = re.findall(r"[a-zA-Z][a-zA-Z0-9+#.-]{2,}", (jd_text or "").lower())
    filtered = [token for token in tokens if token not in STOPWORDS and len(token) >= 3]
    freq = Counter(filtered)

    ranked = [word for word, _ in freq.most_common(25)]
    skill_terms: List[str] = []
    for skill in required_skills:
        skill_terms.extend([part.lower() for part in re.split(r"\s+", skill) if part])

    ordered = []
    for token in skill_terms + ranked:
        if token and token not in ordered and token not in STOPWORDS:
            ordered.append(token)
    return ordered[:30]


def _project_relevance_score(required_skills: List[str], resume_text: str, resume_data: Optional[Dict[str, Any]]) -> float:
    projects = (resume_data or {}).get("projects", []) if isinstance(resume_data, dict) else []
    project_text = ""
    if projects:
        parts = []
        for project in projects:
            if isinstance(project, dict):
                parts.append(str(project.get("name", "")))
                parts.append(str(project.get("description", "")))
                parts.extend([str(t) for t in project.get("technologies", [])])
        project_text = _normalize_space(" ".join(parts)).lower()
    else:
        project_text = (resume_text or "").lower()

    if not required_skills:
        return 8.0

    hits = sum(1 for skill in required_skills if skill.lower() in project_text)
    ratio = hits / max(1, len(required_skills))
    if ratio >= 0.6:
        return 15.0
    if ratio >= 0.45:
        return 12.0
    if ratio >= 0.3:
        return 9.0
    if ratio > 0:
        return 5.0
    return 3.0


def _resume_quality_score(resume_text: str) -> float:
    text = (resume_text or "").lower()
    sections = ["summary", "skills", "experience", "education", "project"]
    section_hits = sum(1 for section in sections if section in text)

    quantified = len(re.findall(r"\b\d+\s*%\b|\b\d+(?:\.\d+)?\s*(?:x|k|m|million|users|hours|days|weeks|months)\b", text))
    bullet_like = len(re.findall(r"(^\s*[-*•])|(;\s)|(:\s)", resume_text or "", flags=re.MULTILINE))

    if section_hits >= 4 and quantified >= 3 and bullet_like >= 3:
        return 10.0
    if section_hits >= 3 and quantified >= 1:
        return 8.0
    if section_hits >= 2:
        return 6.0
    return 4.0


def _keyword_stuffing_detected(resume_text: str, keywords: List[str]) -> bool:
    text = (resume_text or "").lower()
    repeated = 0
    for keyword in keywords[:20]:
        if len(keyword) < 3:
            continue
        count = len(re.findall(rf"(?<!\w){re.escape(keyword)}(?!\w)", text))
        if count >= 12:
            repeated += 1
    return repeated >= 2


def _infer_required_skills(jd_text: str, target_role: str) -> List[str]:
    from_jd = _extract_skills(jd_text)
    if from_jd:
        return from_jd

    role_lower = (target_role or "software engineer").lower()
    for role_key, defaults in ROLE_DEFAULT_SKILLS.items():
        if role_key in role_lower:
            return defaults
    return ROLE_DEFAULT_SKILLS["software engineer"]


def _build_jd_match_fallback(
    resume_text: str,
    jd_text: str,
    resume_data: Optional[Dict[str, Any]],
    reason: str,
) -> Dict[str, Any]:
    required_skills = _infer_required_skills(jd_text, "software engineer")
    resume_skill_set = set(_extract_skills(resume_text))

    if isinstance(resume_data, dict):
        for skill in resume_data.get("skills", []):
            if isinstance(skill, dict) and skill.get("name"):
                resume_skill_set.add(str(skill.get("name")).strip())

    matched_skills = [skill for skill in required_skills if skill in resume_skill_set]
    missing_skills = [skill for skill in required_skills if skill not in resume_skill_set]

    resume_lower = (resume_text or "").lower()
    jd_lower = (jd_text or "").lower()
    keyword_hits = sum(1 for skill in required_skills if skill.lower() in jd_lower and skill.lower() in resume_lower)
    keyword_ratio = keyword_hits / max(1, len(required_skills))

    skills_ratio = len(matched_skills) / max(1, len(required_skills))
    experience_score = min(20.0, _extract_candidate_years(resume_text, resume_data) * 4.0)
    education_score = _education_score(resume_data, jd_text)
    project_score = _project_relevance_score(required_skills, resume_text, resume_data)
    quality_score = _resume_quality_score(resume_text)

    match_percentage = round(
        min(
            100.0,
            max(
                18.0,
                (skills_ratio * 42.0)
                + (keyword_ratio * 18.0)
                + experience_score
                + education_score
                + project_score
                + quality_score,
            ),
        ),
        1,
    )

    focus_candidates = missing_skills[:5]
    if len(focus_candidates) < 5:
        for skill in required_skills:
            if skill not in focus_candidates:
                focus_candidates.append(skill)
            if len(focus_candidates) >= 5:
                break

    focus_areas = []
    priority_map = ["HIGH", "HIGH", "MEDIUM", "MEDIUM", "LOW"]
    study_map = ["2-3 days", "3-5 days", "1 week", "1 week", "1-2 weeks"]
    for index, skill in enumerate(focus_candidates[:5]):
        focus_areas.append({
            "skill": skill,
            "priority": priority_map[index],
            "weight": float(max(8, 30 - index * 4)),
            "reason": (
                f"{skill} is not strongly represented in your extracted resume data and is important in the JD."
                if skill in missing_skills
                else f"{skill} appears in the JD and should be reinforced with stronger evidence."
            ),
            "study_time": study_map[index],
        })

    suggestions = [
        f"Add stronger evidence for {focus_areas[0]['skill']} in your summary, skills, and project bullets.",
        "Mirror the JD wording naturally in your experience and project descriptions.",
        "Add one project bullet with measurable impact, scale, or performance improvements.",
        "Convert weak areas into explicit accomplishments with metrics, tools, and outcomes.",
    ]

    strengths = []
    if matched_skills:
        strengths.append(f"Resume already demonstrates {', '.join(matched_skills[:3])}")
    if education_score >= 7:
        strengths.append("Education background aligns reasonably with the target role")
    if experience_score >= 10:
        strengths.append("Experience depth is relevant for the role")

    weaknesses = []
    if missing_skills:
        weaknesses.append(f"Missing or weak coverage for {', '.join(missing_skills[:4])}")
    if project_score < 9:
        weaknesses.append("Projects need stronger alignment with JD requirements")
    if quality_score < 6:
        weaknesses.append("Resume structure can be improved for ATS readability")

    hire_probability = "High" if match_percentage >= 80 else "Medium" if match_percentage >= 60 else "Low"

    return {
        "match_percentage": match_percentage,
        "hire_probability": hire_probability,
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "focus_areas": focus_areas,
        "interview_topics": [skill for skill in focus_candidates[:4]] + ["Projects", "System Design"],
        "strengths": strengths or ["Resume data parsed successfully"],
        "weaknesses": weaknesses or ["Live JD model temporarily unavailable"],
        "suggestions": suggestions,
        "source": "jd_structured_fallback",
        "warning": reason,
    }


class AIServiceError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code

def _extract_text_from_response_payload(data: Dict[str, Any]) -> Optional[str]:
    # OpenAI/Oxlo style: {"choices": [{"message": {"content": "..."}}]}
    choices = data.get("choices")
    if isinstance(choices, list) and choices:
        message = choices[0].get("message", {}) if isinstance(choices[0], dict) else {}
        content = message.get("content", "") if isinstance(message, dict) else ""
        if isinstance(content, str) and content.strip():
            return content.strip()

    # Anthropic style: {"content": [{"type": "text", "text": "..."}]}
    if "content" in data and isinstance(data["content"], list):
        for block in data["content"]:
            if isinstance(block, dict) and block.get("type") == "text":
                text = block.get("text", "").strip()
                if text:
                    return text

    if isinstance(data.get("text"), str) and data.get("text").strip():
        return data.get("text").strip()

    return None


async def call_model_chat(
    messages: List[Dict[str, str]],
    endpoint: str,
    api_key: str,
    model: str,
    temperature: float = 0.7,
    max_tokens: int = 2000,
    require_authorization_header: bool = False,
    request_timeout_seconds: Optional[int] = None,
) -> str:
    """Call a chat model endpoint with explicit credentials and model routing."""

    if not api_key:
        raise AIServiceError("config", "API key is not configured")

    if not endpoint:
        raise AIServiceError("config", "Chat endpoint is not configured")

    if not model:
        raise AIServiceError("config", "Model name is not configured")

    api_key = api_key.strip()
    if api_key.lower().startswith("bearer "):
        api_key = api_key[7:].strip()
    if not api_key:
        raise AIServiceError("config", "API key is empty after normalization")

    auth_header_variants = [
        {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        {
            "Authorization": f"Bearer {api_key}",
            "x-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    ]
    api_key_only_variants = [
        {
            "x-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        {
            "api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        {
            "X-API-Key": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    ]
    # Quiz route should enforce Authorization-bearing headers only to avoid
    # provider-side 401 "Missing Authorization header" responses.
    header_variants = auth_header_variants[:1] if require_authorization_header else (auth_header_variants + api_key_only_variants)
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    last_response = None
    if request_timeout_seconds is not None:
        timeout_seconds = max(12, min(90, int(request_timeout_seconds)))
    else:
        timeout_seconds = max(15, min(45, int(getattr(settings, "API_TIMEOUT_SECONDS", 20)) * 2))
    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        for headers in header_variants:
            for attempt in range(2):
                try:
                    response = await client.post(endpoint, headers=headers, json=payload)
                except Exception as e:
                    if isinstance(e, (httpx.ReadTimeout, httpx.ConnectTimeout, httpx.TimeoutException)):
                        if attempt == 0:
                            await asyncio.sleep(0.35)
                            continue
                        raise AIServiceError("timeout", "AI API request timed out") from e
                    error_detail = str(e).strip() or e.__class__.__name__
                    raise AIServiceError("network", f"AI API request failed: {error_detail}") from e

                if response.status_code == 200:
                    last_response = response
                    break

                response_text = (response.text or "")[:220]
                missing_auth_header = (
                    response.status_code in (401, 403)
                    and "missing authorization header" in response_text.lower()
                )

                # Retry auth format on auth failures only.
                if response.status_code in (401, 403):
                    last_response = response
                    # If gateway explicitly requires Authorization, skip
                    # api-key-only variants to avoid misleading final errors.
                    if missing_auth_header and "Authorization" not in headers:
                        continue
                    break

                if response.status_code in (429, 502, 503, 504) and attempt == 0:
                    wait_seconds = 2
                    if response.status_code == 429:
                        try:
                            payload_json = response.json()
                            retry_after = int(payload_json.get("retry_after", 2))
                            wait_seconds = max(1, min(5, retry_after))
                        except Exception:
                            wait_seconds = 2
                    await asyncio.sleep(wait_seconds)
                    continue

                if response.status_code == 429:
                    raise AIServiceError("rate_limit", f"AI API rate limit exceeded: {response_text}")

                code = "http_error"
                raise AIServiceError(code, f"AI API request failed: status={response.status_code}, body={response_text}")

            if last_response and last_response.status_code == 200:
                break

    if not last_response or last_response.status_code != 200:
        status_code = last_response.status_code if last_response is not None else 0
        body = (last_response.text or "")[:220] if last_response is not None else "No response body"
        error_code = "auth" if status_code in (401, 403) else "http_error"
        raise AIServiceError(error_code, f"AI API request failed: status={status_code}, body={body}")

    try:
        data = last_response.json()
    except Exception as e:
        raise AIServiceError("parse", f"Invalid JSON response from AI API: {str(e)}") from e

    text = _extract_text_from_response_payload(data)
    if text:
        return text

    raise AIServiceError("parse", f"No textual content in response payload keys={list(data.keys())}")


def _should_retry_with_fallback_key(error: Exception) -> bool:
    return isinstance(error, AIServiceError) and error.code == "rate_limit"


def _mask_key_for_logs(key: str) -> str:
    value = str(key or "").strip()
    if not value:
        return "missing"
    if len(value) <= 10:
        return "*" * len(value)
    return f"{value[:6]}...{value[-4:]}"


def _normalize_route_model(route_name: str, model: str) -> str:
    normalized_model = str(model or "").strip()
    if not normalized_model:
        return "deepseek-r1-8b" if route_name in {"quiz", "interview", "roadmap"} else normalized_model

    model_lower = normalized_model.lower()
    if route_name in {"quiz", "interview", "roadmap"} and (
        "gemma" in model_lower
        or "claude" in model_lower
        or "gpt-4" in model_lower
        or "o1" in model_lower
        or "deepseek-coder-33b" in model_lower
        or model_lower.endswith("33b")
        or model_lower.endswith("70b")
        or "coder" in model_lower
        or "premium" in model_lower
    ):
        return "deepseek-r1-8b"

    return normalized_model


def _resolve_db_primary_api_key() -> tuple[str, str]:
    """Try loading persisted API key from Supabase encrypted storage."""
    encryption_secret = str(getattr(settings, "API_KEY_ENCRYPTION_SECRET", "") or "").strip()
    if not encryption_secret:
        return "", "API_KEY_ENCRYPTION_SECRET not configured"

    try:
        from app.services.supabase_service import supabase_service
    except Exception:
        return "", "Supabase service import failed"

    enabled_attr = getattr(supabase_service, "enabled", False)
    enabled = bool(enabled_attr() if callable(enabled_attr) else enabled_attr)
    if not enabled:
        return "", "Supabase is not enabled"

    ok, db_key, err = supabase_service.get_runtime_api_key(
        scope_key="global",
        encryption_secret=encryption_secret,
    )
    if not ok or not db_key:
        return "", err or "DB key lookup failed"

    key = str(db_key).strip().strip('"').strip("'")
    if key.lower().startswith("bearer "):
        key = key[7:].strip()
    return key, ""


async def _call_model_chat_with_fallback_key(
    messages: List[Dict[str, str]],
    endpoint: str,
    api_key: str,
    fallback_api_key: str,
    model: str,
    route_name: str,
    temperature: float = 0.7,
    max_tokens: int = 2000,
    require_authorization_header: bool = False,
    request_timeout_seconds: Optional[int] = None,
) -> str:
    fallback_key = (fallback_api_key or "").strip().strip('"').strip("'")
    route_key = (api_key or "").strip().strip('"').strip("'")
    db_primary_key, db_lookup_detail = _resolve_db_primary_api_key()
    default_primary_key = (getattr(settings, "OXLO_API_KEY", "") or "").strip().strip('"').strip("'")

    if fallback_key.lower().startswith("bearer "):
        fallback_key = fallback_key[7:].strip()
    if route_key.lower().startswith("bearer "):
        route_key = route_key[7:].strip()
    if default_primary_key.lower().startswith("bearer "):
        default_primary_key = default_primary_key[7:].strip()

    if db_primary_key.lower().startswith("bearer "):
        db_primary_key = db_primary_key[7:].strip()

    primary_source = ""
    if db_primary_key:
        primary_key = db_primary_key
        primary_source = "db"
    elif route_key and route_key != fallback_key:
        primary_key = route_key
        primary_source = "route"
    elif default_primary_key:
        primary_key = default_primary_key
        primary_source = "env_default"
    else:
        raise AIServiceError(
            "config",
            "Primary API key is missing or invalid. Set OXLO_API_KEY and keep it different from OXLO_FALLBACK_API_KEY.",
        )

    print(
        f"[AI KEY] route={route_name} source={primary_source} key={_mask_key_for_logs(primary_key)} "
        f"db_lookup={'ok' if db_primary_key else db_lookup_detail}"
    )

    candidate_keys: List[tuple[str, str]] = []
    seen_keys = set()
    for source_name, candidate_key in [
        ("db", db_primary_key),
        ("route", route_key),
        ("env_default", default_primary_key),
        ("fallback", fallback_key),
    ]:
        if candidate_key and candidate_key not in seen_keys:
            candidate_keys.append((source_name, candidate_key))
            seen_keys.add(candidate_key)

    last_error: Optional[Exception] = None
    for candidate_source, candidate_key in candidate_keys:
        try:
            return await call_model_chat(
                messages=messages,
                endpoint=endpoint,
                api_key=candidate_key,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                require_authorization_header=require_authorization_header,
                request_timeout_seconds=request_timeout_seconds,
            )
        except Exception as primary_error:
            last_error = primary_error
            if not isinstance(primary_error, AIServiceError):
                raise

            if primary_error.code in {"auth", "config", "rate_limit"}:
                print(
                    f"[AI KEY] route={route_name} candidate={candidate_source} failed reason={str(primary_error)}"
                )
                continue

            raise

    if last_error is not None:
        raise last_error

    try:
        raise AIServiceError("config", "No usable API key candidates were available")
    except Exception:
        raise


async def call_ats_chat(
    messages: List[Dict[str, str]],
    temperature: float = 0.7,
    max_tokens: int = 2000,
) -> str:
    return await _call_model_chat_with_fallback_key(
        messages=messages,
        endpoint=settings.ATS_CHAT_ENDPOINT,
        api_key=settings.ATS_API_KEY,
        fallback_api_key=settings.OXLO_FALLBACK_API_KEY,
        model=settings.ATS_MODEL,
        route_name="ats",
        temperature=temperature,
        max_tokens=max_tokens,
    )


async def call_jd_chat(
    messages: List[Dict[str, str]],
    temperature: float = 0.7,
    max_tokens: int = 2000,
) -> str:
    return await _call_model_chat_with_fallback_key(
        messages=messages,
        endpoint=settings.JD_CHAT_ENDPOINT,
        api_key=settings.JD_API_KEY,
        fallback_api_key=settings.OXLO_FALLBACK_API_KEY,
        model=settings.JD_MODEL,
        route_name="jd",
        temperature=temperature,
        max_tokens=max_tokens,
    )


async def call_roadmap_chat(
    messages: List[Dict[str, str]],
    temperature: float = 0.7,
    max_tokens: int = 2000,
) -> str:
    model = _normalize_route_model("roadmap", settings.ROADMAP_MODEL)
    return await _call_model_chat_with_fallback_key(
        messages=messages,
        endpoint=settings.ROADMAP_CHAT_ENDPOINT,
        api_key=settings.ROADMAP_API_KEY,
        fallback_api_key=settings.OXLO_FALLBACK_API_KEY,
        model=model,
        route_name="roadmap",
        temperature=temperature,
        max_tokens=max_tokens,
        require_authorization_header=True,
    )


async def call_quiz_chat(
    messages: List[Dict[str, str]],
    temperature: float = 0.7,
    max_tokens: int = 2000,
) -> str:
    model = _normalize_route_model("quiz", settings.QUIZ_MODEL)
    return await _call_model_chat_with_fallback_key(
        messages=messages,
        endpoint=settings.QUIZ_CHAT_ENDPOINT,
        api_key=settings.QUIZ_API_KEY,
        fallback_api_key=settings.OXLO_FALLBACK_API_KEY,
        model=model,
        route_name="quiz",
        temperature=temperature,
        max_tokens=max_tokens,
        require_authorization_header=True,
        request_timeout_seconds=getattr(settings, "QUIZ_API_TIMEOUT_SECONDS", 35),
    )


async def call_interview_chat(
    messages: List[Dict[str, str]],
    temperature: float = 0.7,
    max_tokens: int = 2000,
) -> str:
    model = _normalize_route_model("interview", settings.INTERVIEW_MODEL)
    return await _call_model_chat_with_fallback_key(
        messages=messages,
        endpoint=settings.INTERVIEW_CHAT_ENDPOINT,
        api_key=settings.INTERVIEW_API_KEY,
        fallback_api_key=settings.OXLO_FALLBACK_API_KEY,
        model=model,
        route_name="interview",
        temperature=temperature,
        max_tokens=max_tokens,
        require_authorization_header=True,
    )


def _allow_rate_limit_fallback(error: Exception) -> bool:
    return (
        settings.ENABLE_RATE_LIMIT_FALLBACK
        and isinstance(error, AIServiceError)
        and error.code == "rate_limit"
    )


def _quiz_reason_is_rate_limited(reason: str) -> bool:
    normalized_reason = reason.lower()
    return "rate_limit" in normalized_reason or "rate limit" in normalized_reason or "429" in normalized_reason


async def call_oxlo_chat(
    messages: List[Dict[str, str]],
    temperature: float = 0.7,
    max_tokens: int = 2000,
) -> str:
    """Backward-compatible alias; defaults to ATS model routing."""
    return await call_ats_chat(messages=messages, temperature=temperature, max_tokens=max_tokens)

def _get_fallback_response(messages: List[Dict[str, str]]) -> str:
    """Fallback response when API is not available"""
    last_message = messages[-1]["content"] if messages else ""
    
    if "resume" in last_message.lower() and "analyze" in last_message.lower():
        return json.dumps({
            "ats_score": 72,
            "problems": [
                "Missing quantifiable metrics in experience bullets",
                "Weak action verbs used",
                "No keywords matching job description"
            ],
            "suggestions": [
                "Add specific numbers and percentages to achievements",
                "Use strong action verbs like 'Architected', 'Optimized', 'Led'",
                "Include relevant technical keywords"
            ]
        })
    
    return "I'm currently in demo mode. Please configure OXLO_API_KEY for full functionality."

async def analyze_resume_with_ai(resume_text: str) -> Dict[str, Any]:
    """Analyze resume and return ATS score + problems"""
    
    prompt = f"""Analyze this resume and provide:
1. ATS score (0-100)
2. List of problems (formatting, content, keywords, grammar)
3. Missing keywords
4. Strong points
5. Suggestions for improvement

Resume:
{resume_text}

Return response in JSON format with keys: ats_score, problems, missing_keywords, strong_points, suggestions"""
    
    messages = [
        {"role": "system", "content": "You are an expert resume analyzer and ATS specialist."},
        {"role": "user", "content": prompt}
    ]
    
    response = await call_ats_chat(messages, temperature=0.3)
    
    try:
        return json.loads(response)
    except:
        return {
            "ats_score": 70,
            "problems": ["Generic content", "Missing metrics"],
            "missing_keywords": ["Docker", "CI/CD"],
            "strong_points": ["Good experience", "Relevant projects"],
            "suggestions": ["Add quantifiable achievements"]
        }


async def improve_resume_bullets(experiences: List[Dict], job_context: str = "") -> List[Dict]:
    """Improve resume bullet points with AI"""
    
    bullets = []
    for exp in experiences:
        for desc in exp.get("description", []):
            bullets.append(desc)
    
    prompt = f"""Improve these resume bullet points to be more impactful:

Bullets:
{chr(10).join(f"- {b}" for b in bullets)}

Job Context: {job_context}

For each bullet, provide:
1. Improved version with metrics and strong action verbs
2. Reason for improvement
3. Impact score (1-10)

Return as JSON array with keys: original, improved, reason, impact_score"""
    
    messages = [
        {"role": "system", "content": "You are an expert resume writer who creates compelling, metric-driven bullet points."},
        {"role": "user", "content": prompt}
    ]
    
    try:
        response = await call_ats_chat(messages, temperature=0.5)
    except Exception as e:
        if not _allow_rate_limit_fallback(e):
            raise
        return [
            {
                "original": bullets[0] if bullets else "Worked on projects",
                "improved": "Built and shipped production features with measurable impact on users and performance.",
                "reason": "Fallback suggestion generated because ATS model rate limit was reached.",
                "impact_score": 7,
            }
        ]
    
    try:
        return json.loads(response)
    except:
        return [
            {
                "original": bullets[0] if bullets else "Worked on projects",
                "improved": "Architected and deployed 5+ microservices handling 100K+ daily requests, reducing latency by 40%",
                "reason": "Added specific metrics and impact",
                "impact_score": 9
            }
        ]

def _build_resume_context_for_jd(resume_text: str, resume_data: Optional[Dict[str, Any]], max_chars: int = 2600) -> str:
    parts: List[str] = []

    if isinstance(resume_data, dict):
        skills = [
            str(skill.get("name", "")).strip()
            for skill in resume_data.get("skills", [])
            if isinstance(skill, dict) and str(skill.get("name", "")).strip()
        ]
        experiences = [
            {
                "title": str(exp.get("title", "")).strip(),
                "company": str(exp.get("company", "")).strip(),
                "duration": str(exp.get("duration", "")).strip(),
            }
            for exp in resume_data.get("experiences", [])
            if isinstance(exp, dict)
        ]
        projects = [
            str(project.get("name", "")).strip()
            for project in resume_data.get("projects", [])
            if isinstance(project, dict) and str(project.get("name", "")).strip()
        ]
        education = [
            str(edu.get("degree", "")).strip()
            for edu in resume_data.get("education", [])
            if isinstance(edu, dict) and str(edu.get("degree", "")).strip()
        ]

        if skills:
            parts.append(f"Skills: {', '.join(skills[:20])}")
        if experiences:
            exp_summary = "; ".join(
                f"{item['title']} at {item['company']} ({item['duration']})".strip()
                for item in experiences[:8]
                if item.get("title") or item.get("company")
            )
            if exp_summary:
                parts.append(f"Experience: {exp_summary}")
        if projects:
            parts.append(f"Projects: {', '.join(projects[:10])}")
        if education:
            parts.append(f"Education: {', '.join(education[:5])}")

    raw = (resume_text or "").strip()
    if raw:
        parts.append(f"Raw resume excerpt: {raw[:max_chars]}")

    combined = "\n".join(part for part in parts if part).strip()
    return combined[:max_chars] if combined else raw[:max_chars]


def _normalize_model_jd_payload(raw: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError("JD model response must be a JSON object")

    def _to_string_list(value: Any) -> List[str]:
        if isinstance(value, list):
            out: List[str] = []
            for item in value:
                text = str(item or "").strip()
                if text:
                    out.append(text)
            return out

        if isinstance(value, str):
            text = value.strip()
            if not text:
                return []
            # Handle model outputs that collapse arrays into a single sentence/blob.
            if "\n" in text:
                parts = [part.strip(" -•\t") for part in text.splitlines() if part.strip()]
                return [part for part in parts if part]
            if ";" in text:
                parts = [part.strip() for part in text.split(";") if part.strip()]
                return [part for part in parts if part]
            return [text]

        return []

    normalized_focus_areas: List[Dict[str, Any]] = []
    incoming_focus_areas = raw.get("focus_areas", [])
    if isinstance(incoming_focus_areas, list):
        for index, area in enumerate(incoming_focus_areas):
            if not isinstance(area, dict):
                continue

            skill = str(
                area.get("skill")
                or area.get("skill_name")
                or area.get("name")
                or ""
            ).strip()
            if not skill:
                continue

            study_time = str(
                area.get("study_time")
                or area.get("studyTime")
                or area.get("estimated_study_time")
                or "1-2 weeks"
            ).strip() or "1-2 weeks"

            priority = str(area.get("priority", "MEDIUM")).strip().upper() or "MEDIUM"
            if priority not in {"HIGH", "MEDIUM", "LOW"}:
                priority = "MEDIUM"

            try:
                weight = float(area.get("weight", max(8, 30 - index * 4)))
            except Exception:
                weight = float(max(8, 30 - index * 4))

            reason = str(
                area.get("reason")
                or f"{skill} appears important in the JD and should be strengthened."
            ).strip()

            normalized_focus_areas.append(
                {
                    "skill": skill,
                    "priority": priority,
                    "weight": weight,
                    "reason": reason,
                    "study_time": study_time,
                }
            )

    return {
        "match_percentage": max(0, min(100, float(raw.get("match_percentage", 0)))),
        "hire_probability": str(raw.get("hire_probability", "Medium")),
        "matched_skills": _to_string_list(raw.get("matched_skills", [])),
        "missing_skills": _to_string_list(raw.get("missing_skills", [])),
        "focus_areas": normalized_focus_areas,
        "interview_topics": _to_string_list(raw.get("interview_topics", [])),
        "strengths": _to_string_list(raw.get("strengths", [])),
        "weaknesses": _to_string_list(raw.get("weaknesses", [])),
        "suggestions": _to_string_list(raw.get("suggestions", [])),
    }


def _build_quiz_fallback_questions(
    topic: str,
    difficulty: str,
    count: int,
    domain: str,
    resume_text: str,
    jd_text: str,
    roadmap_context: Optional[List[Dict[str, Any]]],
    reason: str,
) -> List[Dict[str, Any]]:
    def _ordered_unique(values: List[str]) -> List[str]:
        ordered: List[str] = []
        seen = set()
        for value in values:
            cleaned = str(value).strip()
            lowered = cleaned.lower()
            if cleaned and lowered not in seen:
                ordered.append(cleaned)
                seen.add(lowered)
        return ordered

    domain_lower = (domain or "").lower()
    resume_skills = _extract_skills(resume_text)
    jd_skills = _extract_skills(jd_text)
    roadmap_skills: List[str] = []
    for item in roadmap_context or []:
        if isinstance(item, dict):
            skill = str(item.get("skill", "")).strip()
            if skill:
                roadmap_skills.append(skill)

    skill_pool = _ordered_unique(resume_skills + jd_skills + roadmap_skills)

    if domain_lower.startswith("coding"):
        topic_pool = [
            "Arrays and Hashing",
            "Strings and Pattern Matching",
            "Two Pointers",
            "Stacks and Queues",
            "Linked Lists",
            "Trees and BSTs",
            "Graphs",
            "Recursion",
            "Dynamic Programming",
            "Time Complexity",
        ]
        question_bank = {
            "Arrays and Hashing": (
                "Which approach is most efficient for checking whether a list contains duplicate values?",
                [
                    "Sort the list and compare adjacent elements",
                    "Use a hash set to track seen values",
                    "Use nested loops for every pair",
                    "Convert the list to a string and search it",
                ],
                1,
            ),
            "Strings and Pattern Matching": (
                "Which technique is usually best for finding a short pattern inside a longer string in linear time?",
                [
                    "Brute-force comparison at every position",
                    "A sliding window with a hash table only",
                    "A linear-time pattern matching algorithm",
                    "Sorting the characters of both strings",
                ],
                2,
            ),
            "Two Pointers": (
                "When is the two-pointer technique most useful?",
                [
                    "When the problem involves two sorted or partially ordered scans",
                    "Only when recursion is required",
                    "Only for graph traversal problems",
                    "Only when dynamic programming tables are needed",
                ],
                0,
            ),
            "Stacks and Queues": (
                "Which data structure is best for evaluating nested expressions with matching delimiters?",
                ["Queue", "Stack", "Heap", "Trie"],
                1,
            ),
            "Trees and BSTs": (
                "What traversal is typically used to visit a binary search tree in sorted order?",
                ["Pre-order traversal", "Level-order traversal", "In-order traversal", "Post-order traversal"],
                2,
            ),
            "Graphs": (
                "Which search strategy is commonly used for shortest paths in an unweighted graph?",
                ["Depth-first search", "Breadth-first search", "Binary search", "Topological sort"],
                1,
            ),
            "Recursion": (
                "What is the main requirement for a recursive solution to terminate correctly?",
                ["A base case", "A global variable", "Sorting the input first", "A queue of pending calls"],
                0,
            ),
            "Dynamic Programming": (
                "What problem pattern usually benefits from dynamic programming?",
                [
                    "Independent subproblems with repeated overlap",
                    "Only one-time random access lookups",
                    "Problems that never reuse intermediate results",
                    "Only sorting problems",
                ],
                0,
            ),
            "Time Complexity": (
                "What is the big-O time complexity of scanning an array once?",
                ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
                2,
            ),
        }
    else:
        topic_pool = [
            "REST APIs",
            "React State",
            "SQL Queries",
            "Authentication",
            "Caching",
            "Testing",
            "Deployment",
            "Debugging",
            "Performance",
            "Security",
        ]
        question_bank = {
            "REST APIs": (
                "Which HTTP method should be used to update an existing resource when the client sends the full replacement payload?",
                ["GET", "POST", "PUT", "TRACE"],
                2,
            ),
            "React State": (
                "What is the safest way to update state that depends on the previous state value in React?",
                [
                    "Read the state variable directly and set it later",
                    "Use the functional state updater form",
                    "Mutate the state object in place",
                    "Store the value in a module-level variable",
                ],
                1,
            ),
            "SQL Queries": (
                "Which SQL clause filters rows after aggregation has already happened?",
                ["WHERE", "ORDER BY", "HAVING", "GROUP BY"],
                2,
            ),
            "Authentication": (
                "What is the main purpose of an access token in an application?",
                [
                    "Encrypting all database rows automatically",
                    "Proving the caller is allowed to access a resource",
                    "Storing UI preferences in local storage",
                    "Replacing the need for HTTPS",
                ],
                1,
            ),
            "Caching": (
                "Why is caching commonly used in web applications?",
                [
                    "To increase repeated read performance and reduce backend load",
                    "To make every request slower but more secure",
                    "To eliminate the need for API responses",
                    "To force all users onto the same page",
                ],
                0,
            ),
            "Testing": (
                "What is the primary goal of a unit test?",
                [
                    "Verify one small piece of behavior in isolation",
                    "Deploy code automatically to production",
                    "Replace integration tests completely",
                    "Measure CPU usage under load",
                ],
                0,
            ),
            "Deployment": (
                "What is the usual purpose of a CI pipeline?",
                [
                    "Run code only on a developer's laptop",
                    "Automate build, test, and validation steps",
                    "Prevent all merges forever",
                    "Store database backups only",
                ],
                1,
            ),
            "Debugging": (
                "What is the best first step when a feature fails in production?",
                [
                    "Guess the issue and patch randomly",
                    "Collect the error signal and reproduce the failure",
                    "Delete the feature entirely",
                    "Ignore logs because they are noisy",
                ],
                1,
            ),
            "Performance": (
                "What is a common way to reduce frontend re-render cost?",
                [
                    "Increase state updates in every child component",
                    "Avoid unnecessary renders and expensive recalculations",
                    "Reload the page after every click",
                    "Store every value in local storage",
                ],
                1,
            ),
            "Security": (
                "Which practice helps protect sensitive data in transit?",
                ["HTTP", "TLS/HTTPS", "FTP", "Local storage"],
                1,
            ),
        }

    chosen_topics = _ordered_unique([topic] + skill_pool + topic_pool)
    fallback_topics: List[str] = []
    for item in chosen_topics:
        if item in question_bank and item not in fallback_topics:
            fallback_topics.append(item)
        if len(fallback_topics) >= max(10, int(count or 10)):
            break
    for item in topic_pool:
        if item not in fallback_topics:
            fallback_topics.append(item)
        if len(fallback_topics) >= max(10, int(count or 10)):
            break

    total = max(10, int(count or 10))
    if (difficulty or "").lower() in {"medium", "adaptive"}:
        easy_count = max(1, total // 3)
        hard_count = max(1, total // 3)
        difficulty_plan = ["Easy"] * easy_count + ["Hard"] * hard_count + ["Advanced"] * max(1, total - easy_count - hard_count)
    else:
        difficulty_plan = [difficulty.title() if difficulty else "Easy"] * total

    questions: List[Dict[str, Any]] = []
    for index in range(total):
        topic_name = fallback_topics[index % len(fallback_topics)]
        question_text, options, correct_index = question_bank.get(topic_name, question_bank[fallback_topics[0]])

        if skill_pool:
            skill_focus = skill_pool[index % len(skill_pool)]
            if skill_focus.lower() not in topic_name.lower() and index % 2 == 0:
                if domain_lower.startswith("coding"):
                    question_text = f"Which concept best supports {skill_focus} work in a coding interview?"
                    options = [
                        f"Use {skill_focus} to improve correctness and runtime characteristics",
                        f"Avoid {skill_focus} because it is never useful",
                        f"Replace {skill_focus} with manual repetition",
                        f"Use {skill_focus} only after ignoring edge cases",
                    ]
                    correct_index = 0
                else:
                    question_text = f"Which practice most directly strengthens {skill_focus} in a product implementation?"
                    options = [
                        f"Add concrete usage of {skill_focus} to a real feature and measure the result",
                        f"Mention {skill_focus} only in a header without implementation",
                        f"Remove {skill_focus} from the stack entirely",
                        f"Use {skill_focus} only in comments and not in code",
                    ]
                    correct_index = 0

        questions.append({
            "id": f"quiz-fallback-{index + 1}",
            "topic": topic_name,
            "difficulty": difficulty_plan[index] if index < len(difficulty_plan) else (difficulty.title() if difficulty else "Easy"),
            "question_type": "MCQ",
            "question": question_text,
            "options": [
                {"text": option, "is_correct": option_index == correct_index}
                for option_index, option in enumerate(options[:4])
            ],
            "correct_answer": options[correct_index],
            "explanation": f"Fallback quiz generated because the live model was unavailable ({reason}). The correct answer is the option that best matches {topic_name.lower()}.",
        })

    return questions[:total]


def build_quiz_fallback_questions(
    topic: str,
    difficulty: str,
    count: int,
    domain: str,
    resume_text: str,
    jd_text: str,
    roadmap_context: Optional[List[Dict[str, Any]]] = None,
    reason: str = "Model unavailable",
) -> List[Dict[str, Any]]:
    """Public wrapper used by API routes to guarantee quiz output on hard failures."""
    return _build_quiz_fallback_questions(
        topic=topic,
        difficulty=difficulty,
        count=count,
        domain=domain,
        resume_text=resume_text,
        jd_text=jd_text,
        roadmap_context=roadmap_context or [],
        reason=reason,
    )


async def match_resume_to_jd(resume_text: str, jd_text: str, resume_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Match resume to job description with focus areas"""

    resume_context = _build_resume_context_for_jd(resume_text, resume_data, max_chars=720)
    cache_key = f"jd_match:v4:{_stable_hash(resume_context)}:{_stable_hash(jd_text[:900])}"
    cached_payload = await _cache_get_json(cache_key)
    if isinstance(cached_payload, dict):
        cached_payload["source"] = cached_payload.get("source", "model")
        cached_payload["cached"] = True
        return cached_payload

    prompt = f"""Analyze this resume against the job description and provide STRICT JSON:

1. Match percentage (0-100)
2. Hire probability (High/Medium/Low)
3. Matched skills
4. Missing skills
5. Top 5 focus areas with:
   - Skill name
   - Priority (HIGH/MEDIUM/LOW)
   - Weight (% of JD importance)
   - Reason
   - Estimated study time
6. Interview topics
7. Strengths
8. Weaknesses
9. Suggestions (top actionable recommendations to improve fit)

Resume:
{resume_context}

Job Description:
{jd_text[:900]}

Return JSON with keys: match_percentage, hire_probability, matched_skills, missing_skills, focus_areas, interview_topics, strengths, weaknesses, suggestions"""

    prompt += "\nRules: Return ONLY JSON. No markdown. Max 5 focus_areas and max 5 suggestions. Keep strengths/weaknesses concise."
    compact_prompt = f"""Analyze resume vs JD and return STRICT JSON only.

Resume:
{resume_context[:520]}

JD:
{jd_text[:700]}

Keys:
match_percentage, hire_probability, matched_skills, missing_skills, focus_areas, interview_topics, strengths, weaknesses, suggestions

Rules:
- focus_areas max 5, suggestions max 5
- concise output
- no markdown"""
    
    messages = [
        {"role": "system", "content": "You are an expert technical recruiter and career coach."},
        {"role": "user", "content": prompt}
    ]
    
    def _parse_and_normalize(response_text: str) -> Dict[str, Any]:
        parsed = _parse_model_json(response_text, expected_type="object")
        return _normalize_model_jd_payload(parsed)

    try:
        response = await call_jd_chat(messages, temperature=0.05, max_tokens=260)
        normalized = _parse_and_normalize(response)
        await _cache_set_json(cache_key, normalized)
        return normalized
    except Exception as first_error:
        retry_messages = [
            {"role": "system", "content": "You are an expert technical recruiter and career coach."},
            {"role": "user", "content": compact_prompt},
        ]
        try:
            retry_response = await call_jd_chat(retry_messages, temperature=0.02, max_tokens=220)
            normalized = _parse_and_normalize(retry_response)
            await _cache_set_json(cache_key, normalized)
            return normalized
        except Exception as retry_error:
            raise AIServiceError(
                "jd_matching",
                f"Model-only JD matching failed: {str(first_error)} | Retry failed: {str(retry_error)}",
            ) from retry_error


async def generate_roadmap(
    resume_text: str,
    jd_text: str,
    skill_gaps: List[str],
    resume_data: Optional[Dict[str, Any]] = None,
    jd_analysis: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Generate a detailed weekly roadmap from resume and JD, with complete week coverage."""

    cache_key = f"roadmap:v4:{_stable_hash(resume_text[:900])}:{_stable_hash(jd_text[:800])}:{_stable_hash(skill_gaps[:6])}"
    cached_payload = await _cache_get_json(cache_key)
    if isinstance(cached_payload, dict):
        if settings.ROADMAP_STRICT_MODEL and cached_payload.get("source") == "roadmap_fallback":
            cached_payload = None
        else:
            cached_payload["cached"] = True
            return cached_payload

    def _unique_items(items: List[str]) -> List[str]:
        output: List[str] = []
        for item in items:
            cleaned = str(item).strip()
            if cleaned and cleaned not in output:
                output.append(cleaned)
        return output

    def _infer_focus_skills() -> List[str]:
        jd_lower = jd_text.lower()
        resume_lower = resume_text.lower()
        skill_keywords = {
            "HTML/CSS": ["html", "css", "responsive", "semantic"],
            "JavaScript": ["javascript", "js", "dom", "es6", "typescript"],
            "React": ["react", "hooks", "component", "redux", "context"],
            "APIs": ["api", "rest", "graphql", "integration", "endpoint"],
            "Backend": ["node", "express", "python", "django", "flask", "backend"],
            "Databases": ["sql", "postgres", "mysql", "mongodb", "database"],
            "DevOps": ["docker", "kubernetes", "ci/cd", "deployment", "aws", "cloud"],
            "Testing": ["test", "testing", "jest", "pytest", "unit"],
            "System Design": ["system design", "architecture", "scalability", "design"],
            "Interview Prep": ["interview", "communication", "behavioral", "dsa"],
        }

        detected: List[str] = []
        for skill, keywords in skill_keywords.items():
            in_jd = any(keyword in jd_lower for keyword in keywords)
            in_resume = any(keyword in resume_lower for keyword in keywords)
            if in_jd and not in_resume:
                detected.append(skill)

        merged = _unique_items(detected + skill_gaps)
        if not merged:
            merged = ["JavaScript", "React", "APIs", "Backend", "System Design"]
        return merged[:6]

    def _week_phase(week: int) -> str:
        if week <= 4:
            return "foundation"
        if week <= 8:
            return "build"
        return "industry"

    def _difficulty_for_week(week: int) -> str:
        if week <= 3:
            return "Easy"
        if week <= 8:
            return "Medium"
        return "Hard"

    def _hours_for_week(week: int) -> int:
        if week <= 4:
            return 12
        if week <= 8:
            return 14
        return 16

    def _build_week_tasks(week: int, primary: str, secondary: str, tertiary: str, focus_pool: List[str]) -> List[Dict[str, Any]]:
        phase = _week_phase(week)
        difficulty = _difficulty_for_week(week)
        hours = _hours_for_week(week)
        pool = [item for item in focus_pool if str(item).strip()]
        if not pool:
            pool = [primary, secondary, tertiary]
        focus = pool[(week - 1) % len(pool)]
        jd_hint = ", ".join(_unique_items(skill_gaps)[:3]) or "JD core requirements"

        learn_task = {
            "week": week,
            "task": f"Week {week} learning track: master {focus} concepts mapped to {jd_hint}. Create concise notes explaining how this skill appears in your target role and where your resume currently lacks evidence.",
            "skill": focus,
            "difficulty": difficulty,
            "estimated_hours": hours,
            "resources": [f"{focus} official docs", "Role-aligned tutorial", "JD keyword checklist"],
            "priority": "HIGH" if phase != "industry" else "CRITICAL",
            "milestone": week in [4, 8, 12],
        }

        build_task = {
            "week": week,
            "task": f"Week {week} build task: implement a practical feature using {focus} and connect it to one real requirement from the job description. Capture measurable output for a resume bullet (performance, reliability, or user impact).",
            "skill": focus,
            "difficulty": "Medium" if difficulty == "Easy" else difficulty,
            "estimated_hours": hours + 2,
            "resources": ["Feature implementation checklist", "Project structure template", "Code review notes"],
            "priority": "CRITICAL" if week in [4, 8, 12] else "HIGH",
            "milestone": week in [4, 8, 12],
        }

        prep_task = {
            "week": week,
            "task": f"Week {week} interview alignment: convert this week's work into interview-ready explanations. Prepare one technical story and one resume bullet that clearly links your implementation to the JD expectations.",
            "skill": "Interview Prep" if week >= 9 else focus,
            "difficulty": difficulty,
            "estimated_hours": max(8, hours - 2),
            "resources": ["STAR method template", "Mock Q&A prompts", "Resume bullet optimizer"],
            "priority": "HIGH",
            "milestone": week in [6, 10, 12],
        }

        return [learn_task, build_task, prep_task]

    def _normalize_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
        skills = _infer_focus_skills()
        primary = skills[0]
        secondary = skills[1] if len(skills) > 1 else f"{primary} Integration"
        tertiary = skills[2] if len(skills) > 2 else "System Design"

        incoming_tasks = payload.get("tasks", []) if isinstance(payload, dict) else []
        tasks_by_week: Dict[int, List[Dict[str, Any]]] = {week: [] for week in range(1, 13)}

        for item in incoming_tasks:
            try:
                week = int(item.get("week"))
            except Exception:
                continue
            if not (1 <= week <= 12):
                continue

            task_text = str(item.get("task", "")).strip()
            if not task_text:
                continue

            cleaned = {
                "week": week,
                "task": task_text,
                "skill": str(item.get("skill", primary)).strip() or primary,
                "difficulty": str(item.get("difficulty", _difficulty_for_week(week))).strip() or _difficulty_for_week(week),
                "estimated_hours": int(item.get("estimated_hours", _hours_for_week(week)) or _hours_for_week(week)),
                "resources": item.get("resources", []) if isinstance(item.get("resources", []), list) else [],
                "priority": str(item.get("priority", "HIGH")).strip() or "HIGH",
                "milestone": bool(item.get("milestone", week in [4, 8, 12])),
            }

            lower_texts = {existing["task"].lower() for existing in tasks_by_week[week]}
            if cleaned["task"].lower() not in lower_texts:
                tasks_by_week[week].append(cleaned)

        for week in range(1, 13):
            if len(tasks_by_week[week]) < 3:
                fallback_tasks = _build_week_tasks(week, primary, secondary, tertiary, skills)
                existing_lower = {task["task"].lower() for task in tasks_by_week[week]}
                for fallback in fallback_tasks:
                    if fallback["task"].lower() not in existing_lower:
                        tasks_by_week[week].append(fallback)
                        existing_lower.add(fallback["task"].lower())
                    if len(tasks_by_week[week]) >= 3:
                        break

        normalized_tasks: List[Dict[str, Any]] = []
        global_seen = set()
        for week in range(1, 13):
            for task in tasks_by_week[week]:
                task_text = task["task"].strip()
                if task_text.lower() in global_seen:
                    task_text = (
                        f"{task_text} Deliverable: publish a distinct Week {week} artifact tied to "
                        f"{task.get('skill', primary)} and one explicit JD requirement."
                    )
                    task["task"] = task_text
                global_seen.add(task_text.lower())
                normalized_tasks.append(task)

        milestones = payload.get("milestones", []) if isinstance(payload, dict) else []
        if not isinstance(milestones, list) or len(milestones) < 4:
            milestones = [
                f"Week 4: {primary} foundation milestone",
                f"Week 8: {secondary} build milestone",
                f"Week 10: interview readiness checkpoint",
                "Week 12: capstone and portfolio completion",
            ]

        completion_criteria = payload.get("completion_criteria") if isinstance(payload, dict) else ""
        if not isinstance(completion_criteria, str) or not completion_criteria.strip():
            completion_criteria = (
                "Complete all weekly learning, build, and interview-alignment tasks; "
                "publish portfolio artifacts and keep evidence for JD keyword coverage."
            )

        return {
            "duration_weeks": 12,
            "daily_hours": 2,
            "tasks": normalized_tasks,
            "milestones": milestones,
            "completion_criteria": completion_criteria,
        }

    resume_context = _build_resume_context_for_jd(resume_text, resume_data, max_chars=700)
    jd_analysis_summary = ""
    if isinstance(jd_analysis, dict):
        jd_analysis_summary = json.dumps({
            "match_percentage": jd_analysis.get("match_percentage"),
            "missing_skills": jd_analysis.get("missing_skills", [])[:8],
            "focus_areas": jd_analysis.get("focus_areas", [])[:5],
            "weaknesses": jd_analysis.get("weaknesses", [])[:5],
            "suggestions": jd_analysis.get("suggestions", [])[:5],
        })

    prompt = f"""Create a personalized 12-week roadmap from extracted resume data, JD analysis, and the full JD.

Extracted Resume Context:
{resume_context}

JD Analysis Summary:
{jd_analysis_summary or 'Not provided'}

Job Description:
{jd_text[:800]}

Missing skills:
{', '.join(skill_gaps[:5])}

Return valid JSON with keys:
- duration_weeks
- daily_hours
- tasks (array of objects with week, task, skill, difficulty, estimated_hours, resources, priority, milestone)
- milestones
- completion_criteria

Rules:
1) Include ALL weeks 1..12.
2) Provide exactly one anchor task per week (12 tasks total).
3) Keep each task under 18 words.
4) No repeated task text.
5) Task content must be specific and tied to resume/JD gaps.
6) Every week must contain a concrete deliverable.
7) Do not output generic tasks like "practice" without a specific artifact.
8) Return ONLY strict JSON. No markdown. Be concise."""

    compact_prompt = f"""Create a 12-week roadmap in STRICT JSON.

Resume context:
{resume_context[:650]}

JD summary:
{jd_analysis_summary[:500] if jd_analysis_summary else 'Not provided'}

Job description:
{jd_text[:700]}

Missing skills:
{', '.join(skill_gaps[:5])}

Return JSON keys only:
- duration_weeks
- daily_hours
- tasks (objects with week, task, skill, difficulty, estimated_hours, resources, priority, milestone)
- milestones
- completion_criteria

Rules:
1) Weeks 1..12 must exist.
2) Exactly one concise anchor task per week.
3) No repeated task text.
4) Each task must include a concrete deliverable tied to JD requirements.
5) Keep wording concise and specific."""

    messages = [
        {
            "role": "system",
            "content": "You are an expert career coach creating practical, non-generic weekly plans tied to candidate gaps and JD requirements.",
        },
        {"role": "user", "content": prompt},
    ]

    try:
        # Primary model attempt.
        response = await call_roadmap_chat(messages, temperature=0.12, max_tokens=220)
        parsed = _parse_model_json(response, expected_type="array")
        normalized = _normalize_payload(parsed)
        normalized["source"] = "model"
        await _cache_set_json(cache_key, normalized)
        return normalized
    except Exception as first_error:
        if isinstance(first_error, AIServiceError) and first_error.code in {"auth", "config"}:
            # Do not burn additional latency on known non-retriable auth/config failures.
            raise
        # Retry once with a compact prompt and lower token budget.
        try:
            retry_messages = [
                {
                    "role": "system",
                    "content": "You are an expert career coach creating practical, non-generic weekly plans tied to candidate gaps and JD requirements.",
                },
                {"role": "user", "content": compact_prompt},
            ]
            retry_response = await call_roadmap_chat(retry_messages, temperature=0.08, max_tokens=180)
            retry_parsed = json.loads(_extract_json_block(retry_response))
            normalized = _normalize_payload(retry_parsed)
            normalized["source"] = "model"
            normalized["retry_used"] = True
            await _cache_set_json(cache_key, normalized)
            return normalized
        except Exception as retry_error:
            error_text = f"{str(first_error)} | Retry failed: {str(retry_error)}"
            print(f"AI FAILED roadmap: {error_text}")
            if settings.ROADMAP_STRICT_MODEL:
                raise AIServiceError("roadmap_generation", error_text)
            normalized = _normalize_payload({})
            normalized["source"] = "roadmap_fallback"
            normalized["warning"] = str(retry_error)
            await _cache_set_json(cache_key, normalized)
            return normalized

async def generate_quiz_questions(
    topic: str,
    difficulty: str,
    count: int = 10,
    domain: str = "Coding DSA",
    resume_text: str = "",
    jd_text: str = "",
    roadmap_context: Optional[List[Dict[str, Any]]] = None,
    generation_meta: Optional[Dict[str, Any]] = None,
) -> List[Dict]:
    """Generate quiz questions based on resume, JD, and followed roadmap context."""

    roadmap_context = roadmap_context or []
    cache_key = f"quiz:v4:{_stable_hash(topic)}:{_stable_hash(difficulty)}:{_stable_hash(domain)}:{int(count or 10)}:{_stable_hash(resume_text[:1200])}:{_stable_hash(jd_text[:1200])}:{_stable_hash(roadmap_context[:8])}"
    cached_payload = await _cache_get_json(cache_key)
    if isinstance(cached_payload, list) and cached_payload:
        if isinstance(generation_meta, dict):
            generation_meta["source"] = "cache"
            generation_meta["warning"] = None
        return cached_payload

    roadmap_snippets = []
    for task in roadmap_context[:8]:
        week = task.get("week", "?")
        task_text = str(task.get("task", "")).strip()[:120]
        skill = str(task.get("skill", "")).strip()
        if task_text:
            roadmap_snippets.append(f"Week {week}: {task_text} ({skill})")

    domain_key = "coding_dsa" if domain.lower().startswith("coding") else "development"
    difficulty_key = difficulty.strip().lower()
    adaptive_mode = difficulty_key in {"medium", "adaptive"}
    difficulty_key = {"medium": "hard"}.get(difficulty_key, difficulty_key)
    difficulty_value = {"easy": "Easy", "hard": "Hard", "advanced": "Advanced"}.get(difficulty_key, "Hard")
    domain_prompt = "Data Structures, Algorithms, problem-solving, complexity" if domain_key == "coding_dsa" else "Web/app development, APIs, architecture, tooling"
    normalized_count = max(10, int(count or 10))

    def _normalize_stem(text: str) -> str:
        return " ".join(text.lower().strip().split())

    def _question_item(question_id: str, item_topic: str, question_text: str, options: List[str], correct_index: int, explanation: str, item_difficulty: str) -> Dict[str, Any]:
        option_items = [{"text": option, "is_correct": index == correct_index} for index, option in enumerate(options)]
        return {
            "id": question_id,
            "topic": item_topic,
            "difficulty": item_difficulty,
            "question_type": "MCQ",
            "question": question_text,
            "options": option_items,
            "correct_answer": options[correct_index],
            "explanation": explanation,
        }

    def _normalize_ai_question(item: Dict[str, Any], index: int) -> Optional[Dict[str, Any]]:
        if not isinstance(item, dict):
            return None

        question_text = str(item.get("question", "")).strip()
        options = item.get("options", [])
        if not question_text or not isinstance(options, list) or len(options) < 4:
            return None

        cleaned_options: List[str] = []
        correct_answer = ""
        flagged_correct = 0
        for option in options:
            if isinstance(option, dict):
                option_text = str(option.get("text", "")).strip()
                if option_text:
                    cleaned_options.append(option_text)
                    if option.get("is_correct"):
                        flagged_correct += 1
                        if not correct_answer:
                            correct_answer = option_text
            elif isinstance(option, str):
                option_text = option.strip()
                if option_text:
                    cleaned_options.append(option_text)

        if len(set(opt.lower() for opt in cleaned_options)) < 4:
            return None

        if len(cleaned_options) < 4:
            return None

        # Accept common model variants for correct answer:
        # - exact option text
        # - option letter (A/B/C/D)
        # - 1-based index (1..4)
        # - 0-based index (0..3)
        correct_raw = item.get("correct_answer", "")
        if not correct_answer and flagged_correct == 1:
            pass
        elif flagged_correct > 1:
            return None
        elif not correct_answer:
            raw = str(correct_raw).strip()
            if raw:
                lower_map = {opt.lower(): opt for opt in cleaned_options}
                if raw.lower() in lower_map:
                    correct_answer = lower_map[raw.lower()]
                else:
                    letter = raw.upper()
                    if letter in {"A", "B", "C", "D"}:
                        idx = ord(letter) - ord("A")
                        if 0 <= idx < len(cleaned_options):
                            correct_answer = cleaned_options[idx]
                    elif raw.isdigit():
                        n = int(raw)
                        if 1 <= n <= len(cleaned_options):
                            correct_answer = cleaned_options[n - 1]
                        elif 0 <= n < len(cleaned_options):
                            correct_answer = cleaned_options[n]

        if not correct_answer:
            return None

        if correct_answer not in cleaned_options:
            return None

        correct_index = cleaned_options.index(correct_answer)
        model_difficulty = str(item.get("difficulty", "")).strip().title()
        if adaptive_mode:
            if index < max(1, normalized_count // 3):
                model_difficulty = "Easy"
            elif index < max(2, (2 * normalized_count) // 3):
                model_difficulty = "Hard"
            else:
                model_difficulty = "Advanced"
        elif model_difficulty not in {"Easy", "Hard", "Advanced"}:
            model_difficulty = difficulty_value

        return _question_item(
            str(item.get("id", f"quiz-{difficulty_key}-{index + 1}")),
            str(item.get("topic", topic or domain)).strip() or (topic or domain),
            question_text,
            cleaned_options[:4],
            correct_index,
            str(item.get("explanation", "Review the underlying concept and compare each option.")).strip(),
            model_difficulty,
        )

    def _dedupe_questions(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        unique_items: List[Dict[str, Any]] = []
        seen = set()
        for item in items:
            stem = _normalize_stem(str(item.get("question", "")))
            if not stem or stem in seen:
                continue
            seen.add(stem)
            unique_items.append(item)
        return unique_items

    difficulty_instruction = (
        "Use progression order: first Easy, then Hard, then Advanced across the quiz."
        if adaptive_mode
        else f"All questions must be {difficulty_value}."
    )

    prompt = f"""Generate exactly {normalized_count} {difficulty} quiz questions for domain: {domain}.

Focus area:
{domain_prompt}

Candidate resume context:
{resume_text[:220]}

Target JD context:
{jd_text[:220]}

Roadmap context (followed/planned):
{chr(10).join(roadmap_snippets[:4]) if roadmap_snippets else 'No roadmap context provided'}

Rules:
1) Questions must be practical and aligned to resume gaps + JD requirements.
2) Return MCQ only, 4 options each, one correct answer.
3) Difficulty policy: {difficulty_instruction}
4) Avoid repetition at all costs.
5) Keep question text crisp and interview-relevant.
6) Questions must be different for different resume/JD/roadmap inputs.
7) Mark exactly one option as correct and keep correct_answer consistent with that option.
8) Keep each explanation to one short sentence.
9) Return ONLY JSON array. No extra text.

Return ONLY JSON array. For each object use keys:
- id
- topic
- difficulty
- question_type (MCQ)
- question
- options: [{{text, is_correct}} x4]
- correct_answer
- explanation
"""

    compact_prompt = f"""Create {normalized_count} unique MCQ questions in STRICT JSON array.

Context:
- Domain: {domain}
- Difficulty policy: {difficulty_instruction}
- Resume: {resume_text[:180]}
- JD: {jd_text[:180]}
- Roadmap: {chr(10).join(roadmap_snippets[:3]) if roadmap_snippets else 'No roadmap'}

Each question object must include:
id, topic, difficulty, question_type, question, options(4 with exactly one is_correct=true), correct_answer, explanation.
No repeated questions.
No generic boilerplate.
Return JSON array only."""

    messages = [
        {"role": "system", "content": "You are an expert technical interviewer creating highly relevant adaptive quizzes."},
        {"role": "user", "content": prompt},
    ]

    async def _call_quiz_with_model_route(
        request_messages: List[Dict[str, str]],
        temperature: float,
        max_tokens: int,
    ) -> str:
        """Use dedicated quiz route for fastest model path and predictable latency."""
        return await call_quiz_chat(request_messages, temperature=temperature, max_tokens=max_tokens)

    primary_error: Optional[Exception] = None
    try:
        # Keep token budget tight for faster first response while still fitting 10 MCQs.
        primary_max_tokens = min(420, max(320, 34 * normalized_count + 60))
        response = await _call_quiz_with_model_route([
            {"role": "system", "content": "You are an expert technical interviewer creating highly relevant adaptive quizzes."},
            {"role": "user", "content": compact_prompt},
        ], temperature=0.2, max_tokens=primary_max_tokens)
        parsed = json.loads(_extract_json_block(response))
        if isinstance(parsed, list):
            normalized_questions: List[Dict[str, Any]] = []
            for index, item in enumerate(parsed):
                normalized = _normalize_ai_question(item, index)
                if normalized:
                    normalized_questions.append(normalized)

            normalized_questions = _dedupe_questions(normalized_questions)
            if len(normalized_questions) >= normalized_count:
                output = normalized_questions[:normalized_count]
                await _cache_set_json(cache_key, output)
                if isinstance(generation_meta, dict):
                    generation_meta["source"] = "model"
                    generation_meta["warning"] = None
                return output
    except Exception as first_error:
        primary_error = first_error

    if isinstance(primary_error, AIServiceError) and primary_error.code in {"auth", "config"}:
        raise primary_error

    try:
        retry_messages = [
            {"role": "system", "content": "You are an expert technical interviewer creating highly relevant adaptive quizzes."},
            {"role": "user", "content": compact_prompt},
        ]
        retry_max_tokens = min(320, max(260, 28 * normalized_count + 50))
        retry_response = await _call_quiz_with_model_route(retry_messages, temperature=0.15, max_tokens=retry_max_tokens)
        retry_parsed = _parse_model_json(retry_response, expected_type="array")
        if isinstance(retry_parsed, list):
            normalized_questions = []
            for index, item in enumerate(retry_parsed):
                normalized = _normalize_ai_question(item, index)
                if normalized:
                    normalized_questions.append(normalized)
            normalized_questions = _dedupe_questions(normalized_questions)
            if len(normalized_questions) >= normalized_count:
                output = normalized_questions[:normalized_count]
                await _cache_set_json(cache_key, output)
                if isinstance(generation_meta, dict):
                    generation_meta["source"] = "model"
                    generation_meta["warning"] = None
                return output
    except Exception as retry_error:
        raise AIServiceError(
            "quiz_generation",
            f"{str(primary_error or 'Primary model failed')} | Retry failed: {str(retry_error)}",
        ) from retry_error

    raise AIServiceError("quiz_generation", "Quiz generation returned insufficient unique validated questions from model after retry")


async def evaluate_quiz_answer(question: str, correct_answer: str, user_answer: str) -> Dict:
    """Evaluate quiz answer and provide feedback"""
    
    is_correct = user_answer.strip().lower() == correct_answer.strip().lower()
    
    prompt = f"""Evaluate this quiz answer:

Question: {question}
Correct Answer: {correct_answer}
User Answer: {user_answer}

Provide:
1. Whether answer is correct
2. Score (0-10)
3. Explanation
4. Weak area identified (if incorrect)

Return as JSON with keys: is_correct, score, explanation, weak_area"""
    
    messages = [
        {"role": "system", "content": "You are an expert educator providing constructive feedback."},
        {"role": "user", "content": prompt}
    ]
    
    response = await call_oxlo_chat(messages, temperature=0.3)
    
    try:
        return json.loads(response)
    except:
        return {
            "is_correct": is_correct,
            "score": 10 if is_correct else 0,
            "explanation": "Correct!" if is_correct else "Incorrect. Review the concept.",
            "weak_area": None if is_correct else "Concept understanding"
        }

async def generate_interview_questions(
    jd_text: str,
    mode: str,
    count: int = 5,
    resume_text: str = "",
    resume_data: Optional[Dict[str, Any]] = None,
    quiz_context: Optional[Dict[str, Any]] = None,
    roadmap_context: Optional[List[Dict[str, Any]]] = None,
    generation_meta: Optional[Dict[str, Any]] = None,
) -> List[Dict]:
    """Generate interview questions based on resume, quiz, roadmap, and JD context."""

    cache_key = f"interview:v4:{_stable_hash(mode)}:{int(count or 4)}:{_stable_hash(jd_text[:800])}:{_stable_hash(resume_text[:900])}:{_stable_hash(quiz_context or {})}:{_stable_hash(roadmap_context or [])}"
    cached_payload = await _cache_get_json(cache_key)
    if isinstance(cached_payload, list) and cached_payload:
        if isinstance(generation_meta, dict):
            generation_meta["source"] = "cache"
            generation_meta["warning"] = None
        return cached_payload

    quiz_context = quiz_context or {}
    roadmap_context = roadmap_context or []
    resume_data = resume_data or {}

    def _extract_project_focus() -> List[str]:
        projects = resume_data.get("projects", []) if isinstance(resume_data, dict) else []
        focus: List[str] = []
        if isinstance(projects, list):
            for project in projects[:6]:
                if not isinstance(project, dict):
                    continue
                name = str(project.get("name", "")).strip()
                description = str(project.get("description", "")).strip()
                tech_stack = project.get("technologies") or project.get("tech_stack") or []
                if name:
                    focus.append(name)
                if description:
                    focus.append(description[:120])
                if isinstance(tech_stack, list):
                    focus.extend([str(t).strip() for t in tech_stack[:4] if str(t).strip()])
        return focus[:8]

    def _extract_roadmap_focus() -> List[str]:
        focus: List[str] = []
        for task in roadmap_context[:8]:
            skill = str(task.get("skill", "")).strip()
            task_text = str(task.get("task", "")).strip()
            if skill:
                focus.append(skill)
            if task_text:
                focus.append(task_text[:120])
        return focus[:10]

    def _extract_quiz_focus() -> List[str]:
        focus: List[str] = []
        weak_topics = quiz_context.get("weakTopics") or quiz_context.get("weak_topics") or []
        if isinstance(weak_topics, list):
            focus.extend([str(topic).strip() for topic in weak_topics if str(topic).strip()])
        recent_questions = quiz_context.get("questions") or []
        if isinstance(recent_questions, list):
            for item in recent_questions[:5]:
                if isinstance(item, dict):
                    q_topic = str(item.get("topic", "")).strip()
                    if q_topic:
                        focus.append(q_topic)
        domain = str(quiz_context.get("domain", "")).strip()
        if domain:
            focus.append(domain)
        return focus[:10]

    def _normalize_interview_question(item: Dict[str, Any], index: int) -> Optional[Dict[str, Any]]:
        if not isinstance(item, dict):
            return None

        question_text = " ".join(str(item.get("question", "")).strip().split())
        if not question_text:
            return None
        if len(question_text) > 170:
            question_text = question_text[:167].rstrip() + "..."

        q_type = str(item.get("type", "Technical")).strip().title()
        if q_type not in {"Technical", "Hr", "Behavioral", "System Design"}:
            q_type = "Technical" if not mode.lower().startswith("hr") else "HR"
        if q_type == "Hr":
            q_type = "HR"

        difficulty = str(item.get("difficulty", "Medium")).strip().title()
        if difficulty not in {"Easy", "Medium", "Hard", "Advanced"}:
            difficulty = "Medium"

        expected_keywords = item.get("expected_keywords", [])
        if not isinstance(expected_keywords, list):
            expected_keywords = []
        expected_keywords = [str(k).strip() for k in expected_keywords if str(k).strip()][:8]
        if len(expected_keywords) < 3:
            expected_keywords = [w for w in re.findall(r"[A-Za-z][A-Za-z0-9+.#-]{2,}", question_text)[:5]]

        criteria = item.get("evaluation_criteria", [])
        if not isinstance(criteria, list):
            criteria = []
        criteria = [str(c).strip() for c in criteria if str(c).strip()][:6]
        if len(criteria) < 3:
            criteria = ["Clarity", "Technical depth", "Relevance"]

        return {
            "id": str(item.get("id", f"int-{index + 1}")),
            "type": q_type,
            "difficulty": difficulty,
            "question": question_text,
            "expected_keywords": expected_keywords,
            "evaluation_criteria": criteria,
        }

    def _dedupe(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        seen = set()
        output: List[Dict[str, Any]] = []
        for item in items:
            key = " ".join(str(item.get("question", "")).strip().lower().split())
            if not key or key in seen:
                continue
            seen.add(key)
            output.append(item)
        return output

    normalized_count = max(1, min(4, int(count or 4)))
    project_focus = _extract_project_focus()
    roadmap_focus = _extract_roadmap_focus()
    quiz_focus = _extract_quiz_focus()
    mode_label = "HR" if mode.lower().startswith("hr") else "Technical"

    prompt = f"""Generate exactly {normalized_count} mock interview questions in JSON array format.

Mode: {mode_label}
Job Description:
{(jd_text or "")[:500]}

Resume Extract:
{(resume_text or "")[:550]}

Project Highlights:
{json.dumps(project_focus[:3], ensure_ascii=True)}

Roadmap Progress Signals:
{json.dumps(roadmap_focus[:3], ensure_ascii=True)}

Quiz Signals:
{json.dumps(quiz_focus[:3], ensure_ascii=True)}

Rules:
1) Questions must be personalized to this candidate profile and JD.
2) Include resume projects, roadmap progress, and quiz weak areas in questioning strategy.
3) Do not return generic interview questions.
4) Questions must be unique and progressively challenging.
5) Keep each question short (max 20 words) and direct.
5) Return ONLY a JSON array with objects containing keys:
   id, type, difficulty, question, expected_keywords (array), evaluation_criteria (array)
6) expected_keywords must contain 3-8 concrete terms.
7) evaluation_criteria must contain 3-6 scoring dimensions.
"""

    compact_prompt = f"""Return {normalized_count} personalized {mode_label} interview questions as JSON array only.
Use resume + JD + roadmap + quiz + project context.
Keys per item: id,type,difficulty,question,expected_keywords,evaluation_criteria.
Question text must be short (max 20 words).
No duplicates."""

    messages = [
        {"role": "system", "content": "You are a senior interviewer generating realistic, candidate-specific interview questions."},
        {"role": "user", "content": prompt},
    ]

    try:
        response = await call_interview_chat(messages, temperature=0.15, max_tokens=400)
        parsed = _parse_model_json(response, expected_type="array")
        if isinstance(parsed, list):
            normalized = []
            for index, item in enumerate(parsed):
                question = _normalize_interview_question(item, index)
                if question:
                    normalized.append(question)
            normalized = _dedupe(normalized)
            if len(normalized) >= normalized_count:
                output = normalized[:normalized_count]
                await _cache_set_json(cache_key, output)
                if isinstance(generation_meta, dict):
                    generation_meta["source"] = "model"
                    generation_meta["warning"] = None
                return output
    except Exception as first_error:
        if isinstance(first_error, AIServiceError) and first_error.code in {"auth", "config"}:
            raise AIServiceError("interview_generation", f"Primary model call failed without retry: {str(first_error)}") from first_error

        try:
            retry_messages = [
                {"role": "system", "content": "You are a senior interviewer generating realistic, candidate-specific interview questions."},
                {"role": "user", "content": compact_prompt},
            ]
            retry_response = await call_interview_chat(retry_messages, temperature=0.12, max_tokens=300)
            retry_parsed = _parse_model_json(retry_response, expected_type="array")
            if isinstance(retry_parsed, list):
                normalized = []
                for index, item in enumerate(retry_parsed):
                    question = _normalize_interview_question(item, index)
                    if question:
                        normalized.append(question)
                normalized = _dedupe(normalized)
                if len(normalized) >= normalized_count:
                    output = normalized[:normalized_count]
                    await _cache_set_json(cache_key, output)
                    if isinstance(generation_meta, dict):
                        generation_meta["source"] = "model"
                        generation_meta["warning"] = None
                    return output
        except Exception as retry_error:
            raise AIServiceError("interview_generation", f"{str(first_error)} | Retry failed: {str(retry_error)}") from retry_error

        raise AIServiceError("interview_generation", "Interview generation returned insufficient validated questions from model")

async def evaluate_interview_answer(
    question: str,
    answer: str,
    expected_keywords: List[str],
    jd_text: str = "",
    resume_text: str = "",
    quiz_context: Optional[Dict[str, Any]] = None,
    roadmap_context: Optional[List[Dict[str, Any]]] = None,
    project_context: Optional[List[str]] = None,
    mode: str = "Technical",
) -> Dict:
    """Evaluate interview answer using interview model route."""

    if not (answer or "").strip():
        return {
            "score": 0,
            "strengths": [],
            "weaknesses": ["No answer provided"],
            "model_answer": "Provide a concise structured answer with one concrete project example and measurable outcome.",
            "confidence_level": "Low",
            "improvement_tips": ["Answer directly", "Use STAR structure", "Include impact metrics"],
        }

    quiz_context = quiz_context or {}
    roadmap_context = roadmap_context or []
    project_context = project_context or []
    keyword_context = [str(k).strip() for k in expected_keywords if str(k).strip()][:10]

    prompt = f"""Evaluate this interview answer and score it from 0 to 10.

Mode: {mode}
Question: {question}
Candidate Answer: {answer}
Expected Keywords: {json.dumps(keyword_context, ensure_ascii=True)}
Job Description Context: {(jd_text or '')[:1600]}
Resume Context: {(resume_text or '')[:900]}
Quiz Context: {json.dumps(quiz_context, ensure_ascii=True)[:700]}
Roadmap Context: {json.dumps(roadmap_context, ensure_ascii=True)[:700]}
Project Context: {json.dumps(project_context, ensure_ascii=True)[:500]}

Scoring dimensions:
1) Relevance to question and role
2) Technical depth / clarity
3) Use of candidate-specific evidence (projects/roadmap/quiz learnings)
4) Communication and structure

Return ONLY JSON object with keys:
score (integer 0-10), strengths (array), weaknesses (array), model_answer (string), confidence_level (High/Medium/Low), improvement_tips (array)

Formatting rules for model_answer:
1) Keep it concise (max 120 words)
2) Use this exact structure with line breaks:
    Summary: ...
    Strength: ...
    Gap: ...
    Better answer: ...
"""

    compact_prompt = f"""Score this answer 0-10 and return JSON keys: score,strengths,weaknesses,model_answer,confidence_level,improvement_tips.
Question: {question}
Answer: {answer}
Expected Keywords: {json.dumps(keyword_context, ensure_ascii=True)}"""

    def _normalize_feedback(raw: Dict[str, Any]) -> Dict[str, Any]:
        try:
            score = int(round(float(raw.get("score", 0))))
        except Exception:
            score = 0
        score = max(0, min(10, score))

        strengths = raw.get("strengths", [])
        if not isinstance(strengths, list):
            strengths = []
        strengths = [str(s).strip() for s in strengths if str(s).strip()][:6]

        weaknesses = raw.get("weaknesses", [])
        if not isinstance(weaknesses, list):
            weaknesses = []
        weaknesses = [str(s).strip() for s in weaknesses if str(s).strip()][:6]

        tips = raw.get("improvement_tips", [])
        if not isinstance(tips, list):
            tips = []
        tips = [str(s).strip() for s in tips if str(s).strip()][:6]

        model_answer = str(raw.get("model_answer", "")).strip()
        if model_answer and len(model_answer) > 900:
            model_answer = model_answer[:900].rstrip() + "..."

        if not model_answer:
            summary = "Your answer is relevant but needs stronger structure and role alignment."
            strength_line = strengths[0] if strengths else "You addressed the core question."
            gap_line = weaknesses[0] if weaknesses else "Add clearer technical depth and measurable impact."
            better_line = "Use a STAR-style response with one concrete project, key decision, and measurable result."
            model_answer = (
                f"Summary: {summary}\n"
                f"Strength: {strength_line}\n"
                f"Gap: {gap_line}\n"
                f"Better answer: {better_line}"
            )

        # Force a predictable structure even if provider returns free-form prose.
        if "Summary:" not in model_answer or "Strength:" not in model_answer or "Gap:" not in model_answer or "Better answer:" not in model_answer:
            summary = "Your answer is partially correct but can be clearer and more interview-ready."
            strength_line = strengths[0] if strengths else "You attempted to connect your experience to the question."
            gap_line = weaknesses[0] if weaknesses else "Include deeper reasoning, trade-offs, and measurable outcomes."
            better_line = "Answer in STAR format, mention one project example, explain decisions, and quantify impact."
            model_answer = (
                f"Summary: {summary}\n"
                f"Strength: {strength_line}\n"
                f"Gap: {gap_line}\n"
                f"Better answer: {better_line}"
            )

        confidence_level = str(raw.get("confidence_level", "Medium")).strip().title()
        if confidence_level not in {"High", "Medium", "Low"}:
            confidence_level = "Medium"

        return {
            "score": score,
            "strengths": strengths,
            "weaknesses": weaknesses,
            "model_answer": model_answer,
            "confidence_level": confidence_level,
            "improvement_tips": tips,
        }

    messages = [
        {"role": "system", "content": "You are an expert interviewer evaluating answers with strict but fair scoring."},
        {"role": "user", "content": prompt},
    ]

    try:
        response = await call_interview_chat(messages, temperature=0.2, max_tokens=520)
        parsed = _parse_model_json(response, expected_type="object")
        if isinstance(parsed, dict):
            return _normalize_feedback(parsed)
    except Exception as first_error:
        try:
            retry_messages = [
                {"role": "system", "content": "Return strict JSON only."},
                {"role": "user", "content": compact_prompt},
            ]
            retry_response = await call_interview_chat(retry_messages, temperature=0.15, max_tokens=360)
            retry_parsed = _parse_model_json(retry_response, expected_type="object")
            if isinstance(retry_parsed, dict):
                return _normalize_feedback(retry_parsed)
        except Exception as retry_error:
            raise AIServiceError("interview_evaluation", f"Interview evaluation failed: {str(first_error)} | Retry failed: {str(retry_error)}") from retry_error

    raise AIServiceError("interview_evaluation", "Interview evaluation returned invalid payload")


def _calculate_ats_score_rule_based(
    resume_text: str,
    target_role: str = "",
    job_description: str = "",
    resume_data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Calculate comprehensive ATS score based on multiple criteria.
    Returns detailed breakdown and actionable insights.
    """
    
    jd_text = job_description or ""
    required_skills = _infer_required_skills(jd_text, target_role)

    resume_structured_skills: List[str] = []
    if isinstance(resume_data, dict):
        resume_structured_skills.extend([
            str(skill.get("name", "")).strip()
            for skill in resume_data.get("skills", [])
            if isinstance(skill, dict) and str(skill.get("name", "")).strip()
        ])

    extracted_resume_skills = _extract_skills(resume_text)
    for skill in resume_structured_skills:
        if skill in SKILL_ALIASES:
            extracted_resume_skills.append(skill)

    resume_skill_set = sorted({skill for skill in extracted_resume_skills if skill})
    matched_skills = sorted([skill for skill in required_skills if skill in resume_skill_set])
    missing_skills = sorted([skill for skill in required_skills if skill not in resume_skill_set])

    total_required_skills = max(1, len(required_skills))
    skills_score = round((len(matched_skills) / total_required_skills) * 30, 2)

    required_years = _extract_required_years(jd_text, target_role)
    candidate_years = _extract_candidate_years(resume_text, resume_data)
    if required_years <= 0:
        experience_score = 20.0
    elif candidate_years >= required_years:
        experience_score = 20.0
    else:
        experience_score = round((candidate_years / required_years) * 20, 2)

    education_score = round(_education_score(resume_data, jd_text), 2)

    keywords = _extract_keywords(jd_text if jd_text else target_role, required_skills)
    resume_text_lower = (resume_text or "").lower()
    matched_keywords = [kw for kw in keywords if _contains_alias(resume_text_lower, kw)]
    missing_keywords = [kw for kw in keywords if kw not in matched_keywords]
    total_keywords = max(1, len(keywords))
    keyword_score = round((len(matched_keywords) / total_keywords) * 15, 2)

    project_score = round(_project_relevance_score(required_skills, resume_text, resume_data), 2)
    quality_score = round(_resume_quality_score(resume_text), 2)

    project_text = " ".join(
        [
            str(project.get("description", ""))
            for project in (resume_data or {}).get("projects", [])
            if isinstance(project, dict)
        ]
    ).lower() if isinstance(resume_data, dict) else ""
    real_world_aligned = project_score >= 13 and any(
        token in project_text
        for token in ["production", "deployed", "real-time", "realtime", "users", "scalable", "cloud", "api"]
    )
    bonus = 5.0 if real_world_aligned else 0.0

    stuffing = _keyword_stuffing_detected(resume_text, keywords)
    penalty = 5.0 if stuffing else 0.0

    total_score = round(skills_score + experience_score + education_score + keyword_score + project_score + quality_score + bonus - penalty, 2)
    total_score = max(0.0, min(100.0, total_score))

    strengths: List[str] = []
    weaknesses: List[str] = []
    recommendations: List[str] = []

    if skills_score >= 20:
        strengths.append("Strong overlap with required technical skills")
    else:
        weaknesses.append("Skills coverage is below the role requirements")
        recommendations.append("Add and demonstrate missing role-specific skills in projects and experience bullets")

    if experience_score >= 15:
        strengths.append("Experience level aligns well with expected years")
    else:
        weaknesses.append("Experience depth appears lower than role expectations")
        recommendations.append("Highlight relevant internship or project ownership to bridge experience gap")

    if education_score >= 9:
        strengths.append("Education is a close match for the role")
    elif education_score <= 5:
        weaknesses.append("Education alignment is limited for this role")
        recommendations.append("Add relevant coursework/certifications tied to the target job")

    if keyword_score >= 10:
        strengths.append("Good keyword alignment with target job language")
    else:
        weaknesses.append("Important JD keywords are missing or underrepresented")
        recommendations.append("Mirror key JD terms naturally in summary, skills, and experience sections")

    if project_score >= 12:
        strengths.append("Projects are relevant to the target role")
    else:
        weaknesses.append("Projects need stronger role alignment")
        recommendations.append("Build one project that directly maps to top missing skills")

    if quality_score >= 8:
        strengths.append("Resume structure and quantification quality are solid")
    else:
        weaknesses.append("Resume quality can improve with clearer structure and measurable impact")
        recommendations.append("Use action verbs and quantified achievements in each experience bullet")

    if stuffing:
        weaknesses.append("Keyword stuffing pattern detected")
        recommendations.append("Reduce repeated keyword usage and prioritize natural context")

    if real_world_aligned:
        strengths.append("Projects show practical real-world application")

    if not recommendations:
        recommendations.append("Continue tailoring resume per job and keep impact metrics updated")

    final_verdict = (
        "Excellent ATS alignment"
        if total_score >= 85
        else "Good ATS alignment with improvement opportunities"
        if total_score >= 65
        else "ATS alignment needs improvement"
    )

    return {
        "match_percentage": total_score,
        "skills_score": skills_score,
        "experience_score": round(experience_score, 2),
        "education_score": education_score,
        "keyword_score": keyword_score,
        "project_score": project_score,
        "quality_score": quality_score,
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "recommendations": recommendations,
        "ats_score": int(round(total_score)),
        "score_breakdown": {
            "keyword_match": round((len(matched_keywords) / total_keywords) * 100, 2),
            "skills_relevance": round((skills_score / 30.0) * 100, 2),
            "experience_alignment": round((experience_score / 20.0) * 100, 2),
            "education_fit": round((education_score / 10.0) * 100, 2),
            "resume_structure": round((quality_score / 10.0) * 100, 2),
            "projects_quality": round((project_score / 15.0) * 100, 2),
            "ats_compatibility": round((quality_score / 10.0) * 100, 2),
        },
        "matched_keywords": matched_keywords,
        "missing_keywords": missing_keywords,
        "analysis": {
            "strengths": strengths,
            "weaknesses": weaknesses,
            "red_flags": ["Potential keyword stuffing"] if stuffing else [],
        },
        "suggestions": {
            "improve_keywords": recommendations[:3],
            "add_projects": ["Create at least one role-specific end-to-end project with measurable impact"],
            "enhance_experience": ["Add impact metrics like % improvements, latency reduction, or user growth"],
            "formatting_fixes": ["Use ATS-friendly headers: Summary, Skills, Experience, Projects, Education"],
        },
        "final_verdict": final_verdict,
        "improvement_roadmap": {
            "duration_weeks": 4,
            "target_score_increase": 20,
            "weekly_tasks": [
                "Week 1: Add top missing skills to learning plan and update resume summary",
                "Week 2: Rewrite experience bullets with quantified outcomes",
                "Week 3: Build or refine one project aligned with target JD",
                "Week 4: Tailor keywords for specific job postings and re-evaluate",
            ],
        },
    }


def _extract_json_block(text: str) -> str:
    cleaned = (text or "").strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    if cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()

    # Extract the first balanced JSON payload (array or object).
    starts = [i for i in [cleaned.find("{"), cleaned.find("[")] if i != -1]
    if starts:
        start = min(starts)
        opening = cleaned[start]
        closing = "}" if opening == "{" else "]"
        depth = 0
        in_string = False
        escaped = False

        for i in range(start, len(cleaned)):
            ch = cleaned[i]
            if in_string:
                if escaped:
                    escaped = False
                    continue
                if ch == "\\":
                    escaped = True
                    continue
                if ch == '"':
                    in_string = False
                continue

            if ch == '"':
                in_string = True
                continue
            if ch == opening:
                depth += 1
                continue
            if ch == closing:
                depth -= 1
                if depth == 0:
                    return cleaned[start:i + 1]

    return cleaned


def _parse_model_json(text: str, expected_type: str = "any") -> Any:
    """Parse model JSON output with light cleanup for common formatting issues."""
    cleaned = _extract_json_block(text)

    # Remove trailing commas before closing braces/brackets, which are common in
    # otherwise valid model outputs and safe to repair deterministically.
    cleaned = re.sub(r",\s*([}\]])", r"\1", cleaned)

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        # Try one more time with the raw text in case the extractor trimmed too much.
        raw = (text or "").strip()
        raw = re.sub(r",\s*([}\]])", r"\1", raw)
        parsed = json.loads(raw)

    if expected_type == "array" and not isinstance(parsed, list):
        raise ValueError("Model output was not a JSON array")
    if expected_type == "object" and not isinstance(parsed, dict):
        raise ValueError("Model output was not a JSON object")

    return parsed


def _sanitize_model_error_message(err: Exception) -> str:
    """Clean nested provider error wrappers for clearer UI warnings."""
    message = str(err or "").strip()
    if not message:
        return "AI provider unavailable"

    prefix = "AI API request failed:"
    # Some paths can double-wrap the same prefix; remove repeated wrappers.
    while message.lower().startswith(prefix.lower()):
        message = message[len(prefix):].strip()

    return message or "AI provider unavailable"


def _normalize_percentage_score(value: Any) -> float:
    try:
        score = float(value)
    except Exception:
        return 0.0

    if score <= 1:
        score *= 100.0
    elif score <= 10:
        score *= 10.0

    return round(max(0.0, min(100.0, score)), 2)


def _normalize_model_ats_payload(raw: Dict[str, Any], fallback: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError("ATS model response must be a JSON object")

    merged = dict(fallback)
    merged.update(raw)

    ats_score = merged.get("ats_score", fallback.get("ats_score", 0))
    try:
        ats_score = int(round(float(ats_score)))
    except Exception:
        ats_score = int(fallback.get("ats_score", 0))
    ats_score = max(0, min(100, ats_score))

    score_breakdown = merged.get("score_breakdown", {})
    if not isinstance(score_breakdown, dict):
        score_breakdown = {}

    merged_score_breakdown = dict(fallback.get("score_breakdown", {}))
    merged_score_breakdown.update(score_breakdown)
    for key in (
        "keyword_match",
        "skills_relevance",
        "experience_alignment",
        "education_fit",
        "resume_structure",
        "projects_quality",
        "ats_compatibility",
    ):
        if key in merged_score_breakdown:
            merged_score_breakdown[key] = _normalize_percentage_score(merged_score_breakdown[key])

    suggestions = merged.get("suggestions", {})
    if not isinstance(suggestions, dict):
        suggestions = {}

    merged_suggestions = dict(fallback.get("suggestions", {}))
    merged_suggestions.update(suggestions)

    analysis = merged.get("analysis", {})
    if not isinstance(analysis, dict):
        analysis = {}

    merged_analysis = dict(fallback.get("analysis", {}))
    merged_analysis.update(analysis)

    return {
        "match_percentage": float(merged.get("match_percentage", ats_score)),
        "skills_score": float(merged.get("skills_score", fallback.get("skills_score", 0))),
        "experience_score": float(merged.get("experience_score", fallback.get("experience_score", 0))),
        "education_score": float(merged.get("education_score", fallback.get("education_score", 0))),
        "keyword_score": float(merged.get("keyword_score", fallback.get("keyword_score", 0))),
        "project_score": float(merged.get("project_score", fallback.get("project_score", 0))),
        "quality_score": float(merged.get("quality_score", fallback.get("quality_score", 0))),
        "matched_skills": merged.get("matched_skills", fallback.get("matched_skills", [])) or [],
        "missing_skills": merged.get("missing_skills", fallback.get("missing_skills", [])) or [],
        "strengths": merged.get("strengths", fallback.get("strengths", [])) or [],
        "weaknesses": merged.get("weaknesses", fallback.get("weaknesses", [])) or [],
        "recommendations": merged.get("recommendations", fallback.get("recommendations", [])) or [],
        "ats_score": ats_score,
        "score_breakdown": merged_score_breakdown,
        "matched_keywords": merged.get("matched_keywords", fallback.get("matched_keywords", [])) or [],
        "missing_keywords": merged.get("missing_keywords", fallback.get("missing_keywords", [])) or [],
        "analysis": merged_analysis,
        "suggestions": merged_suggestions,
        "final_verdict": str(merged.get("final_verdict", fallback.get("final_verdict", "Resume analysis complete"))),
        "improvement_roadmap": merged.get("improvement_roadmap", fallback.get("improvement_roadmap", {})) or {},
        "source": "model",
    }


def _build_resume_context_for_ats(
    resume_text: str,
    resume_data: Optional[Dict[str, Any]],
    max_chars: int,
) -> str:
    parts: List[str] = []

    if isinstance(resume_data, dict):
        skills = [
            str(skill.get("name", "")).strip()
            for skill in resume_data.get("skills", [])
            if isinstance(skill, dict) and str(skill.get("name", "")).strip()
        ]
        experiences = [
            str(exp.get("title", "")).strip()
            for exp in resume_data.get("experiences", [])
            if isinstance(exp, dict) and str(exp.get("title", "")).strip()
        ]
        projects = [
            str(project.get("name", "")).strip()
            for project in resume_data.get("projects", [])
            if isinstance(project, dict) and str(project.get("name", "")).strip()
        ]
        education = [
            str(edu.get("degree", "")).strip()
            for edu in resume_data.get("education", [])
            if isinstance(edu, dict) and str(edu.get("degree", "")).strip()
        ]

        if skills:
            parts.append(f"Skills: {', '.join(skills[:20])}")
        if experiences:
            parts.append(f"Experience titles: {', '.join(experiences[:10])}")
        if projects:
            parts.append(f"Projects: {', '.join(projects[:10])}")
        if education:
            parts.append(f"Education: {', '.join(education[:5])}")

    raw = (resume_text or "").strip()
    if raw:
        parts.append(f"Resume raw excerpt: {raw[:max_chars]}")

    combined = "\n".join(part for part in parts if part).strip()
    if not combined:
        combined = raw[:max_chars]

    return combined[:max_chars]


async def calculate_ats_score(
    resume_text: str,
    target_role: str = "",
    job_description: str = "",
    resume_data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Model-first ATS scoring. Falls back to rule engine only on provider rate limits."""

    cache_key = f"ats_score:v2:{_stable_hash(resume_text[:1800])}:{_stable_hash(target_role)}:{_stable_hash(job_description[:1200])}"
    cached_payload = await _cache_get_json(cache_key)
    if isinstance(cached_payload, dict):
        cached_payload["cached"] = True
        return cached_payload

    fallback = _calculate_ats_score_rule_based(
        resume_text=resume_text,
        target_role=target_role,
        job_description=job_description,
        resume_data=resume_data,
    )

    resume_context = _build_resume_context_for_ats(
        resume_text=resume_text,
        resume_data=resume_data,
        max_chars=900,
    )

    prompt = (
        "Analyze this resume for ATS compatibility and return STRICT JSON only.\\n"
        "The JSON must include these keys:\\n"
        "ats_score, score_breakdown, analysis, missing_keywords, matched_keywords, matched_skills, missing_skills, suggestions, final_verdict\\n"
        "where score_breakdown includes: keyword_match, skills_relevance, experience_alignment, education_fit, resume_structure, projects_quality, ats_compatibility.\\n"
        "analysis includes: strengths (array), weaknesses (array), red_flags (array).\\n"
        "suggestions includes: improve_keywords (array), add_projects (array), enhance_experience (array), formatting_fixes (array).\\n"
        f"Target role: {target_role or 'Software Engineer'}\\n"
        f"Job description: {(job_description or '')[:700]}\\n"
        f"Resume text: {resume_context}"
    )

    messages = [
        {
            "role": "system",
            "content": "You are an expert ATS evaluator. Return only valid JSON with no markdown.",
        },
        {"role": "user", "content": prompt},
    ]

    try:
        response_text = await call_ats_chat(messages, temperature=0.1, max_tokens=420)
        payload = json.loads(_extract_json_block(response_text))
        normalized = _normalize_model_ats_payload(payload, fallback)
        await _cache_set_json(cache_key, normalized)
        return normalized
    except Exception as first_error:
        # Retry once with an even shorter context for model gateways that reject large/noisy payloads.
        try:
            short_context = _build_resume_context_for_ats(
                resume_text=resume_text,
                resume_data=resume_data,
                max_chars=600,
            )
            retry_prompt = (
                "Return STRICT JSON only with keys: ats_score, score_breakdown, analysis, missing_keywords, matched_keywords, matched_skills, missing_skills, suggestions, final_verdict.\n"
                f"Target role: {target_role or 'Software Engineer'}\n"
                f"Job description: {(job_description or '')[:500]}\n"
                f"Resume text: {short_context}"
            )
            retry_messages = [
                {
                    "role": "system",
                    "content": "You are an ATS evaluator. Return only valid JSON and no markdown.",
                },
                {"role": "user", "content": retry_prompt},
            ]
            retry_text = await call_ats_chat(retry_messages, temperature=0.05, max_tokens=300)
            retry_payload = json.loads(_extract_json_block(retry_text))
            normalized = _normalize_model_ats_payload(retry_payload, fallback)
            await _cache_set_json(cache_key, normalized)
            return normalized
        except Exception:
            e = first_error

        should_fallback = _allow_rate_limit_fallback(e)
        if isinstance(e, AIServiceError) and e.code in {"auth", "config", "network", "http_error", "parse"}:
            should_fallback = True

        if should_fallback:
            fallback_with_reason = dict(fallback)
            fallback_with_reason["source"] = "rule_engine_model_unavailable"
            fallback_with_reason["fallback_reason"] = _sanitize_model_error_message(e)
            await _cache_set_json(cache_key, fallback_with_reason)
            return fallback_with_reason
        raise


# ===== FINAL STABLE LOCAL DEMO PATCH =====
import os as _sb_os

def _sb_local_demo_enabled():
    return str(_sb_os.getenv("FORCE_LOCAL_AI", "false")).strip().lower() in {"1", "true", "yes", "on"}

_ORIG_generate_quiz_questions = generate_quiz_questions
async def generate_quiz_questions(topic, difficulty, count=10, domain="Coding DSA", resume_text="", jd_text="", roadmap_context=None, generation_meta=None):
    if _sb_local_demo_enabled():
        if isinstance(generation_meta, dict):
            generation_meta["source"] = "local_demo"
            generation_meta["warning"] = "Local demo quiz generated without external AI parsing."
        return build_quiz_fallback_questions(
            topic=topic,
            difficulty=difficulty,
            count=max(10, int(count or 10)),
            domain=domain,
            resume_text=resume_text,
            jd_text=jd_text,
            roadmap_context=roadmap_context or [],
            reason="Local demo mode"
        )
    try:
        return await _ORIG_generate_quiz_questions(topic, difficulty, count, domain, resume_text, jd_text, roadmap_context, generation_meta)
    except Exception:
        if isinstance(generation_meta, dict):
            generation_meta["source"] = "fallback"
            generation_meta["warning"] = "AI response failed, fallback quiz used."
        return build_quiz_fallback_questions(topic, difficulty, max(10, int(count or 10)), domain, resume_text, jd_text, roadmap_context or [], "AI parse failed")


_ORIG_generate_interview_questions = generate_interview_questions
async def generate_interview_questions(jd_text, mode, count=5, resume_text="", resume_data=None, quiz_context=None, roadmap_context=None, generation_meta=None):
    if _sb_local_demo_enabled():
        if isinstance(generation_meta, dict):
            generation_meta["source"] = "local_demo"
            generation_meta["warning"] = "Local demo interview generated without external AI parsing."

        skills = _extract_skills((resume_text or "") + " " + (jd_text or "")) or ["React", "REST API", "Database", "Project"]
        n = max(1, min(4, int(count or 4)))
        is_hr = str(mode or "").lower().startswith("hr")

        hr_questions = [
            "Tell me about yourself and your career goal.",
            "Explain your strongest project and your role in it.",
            "How do you handle pressure during deadlines?",
            "Why should we hire you for this role?"
        ]

        tech_questions = [
            f"Explain one project where you used {skills[0]}.",
            "How do you connect frontend with backend APIs?",
            "How do you design a simple full stack application?",
            "How do you debug and improve application performance?"
        ]

        base = hr_questions if is_hr else tech_questions
        output = []
        for i, q in enumerate(base[:n]):
            output.append({
                "id": f"demo-int-{i+1}",
                "type": "HR" if is_hr else "Technical",
                "difficulty": "Medium",
                "question": q,
                "expected_keywords": skills[:5],
                "evaluation_criteria": ["Clarity", "Relevance", "Project evidence"]
            })
        return output

    try:
        return await _ORIG_generate_interview_questions(jd_text, mode, count, resume_text, resume_data, quiz_context, roadmap_context, generation_meta)
    except Exception:
        return await generate_interview_questions(jd_text, mode, count, resume_text, resume_data, quiz_context, roadmap_context, generation_meta)


_ORIG_evaluate_interview_answer = evaluate_interview_answer
async def evaluate_interview_answer(question, answer, expected_keywords, jd_text="", resume_text="", quiz_context=None, roadmap_context=None, project_context=None, mode="Technical"):
    if _sb_local_demo_enabled():
        words = len((answer or "").split())
        hits = sum(1 for k in expected_keywords if str(k).lower() in (answer or "").lower())
        score = max(4, min(10, 5 + min(3, words // 20) + min(2, hits)))
        return {
            "score": score,
            "strengths": ["Clear attempt", "Relevant explanation"],
            "weaknesses": ["Add more project proof and measurable impact"],
            "model_answer": "Use STAR format: situation, task, action, and result. Mention tools, project role, and measurable output.",
            "confidence_level": "Medium",
            "improvement_tips": ["Use STAR format", "Mention technologies", "Add measurable result"]
        }
    return await _ORIG_evaluate_interview_answer(question, answer, expected_keywords, jd_text, resume_text, quiz_context, roadmap_context, project_context, mode)


_ORIG_evaluate_quiz_answer = evaluate_quiz_answer
async def evaluate_quiz_answer(question, correct_answer, user_answer):
    if _sb_local_demo_enabled():
        ok = str(user_answer).strip().lower() == str(correct_answer).strip().lower()
        return {
            "is_correct": ok,
            "score": 10 if ok else 0,
            "explanation": "Local demo evaluation completed.",
            "weak_area": None if ok else "Review this concept again"
        }
    return await _ORIG_evaluate_quiz_answer(question, correct_answer, user_answer)

# ===== FINAL STABLE LOCAL DEMO PATCH END =====


# ===== FORCE LOCAL ATS OVERRIDE PATCH =====
import os as _force_local_ats_os

if "ORIGINAL_CALCULATE_ATS_SCORE_BACKUP" not in globals():
    ORIGINAL_CALCULATE_ATS_SCORE_BACKUP = calculate_ats_score

async def calculate_ats_score(
    resume_text: str,
    target_role: str = "",
    job_description: str = "",
    resume_data=None,
):
    """
    Forced local ATS scoring for stable college demo.
    Avoids external AI API failure and returns non-zero ATS score.
    """
    if str(_force_local_ats_os.getenv("FORCE_LOCAL_ATS", "true")).strip().lower() in {"1", "true", "yes", "on"}:
        result = _calculate_ats_score_rule_based(
            resume_text=resume_text,
            target_role=target_role,
            job_description=job_description,
            resume_data=resume_data,
        )
        result["source"] = "local_rule_engine"
        result["fallback_reason"] = "FORCE_LOCAL_ATS enabled"
        return result

    return await ORIGINAL_CALCULATE_ATS_SCORE_BACKUP(
        resume_text=resume_text,
        target_role=target_role,
        job_description=job_description,
        resume_data=resume_data,
    )

# ===== FORCE LOCAL ATS OVERRIDE PATCH END =====
