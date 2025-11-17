#!/bin/bash
echo "Устанавливаем clasp..."
npm install -g @google/clasp

echo "Логинимся..."
clasp login --no-localhost

echo "Загружаем все файлы..."
clasp push

echo "Готово!"
