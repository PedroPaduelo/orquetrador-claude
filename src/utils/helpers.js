/**
 * Formata uma data para exibição
 * @param {Date|string} date - Data a ser formatada
 * @returns {string} Data formatada
 */
export function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Gera um slug a partir de uma string
 * @param {string} text - Texto para gerar slug
 * @returns {string} Slug gerado
 */
export function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

/**
 * Trunca um texto para um tamanho máximo
 * @param {string} text - Texto a ser truncado
 * @param {number} maxLength - Tamanho máximo
 * @returns {string} Texto truncado
 */
export function truncate(text, maxLength = 100) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Valida se uma string é um UUID válido
 * @param {string} str - String para validar
 * @returns {boolean} Se é um UUID válido
 */
export function isValidUUID(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Escapa caracteres HTML para prevenir XSS
 * @param {string} text - Texto para escapar
 * @returns {string} Texto escapado
 */
export function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

export default {
  formatDate,
  slugify,
  truncate,
  isValidUUID,
  escapeHtml,
};
