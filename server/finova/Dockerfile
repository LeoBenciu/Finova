FROM node:23-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

FROM node:23-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

COPY --from=builder /app/dist ./dist

EXPOSE 4010

CMD ["node", "dist/src/main.js"]