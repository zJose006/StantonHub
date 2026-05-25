FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends default-mysql-client ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4173
ENV MYSQL_BIN=mysql
ENV DB_SKIP_CREATE=1

EXPOSE 4173

CMD ["node", "server.js"]
