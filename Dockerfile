FROM node:20-slim

WORKDIR /app

COPY package.json tsconfig.json ./
COPY src ./src
COPY dashboard ./dashboard

RUN npm install

CMD ["npm", "run", "dev"]
