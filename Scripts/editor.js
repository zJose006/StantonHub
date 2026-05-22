const sectionSelect = document.getElementById('editor-section');
const titleInput = document.getElementById('editor-title');
const richEditor = document.getElementById('rich-editor');
const imageInput = document.getElementById('editor-images');
const imagePreview = document.getElementById('image-preview');
const editorForm = document.getElementById('editor-form');
const editorMessage = document.getElementById('editor-message');
const editorHeading = document.getElementById('editor-heading');
const textColor = document.getElementById('text-color');

const sectionLabels = {
  forum: 'mensaje de foro',
  guides: 'gu\u00eda',
  news: 'intel'
};

let selectedImages = [];

function getInitialSection() {
  const params = new URLSearchParams(window.location.search);
  const requestedType = params.get('type');
  return ['forum', 'guides', 'news'].includes(requestedType) ? requestedType : 'forum';
}

function showEditorMessage(message, isError = false) {
  editorMessage.textContent = message;
  editorMessage.classList.toggle('error', isError);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || 'No se pudo completar la acci\u00f3n.');
  }

  return payload;
}

function sanitizeEditorHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const allowedTags = new Set(['B', 'I', 'U', 'S', 'STRIKE', 'STRONG', 'EM', 'P', 'BR', 'UL', 'OL', 'LI', 'H2', 'H3', 'BLOCKQUOTE', 'A', 'SPAN', 'DIV']);
  const allowedStyleProperties = new Set(['color', 'text-align']);

  template.content.querySelectorAll('*').forEach((node) => {
    if (!allowedTags.has(node.tagName)) {
      node.replaceWith(...node.childNodes);
      return;
    }

    [...node.attributes].forEach((attribute) => {
      if (node.tagName === 'A' && attribute.name === 'href') {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
        return;
      }
      if (attribute.name === 'style') {
        const safeStyles = attribute.value
          .split(';')
          .map((style) => style.trim())
          .filter(Boolean)
          .filter((style) => allowedStyleProperties.has(style.split(':')[0].trim().toLowerCase()));

        if (safeStyles.length) {
          node.setAttribute('style', safeStyles.join('; '));
        } else {
          node.removeAttribute('style');
        }
        return;
      }
      node.removeAttribute(attribute.name);
    });
  });

  return template.innerHTML.trim();
}

function updateHeading() {
  editorHeading.textContent = `${sectionSelect.value === 'guides' ? 'Nueva' : 'Nuevo'} ${sectionLabels[sectionSelect.value]}`;
}

function renderImages() {
  imagePreview.innerHTML = selectedImages
    .map(
      (image, index) => `
        <figure class="preview-image">
          <img src="${image.src}" alt="${image.name}" />
          <figcaption>${image.name}</figcaption>
          <button type="button" data-remove-image="${index}">Quitar</button>
        </figure>
      `
    )
    .join('');
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
    reader.readAsDataURL(file);
  });
}

document.querySelectorAll('.editor-toolbar button[data-command]').forEach((button) => {
  button.addEventListener('click', () => {
    const command = button.dataset.command;
    const value = button.dataset.value || null;
    richEditor.focus();
    document.execCommand(command, false, value);
  });
});

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

document.getElementById('insert-link-btn').addEventListener('click', () => {
  const url = window.prompt('URL del enlace');
  if (!url) return;
  richEditor.focus();
  document.execCommand('createLink', false, url);
});

textColor.addEventListener('input', () => {
  richEditor.focus();
  document.execCommand('foreColor', false, textColor.value);
});

sectionSelect.value = getInitialSection();
updateHeading();
sectionSelect.addEventListener('change', updateHeading);

imageInput.addEventListener('change', async () => {
  const files = [...imageInput.files].slice(0, 8 - selectedImages.length);
  const images = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      src: await readFileAsDataUrl(file)
    }))
  );
  selectedImages = [...selectedImages, ...images].slice(0, 8);
  imageInput.value = '';
  renderImages();
});

imagePreview.addEventListener('click', (event) => {
  const removeButton = event.target.closest('[data-remove-image]');
  if (!removeButton) return;
  selectedImages.splice(Number(removeButton.dataset.removeImage), 1);
  renderImages();
});

editorForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const contentHtml = sanitizeEditorHtml(richEditor.innerHTML);
  const textContent = richEditor.innerText.trim();

  if (!title || !textContent) {
    showEditorMessage('A\u00f1ade un t\u00edtulo y contenido antes de publicar.', true);
    return;
  }

  try {
    await requestJson('/api/content', {
      method: 'POST',
      body: JSON.stringify({
        section: sectionSelect.value,
        title,
        content: textContent,
        contentHtml,
        images: selectedImages
      })
    });
    showEditorMessage('Publicaci\u00f3n guardada. Redirigiendo...');
    const target = {
      forum: 'forum.html',
      guides: 'guias.html',
      news: 'noticias.html'
    }[sectionSelect.value];
    setTimeout(() => {
      window.location.href = target;
    }, 650);
  } catch (error) {
    showEditorMessage(error.message, true);
  }
});

setupNavigationMenus();
