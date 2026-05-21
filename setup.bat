@echo off
setlocal EnableExtensions EnableDelayedExpansion

echo ========================================
echo SkillBridge AI - One Time Setup
echo ========================================
echo.

set "ROOT_DIR=%~dp0"
set "BACKEND_DIR=%ROOT_DIR%backend"
set "FRONTEND_DIR=%ROOT_DIR%frontend"
set "VENV_DIR=%ROOT_DIR%.venv"

where py >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python launcher 'py' was not found.
    echo Install Python 3.10+ and ensure it is added to PATH.
    goto :fail
)

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm was not found.
    echo Install Node.js LTS and ensure npm is added to PATH.
    goto :fail
)

if not exist "%BACKEND_DIR%\requirements.txt" (
    echo [ERROR] Could not find backend requirements file.
    goto :fail
)

if not exist "%FRONTEND_DIR%\package.json" (
    echo [ERROR] Could not find frontend package.json.
    goto :fail
)

echo [1/7] Creating Python virtual environment...
if not exist "%VENV_DIR%\Scripts\python.exe" (
    py -3 -m venv "%VENV_DIR%"
    if %errorlevel% neq 0 goto :fail
) else (
    echo     Virtual environment already exists. Reusing it.
)

set "PYTHON_EXE=%VENV_DIR%\Scripts\python.exe"

echo [2/7] Upgrading pip/setuptools/wheel...
"%PYTHON_EXE%" -m pip install --upgrade pip setuptools wheel
if %errorlevel% neq 0 goto :fail

echo [3/7] Installing backend dependencies...
"%PYTHON_EXE%" -m pip install -r "%BACKEND_DIR%\requirements.txt"
if %errorlevel% neq 0 goto :fail

echo [4/7] Installing spaCy model (en_core_web_sm)...
"%PYTHON_EXE%" -m spacy download en_core_web_sm
if %errorlevel% neq 0 (
    echo     [WARN] spaCy model install failed. You can retry later with:
    echo            %VENV_DIR%\Scripts\python.exe -m spacy download en_core_web_sm
)

echo [5/7] Installing frontend dependencies...
pushd "%FRONTEND_DIR%"
call npm install
if %errorlevel% neq 0 (
    popd
    goto :fail
)
popd

echo [6/7] Creating backend .env from .env.example if needed...
if exist "%BACKEND_DIR%\.env.example" (
    if not exist "%BACKEND_DIR%\.env" (
        copy "%BACKEND_DIR%\.env.example" "%BACKEND_DIR%\.env" >nul
        echo     Created backend\.env from backend\.env.example
    ) else (
        echo     backend\.env already exists. Keeping your existing values.
    )
) else (
    echo     [WARN] backend\.env.example not found. Skipping .env creation.
)

echo [7/7] Setup complete.
echo.
echo ========================================
echo Setup finished successfully.
echo Next steps:
echo 1. Update backend\.env values if needed.
echo 2. Run start.bat to launch backend and frontend.
echo ========================================
echo.
goto :end

:fail
echo.
echo ========================================
echo Setup failed. Fix the error above and run setup.bat again.
echo ========================================
echo.
exit /b 1

:end
endlocal
exit /b 0
