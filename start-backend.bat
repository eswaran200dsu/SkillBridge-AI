@echo off
setlocal

cd /d "%~dp0backend"

if exist "..\.venv\Scripts\activate.bat" (
    call "..\.venv\Scripts\activate.bat"
)

echo Starting SkillBridge backend on http://127.0.0.1:8001
uvicorn main:app --reload --host 127.0.0.1 --port 8001
