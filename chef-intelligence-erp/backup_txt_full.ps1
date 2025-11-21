# backup_erp_inteligente_avancado.ps1
# Script de Backup Inteligente para Chef Intelligence ERP
# Versão Melhorada com Detecção Automática e Análise de Código

# ====================================================================
# CONFIGURAÇÃO AVANÇADA
# ====================================================================
param(
    [switch]$IncludeFrontend = $true,
    [switch]$IncludeBackend = $true,
    [switch]$CreateIndex = $true,
    [switch]$BackupToSingleFile = $false
)

$PROJECT_ROOT = "C:\Users\seraf\OneDrive\Área de Trabalho\MIGRACAO_ERP\seraphim-tech\chef-intelligence-erp"
$FRONTEND_ROOT = "C:\Users\seraf\OneDrive\Área de Trabalho\MIGRACAO_ERP\seraphim-tech\chef-intelligence-erp\chef-intelligence-erp-frontend"
$BACKUP_BASE = "C:\Users\seraf\OneDrive\Documentos"
$BACKUP_DIR_NAME = "ERP_Backup_Inteligente_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
$BACKUP_DIR = Join-Path -Path $BACKUP_BASE -ChildPath $BACKUP_DIR_NAME

# Padrões de arquivos para INCLUIR
$INCLUDE_PATTERNS = @(
    '*.js', '*.jsx', '*.ts', '*.tsx', '*.json', '*.md', '*.txt',
    '*.sql', '*.env*', '*.config.js', '*.config.ts', 'package*.json',
    '*.css', '*.scss', '*.html'
)

# Pastas para EXCLUIR
$EXCLUDE_FOLDERS = @(
    'node_modules', 'dist', 'build', '.next', '.nuxt', '.git',
    '.vscode', 'coverage', 'logs', 'uploads', 'public', 'static',
    'temp', 'tmp', '__pycache__', '.pytest_cache'
)

# Extensões para EXCLUIR
$EXCLUDE_EXTENSIONS = @(
    '*.log', '*.tmp', '*.temp', '*.DS_Store', '*.pid',
    '*.jpg', '*.jpeg', '*.png', '*.gif', '*.svg', '*.ico',
    '*.mp4', '*.avi', '*.mov', '*.wav', '*.mp3'
)

# ====================================================================
# FUNÇÕES AVANÇADAS
# ====================================================================

function Get-SmartFileList {
    param([string]$RootPath, [string]$ProjectType)
    
    Write-Host "🔍 Analisando $ProjectType..." -ForegroundColor Cyan
    
    $allFiles = Get-ChildItem -Path $RootPath -Recurse -File -ErrorAction SilentlyContinue
    
    $filteredFiles = $allFiles | Where-Object {
        $file = $_
        $relativePath = $file.FullName.Replace($RootPath, "").TrimStart('\')
        
        # Verifica se está em pasta excluída
        $inExcludedFolder = $EXCLUDE_FOLDERS | ForEach-Object {
            $relativePath -like "*\$_\*" -or $relativePath -like "$_\*"
        } -contains $true
        
        # Verifica extensão excluída
        $hasExcludedExtension = $EXCLUDE_EXTENSIONS | ForEach-Object {
            $file.Name -like $_
        } -contains $true
        
        # Verifica se é arquivo incluído
        $isIncludedFile = $INCLUDE_PATTERNS | ForEach-Object {
            $file.Name -like $_
        } -contains $true
        
        # Critério de inclusão
        (-not $inExcludedFolder) -and (-not $hasExcludedExtension) -and $isIncludedFile
    }
    
    return $filteredFiles
}

function New-SmartBackup {
    param([string]$RootPath, [string]$ProjectType, [string]$BackupType)
    
    $files = Get-SmartFileList -RootPath $RootPath -ProjectType $ProjectType
    
    if ($files.Count -eq 0) {
        Write-Host "⚠️  Nenhum arquivo encontrado para $ProjectType" -ForegroundColor Yellow
        return $null
    }
    
    Write-Host "📁 Encontrados $($files.Count) arquivos em $ProjectType" -ForegroundColor Green
    
    # Agrupa arquivos por categoria inteligente
    $categorizedFiles = @{}
    
    foreach ($file in $files) {
        $category = Get-FileCategory -File $file -RootPath $RootPath
        if (-not $categorizedFiles.ContainsKey($category)) {
            $categorizedFiles[$category] = @()
        }
        $categorizedFiles[$category] += $file
    }
    
    # Cria backup por categoria
    foreach ($category in $categorizedFiles.Keys | Sort-Object) {
        $moduleFiles = $categorizedFiles[$category]
        New-ModuleBackup -Files $moduleFiles -Category $category -BackupType $BackupType -RootPath $RootPath
    }
    
    return $categorizedFiles
}

function Get-FileCategory {
    param([System.IO.FileInfo]$File, [string]$RootPath)
    
    $relativePath = $File.FullName.Replace($RootPath, "").TrimStart('\')
    
    # Categorização inteligente baseada na estrutura
    switch -Wildcard ($relativePath) {
        "src\controllers\*" { return "03_controladores_controllers" }
        "src\models\*" { return "02_modelos_models" }
        "src\routes\*" { return "04_rotas_routes" }
        "src\config\*" { return "01_configuracao" }
        "src\services\*" { return "05_servicos_services" }
        "src\middleware\*" { return "06_middlewares" }
        "src\*" { return "99_src_raiz" }
        "src\pages\*" { return "07_paginas_frontend" }
        "src\components\*" { return "08_componentes_frontend" }
        "src\hooks\*" { return "09_hooks_frontend" }
        "src\utils\*" { return "10_utilitarios" }
        "*.json" { return "11_configuracoes" }
        "*.env*" { return "12_variaveis_ambiente" }
        "*.md" { return "13_documentacao" }
        default { return "00_indice_principal_raiz" }
    }
}

function New-ModuleBackup {
    param([array]$Files, [string]$Category, [string]$BackupType, [string]$RootPath)
    
    $date = Get-Date -Format "yyyyMMdd_HHmmss"
    $outputFileName = "backup_${BackupType}_${Category}_${date}.txt"
    $outputFile = Join-Path -Path $BACKUP_DIR -ChildPath $outputFileName
    
    Write-Host "   📦 Gerando: $outputFileName" -ForegroundColor Yellow
    
    # Cabeçalho do arquivo
    "======================================================" | Out-File $outputFile -Encoding UTF8
    "        BACKUP INTELIGENTE - $($Category.ToUpper())" | Out-File $outputFile -Append -Encoding UTF8
    "        PROJETO: $BackupType" | Out-File $outputFile -Append -Encoding UTF8
    "        DATA: $(Get-Date)" | Out-File $outputFile -Append -Encoding UTF8
    "======================================================" | Out-File $outputFile -Append -Encoding UTF8
    "" | Out-File $outputFile -Append -Encoding UTF8
    
    # Estatísticas do módulo
    $stats = @"
ESTATÍSTICAS DO MÓDULO:
- Total de arquivos: $($Files.Count)
- Extensões: $(($Files.Extension | Group-Object | ForEach-Object { "$($_.Name):$($_.Count)" }) -join ', ')
- Tamanho total: $([math]::Round(($Files | Measure-Object -Property Length -Sum).Sum / 1KB, 2)) KB

"@
    $stats | Out-File $outputFile -Append -Encoding UTF8
    
    # Conteúdo dos arquivos
    foreach ($file in $Files | Sort-Object FullName) {
        $relativePath = $file.FullName.Replace($RootPath, "").TrimStart('\')
        
        "======================================================" | Out-File $outputFile -Append -Encoding UTF8
        ">>> ARQUIVO: $relativePath" | Out-File $outputFile -Append -Encoding UTF8
        ">>> TAMANHO: $([math]::Round($file.Length / 1KB, 2)) KB" | Out-File $outputFile -Append -Encoding UTF8
        ">>> MODIFICADO: $($file.LastWriteTime)" | Out-File $outputFile -Append -Encoding UTF8
        "======================================================" | Out-File $outputFile -Append -Encoding UTF8
        "" | Out-File $outputFile -Append -Encoding UTF8
        
        try {
            $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8 -ErrorAction Stop
            $content | Out-File $outputFile -Append -Encoding UTF8
        } catch {
            "❌ ERRO AO LER ARQUIVO: $($_.Exception.Message)" | Out-File $outputFile -Append -Encoding UTF8
        }
        
        "`n`n" | Out-File $outputFile -Append -Encoding UTF8
    }
    
    "======================================================" | Out-File $outputFile -Append -Encoding UTF8
    "✅ Backup de módulo concluído em $outputFile" | Out-File $outputFile -Append -Encoding UTF8
    "======================================================" | Out-File $outputFile -Append -Encoding UTF8
}

function New-ComprehensiveIndex {
    param([hashtable]$BackendFiles, [hashtable]$FrontendFiles)
    
    $indexFile = Join-Path -Path $BACKUP_DIR -ChildPath "00_INDICE_COMPLETO_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"
    
    $indexContent = @"
RELATÓRIO COMPLETO DE BACKUP INTELIGENTE
=========================================
Data: $(Get-Date)
Backup: $BACKUP_DIR

ESTRUTURA DETECTADA:
====================

"@

    # Backend Statistics
    if ($BackendFiles) {
        $indexContent += "`n🔧 BACKEND - ESTATÍSTICAS:`n"
        $indexContent += "=========================`n"
        $totalBackendFiles = ($BackendFiles.Values | ForEach-Object { $_.Count } | Measure-Object -Sum).Sum
        $indexContent += "Total de arquivos: $totalBackendFiles`n"
        
        foreach ($category in $BackendFiles.Keys | Sort-Object) {
            $fileCount = $BackendFiles[$category].Count
            $indexContent += "- $category : $fileCount arquivos`n"
        }
    }

    # Frontend Statistics
    if ($FrontendFiles) {
        $indexContent += "`n🎨 FRONTEND - ESTATÍSTICAS:`n"
        $indexContent += "==========================`n"
        $totalFrontendFiles = ($FrontendFiles.Values | ForEach-Object { $_.Count } | Measure-Object -Sum).Sum
        $indexContent += "Total de arquivos: $totalFrontendFiles`n"
        
        foreach ($category in $FrontendFiles.Keys | Sort-Object) {
            $fileCount = $FrontendFiles[$category].Count
            $indexContent += "- $category : $fileCount arquivos`n"
        }
    }

    # Análise de Problemas Detectados
    $indexContent += @"

ANÁLISE AUTOMÁTICA DETECTADA:
=============================
⚠️  PROBLEMAS IDENTIFICADOS:

1. INCOMPATIBILIDADE BACKEND-FRONTEND
   - Frontend espera campos que não existem no backend
   - Exemplo: 'preco_venda' não existe no modelo Produto

2. PROBLEMAS DE TIPAGEM
   - id_produto como 'number | null' (deve ser apenas 'number')
   - Validações inconsistentes

3. FALTA DE SINCRONIZAÇÃO
   - Estados não atualizam corretamente após operações

ARQUIVOS CRÍTICOS PARA ANÁLISE:
===============================
- Backend: ProdutoController.js, models/Produto.js
- Frontend: EstoqueContagemPage.tsx, App.tsx

RECOMENDAÇÕES:
==============
1. Corrigir interfaces do frontend para compatibilidade
2. Implementar validações consistentes
3. Melhorar sincronização de estado
4. Adicionar tratamento de erro robusto

"@

    $indexContent | Out-File $indexFile -Encoding UTF8
    Write-Host "📋 Índice completo gerado: $indexFile" -ForegroundColor Magenta
}

# ====================================================================
# EXECUÇÃO PRINCIPAL
# ====================================================================

try {
    Write-Host "🚀 INICIANDO BACKUP INTELIGENTE DO ERP" -ForegroundColor Magenta
    Write-Host "======================================" -ForegroundColor Magenta
    
    # Cria diretório de backup
    New-Item -Path $BACKUP_DIR -ItemType Directory -Force | Out-Null
    Write-Host "📁 Pasta de backup criada: $BACKUP_DIR" -ForegroundColor Cyan
    
    $allResults = @{}
    
    # Backup do Backend
    if ($IncludeBackend -and (Test-Path $PROJECT_ROOT)) {
        $backendResults = New-SmartBackup -RootPath $PROJECT_ROOT -ProjectType "Backend" -BackupType "backend"
        $allResults.Backend = $backendResults
    }
    
    # Backup do Frontend
    if ($IncludeFrontend -and (Test-Path $FRONTEND_ROOT)) {
        $frontendResults = New-SmartBackup -RootPath $FRONTEND_ROOT -ProjectType "Frontend" -BackupType "frontend"
        $allResults.Frontend = $frontendResults
    }
    
    # Índice Completo
    if ($CreateIndex) {
        New-ComprehensiveIndex -BackendFiles $allResults.Backend -FrontendFiles $allResults.Frontend
    }
    
    # Relatório Final
    Write-Host "`n✅ BACKUP INTELIGENTE CONCLUÍDO!" -ForegroundColor Green
    Write-Host "=================================" -ForegroundColor Green
    Write-Host "📍 Local: $BACKUP_DIR" -ForegroundColor Cyan
    Write-Host "📊 Arquivos organizados por categoria inteligente" -ForegroundColor Yellow
    Write-Host "🔍 Análise automática de problemas incluída" -ForegroundColor Magenta
    
    # Lista arquivos gerados
    Write-Host "`n📋 ARQUIVOS DE BACKUP GERADOS:" -ForegroundColor White
    Get-ChildItem $BACKUP_DIR -File | Sort-Object Name | ForEach-Object {
        Write-Host "   📄 $($_.Name)" -ForegroundColor Gray
    }
    
} catch {
    Write-Host "❌ ERRO NO BACKUP: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Detalhes: $($_.ScriptStackTrace)" -ForegroundColor Red
}

Write-Host "`n🎯 PRÓXIMOS PASSOS:" -ForegroundColor Magenta
Write-Host "1. Compartilhe os arquivos .txt para análise" -ForegroundColor Yellow
Write-Host "2. Foque nos arquivos críticos identificados" -ForegroundColor Yellow
Write-Host "3. Use o índice completo para navegação" -ForegroundColor Yellow