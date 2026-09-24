param(
  [string]$StatePath,
  [string]$Token,
  [int]$DelayMs
)

try {
  # Main pipes the secret over stdin so it never touches disk. Read raw
  # bytes: [Console]::In would decode with the OEM code page.
  $buffer = New-Object System.IO.MemoryStream
  [Console]::OpenStandardInput().CopyTo($buffer)
  $expected = [System.Text.Encoding]::UTF8.GetString($buffer.ToArray())

  if ([string]::IsNullOrEmpty($expected)) {
    exit 0
  }

  Start-Sleep -Milliseconds $DelayMs

  $currentToken = ''
  try {
    if (Test-Path -LiteralPath $StatePath) {
      $currentToken = [System.IO.File]::ReadAllText($StatePath, [System.Text.Encoding]::UTF8)
    }
  } catch {
    $currentToken = ''
  }

  if (-not [string]::Equals($currentToken, $Token, [System.StringComparison]::Ordinal)) {
    exit 0
  }

  $clipboardText = ''
  try {
    $clipboardText = Get-Clipboard -Raw
  } catch {
    $clipboardText = ''
  }

  if ([string]::Equals($clipboardText, $expected, [System.StringComparison]::Ordinal)) {
    Set-Clipboard -Value ''
  }

  $latestToken = ''
  try {
    if (Test-Path -LiteralPath $StatePath) {
      $latestToken = [System.IO.File]::ReadAllText($StatePath, [System.Text.Encoding]::UTF8)
    }
  } catch {
    $latestToken = ''
  }

  if ([string]::Equals($latestToken, $Token, [System.StringComparison]::Ordinal)) {
    Remove-Item -LiteralPath $StatePath -Force -ErrorAction SilentlyContinue
  }
} catch {
  exit 1
}
