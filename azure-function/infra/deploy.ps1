# PRA Sync — Azure deployment script
# Prerequisites: Azure CLI (az), Azure Functions Core Tools (func)
#
# Usage:
#   .\deploy.ps1 -ResourceGroup "MyGroup" -StorageAccountName "myuniquestorage" -SyncSecret "my-secret"
#
# Optional parameters:
#   -Location        Azure region (default: eastus)
#   -AppName         Function App + resource base name (default: pra-sync)

param(
    [Parameter(Mandatory)][string]$ResourceGroup,
    [Parameter(Mandatory)][string]$StorageAccountName,
    [Parameter(Mandatory)][string]$SyncSecret,
    [string]$Location = "eastus",
    [string]$AppName = "pra-sync"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "==> Logging in to Azure (skip if already logged in)" -ForegroundColor Cyan
az account show > $null 2>&1
if ($LASTEXITCODE -ne 0) { az login }

Write-Host "==> Creating resource group '$ResourceGroup' in '$Location'" -ForegroundColor Cyan
az group create --name $ResourceGroup --location $Location | Out-Null

Write-Host "==> Deploying Bicep template..." -ForegroundColor Cyan
$deployOutput = az deployment group create `
    --resource-group $ResourceGroup `
    --template-file "$PSScriptRoot\main.bicep" `
    --parameters `
        appName=$AppName `
        storageAccountName=$StorageAccountName `
        syncSecret=$SyncSecret `
        location=$Location `
    --query "properties.outputs" `
    --output json | ConvertFrom-Json

$syncUrl = $deployOutput.syncUrl.value
$functionAppName = $deployOutput.functionAppName.value

Write-Host "==> Infrastructure deployed." -ForegroundColor Green
Write-Host "    Function App : $functionAppName"
Write-Host "    Sync URL     : $syncUrl"

Write-Host "==> Deploying function code..." -ForegroundColor Cyan
Push-Location "$PSScriptRoot\.."
npm install --omit=dev
func azure functionapp publish $functionAppName --node
Pop-Location

Write-Host ""
Write-Host "===================================================" -ForegroundColor Green
Write-Host " Deployment complete!" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Green
Write-Host " Sync URL    : $syncUrl" -ForegroundColor Yellow
Write-Host " Secret      : $SyncSecret" -ForegroundColor Yellow
Write-Host " Enter both in PRA Settings > Synchronizace" -ForegroundColor Yellow
Write-Host "==================================================="
