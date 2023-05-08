FROM node:18-slim
WORKDIR /wd
COPY package*.json ./
RUN npm ci
COPY . .
CMD npm run main
