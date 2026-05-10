#!/bin/zsh
set -e
cd "$(dirname "$0")"
npm i && npm run open
