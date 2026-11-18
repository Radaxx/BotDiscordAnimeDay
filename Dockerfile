FROM node:22-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

# La base SQLite est écrite ici : montez un volume Railway sur /data
ENV DB_PATH=/data/anime-du-jour.db

CMD ["node", "--disable-warning=ExperimentalWarning", "src/index.js"]
