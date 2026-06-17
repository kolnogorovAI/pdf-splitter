# Node.js 22 
FROM node:22-alpine

# Рабочая директория
WORKDIR /app

# Файлы с зависимостями
COPY package*.json ./

# Установка зависимостей
RUN npm ci --only=production

# КОД
COPY . .

# ПОРТ 8082
EXPOSE 8082

# Запускаем микросервис
CMD ["node", "server.js"]