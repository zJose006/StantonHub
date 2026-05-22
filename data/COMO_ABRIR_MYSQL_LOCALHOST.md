# Base de datos MySQL en localhost

Archivo SQL listo para importar:

`C:\Users\Usuario\Desktop\ProyectoCode\data\stanton_hub_mysql.sql`

## Opcion 1: XAMPP + phpMyAdmin

1. Abre XAMPP Control Panel.
2. Pulsa `Start` en `Apache`.
3. Pulsa `Start` en `MySQL`.
4. Abre el navegador en `http://localhost/phpmyadmin`.
5. En la barra superior, entra en `Importar`.
6. Selecciona el archivo `stanton_hub_mysql.sql`.
7. Pulsa `Importar`.
8. En el panel izquierdo aparecera la base de datos `stanton_hub`.

## Opcion 2: MySQL Workbench

1. Abre MySQL Workbench.
2. Entra en tu conexion local, normalmente `Local instance MySQL`.
3. Ve a `File > Open SQL Script`.
4. Selecciona `stanton_hub_mysql.sql`.
5. Pulsa el icono del rayo para ejecutar el script.
6. Refresca los esquemas y abre `stanton_hub`.

## Opcion 3: Consola MySQL

1. Abre una terminal.
2. Ejecuta:

```powershell
mysql -u root -p < "C:\Users\Usuario\Desktop\ProyectoCode\data\stanton_hub_mysql.sql"
```

3. Si no tienes password en root, pulsa `Enter` cuando lo pida.
4. Comprueba que existe:

```sql
SHOW DATABASES;
USE stanton_hub;
SHOW TABLES;
```

## Tablas creadas

- `users`: usuarios registrados.
- `content_items`: foro, guias e intel.
- `content_images`: imagenes de publicaciones.
- `votes`: votos positivos y negativos.
- `comments`: comentarios.
- `app_settings`: ajustes simples de la app.
- `content_with_stats`: vista con publicaciones, votos y comentarios.

## Arrancar la web con MySQL

La web ya usa MySQL como almacenamiento. Para arrancarla:

```powershell
node server.js
```

Por defecto conecta con:

- Host: `127.0.0.1`
- Puerto: `3306`
- Usuario: `root`
- Password: vacio
- Base de datos: `stanton_hub`

Si tu MySQL usa otros datos, define estas variables antes de iniciar:

```powershell
$env:DB_HOST="127.0.0.1"
$env:DB_PORT="3306"
$env:DB_USER="root"
$env:DB_PASSWORD="tu_password"
$env:DB_NAME="stanton_hub"
node server.js
```

## Conectar UEX API

1. En UEX, entra en `API > My Apps`.
2. Abre la app que has creado.
3. Copia el `Access Token`.
4. Antes de arrancar la web, define el token:

```powershell
$env:UEX_TOKEN="pega_aqui_tu_access_token"
node server.js
```

Si en tu app activaste `Client Version Lock`, define tambien la version exacta:

```powershell
$env:UEX_TOKEN="pega_aqui_tu_access_token"
$env:UEX_CLIENT_VERSION="1.0.0"
node server.js
```

El token se usa solo en `server.js`; no se envia al navegador.
