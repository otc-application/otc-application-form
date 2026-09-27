<#
.SYNOPSIS
部署 GAS 後端到固定的 deployment ID，並驗證結果。

.DESCRIPTION
依序做前置檢查 → clasp push → clasp redeploy（固定 ID、不帶 -V）→ 驗證。
任何一步不符就 exit 1，不會繼續往下部署。

本腳本**不會建立新的 deployment**。固定 ID 若消失會停下並報錯，需在
Apps Script 編輯器手動重建後，同步更新 web/.env.production 與下面的
$DeploymentId。

.PARAMETER Message
必填。會成為 clasp deployment 的 description，等同 GAS 側的 commit 訊息
（Conventional Commits 格式的 subject + 說明「為什麼」的 body）。

Apps Script 的 HTML 編輯畫面沒有版控，`clasp list-deployments` 的
description 是日後唯一能回溯「這次部署改了什麼」的線索，所以不接受空字串。

.PARAMETER SkipPush
只重新部署，不推送本機變更。確認本機 Code.gs 與遠端一致時才用。

.EXAMPLE
.\deploy.ps1 -Message "fix(gas): 移除確認信的內嵌圖片`n`nMailApp.sendEmail 不支援 inlineImages 參數，導致每封信都寄不出去。"

.EXAMPLE
.\deploy.ps1 -SkipPush -Message "chore(gas): 重新部署以套用最新權限設定"
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Message,
    [switch]$SkipPush
)

$ErrorActionPreference = 'Stop'

# clasp 是 Node CLI，stdout 一律是 UTF-8。Windows PowerShell 5.1 預設用主控台
# 碼頁（本機是 Big5）解讀原生程式的輸出，中文會被解成替代字元，緊接著
# ConvertFrom-Json 就因為字串損壞而失敗。
# 症狀很有欺騙性：部署其實成功了，卻在驗證步驟報錯，看起來像部署壞掉。
[Console]::OutputEncoding = [Text.Encoding]::UTF8

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

# 說明訊息正規化：把 CRLF 統一成 LF，這樣不論呼叫端是 here-string 還是
# 單行字串，事後比對都一致。
$desc = $Message -replace "`r`n", "`n"
$descSubject = ($desc -split "`n")[0].Trim()
if (-not $descSubject) {
    Fail '-Message has no subject line'
}
if ($descSubject -notmatch '^(feat|fix|docs|chore|refactor|perf|test|style|build|ci)(\([^)]+\))?!?: .+') {
    Write-Warning @"
-Message 的 subject 不像 Conventional Commits。仍會部署，但請與 git log 保持一致。
  got:      $descSubject
  expected: fix(gas): 說明這次改了什麼
"@
}

Write-Host "GAS deployment: $($script:DeploymentId)" -ForegroundColor White
Write-Host "URL: $($script:DeploymentUrl)" -ForegroundColor DarkGray
Write-Host "Message: $descSubject" -ForegroundColor DarkGray

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
clasp redeploy $script:DeploymentId -d $desc
if ($LASTEXITCODE -ne 0) {
    Fail 'clasp redeploy failed. Do not create a new deployment. Stop and investigate.'
}
Ok 'redeployed, URL unchanged'

Step 'Verify the deployment (version + description)'
$depRaw = clasp list-deployments --json 2>&1 | Out-String
try {
    $depJson = $depRaw | ConvertFrom-Json
} catch {
    Fail "could not parse clasp list-deployments --json:`n$($depRaw.Trim())"
}
$mine = $depJson | Where-Object { $_.deploymentId -eq $script:DeploymentId }
if (-not $mine) {
    Fail "deployment $($script:DeploymentId) is no longer in the deployment list"
}

# ⚠️ 刻意改用 --json 讀版本號，不再解析表格輸出裡的 '@N'：表格格式一改就
# 打不出數字，而舊寫法在抓不到數字時會直接回 OK，等於把「無法驗證」當成
# 「驗證通過」—— 那正是本專案出事時的形狀。
$maxVer = 0
foreach ($line in @(clasp list-versions 2>&1)) {
    if ($line -match '^\s*(\d+)\s+-') {
        $n = [int]$Matches[1]
        if ($n -gt $maxVer) { $maxVer = $n }
    }
}
if ($null -eq $mine.versionNumber) {
    Fail 'the deployment reports no version number; it may not be running the latest code'
}
if ($mine.versionNumber -ne $maxVer) {
    Fail "deployment is at @$($mine.versionNumber) but the latest version is @$maxVer. New code is not live."
}
Ok "latest version @$($mine.versionNumber)"

# 說明沒寫上去等於這次部署沒有留下任何線索：Apps Script 編輯畫面不會顯示
# clasp 的 deployment description，只有這裡看得到。
$actualDesc = $mine.description
if (-not $actualDesc) {
    Fail 'the deployment has no description; -Message did not take effect'
}
if (($actualDesc -replace "`r`n", "`n") -ne $desc) {
    Fail "the deployment description does not match -Message.`n  got:      $actualDesc`n  expected: $desc"
}
Ok "description recorded: $descSubject"

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
