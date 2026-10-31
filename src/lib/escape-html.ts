// Convierte texto en algo seguro para insertar dentro de HTML (tickets, reportes PDF).
// Evita que un nombre de producto o de empleado con código dentro se ejecute.
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
