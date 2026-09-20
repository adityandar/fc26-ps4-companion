FROM node:20-bookworm-slim

ARG COMPANION_REVISION=0e1d32a87c9947be681803cd506bc543f912cfd8

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

RUN git clone https://github.com/ismailoksuz/EAFC26-DataHub.git /app/public-reference/fc26companion \
  && cd /app/public-reference/fc26companion \
  && git checkout ${COMPANION_REVISION} \
  && npm ci

COPY . .
RUN cp config.example.json config.json \
  && node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('config.json')); p.companionRoot='/app/public-reference/fc26companion'; p.objectRoot='data-v2/objects'; p.databasePath='data-v2/companion.sqlite'; p.host='0.0.0.0'; p.port=4132; p.currency='USD'; fs.writeFileSync('config.json', JSON.stringify(p,null,2)+'\\n')" \
  && npm run build:web

EXPOSE 4132
VOLUME ["/app/data-v2"]

CMD ["npx", "tsx", "src/main.ts"]
