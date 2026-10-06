FROM node:22-alpine AS frontend
WORKDIR /src
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ENV VITE_API_URL=
RUN npm run build

FROM golang:1.24-alpine AS backend
WORKDIR /src
COPY backend/go.mod ./
RUN go mod download
COPY backend/ ./
COPY --from=frontend /src/dist/ ./static/
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/sezzle .

FROM alpine:3.21
RUN adduser -D -u 10001 app
USER app
COPY --from=backend /out/sezzle /sezzle
EXPOSE 3000
ENV PORT=3000
ENTRYPOINT ["/sezzle"]
