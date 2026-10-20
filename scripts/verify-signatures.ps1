param([string]$OutputDirectory = (Join-Path $PSScriptRoot '../dist'))
$ErrorActionPreference = 'Stop'
$version = (Get-Content -LiteralPath (Join-Path $PSScriptRoot '../package.json') -Raw | ConvertFrom-Json).version
$files = @(
    (Join-Path $OutputDirectory "StarOptimizer-$version-portable.exe"),
    (Join-Path $OutputDirectory 'win-unpacked/StarOptimizer.exe'),
    (Join-Path $OutputDirectory 'win-unpacked/resources/app.asar.unpacked/src/native/StarOptimizer.System.exe')
)
foreach ($file in $files) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Missing executable: $file" }
    $signature = Get-AuthenticodeSignature -LiteralPath $file
    if ($signature.Status -ne 'Valid') { throw "Invalid signature ($($signature.Status)): $file" }
    if ($null -eq $signature.TimeStamperCertificate) { throw "Missing timestamp: $file" }
    Write-Output "Valid signed executable: $file"
}
