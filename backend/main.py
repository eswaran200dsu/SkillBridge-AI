from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.routes import router
from app.services.supabase_service import supabase_service
import os

# Create upload directory if it doesn't exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=settings.DESCRIPTION,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(router)

@app.on_event("startup")
async def startup_event():
    print(f"🚀 {settings.PROJECT_NAME} v{settings.VERSION} starting...")
    print(f"📚 API Documentation: http://localhost:8000/docs")
    print(f"🔧 Upload directory: {settings.UPLOAD_DIR}")

    encryption_secret = str(getattr(settings, "API_KEY_ENCRYPTION_SECRET", "") or "").strip()
    if supabase_service.enabled and encryption_secret:
        ok, db_key, err = supabase_service.get_runtime_api_key("global", encryption_secret)
        if ok and db_key:
            normalized = str(db_key).strip().strip('"').strip("'")
            if normalized.lower().startswith("bearer "):
                normalized = normalized[7:].strip()
            settings.OXLO_API_KEY = normalized
            settings.ATS_API_KEY = normalized
            settings.JD_API_KEY = normalized
            settings.ROADMAP_API_KEY = normalized
            settings.QUIZ_API_KEY = normalized
            settings.INTERVIEW_API_KEY = normalized
            os.environ["OXLO_API_KEY"] = normalized
            os.environ["ATS_API_KEY"] = normalized
            os.environ["JD_API_KEY"] = normalized
            os.environ["ROADMAP_API_KEY"] = normalized
            os.environ["QUIZ_API_KEY"] = normalized
            os.environ["INTERVIEW_API_KEY"] = normalized
            print("✅ Hydrated API key from Supabase runtime storage")
        elif err and "not found" not in err.lower():
            print(f"⚠️  Could not hydrate API key from Supabase: {err}")
    
    if settings.ATS_API_KEY:
        print(f"✅ ATS model route configured ({settings.ATS_MODEL})")
    else:
        print("⚠️  ATS model route not configured")

    if settings.JD_API_KEY:
        print(f"✅ JD model route configured ({settings.JD_MODEL})")
    else:
        print("⚠️  JD model route not configured")
    
    if settings.ADZUNA_APP_ID and settings.ADZUNA_APP_KEY:
        print("✅ Adzuna API configured")
    else:
        print("⚠️  Adzuna API not configured - using sample jobs")

@app.on_event("shutdown")
async def shutdown_event():
    print("👋 Shutting down SkillBridge AI API...")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    )
