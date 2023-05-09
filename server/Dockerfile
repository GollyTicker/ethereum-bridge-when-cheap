FROM node:18-slim
WORKDIR /wd
COPY package*.json ./
RUN npm ci
COPY *.ts *.js *.json ./
RUN npm run build
COPY . .
CMD npm run main
