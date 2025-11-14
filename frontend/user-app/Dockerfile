# Build FE
FROM node:18 as build
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

# Serve bằng Nginx
FROM nginx:alpine

# Xoá default html
RUN rm -rf /usr/share/nginx/html/*

# Copy dist vào Nginx root
COPY --from=build /app/dist/ /usr/share/nginx/html/

# Copy nginx config
COPY nginx.conf  /etc/nginx/conf.d/campuslearning.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
