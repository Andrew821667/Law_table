#!/bin/bash
# 🚀 Скрипт для быстрого деплоя на GitHub
# Выполните этот скрипт на вашем Mac после копирования проекта

set -e

echo "🚀 Legal AI Sheets Scripts - GitHub Deploy"
echo "==========================================="
echo ""

# Цвета для вывода
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Проверка, что мы в правильной директории
if [ ! -f ".clasp.json" ]; then
    echo "❌ Ошибка: .clasp.json не найден!"
    echo "Запустите скрипт из корневой директории проекта"
    exit 1
fi

echo -e "${BLUE}Шаг 1: Проверка GitHub CLI...${NC}"
if ! command -v gh &> /dev/null; then
    echo -e "${YELLOW}⚠️  GitHub CLI не установлен${NC}"
    echo "Установите: brew install gh"
    echo ""
    echo "Или создайте репозиторий вручную:"
    echo "1. Откройте https://github.com/new"
    echo "2. Имя: legal-ai-sheets-scripts"
    echo "3. Нажмите Create repository"
    echo ""
    read -p "После создания нажмите Enter для продолжения..."
else
    echo -e "${GREEN}✅ GitHub CLI установлен${NC}"

    # Проверка авторизации
    if ! gh auth status &> /dev/null; then
        echo -e "${YELLOW}🔐 Требуется авторизация в GitHub...${NC}"
        gh auth login
    fi

    echo ""
    echo -e "${BLUE}Создаем репозиторий на GitHub...${NC}"

    # Репозиторий уже создан на https://github.com/Andrew821667/Law_table
    echo -e "${GREEN}✅ Репозиторий уже создан: Law_table${NC}"
fi

echo ""
echo -e "${BLUE}Шаг 2: Настройка git remote...${NC}"

# Проверка существующего remote
if git remote | grep -q "origin"; then
    echo -e "${YELLOW}⚠️  Remote 'origin' уже существует${NC}"
    CURRENT_REMOTE=$(git remote get-url origin)
    echo "Текущий remote: $CURRENT_REMOTE"

    read -p "Заменить на новый? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git remote remove origin
        git remote add origin https://github.com/Andrew821667/Law_table.git
        echo -e "${GREEN}✅ Remote обновлен${NC}"
    fi
else
    git remote add origin https://github.com/Andrew821667/Law_table.git
    echo -e "${GREEN}✅ Remote добавлен${NC}"
fi

echo ""
echo -e "${BLUE}Шаг 3: Скачивание реальных скриптов из Google Sheets...${NC}"

# Проверка clasp
if ! command -v clasp &> /dev/null; then
    echo -e "${YELLOW}⚠️  clasp не установлен${NC}"
    echo "Установка..."
    npm install -g @google/clasp
fi

# Проверка авторизации clasp
if [ ! -f ~/.clasprc.json ]; then
    echo -e "${YELLOW}🔐 Требуется авторизация в Google...${NC}"
    clasp login
fi

echo "📥 Скачиваем код из Google Sheets..."
clasp pull --force || echo -e "${YELLOW}⚠️  Не удалось скачать код. Продолжаем...${NC}"

echo ""
echo -e "${BLUE}Шаг 4: Коммит реальных скриптов...${NC}"

if git diff --quiet && git diff --cached --quiet; then
    echo -e "${YELLOW}⚠️  Нет изменений для коммита${NC}"
else
    git add .
    git commit -m "feat: add real scripts from Google Sheets" || echo -e "${YELLOW}⚠️  Нечего коммитить${NC}"
    echo -e "${GREEN}✅ Изменения закоммичены${NC}"
fi

echo ""
echo -e "${BLUE}Шаг 5: Push на GitHub...${NC}"

git push -u origin main || git push origin main

echo ""
echo -e "${GREEN}✅✅✅ Успешно задеплоено на GitHub! ✅✅✅${NC}"
echo ""
echo "📍 Ваш репозиторий:"
echo "   https://github.com/Andrew821667/Law_table"
echo ""
echo -e "${BLUE}Шаг 6: Настройка GitHub Secrets для CI/CD${NC}"
echo ""
echo "Для автоматического деплоя нужно добавить секрет:"
echo ""
echo "1. Откройте: https://github.com/Andrew821667/Law_table/settings/secrets/actions"
echo "2. Нажмите: New repository secret"
echo "3. Name: CLASPRC_JSON"
echo "4. Value: (выполните команду ниже и скопируйте результат)"
echo ""
echo -e "${YELLOW}   cat ~/.clasprc.json${NC}"
echo ""
read -p "Нажмите Enter когда добавите секрет..."

echo ""
echo -e "${GREEN}🎉 ВСЁ ГОТОВО! 🎉${NC}"
echo ""
echo "Теперь при каждом push в main код автоматически задеплоится в Google Sheets!"
echo ""
echo "📚 Полезные команды:"
echo "   npm run pull         - Скачать из Google Sheets"
echo "   npm run push         - Загрузить в Google Sheets"
echo "   npm run lint         - Проверить код"
echo "   npm run open         - Открыть в браузере"
echo ""
echo "Happy coding! 🚀"
