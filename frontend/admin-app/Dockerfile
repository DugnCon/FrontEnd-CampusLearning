# Stage 1: Build FE
FROM node:18-alpine AS build

WORKDIR /app

# Copy package.json & package-lock.json và install
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy toàn bộ source code vào container
COPY . .

# Build FE
RUN npm run build

# Stage 2: Serve bằng Nginx
FROM nginx:alpine

# Xoá default html
RUN rm -rf /usr/share/nginx/html/*

# Copy thư mục build sang Nginx root
COPY --from=build /app/build/ /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
