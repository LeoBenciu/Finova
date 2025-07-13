FROM node:18-slim

RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-ron \
    tesseract-ocr-eng \
    poppler-utils \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY requirements.txt ./

RUN npm ci --only=production

COPY . .

RUN npx prisma generate

RUN pip install -r requirements.txt

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start:prod"]