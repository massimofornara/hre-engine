FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
COPY schema.sql ./
CMD ["node", "src/arbitrum_listener.js"]
