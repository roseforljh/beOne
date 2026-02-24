# Go Core Re-Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 用 Go 核心后端替换当前混合后端中的关键链路，先跑通“鉴权 + 实时连接 + 文件分片上传基础能力”。

**Architecture:** 新增 `go-core` 目录作为独立服务，提供 REST API + WebSocket 网关；PostgreSQL 做主数据，Redis 做会话/实时状态，MinIO 做对象存储。先与现有前端并行联调，不一次性替换全部旧服务。

**Tech Stack:** Go 1.23+, chi/gin（二选一，建议 chi）, gorilla/websocket 或 nhooyr/websocket, pgx, go-redis, minio-go, JWT, Docker Compose。

---

### Task 1: 创建 Go 核心服务骨架

**Files:**
- Create: `go-core/go.mod`
- Create: `go-core/cmd/server/main.go`
- Create: `go-core/internal/config/config.go`
- Create: `go-core/internal/http/router.go`
- Create: `go-core/internal/http/handlers/health.go`
- Test: `go-core/internal/http/handlers/health_test.go`

**Step 1: Write the failing test**

```go
func TestHealth(t *testing.T) {
  req := httptest.NewRequest(http.MethodGet, "/health", nil)
  rr := httptest.NewRecorder()
  router := NewRouter()
  router.ServeHTTP(rr, req)
  if rr.Code != http.StatusOK { t.Fatalf("expected 200, got %d", rr.Code) }
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./...`（在 `go-core`）
Expected: FAIL（`NewRouter` 未实现）

**Step 3: Write minimal implementation**

实现 `/health` 返回 `{"status":"ok"}`。

**Step 4: Run test to verify it passes**

Run: `go test ./...`
Expected: PASS

**Step 5: Commit**

```bash
git add go-core
git commit -m "feat(go-core): bootstrap service with health endpoint"
```

### Task 2: 基础依赖接入（PostgreSQL/Redis/MinIO）

**Files:**
- Create: `go-core/internal/store/postgres.go`
- Create: `go-core/internal/store/redis.go`
- Create: `go-core/internal/store/minio.go`
- Modify: `go-core/internal/config/config.go`
- Modify: `go-core/cmd/server/main.go`
- Test: `go-core/internal/store/config_validation_test.go`

**Step 1: Write the failing test**

测试环境变量缺失时配置校验失败。

**Step 2: Run test to verify it fails**

Run: `go test ./internal/store -run TestConfigValidation -v`
Expected: FAIL

**Step 3: Write minimal implementation**

实现配置加载与连接初始化（支持容器环境）。

**Step 4: Run test to verify it passes**

Run: `go test ./...`
Expected: PASS

**Step 5: Commit**

```bash
git add go-core
git commit -m "feat(go-core): add postgres redis minio bootstrap"
```

### Task 3: 鉴权链路（登录+JWT校验中间件）

**Files:**
- Create: `go-core/internal/domain/user.go`
- Create: `go-core/internal/http/handlers/auth.go`
- Create: `go-core/internal/http/middleware/jwt.go`
- Modify: `go-core/internal/http/router.go`
- Test: `go-core/internal/http/handlers/auth_test.go`

**Step 1: Write the failing test**

覆盖：
- `POST /api/v1/auth/dev-login` 返回 token
- 受保护路由无 token 返回 401

**Step 2: Run test to verify it fails**

Run: `go test ./internal/http/... -v`
Expected: FAIL

**Step 3: Write minimal implementation**

实现 dev-login + JWT 中间件。

**Step 4: Run test to verify it passes**

Run: `go test ./internal/http/... -v`
Expected: PASS

**Step 5: Commit**

```bash
git add go-core
git commit -m "feat(go-core): implement jwt auth baseline"
```

### Task 4: WebSocket 实时层（自动重连友好）

**Files:**
- Create: `go-core/internal/ws/hub.go`
- Create: `go-core/internal/ws/client.go`
- Create: `go-core/internal/http/handlers/ws.go`
- Modify: `go-core/internal/http/router.go`
- Test: `go-core/internal/ws/hub_test.go`

**Step 1: Write the failing test**

覆盖：
- 客户端连接后可收到 `connected`
- 心跳 `ping/pong`
- 断开后从 hub 清理

**Step 2: Run test to verify it fails**

Run: `go test ./internal/ws -v`
Expected: FAIL

**Step 3: Write minimal implementation**

实现 hub + client 生命周期，保证并发安全。

**Step 4: Run test to verify it passes**

Run: `go test ./internal/ws -v`
Expected: PASS

**Step 5: Commit**

```bash
git add go-core
git commit -m "feat(go-core): add websocket realtime hub"
```

### Task 5: 文件分片上传（对象存储）

**Files:**
- Create: `go-core/internal/http/handlers/upload.go`
- Create: `go-core/internal/service/upload_service.go`
- Create: `go-core/internal/domain/file.go`
- Modify: `go-core/internal/http/router.go`
- Test: `go-core/internal/http/handlers/upload_test.go`

**Step 1: Write the failing test**

覆盖：
- 初始化分片上传会话
- 分片上传成功
- 合并完成后返回 file 元数据

**Step 2: Run test to verify it fails**

Run: `go test ./internal/http/handlers -run TestChunkUpload -v`
Expected: FAIL

**Step 3: Write minimal implementation**

实现 init/upload-part/complete 三个端点，落 MinIO。

**Step 4: Run test to verify it passes**

Run: `go test ./...`
Expected: PASS

**Step 5: Commit**

```bash
git add go-core
git commit -m "feat(go-core): add chunked upload to minio"
```

### Task 6: Docker 编排与联调切换

**Files:**
- Modify: `docker-compose.yml`
- Create: `go-core/Dockerfile`
- Modify: `frontend/.env.production`（如不存在则 Create）
- Test: 端到端联调脚本（命令验证）

**Step 1: Write failing verification**

用命令验证：
- API 健康检查
- 登录获取 token
- WS 建连成功

**Step 2: Run to verify fail (before wiring)**

Run: `docker compose up -d --build`
Expected: go-core 未暴露或接口不可用

**Step 3: Write minimal implementation**

新增 go-core 服务，前端 API/WS 指向 go-core。

**Step 4: Run verification to pass**

Run:
- `curl http://localhost:8080/health`
- `curl -X POST http://localhost:8080/api/v1/auth/dev-login`
- 前端打开 dashboard 验证 WS 状态

Expected: 全部可用

**Step 5: Commit**

```bash
git add docker-compose.yml go-core frontend/.env.production
git commit -m "feat(infra): wire go-core service into compose"
```

### Task 7: 稳定性与性能基线

**Files:**
- Create: `go-core/scripts/load/ws-smoke.js`
- Create: `go-core/scripts/load/upload-smoke.js`
- Create: `go-core/Makefile`

**Step 1: Write failing verification**

目标：
- WS 重连成功率 >= 99%
- 100MB 文件分片上传成功率 >= 99%

**Step 2: Run to verify baseline**

Run: `make smoke`
Expected: 初始可能失败

**Step 3: Write minimal fixes**

调优超时、连接池、重试与指数退避。

**Step 4: Run to verify pass**

Run: `make smoke`
Expected: 达到基线

**Step 5: Commit**

```bash
git add go-core
git commit -m "perf(go-core): add reliability and smoke benchmarks"
```
