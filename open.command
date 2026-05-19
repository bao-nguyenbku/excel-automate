#!/bin/bash

# ✅ Always work in the same folder as this script
cd "$(dirname "$0")"

TARGET_DIR="excel-automate"
REPO_URL="https://github.com/bao-nguyenbku/excel-automate/archive/refs/heads/main.zip"
ZIP_FILE="excel-automate.zip"

# ✅ Function: print banner
print_banner() {
  local version="N/A"
  if [ -f "$TARGET_DIR/package.json" ]; then
    version=$(grep '"version"' "$TARGET_DIR/package.json" | sed 's/.*"version": "\(.*\)".*/\1/')
  fi

  echo ""
  echo "╔══════════════════════════════════════╗"
  echo "║       🚀 Excel Automate Tool         ║"
  echo "║                                      ║"
  printf  "║          Version: v%-18s  ║\n" "$version"
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
}

# ✅ Function: install & run
run_app() {
  cd "$TARGET_DIR" || { echo "❌ Error: Could not cd into $TARGET_DIR"; exit 1; }
  echo "📦 Installing dependencies..."
  npm i && echo "" && echo "✅ Starting app..." && echo "" && npm run terminal:live
}

# ✅ Interactive menu
print_banner

# If folder doesn't exist, force download
if [ ! -d "$TARGET_DIR" ]; then
  echo "⚠️  No source code found. Downloading automatically..."
  download
  run_app
  exit 0
fi

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
    echo "▶  Starting app..."
    run_app
    ;;
  2)
    echo ""
    download
    echo ""
    echo "▶  Starting app..."
    run_app
    ;;
  3)
    echo ""
    echo "👋 Goodbye!"
    exit 0
    ;;
  *)
    echo ""
    echo "❌ Invalid choice. Please enter 1, 2, or 3."
    exit 1
    ;;
esac