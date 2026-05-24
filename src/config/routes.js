/** Rutas limpias de la aplicacion React. */
export const routes = { home: '/pages/index', forum: '/pages/forum', guides: '/pages/guias', news: '/pages/noticias', ships: '/pages/naves', ship: '/pages/naves', profile: '/pages/perfil', login: '/pages/login', register: '/pages/registro', editor: '/pages/editor', admin: '/pages/admin' };

/** Compatibilidad con enlaces antiguos terminados en .html. */
export const legacyRouteMap = { '/index.html': routes.home, '/pages/index.html': routes.home, '/pages/forum.html': routes.forum, '/pages/guias.html': routes.guides, '/pages/noticias.html': routes.news, '/pages/naves.html': routes.ships, '/pages/perfil.html': routes.profile, '/pages/login.html': routes.login, '/pages/registro.html': routes.register, '/pages/editor.html': routes.editor, '/pages/admin.html': routes.admin };

/** Traduce cada URL a una pagina interna. */
export const pageMap = { '/': 'home', [routes.home]: 'home', [routes.forum]: 'forum', [routes.guides]: 'guides', [routes.news]: 'news', [routes.ships]: 'ships', [routes.profile]: 'profile', [routes.login]: 'login', [routes.register]: 'register', [routes.editor]: 'editor', [routes.admin]: 'admin' };

/** Nombres visibles para las secciones publicables. */
export const sectionLabels = { forum: 'Base de operaciones', guides: 'Guias', news: 'Intel' };

/** Nombres usados por el editor al crear contenido. */
export const editorLabels = { forum: 'mensaje de foro', guides: 'guia', news: 'intel' };
