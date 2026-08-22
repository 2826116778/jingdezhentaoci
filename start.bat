@echo off
REM 一键启动 Windows（cmd / PowerShell）
REM 前提：本地 MongoDB 27017 默认实例，或改 backend\.env 的 MONGODB_URI
setlocal
cd /d "%~dp0"

echo Step 1 ^> 安装依赖
if not exist node_modules (
  call npm install --no-audit --no-fund --ignore-scripts
)

echo Step 2 ^> 准备 backend\.env（已存在则跳过）
if not exist backend\.env (
  copy backend\.env.example backend\.env > nul
  echo backend\.env 已创建，可修改商户钱包/数据库等
)

echo Step 3 ^> 前端构建
if not exist frontend\dist\index.html (
  cd frontend
  call npm run build
  cd ..
)

echo Step 4 ^> 启动后端（托管前端 dist + API）
cd backend
if not exist node_modules call npm install --no-audit --no-fund --ignore-scripts
if not exist dist ( npx tsc -p tsconfig.json )
set PORT=5000
echo Server starting: http://localhost:%PORT%
node dist\index.js
endlocal
