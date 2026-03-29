#!/usr/bin/env bash
# 一键：各云函数 npm install + tcb 上传部署（需已全局安装 @cloudbase/cli 并完成 tcb login）
#
# 用法：
#   ./scripts/deploy-cloudfunctions.sh              # 部署全部
#   ./scripts/deploy-cloudfunctions.sh account login # 仅部署指定函数
#
# 环境 ID 优先读环境变量 CLOUD_ENV_ID；未设置则从 miniprogram/config/env.js 读取（需已配置非占位符）。
# 覆盖云端同名函数配置时：DEPLOY_FORCE=1 ./scripts/deploy-cloudfunctions.sh
# 仅本地安装依赖、不上传：INSTALL_ONLY=1 ./scripts/deploy-cloudfunctions.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

resolve_env_id() {
  if [[ -n "${CLOUD_ENV_ID:-}" ]]; then
    printf '%s' "$CLOUD_ENV_ID"
    return
  fi
  node -e "
    const e = require('./miniprogram/config/env.js');
    if (!e.isCloudEnvConfigured()) {
      console.error('请在 miniprogram/config/env.js 中配置 CLOUD_ENV_ID，或导出环境变量 CLOUD_ENV_ID');
      process.exit(2);
    }
    process.stdout.write(e.CLOUD_ENV_ID);
  "
}

if [[ "${INSTALL_ONLY:-}" == "1" ]]; then
  ENV_ID=""
else
  ENV_ID="$(resolve_env_id)"
fi

if command -v tcb &>/dev/null; then
  TCB=(tcb)
elif command -v cloudbase &>/dev/null; then
  TCB=(cloudbase)
else
  TCB=(npx --yes @cloudbase/cli)
fi

FORCE=()
if [[ "${DEPLOY_FORCE:-}" == "1" ]]; then
  FORCE=(--force)
fi

install_deps() {
  local name="$1"
  local dir="$ROOT/cloudfunctions/$name"
  echo "==> npm install: $name"
  (cd "$dir" && npm install)
}

deploy_one() {
  local name="$1"
  local dir="$ROOT/cloudfunctions/$name"
  install_deps "$name"
  if [[ "${INSTALL_ONLY:-}" == "1" ]]; then
    return
  fi
  echo "==> tcb fn deploy: $name (env: $ENV_ID)"
  "${TCB[@]}" fn deploy "$name" -e "$ENV_ID" --dir "$dir" --yes "${FORCE[@]}"
}

list_all_functions() {
  local d name
  for d in "$ROOT"/cloudfunctions/*/; do
    [[ -f "${d}package.json" ]] || continue
    name="$(basename "$d")"
    printf '%s\n' "$name"
  done
}

if [[ $# -gt 0 ]]; then
  for name in "$@"; do
    if [[ ! -f "$ROOT/cloudfunctions/$name/package.json" ]]; then
      echo "未知云函数: $name（cloudfunctions/$name 下无 package.json）" >&2
      exit 1
    fi
    deploy_one "$name"
  done
else
  while IFS= read -r name; do
    [[ -n "$name" ]] || continue
    deploy_one "$name"
  done < <(list_all_functions | sort)
fi

if [[ "${INSTALL_ONLY:-}" == "1" ]]; then
  echo "仅完成依赖安装（INSTALL_ONLY=1），未执行上传。"
else
  echo "全部完成。"
fi
