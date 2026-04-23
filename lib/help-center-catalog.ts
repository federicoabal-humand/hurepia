/**
 * lib/help-center-catalog.ts
 * Help Center URL builder — provides dynamic search links for the AI prompt.
 * No external calls — all URL construction is local.
 */

export const HELP_CENTER_BASE = {
  es: "https://help.humand.co/hc/es-419",
  en: "https://help.humand.co/hc/en-us",
};

export const HELP_CENTER_ADMIN_CATEGORY = {
  es: "https://help.humand.co/hc/es-419/categories/21664670533139-Ayuda-para-Administradores",
  en: "https://help.humand.co/hc/en-us/categories/21664670533139-Ayuda-para-Administradores",
};

/**
 * Genera URL de búsqueda en el Help Center.
 * Ejemplo: searchHelpCenter("cambiar foto perfil", "es")
 * → "https://help.humand.co/hc/es-419/search?query=cambiar+foto+perfil"
 */
export function searchHelpCenter(query: string, language: string): string {
  const base = language === "en" ? HELP_CENTER_BASE.en : HELP_CENTER_BASE.es;
  const encodedQuery = encodeURIComponent(query.trim().slice(0, 100));
  return `${base}/search?query=${encodedQuery}`;
}

/**
 * Catálogo de keywords por módulo — para armar búsquedas relevantes en el
 * Help Center cuando la IA quiere sugerir recursos al admin.
 */
export const HELP_CENTER_MODULE_KEYWORDS: Record<string, string[]> = {
  time_off: ["vacaciones", "ausencias", "licencias", "días disponibles"],
  users: ["usuarios", "permisos", "roles", "administrador", "perfil"],
  chats: ["chats", "mensajes", "canales de consulta", "notificaciones"],
  news: ["noticias", "publicaciones", "muro"],
  onboarding: ["onboarding", "incorporación", "ingreso de nuevos"],
  learning: ["capacitaciones", "cursos", "aprendizaje"],
  events: ["eventos", "inscripciones"],
  attendance: ["control de asistencia", "fichaje", "kiosk", "marcaje"],
  knowledge: ["librerías de conocimiento", "archivos", "documentos"],
  acknowledgements: ["reconocimientos", "canjes"],
  workflows: ["formularios", "flujos de aprobación", "solicitudes"],
  groups: ["grupos"],
  personal_documents: ["documentos personales", "firma"],
  org_chart: ["organigrama"],
  work_schedules: ["jornadas", "horarios de trabajo"],
  notifications: ["notificaciones", "push", "avisos"],
  directory: ["directorio", "contactos"],
  benefits: ["beneficios", "descuentos"],
  surveys: ["encuestas", "feedback"],
  social: ["reconocimientos", "muro social", "publicaciones"],
};

/**
 * Arma el mejor link posible para un reporte.
 * Si hay texto del usuario, lo usa para la búsqueda; si no, usa keywords del módulo.
 */
export function buildHelpCenterUrl(
  moduleSlug: string,
  language: string,
  userText?: string
): string {
  const keywords = HELP_CENTER_MODULE_KEYWORDS[moduleSlug] || [];

  // Si hay texto del usuario, combinarlo en una búsqueda relevante
  if (userText && userText.length > 5) {
    const shortText = userText.split(/\s+/).slice(0, 5).join(" ");
    return searchHelpCenter(shortText, language);
  }

  // Si no, usar la primera keyword del módulo
  if (keywords.length > 0) {
    return searchHelpCenter(keywords[0], language);
  }

  // Fallback: categoría de Administradores
  return language === "en"
    ? HELP_CENTER_ADMIN_CATEGORY.en
    : HELP_CENTER_ADMIN_CATEGORY.es;
}
