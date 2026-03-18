#!/bin/bash

# WISP Manager - Script de Instalación Automatizada para Ubuntu
# Este script prepara un servidor Ubuntu en blanco, instala WISP Manager de forma nativa
# y configura actualizaciones automáticas.

set -e

echo "====================================================="
echo "  🚀 Instalando WISP Manager Profesional (Native)"
echo "====================================================="

# Validar que somos root
if [ "$EUID" -ne 0 ]; then
  echo "Por favor, ejecuta este script como root o usando sudo."
  exit 1
fi

APP_DIR="/opt/wisp-manager"
REPO_URL="https://github.com/3046455432/wisp_manager.git"
USER_APP="wispmanager"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Configuración de Licencia WISP Manager"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " 1) Solicitar Trial Gratuito de 14 días (recomendado)"
echo " 2) Ingresar token de licencia existente"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
read -p " Elige una opción (1 o 2): " LICENSE_OPTION
echo ""

read -p " URL del servidor de licencias (ej: https://wisp.tuproveedor.com): " WISP_LICENSE_SERVER

if [ "$LICENSE_OPTION" = "1" ]; then
    # Opción Trial: Auto-generar token y enviar solicitud al SaaS central
    CLIENT_HOSTNAME=$(hostname)
    SERVER_IP=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null || echo "unknown")
    read -p " Nombre de tu empresa o ISP: " CLIENT_NAME

    echo ""
    echo ">>> Enviando solicitud de trial al servidor central..."
    TRIAL_RESPONSE=$(curl -s --max-time 15 -X POST "${WISP_LICENSE_SERVER}/api/license/request-trial" \
        -H "Content-Type: application/json" \
        -d "{\"clientName\":\"${CLIENT_NAME}\",\"hostname\":\"${CLIENT_HOSTNAME}\",\"serverIp\":\"${SERVER_IP}\"}" 2>/dev/null)

    WISP_LICENSE_TOKEN=$(echo "$TRIAL_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

    if [ -z "$WISP_LICENSE_TOKEN" ]; then
        echo "⚠️  No se pudo contactar el servidor de licencias. Instalando en modo sin licencia."
        echo "   Edita $APP_DIR/.env después de la instalación para agregar tu token."
        WISP_LICENSE_TOKEN=""
    else
        echo "✅ Solicitud enviada correctamente."
        echo "   Token generado: ${WISP_LICENSE_TOKEN:0:16}..."
        echo "   Tu proveedor recibirá la solicitud y la aprobará pronto."
    fi
else
    # Opción manual: ingresar token existente
    read -p " Ingresa tu Token de Licencia: " WISP_LICENSE_TOKEN
fi
echo ""

echo ">>> [1/6] Instalando dependencias del sistema (Git, PostgreSQL, curl)..."
apt-get update
apt-get install -y git postgresql postgresql-contrib curl unzip build-essential cron

echo ">>> Instalando Node.js v24.13.0 (versión específica)..."
curl -fsSL https://raw.githubusercontent.com/tj/n/master/bin/n | bash -s 24.13.0
ln -sf /usr/local/bin/node /usr/bin/node
ln -sf /usr/local/bin/npm /usr/bin/npm

echo ">>> Configurando PostgreSQL local..."
# Crear base de datos y usuario si no existen
sudo -u postgres psql -c "CREATE USER wispmanager WITH PASSWORD 'wisp_secure_pass_2025';" || true
sudo -u postgres psql -c "CREATE DATABASE wispdb OWNER wispmanager;" || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE wispdb TO wispmanager;" || true

echo ">>> [2/6] Preparando usuario protegido y directorios..."
if ! id "$USER_APP" &>/dev/null; then
    useradd -r -s /bin/false $USER_APP
fi
mkdir -p $APP_DIR

echo ">>> [3/6] Descargando la última versión del código..."
if [ -d "$APP_DIR/.git" ]; then
    echo "El código ya existe. Actualizando con git pull..."
    cd $APP_DIR
    git config --global --add safe.directory $APP_DIR
    git reset --hard HEAD
    git pull origin main
elif [ -d "$APP_DIR" ]; then
    echo "El directorio existe pero no tiene repositorio git. Limpiando y clonando..."
    rm -rf $APP_DIR
    git clone $REPO_URL $APP_DIR
else
    git clone $REPO_URL $APP_DIR
fi

cd $APP_DIR
git config --global --add safe.directory $APP_DIR

echo ">>> [4/6] Compilando el proyecto..."
npm install
npx prisma generate
npx prisma migrate deploy
npx astro build

echo ">>> Preparando entorno (.env)..."
if [ ! -f "$APP_DIR/.env" ]; then
    cat <<ENVFILE > $APP_DIR/.env
# === BASE DE DATOS LOCAL (PostgreSQL) ===
DATABASE_URL="postgresql://wispmanager:wisp_secure_pass_2025@localhost:5432/wispdb?schema=public"

# === SEGURIDAD Y SESIONES ===
JWT_SECRET="$(openssl rand -hex 32)"

# === LICENCIA WISP MANAGER (SaaS Central) ===
WISP_LICENSE_TOKEN="${WISP_LICENSE_TOKEN}"
WISP_LICENSE_SERVER="${WISP_LICENSE_SERVER}"

# === SERVICIOS DE TERCEROS ===
PUBLIC_MAPBOX_TOKEN="pk.eyJ1IjoiYnJheWFudHVudSIsImEiOiJjbW1mOGpvZTAwNWwwMnlwd3pnM2ZyczVoIn0.LYky1j_5_UsB184EHdkv_A"
ENVFILE
    echo ">> .env creado automáticamente con base de datos local y configuración de licencia."
fi

# Ajustar permisos
chown -R $USER_APP:$USER_APP $APP_DIR
chmod 600 $APP_DIR/.env 2>/dev/null || true

echo ">>> [5/6] Instalando Servicios del Sistema (Systemd)..."

cat <<EOF > /etc/systemd/system/wisp-manager.service
[Unit]
Description=WISP Manager Web App
After=network.target

[Service]
Environment=NODE_ENV=production
Environment=PORT=80
Type=simple
User=$USER_APP
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node ./dist/server/entry.mjs
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

cat <<EOF > /etc/systemd/system/wisp-cron.service
[Unit]
Description=WISP Manager Background Tasks (Cron)
After=network.target

[Service]
Environment=NODE_ENV=production
Type=simple
User=$USER_APP
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/npx tsx src/worker.ts
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable wisp-manager
systemctl enable wisp-cron
systemctl restart wisp-manager || true
systemctl restart wisp-cron || true

echo ">>> [6/6] Configurando Autoupdater diario..."
chmod +x $APP_DIR/auto_update.sh 2>/dev/null || true
ln -sf $APP_DIR/auto_update.sh /etc/cron.daily/wisp-manager-update

echo "====================================================="
echo " ✅ Instalación completa en la carpeta $APP_DIR."
echo " El sistema web está configurado para iniciar automáticamente."
echo " Las actualizaciones se revisarán solas 1 vez al día."
echo ""
echo " COMANDOS ÚTILES:"
echo " - Editar configuración: sudo nano $APP_DIR/.env"
echo " - Estado del servidor:  sudo systemctl status wisp-manager"
echo " - Ver registros logs:   sudo journalctl -u wisp-manager -f"
echo "====================================================="
