# Estructura React

Esta carpeta separa la web por responsabilidades para que puedas tocar una parte sin buscar en un archivo gigante.

## Entrada

- `main.jsx`: monta React en el navegador.
- `App.jsx`: decide que pagina se muestra, mantiene el estado global y conecta header/footer.

## Configuracion

- `config/routes.js`: rutas, aliases antiguos `.html`, nombres de secciones y etiquetas del editor.

## Servicios

- `services/api.js`: llamadas al backend (`requestJson`, `loadState`).

## Componentes compartidos

- `components/layout/Header.jsx`: header, menus desplegables y estado de cuenta.
- `components/layout/Footer.jsx`: footer comun.
- `components/layout/HeroContent.jsx`: textos del hero por pagina.
- `components/layout/AuthShell.jsx`: marco visual de paginas de acceso.
- `components/icons/DiscordIcon.jsx`: icono oficial de Discord.

## Paginas

- `pages/Home.jsx`: inicio.
- `pages/LoginPage.jsx`: acceso unico con Discord.
- `pages/ContentPage.jsx`: foro, guias e intel.
- `pages/ShipsPage.jsx`: catalogo de naves.
- `pages/ProfilePage.jsx`: perfil del usuario.
- `pages/AdminPage.jsx`: administracion de usuarios, contenido, capturas y UEX.
- `pages/EditorPage.jsx`: editor de publicaciones.

## Utilidades

- `utils/navigation.js`: navegacion interna y normalizacion de rutas.
- `utils/permissions.js`: comprobacion de permisos.
- `utils/format.js`: formatos de texto, moneda, metros e iniciales.
- `utils/ships.js`: filtros y ordenacion del catalogo de naves.
- `utils/editor.js`: lectura de imagenes y limpieza del HTML del editor.
