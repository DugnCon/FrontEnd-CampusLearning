# Stage 1: chỉ cần dùng Nginx, vì FE đã build sẵn dist
FROM nginx:alpine

# Copy dist vào thư mục serve của Nginx
COPY dist/ /usr/share/nginx/html

# Copy file config Nginx nếu cần (ngược lại sẽ dùng default)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Chạy Nginx
CMD ["nginx", "-g", "daemon off;"]
