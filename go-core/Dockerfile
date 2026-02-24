FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod .
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /bin/go-core ./cmd/server

FROM alpine:3.20
WORKDIR /app
COPY --from=builder /bin/go-core /app/go-core
RUN mkdir -p /app/uploads
EXPOSE 8080
CMD ["/app/go-core"]
