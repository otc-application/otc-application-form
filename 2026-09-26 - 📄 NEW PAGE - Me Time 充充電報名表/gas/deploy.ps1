[CmdletBinding()]
param(
    [switch]$SkipPush
)

$ErrorActionPreference = 'Stop'

$script:DeploymentId = 'AKfycbxeTyNNKooo3xmG3CsdpBhULnMiduMz8ozAdwQ1glai7XnBGGlN82DPwBDwbv-i1PmX'
$script:DeploymentUrl = "https://script.google.com/macros/s/$($script:DeploymentId)/exec"
$script:ExpectedScriptId = '1SGUHG26Yw5yPoKq6ujkwa6jz7_EwbBOqJeDuLy2KnK1DSOhY5222HTRi'
$script:ExpectedColumns = 16
$script:ExpectedSfc = 'Code.gs'

$gasDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $gasDir

function Fail($msg) {
    Write-Host "FAIL: $msg" -ForegroundColor Red
    exit 1
}

function Step($msg) {
    Write-Host "`n> $msg" -ForegroundColor Cyan
}

function Ok($msg) {
    Write-Host "  OK   $msg" -ForegroundColor Green
}

Write-Host "GAS deployment: $($script:DeploymentId)" -ForegroundColor White
Write-Host "URL: $($script:DeploymentUrl)" -ForegroundColor DarkGray

Step 'Preflight: script file set'
$codeFiles = @(Get-ChildItem -Path "$gasDir\*" -File -Include '*.gs', '*.js', '*.ts', '*.html' -Recurse |
    ForEach-Object { $_.Name })
if ($codeFiles.Count -ne 1 -or $codeFiles[0] -ne $script:ExpectedSfc) {
    Fail "gas/ must contain exactly one script file named $($script:ExpectedSfc); found: $($codeFiles -join ', ')"
}
Ok "only $($script:ExpectedSfc)"

Step 'Preflight: clasp project binding'
$projPath = Join-Path $gasDir '.clasp.json'
if (-not (Test-Path $projPath)) {
    Fail 'gas/.clasp.json not found. Copy .clasp.json.example and fill in scriptId.'
}
$proj = Get-Content $projPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($proj.scriptId -ne $script:ExpectedScriptId) {
    Fail "scriptId mismatch: got $($proj.scriptId), expected $($script:ExpectedScriptId)"
}
Ok "scriptId $($proj.scriptId)"

Step 'Preflight: deployment still registered'
$depLine = @(clasp list-deployments 2>&1) | Where-Object { $_ -like "*$($script:DeploymentId)*" }
if (-not $depLine) {
    Fail "deployment $($script:DeploymentId) not found. This script never creates deployments. Restore the deployment in the Apps Script editor, then update .env.production and this script."
}
Ok ($depLine -join '').Trim()

Step 'Preflight: web/.env.production backend URL'
$envFile = Join-Path (Split-Path $gasDir -Parent) 'web\.env.production'
if (-not (Test-Path $envFile)) {
    Fail 'web/.env.production not found'
}
$envUrl = ((Get-Content $envFile -Encoding UTF8) | Where-Object { $_ -match '^VITE_GAS_API_URL=' } |
    Select-Object -First 1) -replace '^VITE_GAS_API_URL=', ''
if ($envUrl.Trim() -ne $script:DeploymentUrl) {
    Fail "web/.env.production does not point at the pinned deployment.`n  got:      $($envUrl.Trim())`n  expected: $($script:DeploymentUrl)"
}
Ok 'URL matches the pinned deployment'

if (-not $SkipPush) {
    Step 'clasp push'
    clasp show-file-status
    if ($LASTEXITCODE -ne 0) { Fail 'clasp show-file-status failed' }
    clasp push -f
    if ($LASTEXITCODE -ne 0) { Fail 'clasp push failed' }
} else {
    Step 'clasp push (skipped via -SkipPush)'
}

Step 'clasp redeploy (no -V: deploys the latest version)'
clasp redeploy $script:DeploymentId
if ($LASTEXITCODE -ne 0) {
    Fail 'clasp redeploy failed. Do not create a new deployment. Stop and investigate.'
}
Ok 'redeployed, URL unchanged'

Step 'Verify the deployment runs the latest version'
$maxVer = 0
foreach ($line in @(clasp list-versions 2>&1)) {
    if ($line -match '^\s*(\d+)\s+-') {
        $n = [int]$Matches[1]
        if ($n -gt $maxVer) { $maxVer = $n }
    }
}
$depLineNow = @(clasp list-deployments 2>&1) | Where-Object { $_ -like "*$($script:DeploymentId)*" }
$depVer = $null
if ($depLineNow -match '@(\d+)') { $depVer = [int]$Matches[1] }
if ($null -eq $depVer -or $depVer -eq $maxVer) {
    Ok "latest version @${maxVer}"
} else {
    Fail "deployment is at @$depVer but the latest version is @$maxVer. New code is not live."
}

Step 'Health check'
$body = curl.exe -sL $script:DeploymentUrl
if ($body -notmatch '^\s*\{') {
    Fail 'response is not JSON. The deployment returned an error page.'
}
try {
    $json = $body | ConvertFrom-Json
} catch {
    Fail "could not parse JSON: $body"
}
if (-not $json.ok) { Fail 'ok is not true' }
if ($json.sheet.name -notmatch '\S') { Fail 'sheet.name is empty; the spreadsheet container binding is broken' }
if ($json.sheet.lastColumn -ne $script:ExpectedColumns) {
    Fail "lastColumn is $($json.sheet.lastColumn), expected $($script:ExpectedColumns). The form schema changed but the sheet header was not rebuilt."
}
Ok "ok=true  sheet=$($json.sheet.name)  lastColumn=$($json.sheet.lastColumn)  lastRow=$($json.sheet.lastRow)"

Write-Host "`nDeployment healthy: $($script:DeploymentUrl)" -ForegroundColor Green
Write-Host "Next: commit and push. Do not create a new deployment for this project." -ForegroundColor DarkGray
