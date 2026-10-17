@echo off
setlocal
cd /d "%~dp0"
where.exe python >nul 2>&1
if errorlevel 1 (
  where.exe py >nul 2>&1
  if errorlevel 1 (
    echo Python was not found. Install Python 3, then run this file again.
    pause
    exit /b 1
  )
  start "Shivshakti CMS server" /min py -3 "%~dp0server.py"
) else (
  start "Shivshakti CMS server" /min python "%~dp0server.py"
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ready = $false; for ($i = 0; $i -lt 20; $i++) { try { $r = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:8765/api/health' -TimeoutSec 1; if ($r.StatusCode -eq 200 -and $r.Content.Trim() -eq 'ok') { $ready = $true; break } } catch {}; Start-Sleep -Milliseconds 500 }; if ($ready) { Start-Process 'http://127.0.0.1:8765/cms.html' } else { Write-Host 'The CMS server did not start. Check that Python is installed and port 8765 is available.'; pause }"
endlocal
