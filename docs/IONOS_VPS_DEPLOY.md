# Stanton Hub completo en IONOS

Para que TODO funcione en IONOS necesitas un VPS o Cloud Server, no solo hosting web estatico.

El hosting estatico sirve para la parte publica, pero no ejecuta:

- `server.js`
- `/api/auth/discord`
- `/api/vehicles`
- sesiones
- votos
- comentarios
- publicaciones
- administracion
- sincronizacion de naves

IONOS Deploy Now admite webs estaticas/SPAs y PHP, pero no Node.js server-side rendering. Para Node necesitas un VPS con acceso root.

## Arquitectura recomendada

```text
https://stantonhub.com
        |
        v
Nginx / HTTPS / dominio
        |
        v
Node.js server.js en puerto 4173
        |
        v
MySQL local en el VPS
```

Con esta arquitectura no necesitas `static-api` para produccion. La web usa `/api` real.

## Variables de entorno

En el VPS crea un `.env` con:

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
```

No subas este `.env` a un hosting estatico ni a Git.

## Discord Developer Portal

Redirect URI:

```text
https://stantonhub.com/api/auth/discord/callback
```

El boton de la web debe seguir apuntando a:

```text
/api/auth/discord
```

No lo cambies por la URL directa de Discord, porque `server.js` genera el `state` de seguridad.

## Comandos en el VPS

Instalar dependencias:

```bash
npm install
```

Compilar React:

```bash
npm run build
```

Arrancar:

```bash
npm start
```

Arrancar con PM2:

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## Nginx

Configura Nginx para enviar todo a Node:

```nginx
server {
    server_name stantonhub.com www.stantonhub.com;

    location / {
        proxy_pass http://127.0.0.1:4173;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Despues instala HTTPS con Certbot o desde las herramientas del VPS/IONOS.

## Que subir al VPS

Para VPS puedes subir el proyecto completo salvo:

```text
node_modules/
publish-ionos/
dist/ si vas a compilar en el VPS
.git/ opcional
```

En el VPS ejecutas `npm install` y `npm run build`.

## Diferencia con hosting estatico

Si usas solo hosting estatico, sube `publish-ionos/StantonHub` y tendras naves estaticas.

Si quieres login, publicar, votar, admin y sincronizacion, usa VPS y ejecuta `server.js`.
