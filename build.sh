#!/usr/bin/env bash
# Сборка: src/ (не в git) -> index.html (зашифрован паролем) + source.enc (зашифрованные исходники)
# Использование: WAVE50_PASSWORD=... ./build.sh        Распаковка исходников: WAVE50_PASSWORD=... ./build.sh --unpack
set -euo pipefail
cd "$(dirname "$0")"
: "${WAVE50_PASSWORD:?Задайте WAVE50_PASSWORD}"
if [[ "${1:-}" == "--unpack" ]]; then
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:WAVE50_PASSWORD -in source.enc | tar xz
  echo "Исходники распакованы в src/"; exit 0
fi
npx --yes staticrypt@3 src/index.html -p "$WAVE50_PASSWORD" -d . --short --remember 30 \
  --template-title "Wave50" --template-instructions "Детектор эпидемий · закрытая демо-версия" \
  --template-placeholder "Пароль" --template-button "ВОЙТИ" --template-remember "Запомнить на 30 дней" \
  --template-error "Неверный пароль" --template-color-primary "#4fd1c5" --template-color-secondary "#0b1016"
tar cz src | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:WAVE50_PASSWORD -out source.enc
echo "Готово: index.html и source.enc"
