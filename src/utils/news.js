/** Devuelve una version de mayor calidad cuando RSI entrega miniaturas heap_thumb. */
export function highQualityNewsImage(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  return url.replace(/\/heap_thumb(\.[a-z0-9]+)(?:\?.*)?$/i, '/source$1');
}

/** Recupera la miniatura original si la version source no existe. */
export function fallbackNewsImage(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  return url.replace(/\/source(\.[a-z0-9]+)(?:\?.*)?$/i, '/heap_thumb$1');
}
