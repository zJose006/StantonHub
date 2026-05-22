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
const testBypass = document.getElementById('test-bypass');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authMessage = document.getElementById('auth-message');

const currentSection = body.dataset.page || 'forum';
const fallbackStorageKey = 'star-citizen-json-fallback';
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
    forum: [
      {
        title: 'Ruta inicial para generar aUEC',
        content: 'Comparte rutas de farmeo, contratos recomendados y consejos para optimizar cada salida en el verso.',
        author: 'Stanton Hub',
        date: formatDate()
      }
    ],
    guides: [
      {
        title: 'Gu\u00eda b\u00e1sica de preparaci\u00f3n',
        content: 'Prepara nave, equipamiento, combustible y destino antes de iniciar misiones o rutas comerciales.',
        author: 'Stanton Hub',
        date: formatDate()
      }
    ],
    news: [
      {
        title: 'Intel reciente del verso',
        content: 'Registra cambios, eventos y oportunidades que puedan afectar al farmeo, comercio o progreso.',
        author: 'Stanton Hub',
        date: formatDate()
      }
    ]
  }
};

let appState = structuredClone(defaultState);
let apiAvailable = false;

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

function loadFallbackState() {
  try {
    return JSON.parse(localStorage.getItem(fallbackStorageKey)) || structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
}

function saveFallbackState() {
  localStorage.setItem(fallbackStorageKey, JSON.stringify(appState));
}

async function loadState() {
  try {
    appState = await requestJson('/api/state');
    apiAvailable = true;
  } catch {
    appState = loadFallbackState();
    apiAvailable = false;
  }
}

async function registerUserInStore(userData) {
  if (apiAvailable) {
    appState = await requestJson('/api/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    return;
  }

  const email = userData.email.toLowerCase();
  if (appState.users.some((user) => user.email === email)) {
    throw new Error('Ese email ya est\u00e1 registrado.');
  }

  const user = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    username: userData.username,
    email,
    role: userData.role,
    password: userData.password,
    createdAt: formatDate()
  };

  appState.users.push(user);
  appState.sessionUserId = user.id;
  saveFallbackState();
}

async function loginUserInStore(email, password) {
  if (apiAvailable) {
    appState = await requestJson('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    return;
  }

  const user = appState.users.find((item) => item.email === email && item.password === password);
  if (!user) {
    throw new Error('No se encontr\u00f3 una cuenta con esos datos.');
  }

  appState.sessionUserId = user.id;
  saveFallbackState();
}

async function logoutUser() {
  if (apiAvailable) {
    appState = await requestJson('/api/logout', { method: 'POST' });
  } else {
    appState.sessionUserId = null;
    saveFallbackState();
  }

  renderAll();
}

async function updateBypass(enabled) {
  if (apiAvailable) {
    appState = await requestJson('/api/bypass', {
      method: 'POST',
      body: JSON.stringify({ enabled })
    });
  } else {
    appState.testBypass = enabled;
    saveFallbackState();
  }

  renderProfile();
}

async function saveContent(section, title, content) {
  if (apiAvailable) {
    appState = await requestJson('/api/content', {
      method: 'POST',
      body: JSON.stringify({ section, title, content })
    });
    return;
  }

  if (!canPublish()) {
    throw new Error('Necesitas iniciar sesi\u00f3n para publicar.');
  }

  appState.content[section].push({
    title,
    content,
    author: getPublisherName(),
    date: formatDate()
  });
  saveFallbackState();
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
    profileActions.innerHTML = `
      <a class="action-btn primary-action" href="perfil.html">Ver perfil</a>
      <button class="action-btn" type="button" id="logout-btn">Cerrar sesi\u00f3n</button>
    `;
  } else {
    profileAvatar.textContent = bypassEnabled ? 'QA' : 'SC';
    profileName.textContent = bypassEnabled ? 'Modo pruebas' : 'Invitado';
    profileStatus.textContent = bypassEnabled
      ? 'Publicaci\u00f3n temporal habilitada sin registro.'
      : 'Inicia sesi\u00f3n para publicar gu\u00edas, rutas y ayudas.';
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

loadState().then(renderAll);
