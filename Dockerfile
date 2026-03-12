FROM node:22-alpine AS build
WORKDIR /app
RUN npm install -g npm@11.4.1
RUN npm config set fetch-retries 5 \
	&& npm config set fetch-retry-mintimeout 20000 \
	&& npm config set fetch-retry-maxtimeout 120000 \
	&& npm config set registry https://registry.npmjs.org/
ARG BUILD_CONFIGURATION=production
ARG APP_BUILD_ID
ENV APP_BUILD_ID=${APP_BUILD_ID}
COPY package*.json ./
RUN for attempt in 1 2 3; do \
	  npm ci --no-audit --no-fund && exit 0; \
	  if [ "$attempt" -eq 3 ]; then exit 1; fi; \
	  echo "npm ci failed on attempt $attempt, retrying..."; \
	  sleep $((attempt * 10)); \
	done
COPY . .
RUN npm run build -- --configuration ${BUILD_CONFIGURATION}

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/my-portal-app/browser /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
