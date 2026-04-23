import type { Classification, FriendlyStatus } from "./mappings";

// ─── Communities ────────────────────────────────────────────────────────────

export interface MockCommunity {
  id: string;
  name: string;
  instanceId: string;
  country: string;
  cxOwner: string;
}

export const MOCK_COMMUNITIES: MockCommunity[] = [
  {
    id: "c1",
    name: "Banco Galicia",
    instanceId: "galicia-ar",
    country: "Argentina",
    cxOwner: "Sofía Martínez",
  },
  {
    id: "c2",
    name: "Mercado Libre",
    instanceId: "meli-ar",
    country: "Argentina",
    cxOwner: "Lucas Pérez",
  },
  {
    id: "c3",
    name: "Rappi Colombia",
    instanceId: "rappi-co",
    country: "Colombia",
    cxOwner: "Valentina Gómez",
  },
  {
    id: "c4",
    name: "Falabella Chile",
    instanceId: "falabella-cl",
    country: "Chile",
    cxOwner: "Andrés Torres",
  },
  {
    id: "c5",
    name: "Grupo Bimbo México",
    instanceId: "bimbo-mx",
    country: "México",
    cxOwner: "Camila Rodríguez",
  },
];

// ─── Tickets ─────────────────────────────────────────────────────────────────

export interface MockTicket {
  id: string;
  ticketNumber: number; // Display as "Ticket-1" — NEVER show HUREP-XX
  jiraKey: string; // internal only, never expose in UI
  communityId: string;
  date: string;
  module: string;
  summary: string;
  description: string;
  classification: Classification;
  status: FriendlyStatus;
  platforms: string[];
  isBlocking: boolean;
  usersAffected: "1" | "many";
  evidenceUrls: string[];
  url?: string;
  affectedUserEmail?: string;
}

export const MOCK_TICKETS: MockTicket[] = [
  {
    id: "t1",
    ticketNumber: 1,
    jiraKey: "HUREP-42",
    communityId: "c1",
    date: "2026-04-18",
    module: "attendance",
    summary: "Los empleados no pueden registrar asistencia desde móvil",
    description:
      "Al intentar marcar asistencia desde la app móvil, la pantalla se congela después de presionar 'Registrar'. El problema ocurre en iOS 17 y Android 14. Afecta a todos los empleados del turno mañana.",
    classification: "bug_confirmed",
    status: "developing_fix",
    platforms: ["mobile_app"],
    isBlocking: true,
    usersAffected: "many",
    evidenceUrls: [],
    url: "https://app.humand.com/attendance",
    affectedUserEmail: "juan.gomez@galicia.com.ar",
  },
  {
    id: "t2",
    ticketNumber: 2,
    jiraKey: "HUREP-43",
    communityId: "c1",
    date: "2026-04-20",
    module: "news",
    summary: "Las noticias no se visualizan en la sección Feed",
    description:
      "Las noticias publicadas en el módulo de Noticias no aparecen en el Feed de los empleados. El problema comenzó luego de la actualización del viernes.",
    classification: "cache_browser",
    status: "resolved",
    platforms: ["web_app", "admin_web"],
    isBlocking: false,
    usersAffected: "many",
    evidenceUrls: [],
  },
  {
    id: "t3",
    ticketNumber: 3,
    jiraKey: "HUREP-44",
    communityId: "c1",
    date: "2026-04-21",
    module: "time_off",
    summary: "Error al aprobar solicitudes de vacaciones",
    description:
      "El manager recibe un error 500 al intentar aprobar solicitudes de vacaciones desde el panel de administración. Solo pasa con solicitudes de más de 10 días.",
    classification: "bug_confirmed",
    status: "under_review",
    platforms: ["admin_web"],
    isBlocking: false,
    usersAffected: "1",
    evidenceUrls: [],
    url: "https://admin.humand.com/time-off/approvals",
  },
  {
    id: "t4",
    ticketNumber: 4,
    jiraKey: "HUREP-45",
    communityId: "c1",
    date: "2026-04-22",
    module: "onboarding",
    summary: "Los nuevos empleados no reciben email de bienvenida",
    description:
      "Al crear un nuevo empleado en el sistema, el email de bienvenida no llega. Verificamos que el correo es correcto y no está en spam.",
    classification: "configuration_error",
    status: "reported",
    platforms: ["admin_web"],
    isBlocking: false,
    usersAffected: "many",
    evidenceUrls: [],
  },
];

// ─── AI Classification Results ───────────────────────────────────────────────

export interface MockAiResult {
  classification: Classification;
  explanation: string;
  ticketNumber?: number;
  fixSteps?: string[];
  questions?: string[];
  docUrl?: string;
}

export const MOCK_AI_RESULTS: Record<Classification, MockAiResult> = {
  bug_confirmed: {
    classification: "bug_confirmed",
    explanation:
      "Analizamos el problema que describiste y confirmamos que es un bug en la plataforma. Lo escalamos de inmediato al equipo técnico con toda la información que proporcionaste.",
    ticketNumber: 5,
  },
  configuration_error: {
    classification: "configuration_error",
    explanation:
      "El problema que describís parece ser un error de configuración que podés resolver desde el panel de administración. Seguí estos pasos:",
    fixSteps: [
      "Ingresá a Configuración → Integraciones → Email.",
      "Verificá que el dominio de envío esté verificado (debe aparecer en verde).",
      "Chequeá que la plantilla de bienvenida esté activa.",
      "Guardá los cambios y probá invitar a un nuevo usuario de prueba.",
    ],
  },
  cache_browser: {
    classification: "cache_browser",
    explanation:
      "Este problema suele deberse a caché desactualizada o datos del navegador. Probá los siguientes pasos antes de escalar:",
    fixSteps: [
      "Presioná Ctrl+Shift+R (Windows) o Cmd+Shift+R (Mac) para recargar sin caché.",
      "Abrí el sitio en una ventana de incógnito y verificá si el problema persiste.",
      "Limpiá las cookies y el caché del navegador desde Configuración.",
      "Si el problema sigue, intentá con otro navegador.",
    ],
  },
  expected_behavior: {
    classification: "expected_behavior",
    explanation:
      "Revisamos el comportamiento que describiste y en realidad funciona como fue diseñado. Te dejamos el link a la documentación para más detalles.",
    docUrl: "https://help.humand.com/docs",
  },
  needs_more_info: {
    classification: "needs_more_info",
    explanation:
      "Para poder clasificar correctamente este reporte necesitamos un poco más de información. ¿Podés responder las siguientes preguntas?",
    questions: [
      "¿Desde cuándo ocurre el problema exactamente?",
      "¿El problema ocurre con todos los usuarios o solo con algunos?",
      "¿Hicieron algún cambio de configuración en las últimas 48 horas?",
      "¿El problema ocurre en todos los dispositivos o en uno específico?",
    ],
  },
  feature_request: {
    classification: "feature_request",
    explanation: "Registramos tu sugerencia. El equipo de Producto la revisará en el próximo ciclo de priorización.",
  },
  bug_known: {
    classification: "bug_known",
    explanation: "Ya identificamos este inconveniente y estamos trabajando en la solución.",
  },
  bug_already_resolved: {
    classification: "bug_already_resolved",
    explanation: "Este inconveniente fue resuelto recientemente. Probá refrescar tu sesión o actualizar la app.",
  },
};
