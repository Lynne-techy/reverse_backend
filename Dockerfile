# NestJS 무상태 API 컨테이너
# 멀티스테이지: 빌드 산출물만 런타임 이미지로 복사 → 이미지 슬림화

# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build          # dist/main.js 생성

# ---- run ----
FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev      # 운영 의존성만
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
