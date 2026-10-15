# Sobe public/cars, public/scenery, public/hdri pro Cloudflare R2 via rclone.
#
# Pré-requisitos (fazer uma vez):
#   1) Criar conta grátis em https://dash.cloudflare.com/
#   2) R2 → Create bucket → nome sugerido: `reparo360-assets` → região automática
#   3) Bucket → Settings → Public access → Allow Access → copiar o hostname
#      `pub-<hash>.r2.dev` (é a URL pública, vai virar NEXT_PUBLIC_ASSETS_BASE)
#   4) R2 → Manage R2 API Tokens → Create API Token → permissão "Object Read & Write"
#      → salvar Access Key ID e Secret Access Key
#   5) Instalar rclone: `winget install Rclone.Rclone`
#   6) Rodar `rclone config`:
#        n (new remote) → name: `r2`
#        Storage: `s3` → provider: `Cloudflare`
#        env_auth: `false`
#        access_key_id: (colar)
#        secret_access_key: (colar)
#        region: `auto`
#        endpoint: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
#          (Account ID fica em Cloudflare dashboard → R2 → à direita)
#        y (yes, this is OK) → q (quit)
#
# Depois disso, é só rodar este script.

$ErrorActionPreference = "Stop"

$Bucket = "reparo360-assets"
$Root = Split-Path -Parent $PSScriptRoot

$dirs = @(
  @{ Local = "public/cars";    Remote = "cars" },
  @{ Local = "public/scenery"; Remote = "scenery" },
  @{ Local = "public/hdri";    Remote = "hdri" }
)

foreach ($d in $dirs) {
  $localPath = Join-Path $Root $d.Local
  $remotePath = "r2:$Bucket/$($d.Remote)"

  if (-not (Test-Path $localPath)) {
    Write-Warning "Pasta local nao existe: $localPath — pulando"
    continue
  }

  Write-Host ""
  Write-Host "==> Sincronizando $($d.Local) → $remotePath" -ForegroundColor Cyan

  # --transfers 8 paraleliza bem sem estourar rate limit do R2.
  # Uso `copy` (não `sync`) pra nunca apagar objeto que já esteja no R2 mas
  # tenha sumido do disco — perda de asset é irrecuperavel.
  rclone copy $localPath $remotePath `
    --transfers 8 `
    --checkers 8 `
    --progress `
    --stats-one-line
}

Write-Host ""
Write-Host "Pronto." -ForegroundColor Green
Write-Host ""
Write-Host "Proximo passo:" -ForegroundColor Yellow
Write-Host "  Copie o hostname publico do bucket (algo como https://pub-<hash>.r2.dev)"
Write-Host "  e configure no Vercel:  NEXT_PUBLIC_ASSETS_BASE=<esse hostname>"
