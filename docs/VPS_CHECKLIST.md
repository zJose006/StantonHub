# Checklist VPS IONOS

## 1. Comprar VPS

Recomendado para empezar:

- Ubuntu 22.04 LTS o 24.04 LTS
- 1-2 vCPU
- 2 GB RAM minimo
- 20 GB disco minimo

## 2. DNS del dominio

En IONOS, apunta:

```text
stantonhub.com      A     IP_DEL_VPS
www.stantonhub.com  A     IP_DEL_VPS
```

Espera a que propague.

## 3. Instalar servidor base

Conectate por SSH:

```bash
ssh root@IP_DEL_VPS
```

Ejecuta el script:

```bash
bash scripts/setup-ionos-vps.sh
```

Si copias el proyecto despues, tambien puedes copiar los comandos del script manualmente.

## 4. Crear MySQL

En el VPS:

```bash
sudo mysql
```

Dentro de MySQL:

```sql
CREATE DATABASE IF NOT EXISTS stanton_hub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'stantonhub'@'localhost' IDENTIFIED BY 'CAMBIA_ESTA_PASSWORD';
GRANT ALL PRIVILEGES ON stanton_hub.* TO 'stantonhub'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## 5. Subir proyecto

Ruta recomendada:

```text
/var/www/stanton-hub
```

Sube el proyecto completo, pero no subas:

```text
node_modules/
publish-ionos/
.git/
```

## 6. Crear .env de produccion

En `/var/www/stanton-hub/.env`:

```text
DISCORD_CLIENT_ID=1507435246529020034
DISCORD_CLIENT_SECRET=7labMC-qH37E_oG15LB1pRBSKRKhjoCb
DISCORD_REDIRECT_URI=https://stantonhub.com/api/auth/discord/callback
PORT=4173
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=stantonhub
DB_PASSWORD=CAMBIA_ESTA_PASSWORD
DB_NAME=stanton_hub
MYSQL_BIN=mysql
DB_SKIP_CREATE=1
```

## 7. Instalar app

```bash
cd /var/www/stanton-hub
npm install
npm run build
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Comprueba:

```bash
curl http://127.0.0.1:4173/api/health
```

Debe devolver JSON.

## 8. Nginx

Copia `deploy/nginx-stantonhub.conf`:

```bash
sudo cp deploy/nginx-stantonhub.conf /etc/nginx/sites-available/stantonhub.com
sudo ln -s /etc/nginx/sites-available/stantonhub.com /etc/nginx/sites-enabled/stantonhub.com
sudo nginx -t
sudo systemctl reload nginx
```

## 9. HTTPS

Cuando DNS ya apunte al VPS:

```bash
sudo certbot --nginx -d stantonhub.com -d www.stantonhub.com
```

## 10. Discord

En Discord Developer Portal añade:

```text
https://stantonhub.com/api/auth/discord/callback
```

El boton de la web debe seguir usando:

```text
/api/auth/discord
```

## 11. Diagnostico rapido

Ver logs:

```bash
pm2 logs stanton-hub
```

Reiniciar app:

```bash
pm2 restart stanton-hub
```

Probar backend local:

```bash
curl http://127.0.0.1:4173/api/health
```

Probar dominio:

```bash
curl https://stantonhub.com/api/health
```
