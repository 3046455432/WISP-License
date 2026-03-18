#!/bin/bash

# WISP License SaaS - Script de Despliegue en VPS
# Este script prepara tu VPS para hostear el servidor de licencias.

set -e

if [ "$EUID" -ne 0 ]; then
  echo "Por favor, ejecuta como root o con sudo."
  exit 1
fi

APP_DIR="/opt/wisp-license"
USER_APP="wispsaas"

echo ">>> [1/4] Instalando dependencias del sistema y Node v24.13.0..."
apt-get update
apt-get install -y git curl build-essential

# Instalar Node v24.13.0 específico
curl -fsSL https://raw.githubusercontent.com/tj/n/master/bin/n | bash -s 24.13.0
ln -sf /usr/local/bin/node /usr/bin/node
ln -sf /usr/local/bin/npm /usr/bin/npm

echo ">>> [2/4] Preparando directorio y usuario..."
if ! id "$USER_APP" &>/dev/null; then
    useradd -r -s /bin/false $USER_APP
fi
mkdir -p $APP_DIR

# Nota: Aquí deberías clonar tu repo o copiar el código
# git clone <URL_DE_TU_REPO_LICENCIAS> $APP_DIR

cd $APP_DIR

echo ">>> [3/4] Configurando variables de entorno (.env)..."
if [ ! -f ".env" ]; then
    read -p "Supabase URL: " SUPABASE_URL
    read -p "Supabase Anon Key: " SUPABASE_ANON_KEY
    read -p "Supabase Service Role Key: " SUPABASE_SERVICE_ROLE
    read -p "Stripe Secret Key: " STRIPE_SECRET
    read -p "Stripe Webhook Secret: " STRIPE_WEBHOOK
    read -p "Owner Email (Tu email de admin): " OWNER_EMAIL

    cat <<EOF > .env
SUPABASE_URL="$SUPABASE_URL"
SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE"
STRIPE_SECRET_KEY="$STRIPE_SECRET"
STRIPE_WEBHOOK_SECRET="$STRIPE_WEBHOOK"
OWNER_EMAIL="$OWNER_EMAIL"
JWT_SECRET="$(openssl rand -hex 32)"
HOST=0.0.0.0
PORT=80
EOF
fi

echo ">>> Instalando paquetes y compilando..."
npm install
npm run build

chown -R $USER_APP:$USER_APP $APP_DIR

echo ">>> [4/4] Creando servicio del sistema (Systemd)..."
cat <<EOF > /etc/systemd/system/wisp-license.service
[Unit]
Description=WISP License SaaS
After=network.target

[Service]
Type=simple
User=$USER_APP
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
ExecStart=/usr/bin/node ./dist/server/entry.mjs
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable wisp-license
systemctl restart wisp-license

echo "====================================================="
echo " ✅ SaaS de Licencias Desplegado Correctamente"
echo " Tu IP es: $(curl -s https://api.ipify.org)"
echo " Tus clientes pueden instalar usando:"
echo " curl -fsSL http://$(curl -s https://api.ipify.org)/install.sh | sudo bash"
echo "====================================================="
