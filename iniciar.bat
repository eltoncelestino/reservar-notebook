@echo off
chcp 65001 >nul
pushd "%~dp0"

set "PY_CMD=python"
if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    set "PY_CMD=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
) else if exist "C:\Program Files\Python312\python.exe" (
    set "PY_CMD=C:\Program Files\Python312\python.exe"
)

echo Verificando dependencias (Flask)...
"%PY_CMD%" -c "import flask" 2>nul
if errorlevel 1 (
    echo Instalando Flask...
    "%PY_CMD%" -m pip install -r requirements.txt
)

start "" http://localhost:5000/sistema-reservar-notebook
echo Iniciando Sistema de Reserva de Notebook...
"%PY_CMD%" app.py
pause
