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
# 비루트 실행 — node 이미지 기본 사용자(uid 1000). dist·node_modules는 root 소유지만
# 월드 리더블이라 읽기·실행 가능하고, API는 디스크에 쓰지 않는 무상태 컨테이너.
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
