# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM nginx:stable-alpine

# Copy build artifacts from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx config if needed (optional, for SPA routing)
RUN printf "server {\n  listen 80;\n  location / {\n    root /usr/share/nginx/html;\n    index index.html;\n    try_files \$uri \$uri/ /index.html;\n  }\n  location /api {\n    proxy_pass http://backend:8000;\n    proxy_set_header Host \$host;\n    proxy_set_header X-Real-IP \$remote_addr;\n  }\n}\n" > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
