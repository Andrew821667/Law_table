#!/bin/bash

# Setup script для локальной разработки
# Legal AI Sheets Scripts

set -e

echo "🚀 Legal AI Sheets Scripts - Local Setup"
echo "=========================================="
echo ""

# Проверка Node.js
echo "📦 Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v)
echo "✅ Node.js $NODE_VERSION found"
echo ""

# Проверка npm
echo "📦 Checking npm..."
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install npm"
    exit 1
fi

NPM_VERSION=$(npm -v)
echo "✅ npm $NPM_VERSION found"
echo ""

# Установка зависимостей
echo "📦 Installing dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# Установка clasp глобально
echo "📦 Installing clasp globally..."
if ! command -v clasp &> /dev/null; then
    npm install -g @google/clasp
    echo "✅ clasp installed globally"
else
    CLASP_VERSION=$(clasp -v)
    echo "✅ clasp $CLASP_VERSION already installed"
fi
echo ""

# Проверка clasp login
echo "🔐 Checking clasp authentication..."
if [ ! -f ~/.clasprc.json ]; then
    echo "⚠️  You need to login to clasp"
    echo "Run: clasp login"
    echo ""
    read -p "Do you want to login now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        clasp login
    else
        echo "⚠️  Remember to run 'clasp login' before pulling/pushing code"
    fi
else
    echo "✅ clasp authentication found"
fi
echo ""

# Проверка .clasp.json
echo "📝 Checking clasp configuration..."
if [ ! -f .clasp.json ]; then
    echo "❌ .clasp.json not found"
    echo "This file should contain your Script ID"
    exit 1
fi
echo "✅ .clasp.json found"
echo ""

# Скачать код из Google Sheets (опционально)
echo "📥 Do you want to pull code from Google Apps Script?"
read -p "This will download current scripts from Google Sheets (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📥 Pulling code from Google Apps Script..."
    clasp pull
    echo "✅ Code pulled successfully"
else
    echo "⏭️  Skipping code pull"
fi
echo ""

# Финальная информация
echo "✅ Setup completed successfully!"
echo ""
echo "📚 Next steps:"
echo "  1. Edit code in src/ directory"
echo "  2. Test locally: npm run lint"
echo "  3. Push to Google Sheets: npm run push"
echo "  4. View logs: npm run logs"
echo ""
echo "🔗 Useful commands:"
echo "  npm run pull         - Download code from Google Sheets"
echo "  npm run push         - Upload code to Google Sheets"
echo "  npm run push:force   - Force upload (overwrites)"
echo "  npm run lint         - Check code quality"
echo "  npm run lint:fix     - Auto-fix code issues"
echo "  npm run open         - Open script in browser"
echo ""
echo "Happy coding! 🎉"
