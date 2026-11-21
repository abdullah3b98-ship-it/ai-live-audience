FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV PORT=3000 DATA_DIR=/app/data
EXPOSE 3000
VOLUME ["/app/data"]
CMD ["node", "--experimental-sqlite", "--no-warnings", "server/index.js"]
