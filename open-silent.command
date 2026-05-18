#!/bin/zsh
set -e
cd "$(dirname "$0")"

git remote set-url origin https://github.com/bao-nguyenbku/excel-automate.git
git pull --ff-only origin main

npm i && npm run terminal:live
