import os
from dotenv import load_dotenv

load_dotenv()


def _get_env(*names: str, default: str = "") -> str:
    """Return the first non-empty environment variable from a list of names."""
    for name in names:
        value = os.getenv(name)
        if value is not None and str(value).strip() != "":
            return str(value).strip()
    return default


def _normalize_api_key(value: str) -> str:
    """Normalize common key formats like quoted strings or Bearer-prefixed values."""
    key = (value or "").strip().strip('"').strip("'")
    if key.lower().startswith("bearer "):
        key = key[7:].strip()
    return key


def _get_env_bool(*names: str, default: bool = False) -> bool:
    raw = _get_env(*names, default="")
    if not raw:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}

class Settings:
    PROJECT_NAME: str = "SkillBridge AI API"
    VERSION: str = "1.0.0"
    DESCRIPTION: str = "Agentic Career Operating System - HackHazards '26"
    
    # Backward-compatible Oxlo API settings (legacy)
    OXLO_API_KEY: str = _normalize_api_key(
        _get_env("OXLO_API_KEY", "OXLO_API_TOKEN", "OPENAI_API_KEY", "ANTHROPIC_API_KEY")
    )
    OXLO_FALLBACK_API_KEY: str = _normalize_api_key(
        _get_env("OXLO_FALLBACK_API_KEY", "FALLBACK_API_KEY")
    )
    OXLO_CHAT_ENDPOINT: str = _get_env("OXLO_CHAT_ENDPOINT", default="https://api.oxlo.ai/v1/chat/completions")
    OXLO_MODEL: str = _get_env("OXLO_MODEL", default="deepseek r1 8b")
    OXLO_EMBEDDINGS_ENDPOINT: str = os.getenv("OXLO_EMBEDDINGS_ENDPOINT", "https://api.oxlo.ai/v1/embeddings")

    # ATS-specific model routing
    ATS_API_KEY: str = _normalize_api_key(
        _get_env("ATS_API_KEY", "OXLO_ATS_API_KEY", "OXLO_API_KEY", "OXLO_API_TOKEN")
    )
    ATS_CHAT_ENDPOINT: str = _get_env(
        "ATS_CHAT_ENDPOINT",
        "OXLO_ATS_CHAT_ENDPOINT",
        "OXLO_CHAT_ENDPOINT",
        default="https://api.oxlo.ai/v1/chat/completions",
    )
    ATS_MODEL: str = _get_env("ATS_MODEL", "OXLO_ATS_MODEL", default="deepseek-r1-8b")

    # JD-specific model routing
    JD_API_KEY: str = _normalize_api_key(
        _get_env("JD_API_KEY", "OXLO_JD_API_KEY", "OXLO_API_KEY", "OXLO_API_TOKEN")
    )
    JD_CHAT_ENDPOINT: str = _get_env(
        "JD_CHAT_ENDPOINT",
        "OXLO_JD_CHAT_ENDPOINT",
        "OXLO_CHAT_ENDPOINT",
        default="https://api.oxlo.ai/v1/chat/completions",
    )
    JD_MODEL: str = _get_env("JD_MODEL", "OXLO_JD_MODEL", default="deepseek-v3.2")

    # Roadmap-specific model routing
    ROADMAP_API_KEY: str = _normalize_api_key(
        _get_env("ROADMAP_API_KEY", "OXLO_ROADMAP_API_KEY", "OXLO_API_KEY", "OXLO_API_TOKEN")
    )
    ROADMAP_CHAT_ENDPOINT: str = _get_env(
        "ROADMAP_CHAT_ENDPOINT",
        "OXLO_ROADMAP_CHAT_ENDPOINT",
        "OXLO_CHAT_ENDPOINT",
        default="https://api.oxlo.ai/v1/chat/completions",
    )
    ROADMAP_MODEL: str = _get_env("ROADMAP_MODEL", "OXLO_ROADMAP_MODEL", default="deepseek-r1-8b")

    # Quiz-specific model routing
    QUIZ_API_KEY: str = _normalize_api_key(
        _get_env("QUIZ_API_KEY", "OXLO_QUIZ_API_KEY", "OXLO_API_KEY", "OXLO_API_TOKEN")
    )
    QUIZ_CHAT_ENDPOINT: str = _get_env(
        "QUIZ_CHAT_ENDPOINT",
        "OXLO_QUIZ_CHAT_ENDPOINT",
        "OXLO_CHAT_ENDPOINT",
        default="https://api.oxlo.ai/v1/chat/completions",
    )
    QUIZ_MODEL: str = _get_env("QUIZ_MODEL", "OXLO_QUIZ_MODEL", default="deepseek-r1-8b")

    # Interview-specific model routing
    INTERVIEW_API_KEY: str = _normalize_api_key(
        _get_env("INTERVIEW_API_KEY", "OXLO_INTERVIEW_API_KEY", "OXLO_API_KEY", "OXLO_API_TOKEN")
    )
    INTERVIEW_CHAT_ENDPOINT: str = _get_env(
        "INTERVIEW_CHAT_ENDPOINT",
        "OXLO_INTERVIEW_CHAT_ENDPOINT",
        "OXLO_CHAT_ENDPOINT",
        default="https://api.oxlo.ai/v1/chat/completions",
    )
    INTERVIEW_MODEL: str = _get_env("INTERVIEW_MODEL", "OXLO_INTERVIEW_MODEL", default="deepseek-r1-8b")

    # Fallback policy: only allow fallback for explicit provider rate limits
    ENABLE_RATE_LIMIT_FALLBACK: bool = _get_env_bool("ENABLE_RATE_LIMIT_FALLBACK", default=True)

    # Resume analysis optimization
    ENABLE_BULLET_IMPROVEMENTS: bool = _get_env_bool("ENABLE_BULLET_IMPROVEMENTS", default=False)

    # Strict model policy for generation-heavy endpoints
    ROADMAP_STRICT_MODEL: bool = _get_env_bool("ROADMAP_STRICT_MODEL", default=True)
    QUIZ_STRICT_MODEL: bool = _get_env_bool("QUIZ_STRICT_MODEL", default=True)
    INTERVIEW_STRICT_MODEL: bool = _get_env_bool("INTERVIEW_STRICT_MODEL", default=True)

    # Supabase
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    API_KEY_ENCRYPTION_SECRET: str = _get_env("API_KEY_ENCRYPTION_SECRET", default="")
    
    # Job Search APIs
    ADZUNA_APP_ID: str = os.getenv("ADZUNA_APP_ID", "")
    ADZUNA_APP_KEY: str = os.getenv("ADZUNA_APP_KEY", "")
    RAPIDAPI_KEY: str = os.getenv("RAPIDAPI_KEY", "")
    
    # Server Config
    CORS_ORIGINS: list = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./uploads")
    MAX_FILE_SIZE_MB: int = int(os.getenv("MAX_FILE_SIZE_MB", "5"))
    
    # Redis (optional)
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    CACHE_TTL_MINUTES: int = int(os.getenv("CACHE_TTL_MINUTES", "15"))
    
    # Job Search Config
    MAX_JOBS_PER_QUERY: int = int(os.getenv("MAX_JOBS_PER_QUERY", "50"))
    MIN_SKILL_MATCH_RATIO: float = float(os.getenv("MIN_SKILL_MATCH_RATIO", "0.6"))
    API_TIMEOUT_SECONDS: int = int(os.getenv("API_TIMEOUT_SECONDS", "10"))
    QUIZ_API_TIMEOUT_SECONDS: int = int(os.getenv("QUIZ_API_TIMEOUT_SECONDS", "55"))

settings = Settings()
