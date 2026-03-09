FROM node:22-alpine AS build
WORKDIR /app
RUN npm install -g npm@11.4.1
ARG BUILD_CONFIGURATION=production
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build -- --configuration ${BUILD_CONFIGURATION}

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/my-portal-app/browser /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
