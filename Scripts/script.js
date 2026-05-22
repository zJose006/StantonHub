const body = document.body;
const modal = document.getElementById('modal');
const closeModal = document.getElementById('close-modal');
const modalTitle = document.getElementById('modal-title');
const modalForm = document.getElementById('modal-form');
const itemTitle = document.getElementById('item-title');
const itemContent = document.getElementById('item-content');
const forumPosts = document.getElementById('forum-posts');
const guidesPosts = document.getElementById('guides-posts');
const newsPosts = document.getElementById('news-posts');
const newTopicBtn = document.getElementById('new-topic-btn');
const newGuideBtn = document.getElementById('new-guide-btn');
const newNewsBtn = document.getElementById('new-news-btn');
const profileAvatar = document.getElementById('profile-avatar');
const profileName = document.getElementById('profile-name');
const profileStatus = document.getElementById('profile-status');
const profileActions = document.getElementById('profile-actions');
const profileMetrics = document.getElementById('profile-metrics');
const profileRoleBadge = document.getElementById('profile-role-badge');
const profileEmail = document.getElementById('profile-email');
const profileCreated = document.getElementById('profile-created');
const profileAccess = document.getElementById('profile-access');
const testBypass = document.getElementById('test-bypass');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authMessage = document.getElementById('auth-message');

const currentSection = body.dataset.page || 'forum';
const dateFormat = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'medium',
  timeStyle: 'short'
});

const defaultState = {
  users: [],
  sessionUserId: null,
  testBypass: false,
  interactions: {
    votes: {},
    comments: {}
  },
  content: {
    forum: [],
    guides: [],
    news: []
  }
};

let appState = structuredClone(defaultState);
function closeNavigationMenus(exceptGroup = null) {
  document.querySelectorAll('.nav-group.is-open').forEach((group) => {
    if (group === exceptGroup) return;
    group.classList.remove('is-open');
    group.querySelector('.nav-trigger')?.setAttribute('aria-expanded', 'false');
    group.querySelector('.nav-menu')?.setAttribute('hidden', '');
  });
}

function setupNavigationMenus() {
  document.querySelectorAll('.nav-menu').forEach((menu) => {
    menu.setAttribute('hidden', '');
  });

  document.querySelectorAll('.nav-trigger').forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      const group = event.currentTarget.closest('.nav-group');
      const menu = group.querySelector('.nav-menu');
      const willOpen = !group.classList.contains('is-open');
      closeNavigationMenus(group);
      group.classList.toggle('is-open', willOpen);
      menu?.toggleAttribute('hidden', !willOpen);
      event.currentTarget.setAttribute('aria-expanded', String(willOpen));
    });
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.nav-group')) closeNavigationMenus();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeNavigationMenus();
  });
}

function formatDate() {
  return dateFormat.format(new Date());
}

function getCurrentUser() {
  return appState.users.find((user) => user.id === appState.sessionUserId) || null;
}

function isBypassEnabled() {
  return Boolean(appState.testBypass);
}

function canPublish() {
  return Boolean(getCurrentUser()) || isBypassEnabled();
}

function getPublisherName() {
  const user = getCurrentUser();
  if (user) return user.username;
  if (isBypassEnabled()) return 'Modo pruebas';
  return 'Invitado';
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || 'No se pudo completar la accion.');
  }

  return payload;
}

async function loadState() {
  try {
    appState = await requestJson('/api/state');
  } catch (error) {
    appState = structuredClone(defaultState);
    showMessage('No se pudo conectar con la base de datos.', true);
  }
}

async function registerUserInStore(userData) {
  appState = await requestJson('/api/register', {
    method: 'POST',
    body: JSON.stringify(userData)
  });
}

async function loginUserInStore(email, password) {
  appState = await requestJson('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

async function logoutUser() {
  appState = await requestJson('/api/logout', { method: 'POST' });
  renderAll();
}

async function updateBypass(enabled) {
  appState = await requestJson('/api/bypass', {
    method: 'POST',
    body: JSON.stringify({ enabled })
  });
  renderProfile();
}

async function saveContent(section, title, content) {
  appState = await requestJson('/api/content', {
    method: 'POST',
    body: JSON.stringify({ section, title, content })
  });
}

function renderAll() {
  renderPosts();
  renderProfile();
}

function renderPosts() {
  const data = appState.content;
  if (forumPosts) forumPosts.innerHTML = renderList(data.forum);
  if (guidesPosts) guidesPosts.innerHTML = renderList(data.guides);
  if (newsPosts) newsPosts.innerHTML = renderList(data.news);
}

function renderList(items) {
  if (!items.length) {
    return `
      <div class="empty-state">
        <strong>No hay publicaciones todav&iacute;a</strong>
        <p>Cuando un usuario publique contenido, aparecer&aacute; aqu&iacute;.</p>
      </div>
    `;
  }

  return items
    .slice()
    .reverse()
    .map(
      (item) => `
      <article class="post-card" data-post-id="${escapeHtml(item.id || '')}">
        <h3>${escapeHtml(item.title)}</h3>
        ${renderPostBody(item)}
        <div class="post-footer">
          <span>${escapeHtml(item.author || 'Stanton Hub')}</span>
          <span>${escapeHtml(item.date)}</span>
        </div>
        ${renderInteractions(item)}
      </article>`
    )
    .join('');
}

function renderPostBody(item) {
  const images = Array.isArray(item.images) ? item.images : [];
  const body = item.contentHtml
    ? `<div class="post-body">${item.contentHtml}</div>`
    : `<p>${escapeHtml(item.content)}</p>`;
  const gallery = images.length
    ? `<div class="post-gallery">${images
        .map((image) => `<img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.name || item.title)}" />`)
        .join('')}</div>`
    : '';

  return `${body}${gallery}`;
}

function renderInteractions(item) {
  const id = item.id || '';
  const votes = appState.interactions?.votes?.[id] || { up: 0, down: 0 };
  const comments = appState.interactions?.comments?.[id] || [];

  return `
    <div class="post-interactions">
      <div class="vote-controls" aria-label="Votos">
        <button type="button" data-vote="1" data-post-id="${escapeHtml(id)}">+ ${votes.up || 0}</button>
        <button type="button" data-vote="-1" data-post-id="${escapeHtml(id)}">- ${votes.down || 0}</button>
      </div>
      <details class="comments-panel">
        <summary>${comments.length} comentarios</summary>
        <div class="comment-list">
          ${comments.map(renderComment).join('') || '<p class="empty-comments">Sin comentarios todavia.</p>'}
        </div>
        <form class="comment-form" data-post-id="${escapeHtml(id)}">
          <input type="text" name="comment" placeholder="Añadir comentario" maxlength="240" required />
          <button type="submit">Comentar</button>
        </form>
      </details>
    </div>
  `;
}

function renderComment(comment) {
  return `
    <article class="comment-item">
      <strong>${escapeHtml(comment.author)}</strong>
      <p>${escapeHtml(comment.text)}</p>
      <span>${escapeHtml(comment.date)}</span>
    </article>
  `;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (match) => {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return map[match];
  });
}

function openModal(type) {
  if (!canPublish()) {
    showAccessRequired();
    return;
  }

  window.location.href = `editor.html?type=${type}`;
}

function showAccessRequired() {
  if (!modal) {
    window.location.href = 'login.html';
    return;
  }

  modalTitle.textContent = 'Registro requerido';
  modalForm.classList.add('hidden');
  modal.querySelector('.modal-card').insertAdjacentHTML(
    'beforeend',
    `<div class="access-warning" id="access-warning">
      <p>Necesitas iniciar sesi&oacute;n para publicar gu&iacute;as, rutas o ayudas. Tambi&eacute;n puedes activar el modo pruebas desde el panel de perfil.</p>
      <div class="profile-actions">
        <a class="action-btn primary-action" href="login.html">Iniciar sesi&oacute;n</a>
        <a class="action-btn" href="registro.html">Crear cuenta</a>
      </div>
    </div>`
  );
  modal.classList.remove('hidden');
}

function closeModalDialog() {
  modal.classList.add('hidden');
  modalForm.classList.remove('hidden');
  document.getElementById('access-warning')?.remove();
}

function getInitials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'SC';
}

function countUserPosts(username) {
  return Object.values(appState.content)
    .flat()
    .filter((item) => item.author === username).length;
}

function renderProfile() {
  const user = getCurrentUser();
  const bypassEnabled = isBypassEnabled();

  if (testBypass) {
    testBypass.checked = bypassEnabled;
  }

  if (!profileName || !profileStatus || !profileActions || !profileAvatar) return;

  if (user) {
    profileAvatar.textContent = getInitials(user.username);
    profileName.textContent = user.username;
    profileStatus.textContent = `${user.role} | Publicaci\u00f3n habilitada`;
    if (profileRoleBadge) profileRoleBadge.textContent = user.role;
    if (profileEmail) profileEmail.textContent = user.email;
    if (profileCreated) profileCreated.textContent = user.createdAt || 'Fecha no disponible';
    if (profileAccess) profileAccess.textContent = 'Publicacion habilitada';
    profileActions.innerHTML = `
      <a class="action-btn primary-action" href="editor.html?type=forum">Publicar</a>
      <button class="action-btn" type="button" id="logout-btn">Cerrar sesi\u00f3n</button>
    `;
  } else {
    profileAvatar.textContent = bypassEnabled ? 'QA' : 'SC';
    profileName.textContent = bypassEnabled ? 'Modo pruebas' : 'Invitado';
    profileStatus.textContent = bypassEnabled
      ? 'Publicaci\u00f3n temporal habilitada sin registro.'
      : 'Inicia sesi\u00f3n para publicar gu\u00edas, rutas y ayudas.';
    if (profileRoleBadge) profileRoleBadge.textContent = bypassEnabled ? 'Acceso temporal' : 'Piloto sin identificar';
    if (profileEmail) profileEmail.textContent = 'No disponible';
    if (profileCreated) profileCreated.textContent = 'Sin registro';
    if (profileAccess) profileAccess.textContent = bypassEnabled ? 'Modo pruebas' : 'Lectura';
    profileActions.innerHTML = `
      <a class="action-btn primary-action" href="login.html">Iniciar sesi\u00f3n</a>
      <a class="action-btn" href="registro.html">Crear cuenta</a>
    `;
  }

  document.getElementById('logout-btn')?.addEventListener('click', logoutUser);
  renderMetrics(user, bypassEnabled);
}

function renderMetrics(user, bypassEnabled) {
  if (!profileMetrics) return;

  profileMetrics.classList.toggle('empty-metrics', !user);

  if (!user) {
    profileMetrics.innerHTML = `
      <div class="profile-note">
        <strong>Historial no disponible</strong>
        <span>${bypassEnabled
          ? 'El modo pruebas permite publicar, pero no muestra gu\u00edas, intel ni aportes como si fueran de una cuenta registrada.'
          : 'Inicia sesi\u00f3n o crea una cuenta para ver tus gu\u00edas, intel y aportes publicados.'}</span>
      </div>
    `;
    return;
  }

  const userGuides = appState.content.guides.filter((item) => item.author === user.username).length;
  const userIntel = appState.content.news.filter((item) => item.author === user.username).length;
  const userPosts = countUserPosts(user.username);

  profileMetrics.innerHTML = `
    <div class="metric">
      <span>${escapeHtml(user.role)}</span>
      <strong>Rol</strong>
    </div>
    <div class="metric">
      <span>${userGuides}</span>
      <strong>Mis gu\u00edas</strong>
    </div>
    <div class="metric">
      <span>${userIntel}</span>
      <strong>Mi intel</strong>
    </div>
    <div class="metric">
      <span>${userPosts}</span>
      <strong>Aportes</strong>
    </div>
  `;
}

function showMessage(message, isError = false) {
  if (!authMessage) return;
  authMessage.textContent = message;
  authMessage.classList.toggle('error', isError);
}

async function registerUser(event) {
  event.preventDefault();
  const username = document.getElementById('register-callsign').value.trim();
  const email = document.getElementById('register-email').value.trim().toLowerCase();
  const role = document.getElementById('register-role').value;
  const password = document.getElementById('register-password').value;

  try {
    await registerUserInStore({ username, email, role, password });
    showMessage('Perfil creado. Redirigiendo al panel...');
    setTimeout(() => {
      window.location.href = 'perfil.html';
    }, 600);
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function loginUser(event) {
  event.preventDefault();
  const email = document.getElementById('login-identifier').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;

  try {
    await loginUserInStore(email, password);
    showMessage('Sesi\u00f3n iniciada. Redirigiendo al panel...');
    setTimeout(() => {
      window.location.href = 'perfil.html';
    }, 600);
  } catch (error) {
    showMessage(error.message, true);
  }
}

if (newTopicBtn) {
  newTopicBtn.addEventListener('click', () => openModal('forum'));
}

document.addEventListener('click', async (event) => {
  const voteButton = event.target.closest('[data-vote][data-post-id]');
  if (!voteButton) return;

  try {
    appState = await requestJson('/api/vote', {
      method: 'POST',
      body: JSON.stringify({
        postId: voteButton.dataset.postId,
        vote: Number(voteButton.dataset.vote)
      })
    });
    renderAll();
  } catch (error) {
    if (!canPublish()) showAccessRequired();
  }
});

document.addEventListener('submit', async (event) => {
  const form = event.target.closest('.comment-form');
  if (!form) return;
  event.preventDefault();
  const input = form.elements.comment;

  try {
    appState = await requestJson('/api/comment', {
      method: 'POST',
      body: JSON.stringify({
        postId: form.dataset.postId,
        text: input.value.trim()
      })
    });
    renderAll();
  } catch (error) {
    if (!canPublish()) showAccessRequired();
  }
});

if (newGuideBtn) {
  newGuideBtn.addEventListener('click', () => openModal('guides'));
}

if (newNewsBtn) {
  newNewsBtn.addEventListener('click', () => openModal('news'));
}

if (closeModal) {
  closeModal.addEventListener('click', closeModalDialog);
}

if (modal) {
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModalDialog();
  });
}

if (modalForm) {
  modalForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!itemTitle.value.trim() || !itemContent.value.trim()) return;

    try {
      await saveContent(currentSection, itemTitle.value.trim(), itemContent.value.trim());
      renderPosts();
      renderProfile();
      closeModalDialog();
    } catch (error) {
      showAccessRequired();
    }
  });
}

if (testBypass) {
  testBypass.addEventListener('change', () => {
    updateBypass(testBypass.checked);
  });
}

if (registerForm) {
  registerForm.addEventListener('submit', registerUser);
}

if (loginForm) {
  loginForm.addEventListener('submit', loginUser);
}

setupNavigationMenus();
loadState().then(renderAll);
