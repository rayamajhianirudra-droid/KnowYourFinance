# ---------- Stage 1: build the static site ----------
FROM node:22-alpine AS build
WORKDIR /app

# Dependencies first, so this layer is reused until package-lock.json changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Leave this unset to call the API at /api on the same address (the
# nginx proxy below handles that). Set it only to point at another server.
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# ---------- Stage 2: serve it with nginx ----------
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost/ || exit 1
