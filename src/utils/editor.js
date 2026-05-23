/** Convierte una imagen local a Data URL para poder guardarla con la publicacion. */
export function readFileAsDataUrl(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('No se pudo cargar la imagen.')); reader.readAsDataURL(file); }); }

/** Limpia el HTML del editor para permitir solo etiquetas y estilos seguros. */
export function sanitizeEditorHtml(html) {
  const template = document.createElement('template'); template.innerHTML = html;
  const allowedTags = new Set(['B','I','U','S','STRIKE','STRONG','EM','P','BR','UL','OL','LI','H2','H3','BLOCKQUOTE','A','SPAN','DIV']);
  const allowedStyleProperties = new Set(['color','text-align']);
  template.content.querySelectorAll('*').forEach((node) => {
    if (!allowedTags.has(node.tagName)) { node.replaceWith(...node.childNodes); return; }
    [...node.attributes].forEach((attribute) => {
      if (node.tagName === 'A' && attribute.name === 'href') { node.setAttribute('target','_blank'); node.setAttribute('rel','noopener noreferrer'); return; }
      if (attribute.name === 'style') { const safeStyles = attribute.value.split(';').map((style) => style.trim()).filter(Boolean).filter((style) => allowedStyleProperties.has(style.split(':')[0].trim().toLowerCase())); if (safeStyles.length) node.setAttribute('style', safeStyles.join('; ')); else node.removeAttribute('style'); return; }
      node.removeAttribute(attribute.name);
    });
  });
  return template.innerHTML.trim();
}
