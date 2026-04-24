export type Lang = "es" | "en" | "pt" | "fr";

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
    "result.viewHelpCenter": "Ver en el Help Center",
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
    "result.resolved.hint":
      "Probá refrescar tu sesión o actualizar la app. Si el problema persiste, reportalo de nuevo.",

    // bug_known result
    "result.known.title": "Ya estamos trabajando en esto",
    "result.known.hint":
      "Tu reporte fue registrado en el ticket existente. Te avisaremos cuando esté resuelto.",

    // My Reports
    "reports.empty":
      "Todavía no hay reportes. Usá la pestaña Reportar para enviar el primero.",
    "reports.ticket": "Reporte",
    "reports.date": "Fecha",
    "reports.module": "Módulo",
    "reports.summary": "Resumen",
    "reports.status": "Estado",
    "reports.expand": "Ver detalle",
    "reports.collapse": "Cerrar",
    "reports.addInfo": "Agregar información",
    "reports.addInfo.placeholder":
      "Agregá más detalles, respondé preguntas o adjuntá archivos...",
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
    "platform.kiosk": "Kiosk",
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
    "result.contactCxFallback":
      "Contactá con tu Manager/Owner de cuenta por los canales oficiales de Humand.",

    // Severity
    "severity.alta": "Impacto alto",
    "severity.media": "Impacto medio",
    "severity.baja": "Impacto bajo",

    // Demo mode
    "demo.badge": "DEMO",
    "demo.reportingAs": "Demostrando como",

    // Affected client (phases 4/5)
    "affectedClient.prompt": "¿Hay otras comunidades afectadas?",
    "affectedClient.inputPlaceholder": "Nombre de la comunidad",
    "affectedClient.addButton": "Agregar comunidad afectada",
    "affectedClient.list": "Comunidades afectadas:",
    "affectedClient.success": "Comunidad agregada al ticket",
    "affectedClient.alreadyAdded": "Esta comunidad ya estaba en la lista",

    // Remove from history (phase 5)
    "report.removeFromHistory": "Quitar de mi historial",
    "report.removeConfirm.title": "¿Quitar del historial?",
    "report.removeConfirm.body":
      "Este ticket ya fue resuelto. ¿Querés quitarlo de tu historial? El ticket sigue vivo para otras comunidades.",
    "report.removeConfirm.cancel": "Cancelar",
    "report.removeConfirm.confirm": "Sí, quitar",
    "report.removeSuccess": "Listo, ya no aparece en tu historial",
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
    "result.viewHelpCenter": "View in Help Center",
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
    "result.resolved.hint":
      "Try refreshing your session or updating the app. If the problem persists, please report it again.",

    // bug_known result
    "result.known.title": "We're already working on this",
    "result.known.hint":
      "Your report was added to the existing ticket. We'll notify you when it's resolved.",

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
    "platform.kiosk": "Kiosk",
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
    "result.contactCxFallback":
      "Reach out to your Account Manager/Owner through the official Humand channels.",

    // Severity
    "severity.alta": "High impact",
    "severity.media": "Medium impact",
    "severity.baja": "Low impact",

    // Demo mode
    "demo.badge": "DEMO",
    "demo.reportingAs": "Demoing as",

    // Affected client (phases 4/5)
    "affectedClient.prompt": "Are other communities affected?",
    "affectedClient.inputPlaceholder": "Community name",
    "affectedClient.addButton": "Add affected community",
    "affectedClient.list": "Affected communities:",
    "affectedClient.success": "Community added to ticket",
    "affectedClient.alreadyAdded": "This community was already listed",

    // Remove from history (phase 5)
    "report.removeFromHistory": "Remove from my history",
    "report.removeConfirm.title": "Remove from history?",
    "report.removeConfirm.body":
      "This ticket is resolved. Remove it from your history? It stays active for other communities.",
    "report.removeConfirm.cancel": "Cancel",
    "report.removeConfirm.confirm": "Yes, remove",
    "report.removeSuccess": "Done, it no longer appears in your history",
  },

  pt: {
    // Trigger button
    "trigger.label": "HuReport",

    // Header
    "header.title": "HuReport AI",
    "header.close": "Fechar",
    "lang.toggle": "ES",

    // Tabs
    "tab.report": "Reportar",
    "tab.myReports": "Meus Relatórios",

    // Report form — sections
    "form.section.client": "Informações do cliente",
    "form.section.issue": "Detalhes do problema",
    "form.section.evidence": "Evidências",

    // Form fields
    "form.community.label": "Comunidade",
    "form.community.placeholder": "Buscar comunidade...",
    "form.community.notFound": "Nenhum resultado encontrado",
    "form.community.instance": "Instância",
    "form.community.country": "País",
    "form.community.cxOwner": "CX Owner",

    "form.module.label": "Módulo",
    "form.module.placeholder": "Selecione um módulo",

    "form.platform.label": "Plataforma",

    "form.whatHappened.label": "O que aconteceu?",
    "form.whatHappened.placeholder": "Descreva o problema em detalhes...",

    "form.whatExpected.label": "O que você esperava que acontecesse?",
    "form.whatExpected.placeholder": "Comportamento esperado...",

    "form.blocking.label": "Isso bloqueia uma ação crítica?",
    "form.blocking.yes": "Sim",
    "form.blocking.no": "Não",

    "form.usersAffected.label": "Quantos usuários afetados?",
    "form.usersAffected.one": "Apenas 1",
    "form.usersAffected.many": "Mais de 1",

    "form.evidence.label": "Evidências (imagens/vídeos)",
    "form.evidence.hint": "Arraste arquivos ou clique para selecionar",
    "form.evidence.required": "* Obrigatório",

    "form.url.label": "URL onde o problema ocorre",
    "form.url.placeholder": "https://...",

    "form.email.label": "Email do usuário afetado",
    "form.email.placeholder": "usuario@empresa.com",

    "form.submit": "Analisar e Reportar",
    "form.submit.loading": "IA analisando...",

    // AI Result
    "result.ticketCreated": "Criamos o relatório automaticamente.",
    "result.ticketNumber": "Relatório",
    "result.reportAnother": "Reportar outro problema",
    "result.submitFeedback": "Enviar como sugestão?",
    "result.yes": "Sim",
    "result.no": "Não",
    "result.viewDocs": "Ver documentação",
    "result.viewHelpCenter": "Ver no Help Center",
    "result.submitAdditional": "Enviar informação adicional",
    "result.additionalPlaceholder": "Responda aqui...",

    // Duplicate result
    "result.duplicate.title": "Encontramos um problema similar já reportado",
    "result.duplicate.report": "Relatório",
    "result.duplicate.reportedAgo": "Reportado",
    "result.duplicate.sameIssue": "É o meu caso",
    "result.duplicate.differentIssue": "Não, é diferente",

    // Classification badges
    "badge.bug_confirmed": "Problema confirmado",
    "badge.configuration_error": "Ajuste de configuração necessário",
    "badge.cache_browser": "Atualize sua sessão",
    "badge.expected_behavior": "Funciona como projetado",
    "badge.needs_more_info": "Precisamos de mais detalhes",
    "badge.feature_request": "Sugestão registrada",
    "badge.bug_known": "Já identificamos",
    "badge.bug_already_resolved": "Resolvido recentemente",

    // bug_already_resolved result
    "result.resolved.title": "Este problema foi resolvido recentemente",
    "result.resolved.hint": "Tente atualizar sua sessão ou o app.",

    // bug_known result
    "result.known.title": "Já estamos trabalhando nisso",
    "result.known.hint": "Seu relatório foi registrado no ticket existente.",

    // My Reports
    "reports.empty": "Nenhum relatório ainda.",
    "reports.ticket": "Relatório",
    "reports.date": "Data",
    "reports.module": "Módulo",
    "reports.summary": "Resumo",
    "reports.status": "Status",
    "reports.expand": "Ver detalhes",
    "reports.collapse": "Fechar",
    "reports.addInfo": "Adicionar informação",
    "reports.addInfo.placeholder": "Adicione mais detalhes...",
    "reports.addInfo.submit": "Enviar",
    "reports.addInfo.cancel": "Cancelar",
    "reports.addInfo.sent": "Informação enviada.",

    // Status badges
    "status.reported": "Reportado",
    "status.under_review": "Em revisão",
    "status.developing_fix": "Desenvolvendo solução",
    "status.resolved": "Resolvido",

    // Modules
    "module.users": "Usuários",
    "module.segmentation": "Segmentação",
    "module.work_schedules": "Horários de trabalho",
    "module.attendance": "Controle de presença",
    "module.news": "Notícias",
    "module.knowledge": "Bibliotecas de conhecimento",
    "module.forms": "Formulários e Procedimentos",
    "module.surveys": "Pesquisas",
    "module.people_experience": "People Experience",
    "module.learning": "Aprendizado",
    "module.service_management": "Gestão de serviços",
    "module.onboarding": "Onboarding",
    "module.files": "Arquivos",
    "module.personal_documents": "Documentos pessoais",
    "module.quick_access": "Acesso rápido",
    "module.time_off": "Férias e licenças",
    "module.performance": "Avaliação de desempenho",
    "module.goals": "Objetivos",
    "module.communication": "Comunicação",
    "module.acknowledgements": "Reconhecimentos",
    "module.groups": "Grupos",
    "module.feed": "Feed",
    "module.chats": "Chats",
    "module.events": "Eventos",
    "module.org_chart": "Organograma",
    "module.profile": "Perfil",
    "module.marketplace": "Marketplace",
    "module.integrations": "Integrações",
    "module.notifications": "Notificações",
    "module.widgets": "Widgets",
    "module.workflows": "Workflows",
    "module.general": "Geral",

    // Platforms
    "platform.admin_web": "Admin Web",
    "platform.web_app": "Web App",
    "platform.mobile_app": "App Mobile",
    "platform.kiosk": "Kiosk",
    "platform.api": "API",

    // Community Gate
    "gate.title": "Bem-vindo ao HuReport AI",
    "gate.welcome": "Bem-vindo ao HuReport AI",
    "gate.subtitle": "Informe sua comunidade para começar.",
    "gate.communityLabel": "Nome da sua comunidade",
    "gate.placeholder": "Ex: Minha Empresa",
    "gate.continue": "Continuar",
    "gate.reportingFor": "Reportando para:",
    "gate.privacyNote": "Essa informação é usada apenas para identificar seu relatório.",
    "header.changeCommunity": "Mudar comunidade",

    // CX routing
    "result.contactCx": "Entre em contato com seu CX Manager",
    "result.contactCxName": "Entre em contato com",
    "result.contactCxFallback":
      "Entre em contato com seu Account Manager pelos canais oficiais da Humand.",

    // Severity
    "severity.alta": "Alto impacto",
    "severity.media": "Impacto médio",
    "severity.baja": "Baixo impacto",

    // Demo mode
    "demo.badge": "DEMO",
    "demo.reportingAs": "Demonstrando como",

    // Affected client (phases 4/5)
    "affectedClient.prompt": "Há outras comunidades afetadas?",
    "affectedClient.inputPlaceholder": "Nome da comunidade",
    "affectedClient.addButton": "Adicionar comunidade afetada",
    "affectedClient.list": "Comunidades afetadas:",
    "affectedClient.success": "Comunidade adicionada ao ticket",
    "affectedClient.alreadyAdded": "Esta comunidade já estava na lista",

    // Remove from history (phase 5)
    "report.removeFromHistory": "Remover do meu histórico",
    "report.removeConfirm.title": "Remover do histórico?",
    "report.removeConfirm.body":
      "Este ticket foi resolvido. Se removê-lo, deixa de aparecer no seu histórico.",
    "report.removeConfirm.cancel": "Cancelar",
    "report.removeConfirm.confirm": "Sim, remover",
    "report.removeSuccess": "Pronto, saiu do seu histórico",
  },

  fr: {
    // Trigger button
    "trigger.label": "HuReport",

    // Header
    "header.title": "HuReport AI",
    "header.close": "Fermer",
    "lang.toggle": "ES",

    // Tabs
    "tab.report": "Signaler",
    "tab.myReports": "Mes signalements",

    // Report form — sections
    "form.section.client": "Informations client",
    "form.section.issue": "Détails du problème",
    "form.section.evidence": "Preuves",

    // Form fields
    "form.community.label": "Communauté",
    "form.community.placeholder": "Rechercher une communauté...",
    "form.community.notFound": "Aucun résultat trouvé",
    "form.community.instance": "Instance",
    "form.community.country": "Pays",
    "form.community.cxOwner": "CX Owner",

    "form.module.label": "Module",
    "form.module.placeholder": "Sélectionner un module",

    "form.platform.label": "Plateforme",

    "form.whatHappened.label": "Que s'est-il passé ?",
    "form.whatHappened.placeholder": "Décrivez le problème en détail...",

    "form.whatExpected.label": "Qu'attendiez-vous ?",
    "form.whatExpected.placeholder": "Comportement attendu...",

    "form.blocking.label": "Cela bloque-t-il une action critique ?",
    "form.blocking.yes": "Oui",
    "form.blocking.no": "Non",

    "form.usersAffected.label": "Combien d'utilisateurs sont affectés ?",
    "form.usersAffected.one": "Seulement 1",
    "form.usersAffected.many": "Plus de 1",

    "form.evidence.label": "Preuves (images/vidéos)",
    "form.evidence.hint": "Glissez des fichiers ou cliquez pour sélectionner",
    "form.evidence.required": "* Obligatoire",

    "form.url.label": "URL où le problème se produit",
    "form.url.placeholder": "https://...",

    "form.email.label": "Email de l'utilisateur affecté",
    "form.email.placeholder": "utilisateur@entreprise.com",

    "form.submit": "Analyser et Signaler",
    "form.submit.loading": "L'IA analyse...",

    // AI Result
    "result.ticketCreated": "Nous avons créé le rapport automatiquement.",
    "result.ticketNumber": "Rapport",
    "result.reportAnother": "Signaler un autre problème",
    "result.submitFeedback": "Envoyer comme suggestion ?",
    "result.yes": "Oui",
    "result.no": "Non",
    "result.viewDocs": "Voir la documentation",
    "result.viewHelpCenter": "Voir dans le Help Center",
    "result.submitAdditional": "Envoyer des informations supplémentaires",
    "result.additionalPlaceholder": "Répondez ici...",

    // Duplicate result
    "result.duplicate.title": "Nous avons trouvé un problème similaire déjà signalé",
    "result.duplicate.report": "Rapport",
    "result.duplicate.reportedAgo": "Signalé",
    "result.duplicate.sameIssue": "C'est mon cas",
    "result.duplicate.differentIssue": "Non, c'est différent",

    // Classification badges
    "badge.bug_confirmed": "Problème confirmé",
    "badge.configuration_error": "Ajustement de configuration nécessaire",
    "badge.cache_browser": "Actualisez votre session",
    "badge.expected_behavior": "Fonctionne comme prévu",
    "badge.needs_more_info": "Il nous faut plus de détails",
    "badge.feature_request": "Suggestion enregistrée",
    "badge.bug_known": "Déjà identifié",
    "badge.bug_already_resolved": "Résolu récemment",

    // bug_already_resolved result
    "result.resolved.title": "Ce problème a été résolu récemment",
    "result.resolved.hint": "Essayez de rafraîchir votre session.",

    // bug_known result
    "result.known.title": "Nous y travaillons déjà",
    "result.known.hint": "Votre signalement a été ajouté au ticket existant.",

    // My Reports
    "reports.empty": "Aucun rapport pour l'instant.",
    "reports.ticket": "Rapport",
    "reports.date": "Date",
    "reports.module": "Module",
    "reports.summary": "Résumé",
    "reports.status": "Statut",
    "reports.expand": "Voir les détails",
    "reports.collapse": "Fermer",
    "reports.addInfo": "Ajouter des informations",
    "reports.addInfo.placeholder": "Ajoutez plus de détails...",
    "reports.addInfo.submit": "Envoyer",
    "reports.addInfo.cancel": "Annuler",
    "reports.addInfo.sent": "Informations envoyées.",

    // Status badges
    "status.reported": "Signalé",
    "status.under_review": "En révision",
    "status.developing_fix": "Correction en cours",
    "status.resolved": "Résolu",

    // Modules
    "module.users": "Utilisateurs",
    "module.segmentation": "Segmentation",
    "module.work_schedules": "Horaires de travail",
    "module.attendance": "Contrôle de présence",
    "module.news": "Actualités",
    "module.knowledge": "Bibliothèques de connaissances",
    "module.forms": "Formulaires et procédures",
    "module.surveys": "Sondages",
    "module.people_experience": "People Experience",
    "module.learning": "Formation",
    "module.service_management": "Gestion des services",
    "module.onboarding": "Onboarding",
    "module.files": "Fichiers",
    "module.personal_documents": "Documents personnels",
    "module.quick_access": "Accès rapide",
    "module.time_off": "Congés et absences",
    "module.performance": "Évaluation des performances",
    "module.goals": "Objectifs",
    "module.communication": "Communication",
    "module.acknowledgements": "Reconnaissances",
    "module.groups": "Groupes",
    "module.feed": "Fil d'actualité",
    "module.chats": "Chats",
    "module.events": "Événements",
    "module.org_chart": "Organigramme",
    "module.profile": "Profil",
    "module.marketplace": "Marketplace",
    "module.integrations": "Intégrations",
    "module.notifications": "Notifications",
    "module.widgets": "Widgets",
    "module.workflows": "Workflows",
    "module.general": "Général",

    // Platforms
    "platform.admin_web": "Admin Web",
    "platform.web_app": "Web App",
    "platform.mobile_app": "App Mobile",
    "platform.kiosk": "Kiosk",
    "platform.api": "API",

    // Community Gate
    "gate.title": "Bienvenue sur HuReport AI",
    "gate.welcome": "Bienvenue sur HuReport AI",
    "gate.subtitle": "Indiquez votre communauté pour commencer.",
    "gate.communityLabel": "Nom de votre communauté",
    "gate.placeholder": "Ex : Mon Entreprise",
    "gate.continue": "Continuer",
    "gate.reportingFor": "Signalement pour :",
    "gate.privacyNote": "Cette information est uniquement utilisée pour identifier votre rapport.",
    "header.changeCommunity": "Changer de communauté",

    // CX routing
    "result.contactCx": "Contactez votre CX Manager",
    "result.contactCxName": "Contactez",
    "result.contactCxFallback":
      "Contactez votre Account Manager via les canaux officiels de Humand.",

    // Severity
    "severity.alta": "Impact élevé",
    "severity.media": "Impact moyen",
    "severity.baja": "Impact faible",

    // Demo mode
    "demo.badge": "DÉMO",
    "demo.reportingAs": "Démonstration en tant que",

    // Affected client (phases 4/5)
    "affectedClient.prompt": "D'autres communautés sont-elles concernées ?",
    "affectedClient.inputPlaceholder": "Nom de la communauté",
    "affectedClient.addButton": "Ajouter une communauté concernée",
    "affectedClient.list": "Communautés concernées :",
    "affectedClient.success": "Communauté ajoutée au ticket",
    "affectedClient.alreadyAdded": "Cette communauté était déjà listée",

    // Remove from history (phase 5)
    "report.removeFromHistory": "Retirer de mon historique",
    "report.removeConfirm.title": "Retirer de l'historique ?",
    "report.removeConfirm.body":
      "Ce ticket est résolu. Si vous le retirez, il n'apparaîtra plus dans votre historique.",
    "report.removeConfirm.cancel": "Annuler",
    "report.removeConfirm.confirm": "Oui, retirer",
    "report.removeSuccess": "C'est fait, il n'apparaît plus dans votre historique",
  },
} as const;

type TranslationKey = keyof (typeof TRANSLATIONS)["es"];

export function t(key: TranslationKey, lang: Lang): string {
  const langMap = TRANSLATIONS[lang] ?? TRANSLATIONS["en"];
  return (
    (langMap as Record<string, string>)[key] ??
    (TRANSLATIONS["en"] as Record<string, string>)[key] ??
    key
  );
}
