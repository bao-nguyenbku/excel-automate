#!/bin/bash

# ✅ Always work in the same folder as this script
cd "$(dirname "$0")"

TARGET_DIR="excel-automate"
REPO_OWNER="bao-nguyenbku"
REPO_NAME="excel-automate"
REPO_GIT_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}.git"
REPO_API_URL="https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits/main"
REPO_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}/archive/refs/heads/main.zip"
ZIP_FILE="excel-automate.zip"
COMMIT_FILE=".excel-automate-commit"

# ✅ Function: print banner
print_banner() {
  local version="1.0"
  # if [ -f "$TARGET_DIR/package.json" ]; then
  #   version=$(grep '"version"' "$TARGET_DIR/package.json" | sed 's/.*"version": "\(.*\)".*/\1/')
  # fi

  echo ""
  echo "╔══════════════════════════════════════╗"
  echo "║       🚀 Excel Automate Tool         ║"
  echo "║                                      ║"
  printf  "║          Version: v%-18s║\n" "$version"
  echo "║                                      ║"
  echo "╚══════════════════════════════════════╝"
  echo ""
}

# ✅ Function: download source code
download() {
  echo "📥 Downloading latest source code..."

  if command -v curl &> /dev/null; then
    curl -L "$REPO_URL" -o "$ZIP_FILE"
  elif command -v wget &> /dev/null; then
    wget -O "$ZIP_FILE" "$REPO_URL"
  else
    echo "❌ Error: Neither curl nor wget is installed."
    exit 1
  fi

  echo "📦 Extracting..."
  unzip -o "$ZIP_FILE" -d "tmp_extract"

  # Remove old version if exists
  rm -rf "$TARGET_DIR"
  mv tmp_extract/excel-automate-main "$TARGET_DIR"

  # Cleanup
  rm -f "$ZIP_FILE"
  rm -rf tmp_extract

  echo "✅ Source code downloaded to ./$TARGET_DIR"

  local latest_sha
  latest_sha=$(fetch_latest_commit_sha)
  if [ -n "$latest_sha" ]; then
    save_local_commit "$latest_sha"
  fi
}

# ✅ Function: fetch latest commit SHA on main (git → curl fallback)
fetch_latest_commit_sha() {
  local sha=""

  if command -v git &> /dev/null; then
    sha=$(git ls-remote "$REPO_GIT_URL" refs/heads/main 2>/dev/null | awk '{print $1}')
  fi

  if [ -z "$sha" ] && command -v curl &> /dev/null; then
    sha=$(curl -sL --max-time 8 "$REPO_API_URL" 2>/dev/null | sed -n 's/.*"sha": "\([a-f0-9]*\)".*/\1/p' | head -1)
  fi

  echo "$sha"
}

# ✅ Function: remember which commit the local copy matches
save_local_commit() {
  echo "$1" > "$COMMIT_FILE"
}

get_local_commit() {
  if [ -f "$COMMIT_FILE" ]; then
    cat "$COMMIT_FILE"
  fi
}

# ✅ Function: parse latest commit message & date from GitHub API (best-effort)
fetch_latest_commit_details() {
  local json msg date

  command -v curl &> /dev/null || return 1
  json=$(curl -sL --max-time 8 "$REPO_API_URL" 2>/dev/null) || return 1
  [ -z "$json" ] && return 1

  if command -v python3 &> /dev/null; then
    printf '%s' "$json" | python3 -c "
import json, sys
d = json.load(sys.stdin)
c = d['commit']
msg = c['message'].split('\n')[0]
if len(msg) > 42:
    msg = msg[:39] + '...'
print(msg)
print(c['author']['date'][:10])
" 2>/dev/null && return 0
  fi

  msg=$(printf '%s' "$json" | sed -n 's/.*"message": "\([^"]*\)".*/\1/p' | head -1)
  date=$(printf '%s' "$json" | sed -n 's/.*"date": "\([0-9-]*\)T.*/\1/p' | head -1)
  [ -n "$msg" ] && echo "$msg"
  [ -n "$date" ] && echo "$date"
}

# ✅ Function: show update banner when remote main has moved ahead
print_update_notice() {
  local remote_sha="$1"
  local short_sha="${remote_sha:0:7}"
  local msg="" date="" details

  details=$(fetch_latest_commit_details 2>/dev/null) || true
  if [ -n "$details" ]; then
    msg=$(printf '%s\n' "$details" | sed -n '1p')
    date=$(printf '%s\n' "$details" | sed -n '2p')
  fi

  echo ""
  echo "  ╔════════════════════════════════════════════════╗"
  echo "  ║                                                ║"
  echo "  ║     ✨  New version available! 🎉              ║"
  echo "  ║                                                ║"
  echo "  ╠════════════════════════════════════════════════╣"
  printf "  ║   📌 Latest commit: %-27s║\n" "$short_sha"
  if [ -n "$msg" ]; then
    printf "  ║   💬 %-43s║\n" "$msg"
  fi
  if [ -n "$date" ]; then
    printf "  ║   📅 %-43s║\n" "$date"
  fi
  echo "  ║                                                ║"
  echo "  ║   👉  Choose option [2] to download & update   ║"
  echo "  ║                                                ║"
  echo "  ╚════════════════════════════════════════════════╝"
  echo ""
}

check_for_updates() {
  local local_sha remote_sha

  local_sha=$(get_local_commit)
  [ -z "$local_sha" ] && return 0

  remote_sha=$(fetch_latest_commit_sha)
  [ -z "$remote_sha" ] && return 0

  if [ "$local_sha" != "$remote_sha" ]; then
    print_update_notice "$remote_sha"
  fi
}

# ✅ Function: install & run
run_app() {
  cd "$TARGET_DIR" || { echo "❌ Error: Could not cd into $TARGET_DIR"; exit 1; }
  echo "📦 Installing dependencies..."
  npm i && echo "" && echo "✅ Starting app..." && echo "" && npm run terminal:live
}

# ==============================
# ✅ MAIN: Interactive menu loop
# ==============================
while true; do
  print_banner
  check_for_updates

  echo "Please select an option:"
  echo ""
  echo "  [1] ▶  Run"
  echo "  [2] 🔄  Download new version"
  echo "  [3] ❌  Exit"
  echo ""
  read -p "👉 Enter your choice (1/2/3): " choice

  case $choice in
    1)
      echo ""
      if [ ! -d "$TARGET_DIR" ]; then
        echo "⚠️  No source code found. Please download first (option 2)."
        echo ""
        continue
      fi
      echo "▶  Starting app..."
      run_app
      break
      ;;
    2)
      echo ""
      download
      echo ""
      echo "▶  Starting app after download..."
      run_app
      break
      ;;
    3)
      echo ""
      echo "👋 Goodbye!"
      exit 0
      ;;
    *)
      echo ""
      echo "❌ Invalid choice. Please enter 1, 2, or 3."
      echo ""
      continue
      ;;
  esac
done