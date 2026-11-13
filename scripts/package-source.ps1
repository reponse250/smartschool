$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$releaseDirectory = Join-Path $projectRoot 'release'
$zipPath = Join-Path $releaseDirectory 'SmartSchool-Mubuga-source.zip'
$stagingDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("smartschool-source-" + [guid]::NewGuid().ToString('N'))

$excludedDirectories = @('.git', 'node_modules', 'android', 'ios', 'release', 'dist')

function Copy-SafeTree($sourceDirectory, $destinationDirectory) {
    foreach ($item in Get-ChildItem -LiteralPath $sourceDirectory -Force) {
        if ($item.PSIsContainer) {
            if ($excludedDirectories -contains $item.Name) {
                continue
            }

            $childDestination = Join-Path $destinationDirectory $item.Name
            New-Item -ItemType Directory -Path $childDestination -Force | Out-Null
            Copy-SafeTree $item.FullName $childDestination
            continue
        }

        if (
            ($item.Name -match '^\.env($|\.)' -and $item.Name -ne '.env.example') -or
            $item.Name -match '^(\.npmrc|\.pypirc|id_(rsa|ed25519)|credentials\.json|secrets\.json)$' -or
            @('.pem', '.key', '.p12', '.pfx') -contains $item.Extension.ToLowerInvariant() -or
            $item.Extension -eq '.zip' -or
            $item.Name -match '\.log$'
        ) {
            continue
        }

        Copy-Item -LiteralPath $item.FullName -Destination (Join-Path $destinationDirectory $item.Name)
    }
}

New-Item -ItemType Directory -Path $stagingDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $releaseDirectory -Force | Out-Null

try {
    Copy-SafeTree $projectRoot $stagingDirectory
    if (Test-Path -LiteralPath $zipPath) {
        Remove-Item -LiteralPath $zipPath -Force
    }

    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [System.IO.Compression.ZipFile]::Open(
        $zipPath,
        [System.IO.Compression.ZipArchiveMode]::Create
    )
    try {
        foreach ($file in Get-ChildItem -LiteralPath $stagingDirectory -File -Recurse -Force) {
            $entryName = $file.FullName.Substring($stagingDirectory.Length).TrimStart('\') -replace '\\', '/'
            $entry = $archive.CreateEntry(
                $entryName,
                [System.IO.Compression.CompressionLevel]::Optimal
            )
            $inputStream = [System.IO.File]::OpenRead($file.FullName)
            $outputStream = $entry.Open()
            try {
                $inputStream.CopyTo($outputStream)
            }
            finally {
                $outputStream.Dispose()
                $inputStream.Dispose()
            }
        }
    }
    finally {
        $archive.Dispose()
    }

    Write-Output "Created $zipPath"
}
finally {
    Remove-Item -LiteralPath $stagingDirectory -Recurse -Force
}
