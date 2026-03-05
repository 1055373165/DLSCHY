#!/usr/bin/env bash
#
# Happy SourceCode 开发服务器一键启停
# 用法: ./start.sh start | stop | status
#

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$APP_DIR/.next/dev.pid"
PORT=3000

# ─── 颜色 ───
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

ensure_node() {
  if command -v nvm &>/dev/null || [ -s "$HOME/.nvm/nvm.sh" ]; then
    source "$HOME/.nvm/nvm.sh" 2>/dev/null
    nvm use 20 --silent 2>/dev/null
  fi
  if ! command -v node &>/dev/null; then
    echo -e "${RED}✗ Node.js 未找到，请先安装 nvm 或 Node.js${NC}"
    exit 1
  fi
}

do_start() {
  # 检查是否已在运行
  if [ -f "$PID_FILE" ]; then
    local old_pid
    old_pid=$(cat "$PID_FILE")
    if kill -0 "$old_pid" 2>/dev/null; then
      echo -e "${YELLOW}⚠ 服务已在运行 (PID: $old_pid, Port: $PORT)${NC}"
      echo -e "  访问: ${GREEN}http://localhost:${PORT}${NC}"
      return 0
    else
      rm -f "$PID_FILE"
    fi
  fi

  # 清理占用端口的进程
  local port_pid
  port_pid=$(lsof -ti:"$PORT" 2>/dev/null)
  if [ -n "$port_pid" ]; then
    echo -e "${YELLOW}⚠ 端口 $PORT 被占用 (PID: $port_pid)，正在释放...${NC}"
    kill -9 $port_pid 2>/dev/null
    sleep 1
  fi

  # 清理旧的锁文件
  rm -f "$APP_DIR/.next/dev/lock"

  ensure_node

  echo -e "${GREEN}▶ 正在启动 Next.js 开发服务器...${NC}"
  cd "$APP_DIR" && npx next dev --port "$PORT" > "$APP_DIR/.next/dev.log" 2>&1 &
  local pid=$!
  echo "$pid" > "$PID_FILE"

  # 等待服务就绪
  local retries=0
  while [ $retries -lt 15 ]; do
    if curl -s "http://localhost:${PORT}" > /dev/null 2>&1; then
      echo -e "${GREEN}✓ 服务已启动 (PID: $pid)${NC}"
      echo -e "  访问: ${GREEN}http://localhost:${PORT}${NC}"
      echo -e "  日志: $APP_DIR/.next/dev.log"
      return 0
    fi
    sleep 1
    retries=$((retries + 1))
  done

  echo -e "${YELLOW}⏳ 服务启动中 (PID: $pid)，请稍候访问 http://localhost:${PORT}${NC}"
  echo -e "  查看日志: tail -f $APP_DIR/.next/dev.log"
}

do_stop() {
  local stopped=false

  # 通过 PID 文件停止
  if [ -f "$PID_FILE" ]; then
    local pid
    pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null
      sleep 1
      kill -9 "$pid" 2>/dev/null
      stopped=true
    fi
    rm -f "$PID_FILE"
  fi

  # 清理端口上残留进程
  local port_pid
  port_pid=$(lsof -ti:"$PORT" 2>/dev/null)
  if [ -n "$port_pid" ]; then
    kill -9 $port_pid 2>/dev/null
    stopped=true
  fi

  rm -f "$APP_DIR/.next/dev/lock"

  if [ "$stopped" = true ]; then
    echo -e "${GREEN}✓ 服务已停止${NC}"
  else
    echo -e "${YELLOW}⚠ 没有运行中的服务${NC}"
  fi
}

do_status() {
  if [ -f "$PID_FILE" ]; then
    local pid
    pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      echo -e "${GREEN}● 运行中 (PID: $pid, Port: $PORT)${NC}"
      echo -e "  访问: http://localhost:${PORT}"
      return 0
    fi
  fi

  local port_pid
  port_pid=$(lsof -ti:"$PORT" 2>/dev/null)
  if [ -n "$port_pid" ]; then
    echo -e "${YELLOW}● 端口 $PORT 被占用 (PID: $port_pid)，但非本脚本启动${NC}"
    return 0
  fi

  echo -e "${RED}● 未运行${NC}"
}

case "${1:-}" in
  start)   do_start ;;
  stop)    do_stop ;;
  status)  do_status ;;
  restart) do_stop; sleep 1; do_start ;;
  *)
    echo "用法: $0 {start|stop|restart|status}"
    exit 1
    ;;
esac
