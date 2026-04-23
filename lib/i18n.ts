export type Lang = "es" | "en";

const TRANSLATIONS = {
  es: {
    // Trigger button
    "trigger.label": "HuReport",

    // Header
    "header.title": "HuReport AI",
    "header.close": "Cerrar",
    "lang.toggle": "EN",

    // Tabs
    "tab.report": "Reportar",
    "tab.myReports": "Mis Reportes",

    // Report form — sections
    "form.section.client": "Información del cliente",
    "form.section.issue": "Detalle del inconveniente",
    "form.section.evidence": "Evidencia",

    // Form fields
    "form.community.label": "Comunidad",
    "form.community.placeholder": "Buscar comunidad...",
    "form.community.notFound": "No se encontraron resultados",
    "form.community.instance": "Instancia",
    "form.community.country": "País",
    "form.community.cxOwner": "CX Owner",

    "form.module.label": "Módulo",
    "form.module.placeholder": "Seleccioná un módulo",

    "form.platform.label": "Plataforma",

    "form.whatHappened.label": "¿Qué pasó?",
    "form.whatHappened.placeholder": "Describí el inconveniente en detalle...",

    "form.whatExpected.label": "¿Qué esperabas que pasara?",
    "form.whatExpected.placeholder": "Comportamiento esperado...",

    "form.blocking.label": "¿Bloquea una acción crítica?",
    "form.blocking.yes": "Sí",
    "form.blocking.no": "No",

    "form.usersAffected.label": "¿Cuántos usuarios afectados?",
    "form.usersAffected.one": "Solo 1",
    "form.usersAffected.many": "Más de 1",

    "form.evidence.label": "Evidencia (imágenes / videos)",
    "form.evidence.hint": "Arrastrá archivos aquí o hacé click para seleccionar",
    "form.evidence.required": "* Requerido",

    "form.url.label": "URL donde ocurre el inconveniente",
    "form.url.placeholder": "https://...",

    "form.email.label": "Email o ID del usuario afectado",
    "form.email.placeholder": "usuario@empresa.com",

    "form.submit": "Analizar y Reportar",
    "form.submit.loading": "La IA está analizando...",

    // AI Result
    "result.ticketCreated": "Creamos el reporte automáticamente.",
    "result.ticketNumber": "Reporte",
    "result.reportAnother": "Reportar otro inconveniente",
    "result.submitFeedback": "¿Enviar esto como sugerencia al equipo de Producto?",
    "result.yes": "Sí, enviar sugerencia",
    "result.no": "No, gracias",
    "result.viewDocs": "Ver documentación",
    "result.submitAdditional": "Enviar información adicional",
    "result.additionalPlaceholder": "Respondé las preguntas aquí...",

    // Duplicate result
    "result.duplicate.title": "Identificamos un inconveniente similar ya reportado",
    "result.duplicate.report": "Reporte",
    "result.duplicate.reportedAgo": "Reportado",
    "result.duplicate.sameIssue": "Este es mi caso",
    "result.duplicate.differentIssue": "No, es algo distinto",

    // Classification badges (admin-friendly, no technical jargon)
    "badge.bug_confirmed": "Inconveniente confirmado",
    "badge.configuration_error": "Ajuste de configuración necesario",
    "badge.cache_browser": "Refrescá tu sesión",
    "badge.expected_behavior": "Funciona como está previsto",
    "badge.needs_more_info": "Necesitamos más detalle",
    "badge.feature_request": "Sugerencia registrada",
    "badge.bug_known": "Ya lo tenemos identificado",
    "badge.bug_already_resolved": "Resuelto recientemente",

    // bug_already_resolved result
    "result.resolved.title": "Este inconveniente fue resuelto recientemente",
    "result.resolved.hint": "Probá refrescar tu sesión o actualizar la app. Si el problema persiste, reportalo de nuevo.",

    // bug_known result
    "result.known.title": "Ya estamos trabajando en esto",
    "result.known.hint": "Tu reporte fue registrado en el ticket existente. Te avisaremos cuando esté resuelto.",

    // My Reports
    "reports.empty": "Todavía no hay reportes. Usá la pestaña Reportar para enviar el primero.",
    "reports.ticket": "Reporte",
    "reports.date": "Fecha",
    "reports.module": "Módulo",
    "reports.summary": "Resumen",
    "reports.status": "Estado",
    "reports.expand": "Ver detalle",
    "reports.collapse": "Cerrar",
    "reports.addInfo": "Agregar información",
    "reports.addInfo.placeholder": "Agregá más detalles, respondé preguntas o adjuntá archivos...",
    "reports.addInfo.submit": "Enviar",
    "reports.addInfo.cancel": "Cancelar",
    "reports.addInfo.sent": "Información enviada correctamente.",

    // Status badges
    "status.reported": "Reportado",
    "status.under_review": "En revisión",
    "status.developing_fix": "Desarrollando solución",
    "status.resolved": "Resuelto",

    // Modules
    "module.users": "Usuarios",
    "module.segmentation": "Segmentación",
    "module.work_schedules": "Horarios laborales",
    "module.attendance": "Control de asistencia",
    "module.news": "Noticias",
    "module.knowledge": "Librerías de conocimiento",
    "module.forms": "Formularios y Trámites",
    "module.surveys": "Encuestas",
    "module.people_experience": "People Experience",
    "module.learning": "Aprendizaje",
    "module.service_management": "Gestión de servicios",
    "module.onboarding": "Onboarding",
    "module.files": "Archivos",
    "module.personal_documents": "Documentos personales",
    "module.quick_access": "Accesos rápidos",
    "module.time_off": "Vacaciones y permisos",
    "module.performance": "Desempeño",
    "module.goals": "Objetivos",
    "module.communication": "Comunicación",
    "module.acknowledgements": "Reconocimientos",
    "module.groups": "Grupos",
    "module.feed": "Feed",
    "module.chats": "Chats",
    "module.events": "Eventos",
    "module.org_chart": "Organigrama",
    "module.profile": "Perfil",
    "module.marketplace": "Marketplace",
    "module.integrations": "Integraciones",
    "module.notifications": "Notificaciones",
    "module.widgets": "Widgets",
    "module.workflows": "Workflows",
    "module.general": "General",

    // Platforms
    "platform.admin_web": "Admin Web",
    "platform.web_app": "Web App",
    "platform.mobile_app": "Mobile App",
    "platform.api": "API",

    // Community Gate
    "gate.title": "Bienvenido a HuReport AI",
    "gate.welcome": "Bienvenido a HuReport AI",
    "gate.subtitle": "Contanos tu comunidad para empezar.",
    "gate.communityLabel": "Nombre de tu comunidad",
    "gate.placeholder": "Ej: Mi Empresa SA",
    "gate.continue": "Continuar",
    "gate.reportingFor": "Reportando para:",
    "gate.privacyNote": "Esta información solo se usa para identificar tu reporte.",
    "header.changeCommunity": "Cambiar comunidad",

    // CX routing
    "result.contactCx": "Contactá a tu CX Manager",
    "result.contactCxName": "Contactá a",
    "result.contactCxFallback": "Contactá con tu Manager/Owner de cuenta por los canales oficiales de Humand.",

    // Severity
    "severity.alta": "Impacto alto",
    "severity.media": "Impacto medio",
    "severity.baja": "Impacto bajo",

    // Demo mode
    "demo.badge": "DEMO",
    "demo.reportingAs": "Demostrando como",
  },

  en: {
    // Trigger button
    "trigger.label": "HuReport",

    // Header
    "header.title": "HuReport AI",
    "header.close": "Close",
    "lang.toggle": "ES",

    // Tabs
    "tab.report": "Report",
    "tab.myReports": "My Reports",

    // Report form — sections
    "form.section.client": "Client information",
    "form.section.issue": "Issue details",
    "form.section.evidence": "Evidence",

    // Form fields
    "form.community.label": "Community",
    "form.community.placeholder": "Search community...",
    "form.community.notFound": "No results found",
    "form.community.instance": "Instance",
    "form.community.country": "Country",
    "form.community.cxOwner": "CX Owner",

    "form.module.label": "Module",
    "form.module.placeholder": "Select a module",

    "form.platform.label": "Platform",

    "form.whatHappened.label": "What happened?",
    "form.whatHappened.placeholder": "Describe the issue in detail...",

    "form.whatExpected.label": "What did you expect to happen?",
    "form.whatExpected.placeholder": "Expected behavior...",

    "form.blocking.label": "Does this block a critical action?",
    "form.blocking.yes": "Yes",
    "form.blocking.no": "No",

    "form.usersAffected.label": "How many users are affected?",
    "form.usersAffected.one": "Only 1",
    "form.usersAffected.many": "More than 1",

    "form.evidence.label": "Evidence (images / videos)",
    "form.evidence.hint": "Drag files here or click to select",
    "form.evidence.required": "* Required",

    "form.url.label": "URL where the issue occurs",
    "form.url.placeholder": "https://...",

    "form.email.label": "Affected user email or ID",
    "form.email.placeholder": "user@company.com",

    "form.submit": "Analyze & Report",
    "form.submit.loading": "AI is analyzing...",

    // AI Result
    "result.ticketCreated": "We've automatically created a report.",
    "result.ticketNumber": "Report",
    "result.reportAnother": "Report another issue",
    "result.submitFeedback": "Would you like to submit this as a suggestion for our Product team?",
    "result.yes": "Yes, send suggestion",
    "result.no": "No, thanks",
    "result.viewDocs": "View documentation",
    "result.submitAdditional": "Submit additional info",
    "result.additionalPlaceholder": "Answer the questions here...",

    // Duplicate result
    "result.duplicate.title": "We found a similar issue already reported",
    "result.duplicate.report": "Report",
    "result.duplicate.reportedAgo": "Reported",
    "result.duplicate.sameIssue": "This is my case",
    "result.duplicate.differentIssue": "No, it's something different",

    // Classification badges (admin-friendly, no technical jargon)
    "badge.bug_confirmed": "Confirmed issue",
    "badge.configuration_error": "Configuration adjustment needed",
    "badge.cache_browser": "Refresh your session",
    "badge.expected_behavior": "Works as designed",
    "badge.needs_more_info": "We need more detail",
    "badge.feature_request": "Suggestion registered",
    "badge.bug_known": "Already tracked",
    "badge.bug_already_resolved": "Recently resolved",

    // bug_already_resolved result
    "result.resolved.title": "This issue was recently resolved",
    "result.resolved.hint": "Try refreshing your session or updating the app. If the problem persists, please report it again.",

    // bug_known result
    "result.known.title": "We're already working on this",
    "result.known.hint": "Your report was added to the existing ticket. We'll notify you when it's resolved.",

    // My Reports
    "reports.empty": "No reports yet. Use the Report tab to submit your first issue.",
    "reports.ticket": "Report",
    "reports.date": "Date",
    "reports.module": "Module",
    "reports.summary": "Summary",
    "reports.status": "Status",
    "reports.expand": "View details",
    "reports.collapse": "Collapse",
    "reports.addInfo": "Add more information",
    "reports.addInfo.placeholder": "Add more details, answer questions or attach files...",
    "reports.addInfo.submit": "Submit",
    "reports.addInfo.cancel": "Cancel",
    "reports.addInfo.sent": "Information sent successfully.",

    // Status badges
    "status.reported": "Reported",
    "status.under_review": "Under review",
    "status.developing_fix": "Developing fix",
    "status.resolved": "Resolved",

    // Modules
    "module.users": "Users",
    "module.segmentation": "Segmentation",
    "module.work_schedules": "Work schedules",
    "module.attendance": "Attendance",
    "module.news": "News",
    "module.knowledge": "Knowledge libraries",
    "module.forms": "Forms & Procedures",
    "module.surveys": "Surveys",
    "module.people_experience": "People Experience",
    "module.learning": "Learning",
    "module.service_management": "Service Management",
    "module.onboarding": "Onboarding",
    "module.files": "Files",
    "module.personal_documents": "Personal documents",
    "module.quick_access": "Quick access",
    "module.time_off": "Time Off",
    "module.performance": "Performance Review",
    "module.goals": "Goals",
    "module.communication": "Communication",
    "module.acknowledgements": "Acknowledgements",
    "module.groups": "Groups",
    "module.feed": "Feed",
    "module.chats": "Chats",
    "module.events": "Events",
    "module.org_chart": "Org Chart",
    "module.profile": "Profile",
    "module.marketplace": "Marketplace",
    "module.integrations": "Integrations",
    "module.notifications": "Notifications",
    "module.widgets": "Widgets",
    "module.workflows": "Workflows",
    "module.general": "General",

    // Platforms
    "platform.admin_web": "Admin Web",
    "platform.web_app": "Web App",
    "platform.mobile_app": "Mobile App",
    "platform.api": "API",

    // Community Gate
    "gate.title": "Welcome to HuReport AI",
    "gate.welcome": "Welcome to HuReport AI",
    "gate.subtitle": "Tell us your community to get started.",
    "gate.communityLabel": "Your community name",
    "gate.placeholder": "E.g: My Company Inc",
    "gate.continue": "Continue",
    "gate.reportingFor": "Reporting for:",
    "gate.privacyNote": "This information is only used to identify your report.",
    "header.changeCommunity": "Change community",

    // CX routing
    "result.contactCx": "Contact your CX Manager",
    "result.contactCxName": "Contact",
    "result.contactCxFallback": "Reach out to your Account Manager/Owner through the official Humand channels.",

    // Severity
    "severity.alta": "High impact",
    "severity.media": "Medium impact",
    "severity.baja": "Low impact",

    // Demo mode
    "demo.badge": "DEMO",
    "demo.reportingAs": "Demoing as",
  },
} as const;

type TranslationKey = keyof (typeof TRANSLATIONS)["es"];

export function t(key: TranslationKey, lang: Lang): string {
  return TRANSLATIONS[lang][key] ?? key;
}
