#!/bin/bash

# BeOne VPS 部署脚本 (Host 网络模式)
# 使用方法: ./deploy-host.sh [up|down|restart|logs]

set -e

ACTION=${1:-up}

echo "=========================================="
echo "BeOne VPS 部署工具 (Host 网络模式)"
echo "=========================================="

case $ACTION in
  up)
    echo "启动服务..."
    docker compose -f docker-compose.host.yml up -d
    echo "✓ 服务已启动"
    echo ""
    echo "查看日志: ./deploy-host.sh logs"
    echo "停止服务: ./deploy-host.sh down"
    ;;
    
  down)
    echo "停止并移除服务..."
    docker compose -f docker-compose.host.yml down
    echo "✓ 服务已停止"
    ;;
    
  restart)
    echo "重启服务..."
    docker compose -f docker-compose.host.yml restart
    echo "✓ 服务已重启"
    ;;
    
  logs)
    echo "查看服务日志 (Ctrl+C 退出)..."
    docker compose -f docker-compose.host.yml logs -f
    ;;
    
  build)
    echo "重新构建并启动服务..."
    docker compose -f docker-compose.host.yml up -d --build
    echo "✓ 服务已重新构建并启动"
    ;;
    
  status)
    echo "服务状态:"
    docker compose -f docker-compose.host.yml ps
    ;;
    
  *)
    echo "用法: $0 [up|down|restart|logs|build|status]"
    echo ""
    echo "命令说明:"
    echo "  up      - 启动服务"
    echo "  down    - 停止并移除服务"
    echo "  restart - 重启服务"
    echo "  logs    - 查看实时日志"
    echo "  build   - 重新构建并启动"
    echo "  status  - 查看服务状态"
    exit 1
    ;;
esac