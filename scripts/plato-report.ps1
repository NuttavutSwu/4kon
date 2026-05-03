$ErrorActionPreference = 'Stop'

$rootDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$tempRoot = Join-Path $rootDir '.plato-tmp'
$reportDir = Join-Path $rootDir 'report'

$sourceFiles = @(
  'app.js',
  'routes\admin.js',
  'routes\auth.js',
  'routes\categories.js',
  'routes\pages.js',
  'routes\products.js',
  'middleware\auth.js',
  'utils\db.js',
  'utils\supabase.js',
  'public\js\main.js',
  'public\js\admin.js',
  'js\user auth.js'
)

function Convert-OptionalChaining {
  param([string]$Text)

  $pattern = '([A-Za-z_$][\w$\.]*)\?\.([A-Za-z_$][\w$]*)'
  $current = $Text

  do {
    $updated = [regex]::Replace($current, $pattern, {
      param($match)
      $left = $match.Groups[1].Value
      $right = $match.Groups[2].Value
      return "($left && $left.$right)"
    })
    $changed = $updated -ne $current
    $current = $updated
  } while ($changed)

  return $current
}

if (Test-Path $tempRoot) {
  Remove-Item -Recurse -Force $tempRoot
}

New-Item -ItemType Directory -Path $tempRoot | Out-Null

foreach ($relative in $sourceFiles) {
  $source = Join-Path $rootDir $relative
  if (-not (Test-Path $source)) {
    continue
  }

  $target = Join-Path $tempRoot $relative
  $targetDir = Split-Path -Parent $target
  if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
  }

  $content = Get-Content $source -Raw
  $content = Convert-OptionalChaining $content
  Set-Content -Path $target -Value $content -Encoding UTF8
}

$platoCmd = Join-Path $env:APPDATA 'npm\plato.cmd'
if (-not (Test-Path $platoCmd)) {
  throw "Plato command not found at $platoCmd"
}

if (Test-Path $reportDir) {
  Remove-Item -Recurse -Force $reportDir
}

$tempFiles = $sourceFiles | ForEach-Object {
  $path = Join-Path $tempRoot $_
  if (Test-Path $path) { $_ }
} | Where-Object { $_ }

& $platoCmd -r -d $reportDir @tempFiles

Remove-Item -Recurse -Force $tempRoot
