$ErrorActionPreference = "Stop"


$pythonCmd = @("python")
if (Get-Command py -ErrorAction SilentlyContinue) {
	$pythonCmd = @("py", "-3.11")
}

Write-Host "Installing LibreTranslate (Python 3.11 recommended)..." -ForegroundColor Cyan
& $pythonCmd[0] $pythonCmd[1] -m pip install libretranslate

Write-Host "Starting LibreTranslate on http://localhost:5000 ..." -ForegroundColor Green
$scriptsDir = & $pythonCmd[0] $pythonCmd[1] -c "import sysconfig; print(sysconfig.get_path('scripts'))"
$exePath = Join-Path $scriptsDir "libretranslate.exe"
if (-not $env:LIBRETRANSLATE_LOAD_ONLY) {
	$env:LIBRETRANSLATE_LOAD_ONLY = "en,ru,kk"
}
if (Test-Path $exePath) {
	& $exePath --load-only $env:LIBRETRANSLATE_LOAD_ONLY
} else {
	Write-Error "libretranslate.exe not found in $scriptsDir. Ensure Python 3.11 Scripts is on PATH."
}
