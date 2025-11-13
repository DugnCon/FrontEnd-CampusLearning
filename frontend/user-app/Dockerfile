# Sử dụng Nginx nhẹ
FROM nginx:alpine

# Copy FE vào đúng subpath /user/
COPY dist/ /usr/share/nginx/html/user/

# Tạo file config Nginx riêng (tùy chỉnh cho SPA + subpath)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Chạy Nginx
CMD ["nginx", "-g", "daemon off;"]