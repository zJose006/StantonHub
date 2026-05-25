# Despliegue Stanton Hub en EasyPanel

Esta es la ruta recomendada si quieres tener TODO dentro de IONOS usando EasyPanel.

EasyPanel trabaja con Docker. Segun su documentacion, los App Services pueden construir una imagen desde tu codigo, los dominios se asignan desde la seccion Domains y tambien existe servicio MySQL basado en la imagen oficial de MySQL.

## Estado de licencia

EasyPanel actualmente usa licencia por servidor. Sin licencia puede que algunas funciones esten limitadas o que el panel no sea viable para produccion. Si te bloquea, la alternativa es usar el despliegue manual con Nginx + PM2 descrito en `docs/VPS_CHECKLIST.md`.

## Servicios necesarios

Necesitas dos servicios:

```text
1. MySQL
2. App Stanton Hub
```

## 1. Crear MySQL en EasyPanel

Crea un servicio MySQL.

Valores recomendados:

```text
Database: stanton_hub
User: stantonhub
Password: genera una password fuerte
Port interno: 3306
```

Guarda estos datos porque los usaras en la app.

## 2. Crear App Service

Crea una App desde repositorio o subida de codigo.

Configura:

```text
Build: Dockerfile
Puerto interno: 4173
```

El proyecto ya incluye:

```text
Dockerfile
.dockerignore
```

## 3. Variables de entorno de la App

En la app Stanton Hub, pon:

```text
NODE_ENV=production
HOST=0.0.0.0
PORT=4173

DISCORD_CLIENT_ID=1507435246529020034
DISCORD_CLIENT_SECRET=7labMC-qH37E_oG15LB1pRBSKRKhjoCb
DISCORD_REDIRECT_URI=https://stantonhub.com/api/auth/discord/callback

DB_HOST=NOMBRE_DEL_SERVICIO_MYSQL
DB_PORT=3306
DB_USER=stantonhub
DB_PASSWORD=PASSWORD_MYSQL
DB_NAME=stanton_hub
MYSQL_BIN=mysql
DB_SKIP_CREATE=1
```

`DB_HOST` debe ser el hostname interno que EasyPanel asigne al servicio MySQL. Normalmente sera el nombre del servicio o algo parecido dentro de la red Docker del proyecto.

## 4. Dominio

En la seccion Domains de la app:

```text
stantonhub.com
www.stantonhub.com
```

Apunta ambos al puerto interno:

```text
4173
```

Activa SSL/HTTPS desde EasyPanel.

## 5. DNS en IONOS

En el panel DNS de IONOS:

```text
stantonhub.com      A      IP_DEL_VPS
www.stantonhub.com  A      IP_DEL_VPS
```

## 6. Discord

En Discord Developer Portal, Redirect URI:

```text
https://stantonhub.com/api/auth/discord/callback
```

El boton de la web debe seguir apuntando a:

```text
/api/auth/discord
```

## 7. Comprobaciones

Cuando despliegue, prueba:

```text
https://stantonhub.com/api/health
```

Debe devolver JSON.

Si devuelve `database: unavailable`, revisa:

```text
DB_HOST
DB_USER
DB_PASSWORD
DB_NAME
MYSQL_BIN=mysql
```

## 8. Orden de despliegue

1. Crear MySQL.
2. Crear App.
3. Meter variables.
4. Deploy.
5. Comprobar `/api/health`.
6. Configurar dominio.
7. Activar SSL.
8. Probar Discord.
