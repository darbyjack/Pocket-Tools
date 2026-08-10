$ErrorActionPreference = "Stop"

$repositoryRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repositoryRoot

$gitleaksVersion = "8.30.0"
$checksumsFileHash = "78e53de2429bde6500a6f22793546babe6ae75634a0c250c37e3a07703856a90"
$windowsX64ArchiveHash = "54fe94f644b832dd08e8c3a5915efb3bfa862386d59fb27ca0792cb687a83573"
$toolRoot = Join-Path $repositoryRoot "release-work\tools\gitleaks-$gitleaksVersion"
$archivePath = Join-Path $toolRoot "gitleaks_${gitleaksVersion}_windows_x64.zip"
$checksumsPath = Join-Path $toolRoot "gitleaks_${gitleaksVersion}_checksums.txt"
$gitleaksExe = Join-Path $toolRoot "gitleaks.exe"

function Assert-LastExitCode([string]$message) {
    if ($LASTEXITCODE -ne 0) {
        throw $message
    }
}

$status = @(git status --porcelain=v1 --untracked-files=all)
Assert-LastExitCode "Unable to inspect the Git worktree."

if ($status.Count -gt 0) {
    $status | ForEach-Object { Write-Host $_ }
    throw "The worktree must be clean before the history audit."
}

$isShallow = (git rev-parse --is-shallow-repository).Trim()
Assert-LastExitCode "Unable to determine whether the repository is shallow."

if ($isShallow -ne "false") {
    throw "The history audit requires a complete, non-shallow clone."
}

Write-Host "Refreshing isolated remote audit refs..."

$existingAuditRefs = @(
    git for-each-ref --format="%(refname)" refs/audit
)
Assert-LastExitCode "Unable to inspect existing audit refs."

foreach ($auditRef in $existingAuditRefs) {
    if ($auditRef) {
        git update-ref -d $auditRef
        Assert-LastExitCode "Unable to remove stale audit ref $auditRef."
    }
}

git fetch origin `
    "+refs/heads/*:refs/audit/heads/*" `
    "+refs/tags/*:refs/audit/tags/*" `
    "+refs/pull/*/head:refs/audit/pull/*/head"

Assert-LastExitCode "Unable to fetch the complete remote audit ref set."

New-Item -ItemType Directory -Force -Path $toolRoot | Out-Null

$checksumsUrl =
    "https://github.com/gitleaks/gitleaks/releases/download/v${gitleaksVersion}/gitleaks_${gitleaksVersion}_checksums.txt"
$archiveUrl =
    "https://github.com/gitleaks/gitleaks/releases/download/v${gitleaksVersion}/gitleaks_${gitleaksVersion}_windows_x64.zip"

if (-not (Test-Path $gitleaksExe)) {
    Write-Host "Downloading pinned Gitleaks $gitleaksVersion..."

    Invoke-WebRequest -Uri $checksumsUrl -OutFile $checksumsPath
    $actualChecksumsHash = (
        Get-FileHash $checksumsPath -Algorithm SHA256
    ).Hash.ToLowerInvariant()

    if ($actualChecksumsHash -ne $checksumsFileHash) {
        throw "Gitleaks checksums file hash mismatch: $actualChecksumsHash"
    }

    $archiveName = Split-Path $archivePath -Leaf
    $checksumLine = Get-Content $checksumsPath |
        Where-Object { $_ -match "\s+$([regex]::Escape($archiveName))$" } |
        Select-Object -First 1

    if (-not $checksumLine) {
        throw "Unable to find $archiveName in the verified Gitleaks checksums file."
    }

    $expectedArchiveHash = ($checksumLine -split "\s+")[0].ToLowerInvariant()

    if ($expectedArchiveHash -ne $windowsX64ArchiveHash) {
        throw "Verified Gitleaks manifest contains an unexpected Windows x64 archive hash: $expectedArchiveHash"
    }

    Invoke-WebRequest -Uri $archiveUrl -OutFile $archivePath
    $actualArchiveHash = (
        Get-FileHash $archivePath -Algorithm SHA256
    ).Hash.ToLowerInvariant()

    if ($actualArchiveHash -ne $expectedArchiveHash) {
        throw "Gitleaks archive hash mismatch: $actualArchiveHash"
    }

    Expand-Archive -Path $archivePath -DestinationPath $toolRoot -Force
}

$reportedVersion = (& $gitleaksExe version | Out-String).Trim()

if ($reportedVersion -notmatch [regex]::Escape($gitleaksVersion)) {
    throw "Expected Gitleaks $gitleaksVersion but found: $reportedVersion"
}

$outputDirectory = "release-work\history-audit"

Remove-Item $outputDirectory -Recurse -Force -ErrorAction SilentlyContinue

node scripts/repository-history-audit.mjs `
    --gitleaks $gitleaksExe `
    --output $outputDirectory

Assert-LastExitCode "Repository history audit failed."

node scripts/repository-history-audit-review.mjs `
    --input "$outputDirectory\gitleaks.json" `
    --output "$outputDirectory\gitleaks-review.json"

Assert-LastExitCode "Unable to create the sanitized Gitleaks review queue."

Write-Host ""
Write-Host "Audit completed. Review:"
Write-Host "  $outputDirectory\summary.json"
Write-Host "  $outputDirectory\gitleaks-review.json"
Write-Host "  $outputDirectory\suspicious-paths.json"
Write-Host "  $outputDirectory\large-blobs.json"
Write-Host "  $outputDirectory\content-review.json"
Write-Host "  $outputDirectory\refs.json"
Write-Host "  $outputDirectory\SHA256SUMS"
Write-Host ""
Write-Host "Raw redacted scanner output remains local at:"
Write-Host "  $outputDirectory\gitleaks.json"
