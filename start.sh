#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

WEB_MODE=false
FORCE_REBUILD=false
ELECTRON_ARGS=()

for arg in "$@"; do
  case "$arg" in
    --web)
      WEB_MODE=true
      ;;
    --rebuild)
      FORCE_REBUILD=true
      ;;
    *)
      ELECTRON_ARGS+=("$arg")
      ;;
  esac
done

echo "=========================================="
echo "  Assistente Pessoal de Voz — Desktop App "
echo "=========================================="

# Ensure node/npx are available
if ! command -v node >/dev/null 2>&1 || ! command -v npx >/dev/null 2>&1; then
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

# 1. Check dependencies
if [ ! -d "node_modules" ]; then
  echo "Instalando dependências..."
  npm install
fi

# 2. Check build (rebuild automatically when source files are newer than dist)
NEEDS_BUILD=false
if [ "$FORCE_REBUILD" = true ] || [ ! -f "dist/client/index.html" ] || [ ! -f "dist/electron/main.cjs" ] || [ ! -f "dist/electron/preload.cjs" ]; then
  NEEDS_BUILD=true
elif [ -n "$(find client server electron package.json tsconfig.json vite.config.ts -type f \( -newer dist/client/index.html -o -newer dist/electron/main.cjs \) -print -quit 2>/dev/null)" ]; then
  NEEDS_BUILD=true
fi

if [ "$NEEDS_BUILD" = true ] && [ "$WEB_MODE" = false ]; then
  echo "Compilando aplicação..."
  npm run build
fi

# 3. Ensure Desktop Shortcut & global CLI command
ICON_PATH="$SCRIPT_DIR/build/icon.png"
[ -f "$ICON_PATH" ] || ICON_PATH="$SCRIPT_DIR/icon.svg"

DESKTOP_DIR="$HOME/.local/share/applications"
DESKTOP_ENTRY="$DESKTOP_DIR/assistente-pessoal-de-voz.desktop"
mkdir -p "$DESKTOP_DIR"
cat <<EOF > "$DESKTOP_ENTRY"
[Desktop Entry]
Version=1.0
Type=Application
Name=Assistente Pessoal de Voz
Comment=Assistente pessoal de IA para chamadas de áudio e voz
Exec="$SCRIPT_DIR/start.sh"
Icon=$ICON_PATH
Terminal=false
Categories=Utility;AudioVideo;Audio;
StartupNotify=true
EOF
chmod +x "$DESKTOP_ENTRY"
update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true

mkdir -p "$HOME/.local/bin"
ln -sf "$SCRIPT_DIR/start.sh" "$HOME/.local/bin/assistente-voz"

# 4. Launch Desktop App or Web Mode
if [ "$WEB_MODE" = true ]; then
  echo "Modo Web: Iniciando servidor na porta 5000..."
  if ! curl -s --connect-timeout 1 http://127.0.0.1:5000/api/config >/dev/null 2>&1; then
    npx tsx server/index.ts > /tmp/audio-call-assistant-server.log 2>&1 &
    sleep 1.5
  fi
  echo "Abrindo no navegador..."
  xdg-open "http://127.0.0.1:5000" >/dev/null 2>&1 || sensible-browser "http://127.0.0.1:5000" 2>/dev/null || true
else
  echo "Iniciando janela nativa Desktop do Assistente Pessoal de Voz..."
  if [ -x "$SCRIPT_DIR/node_modules/.bin/electron" ]; then
    "$SCRIPT_DIR/node_modules/.bin/electron" . --no-sandbox ${ELECTRON_ARGS[@]+"${ELECTRON_ARGS[@]}"}
  else
    npx electron . --no-sandbox ${ELECTRON_ARGS[@]+"${ELECTRON_ARGS[@]}"}
  fi
fi
