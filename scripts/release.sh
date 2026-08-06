#!/usr/bin/env bash
set -e

VERSION=$1

# 校验语义化版本号 (x.y.z)
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "❌ 版本号格式错误，请使用语义化版本号，例如：1.0.1"
  exit 1
fi

TAG="v$VERSION"

# 0. 检查工作区是否有未提交改动（避免把无关改动一起发版）
if [ -n "$(git status --porcelain)" ]; then
  echo "⚠️  工作区存在未提交的改动："
  git status --short
  read -p "是否将这些改动一并提交到发布版本？y/N: " CONFIRM
  [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]] && exit 1
fi

# 1. 非 main 分支警告确认
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
  read -p "⚠️  当前分支 $CURRENT_BRANCH，是否继续？y/N: " CONFIRM
  [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]] && exit 1
fi

# 2. 检查 tag 冲突
git rev-parse "$TAG" >/dev/null 2>&1 && echo "❌ 本地 tag 已存在" && exit 1
git ls-remote --tags origin | grep -q "refs/tags/$TAG$" && echo "❌ 远程 tag 已存在" && exit 1

# 3. 同步更新版本号
node -e "
const fs = require('fs');
const p = JSON.parse(fs.readFileSync('package.json', 'utf8'));
p.version = '$VERSION';
fs.writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n');
"
node -e "
const fs = require('fs');
const p = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8'));
p.version = '$VERSION';
fs.writeFileSync('src-tauri/tauri.conf.json', JSON.stringify(p, null, 2) + '\n');
"
perl -0pi -e 's/^version = ".*?"/version = "'"$VERSION"'"/m' src-tauri/Cargo.toml

# 4. 同步 Cargo.lock 中的包版本（cargo check 会把 manifest 版本写回 lock，
#    依赖未变化时无需联网；勿用 cargo metadata——它不写锁文件）
cd src-tauri && cargo check && cd ..

# 验证三处版本号一致
PKG_VER=$(node -p "require('./package.json').version")
CARGO_VER=$(grep -m1 '^version = ' src-tauri/Cargo.toml | cut -d'"' -f2)
if [ "$PKG_VER" != "$VERSION" ] || [ "$CARGO_VER" != "$VERSION" ]; then
  echo "❌ 版本号同步失败: package.json=$PKG_VER Cargo.toml=$CARGO_VER"
  exit 1
fi

# 5. 提交 + tag + 推送
git add .
git diff --cached --quiet || git commit -m "chore: release $TAG"
git tag "$TAG"
git push origin "$CURRENT_BRANCH"
git push origin "$TAG"

# 从 remote 解析真实仓库地址
REPO_URL=$(git config --get remote.origin.url | sed -E 's#(git@|https://)[^:/]+[:/]([^/]+)/([^/.]+)(\.git)?#https://github.com/\2/\3#')

echo ""
echo "✅ 发布触发完成：$TAG"
echo "👉 GitHub Actions → Release 工作流将自动开始构建"
echo "👉 构建完成后在 $REPO_URL/releases 查看"
