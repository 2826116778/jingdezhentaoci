#!/bin/bash
set -e

echo "=== LuxeCeramics 部署脚本 ==="

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo "请先安装 Node.js 18+"
    exit 1
fi

echo "1. 安装根依赖..."
npm install

echo "2. 安装后端依赖..."
cd backend && npm install && cd ..

echo "3. 构建前端..."
cd frontend && npm run build && cd ..

echo "4. 配置环境变量..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "已创建 .env 文件，请编辑配置"
fi

echo ""
echo "=== 部署完成 ==="
echo "请编辑 .env 文件后运行: node backend/dist/index.js"
