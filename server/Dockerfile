FROM node:18-slim
WORKDIR /wd
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
CMD npm run main
