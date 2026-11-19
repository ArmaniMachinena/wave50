#!/usr/bin/env bash
# Сборка Wave50: снимок данных -> index.html (вход по паролю) + source.enc (зашифрованные исходники страницы и сборщика).
#   WAVE50_PASSWORD=... ./build.sh            собрать
#   WAVE50_PASSWORD=... ./build.sh --unpack   распаковать src/ из source.enc
set -euo pipefail
cd "$(dirname "$0")"
: "${WAVE50_PASSWORD:?Задайте WAVE50_PASSWORD}"
if [[ "${1:-}" == "--unpack" ]]; then
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:WAVE50_PASSWORD -in source.enc | tar xz; echo "src/ и collector/ распакованы"; exit 0
fi
MODS="${W50_MODULES_DIR:-/tmp/w50mods}"
[ -d "$MODS/node_modules/d3" ] || (mkdir -p "$MODS" && cd "$MODS" && npm init -y >/dev/null && npm i --silent d3@7 topojson-client@3 world-atlas@2)
python3 collector/collect.py --snapshot /tmp/snap.json
W50_MODULES_DIR="$MODS" node build.mjs
tar cz src collector | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:WAVE50_PASSWORD -out source.enc
echo "Готово"
