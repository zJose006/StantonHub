# Despliegue en IONOS

Para publicar la web en IONOS no subas el proyecto entero. El hosting debe recibir solo el build final.

## Pasos

1. Ejecuta:

```bash
npm run build:ionos
```

2. Abre la carpeta:

```text
publish-ionos/StantonHub
```

3. Sube el contenido de esa carpeta a la raiz del dominio en IONOS.

En IONOS deben quedar:

```text
index.html
.htaccess
assets/
static-api/
```

El archivo `.htaccess` ya fuerza HTTPS y permite que las rutas internas de React funcionen al recargar.

No subas:

```text
src/
node_modules/
public/
dist/
data/
.git/
.env
package.json
server.js
```

## Error main.jsx

Si la consola muestra `main.jsx:1 Failed to load module script`, IONOS esta sirviendo el `index.html` de desarrollo de la raiz del proyecto. Eso significa que se ha subido el proyecto entero en vez del contenido de `publish-ionos/StantonHub`.

## Error de JSON en Naves

Si aparece `Unexpected token '<'`, el hosting estatico esta devolviendo `index.html` cuando la web pide `/api/vehicles`.

Para IONOS la pagina usa `static-api/vehicles.json` y `static-api/vehicles/*.json`. Esos archivos se generan con:

```bash
npm run build:ionos
```

Ten MySQL encendido. Si la API local no esta abierta, el script levantara `server.js` temporalmente, leera `http://127.0.0.1:4173/api/vehicles` y volcara los datos como JSON estatico.

## Login de Discord

El login con Discord no funciona en un hosting estatico puro porque necesita ejecutar `/api/auth/discord` y `/api/auth/discord/callback` en un servidor Node.

Para activarlo en dominio real necesitas desplegar `server.js` en un servidor con Node.js y configurar en Discord Developer Portal:

```text
https://stantonhub.com/api/auth/discord/callback
```

En el servidor Node de produccion, `.env` debe usar:

```text
DISCORD_REDIRECT_URI=https://stantonhub.com/api/auth/discord/callback
```

No subas `.env` al hosting estatico.

La URL de autorizacion para Discord con el dominio de produccion es:

```text
https://discord.com/oauth2/authorize?client_id=1507435246529020034&response_type=code&redirect_uri=https%3A%2F%2Fstantonhub.com%2Fapi%2Fauth%2Fdiscord%2Fcallback&scope=identify+email
```

No pongas esa URL directamente en el boton de la web. El boton debe seguir apuntando a:

```text
/api/auth/discord
```

Ese endpoint genera un `state` de seguridad y despues redirige a Discord con la URL correcta.

El flujo correcto es:

```text
Usuario pulsa Entrar con Discord
-> https://stantonhub.com/api/auth/discord
-> Discord OAuth
-> https://stantonhub.com/api/auth/discord/callback
-> Perfil del usuario
```

Si `https://stantonhub.com/api/auth/discord` no existe en produccion, significa que falta desplegar el backend Node. En hosting estatico solo funcionara la parte publica de la web.
