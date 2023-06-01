FROM node:18-slim
WORKDIR /wd
COPY package*.json ./
RUN npm ci
COPY pre-built/ pre-built/
COPY *.ts *.js *.json ./
RUN npm run build
COPY . .
CMD npm run main
