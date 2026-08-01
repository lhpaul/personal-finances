/**
 * Sole manifest source for the `mobile` mockup.
 * Loaded with a classic <script> tag so the viewer works from file:// and HTTP.
 * Framework: ~/Git/Cerebro/LH/40 - Conocimiento/Topics/HTML Mockup Framework.md
 *
 * Rules:
 *  - `navigation` / `screens[]` hold REAL destinations only.
 *  - Visual variants (empty, error, filled, open sheet…) are `screens[].states`.
 *  - Exactly one state per screen sets `initial: true`.
 *  - `mvp: false` marks screens intentionally OUT of the development MVP
 *    (budgets / planning / benefits). They stay in the mockups on purpose.
 */
window.__MOCKUP_MANIFEST__ = {
  $status: 'complete',
  $version: '1.0.0',
  product: 'Finanzas',
  frame: 'phone',
  default_screen: 'home',
  synced_at: '2026-08-01',
  figma_url: 'https://www.figma.com/design/1hvQP0Tu1ueQAxRWYFDIUa/Personal-Finance-App-MVP',

  navigation: [
    {
      label: 'Auth',
      items: [
        { screen_id: 'auth', label: '(auth)/sign-in' },
        { screen_id: 'verify-code', label: '(auth)/verify-code' },
      ],
    },
    {
      label: 'Onboarding',
      items: [
        { screen_id: 'onboarding-intro', label: '(onboarding)/intro' },
        { screen_id: 'onboarding-value', label: '(onboarding)/value' },
        {
          screen_id: 'connect-bank-intro',
          label: '(onboarding)/connect-bank',
          items: [
            { screen_id: 'bank-picker', label: 'bank-picker' },
            { screen_id: 'bank-credentials', label: 'bank-credentials' },
            { screen_id: 'bank-syncing', label: 'bank-syncing' },
            { screen_id: 'bank-connected', label: 'bank-connected' },
          ],
        },
        {
          screen_id: 'notifications-intro',
          label: '(onboarding)/notifications',
          items: [{ screen_id: 'notifications-schedule', label: 'schedule' }],
        },
        { screen_id: 'onboarding-ready', label: '(onboarding)/ready' },
      ],
    },
    {
      label: 'Categorización',
      items: [
        { screen_id: 'stage-intro', label: 'categorize/intro' },
        {
          screen_id: 'categorize',
          label: 'categorize',
          items: [{ screen_id: 'merchant-edit', label: 'merchant/[id]' }],
        },
        { screen_id: 'categorize-complete', label: 'categorize/complete' },
      ],
    },
    {
      label: 'App',
      items: [
        { screen_id: 'home', label: '(tabs)/home' },
        {
          screen_id: 'transactions',
          label: '(tabs)/transactions',
          items: [{ screen_id: 'transaction-detail', label: 'transactions/[id]' }],
        },
        { screen_id: 'dashboard', label: 'dashboard' },
      ],
    },
    {
      label: 'Presupuestos · fuera del MVP',
      items: [
        {
          screen_id: 'budgets',
          label: '(tabs)/budgets',
          items: [{ screen_id: 'budget-create', label: 'budgets/new' }],
        },
        {
          screen_id: 'planning',
          label: 'planning',
          items: [{ screen_id: 'planning-life', label: 'planning/life' }],
        },
      ],
    },
    {
      label: 'Beneficios · fuera del MVP',
      items: [
        {
          screen_id: 'benefits',
          label: '(tabs)/benefits',
          items: [{ screen_id: 'benefit-category', label: 'benefits/[category]' }],
        },
      ],
    },
    {
      label: 'Configuración',
      items: [
        {
          screen_id: 'settings',
          label: 'settings',
          items: [
            { screen_id: 'settings-account', label: 'account' },
            { screen_id: 'settings-banks', label: 'banks' },
            { screen_id: 'bank-review', label: 'banks/[id]' },
            { screen_id: 'settings-notifications', label: 'notifications' },
            { screen_id: 'settings-categories', label: 'categories' },
            { screen_id: 'settings-about', label: 'about' },
          ],
        },
      ],
    },
    {
      label: 'Design system',
      items: [
        { screen_id: 'ds-colors', label: 'colors' },
        { screen_id: 'ds-typography', label: 'typography' },
        { screen_id: 'ds-components', label: 'components' },
      ],
    },
  ],

  screens: [
    // ── Auth ───────────────────────────────────────────────────────────────
    {
      screen_id: 'auth',
      route: '/(auth)/sign-in',
      title: 'Ingreso · email + código',
      kind: 'html',
      state_label: 'Estados del formulario',
      states: [
        { state_id: 'empty', label: 'Inicial · email vacío', initial: true },
        { state_id: 'email-typed', label: 'Email escrito · CTA activo' },
      ],
    },
    {
      screen_id: 'verify-code',
      route: '/(auth)/verify-code',
      title: 'Verificar código de 6 caracteres',
      kind: 'html',
      state_label: 'Estados del código',
      states: [
        { state_id: 'empty', label: 'Inicial · contador 1:00', initial: true },
        { state_id: 'filled', label: 'Código completo' },
        { state_id: 'invalid', label: 'Código inválido' },
        { state_id: 'resend-ready', label: 'Reenvío habilitado' },
      ],
    },

    // ── Onboarding ─────────────────────────────────────────────────────────
    {
      screen_id: 'onboarding-intro',
      route: '/(onboarding)/intro',
      title: 'Bienvenida',
      kind: 'html',
    },
    {
      screen_id: 'onboarding-value',
      route: '/(onboarding)/value',
      title: 'Propuesta de valor',
      kind: 'html',
      state_label: 'Pasos del carrusel',
      states: [
        { state_id: 'step-1', label: '1 · Mejoras simples', initial: true, title: 'Valor · mejoras simples' },
        { state_id: 'step-2', label: '2 · Privacidad', title: 'Valor · privacidad' },
        { state_id: 'step-3', label: '3 · A tu ritmo', title: 'Valor · a tu ritmo' },
      ],
    },
    {
      screen_id: 'connect-bank-intro',
      route: '/(onboarding)/connect-bank',
      title: 'Desafío 1 · Conecta tu banco',
      kind: 'html',
      state_label: 'Explicación de seguridad',
      states: [
        { state_id: 'default', label: 'Inicial', initial: true },
        { state_id: 'how-it-works', label: 'Acordeón «¿Cómo funciona?» abierto' },
      ],
    },
    {
      screen_id: 'bank-picker',
      route: '/(onboarding)/bank-picker',
      title: 'Seleccionar banco',
      kind: 'html',
      state_label: 'Estados del listado',
      states: [
        { state_id: 'list', label: 'Listado completo', initial: true },
        { state_id: 'search', label: 'Búsqueda con resultados' },
        { state_id: 'no-results', label: 'Sin resultados' },
      ],
    },
    {
      screen_id: 'bank-credentials',
      route: '/(onboarding)/bank-credentials',
      title: 'Credenciales del banco',
      kind: 'html',
      state_label: 'Estados del formulario',
      states: [
        { state_id: 'empty', label: 'Inicial · vacío', initial: true },
        { state_id: 'filled', label: 'Completo · CTA activo' },
        { state_id: 'error', label: 'Credenciales rechazadas' },
        { state_id: 'rut-locked', label: 'Segundo banco · RUT bloqueado' },
      ],
    },
    {
      screen_id: 'bank-syncing',
      route: '/(onboarding)/bank-syncing',
      title: 'Sincronizando con el banco',
      kind: 'html',
      state_label: 'Pasos del scraper',
      states: [
        { state_id: 'login', label: 'Iniciando sesión', initial: true },
        { state_id: 'products', label: 'Leyendo productos' },
        { state_id: 'transactions', label: 'Descargando movimientos' },
        { state_id: 'error', label: 'Error de conexión' },
      ],
    },
    {
      screen_id: 'bank-connected',
      route: '/(onboarding)/bank-connected',
      title: 'Banco conectado',
      kind: 'html',
      state_label: 'Bancos conectados',
      states: [
        { state_id: 'single', label: 'Un banco', initial: true },
        { state_id: 'multiple', label: 'Dos bancos' },
      ],
    },
    {
      screen_id: 'notifications-intro',
      route: '/(onboarding)/notifications',
      title: 'Desafío 2 · Notificaciones',
      kind: 'html',
      state_label: 'Permiso del sistema',
      states: [
        { state_id: 'default', label: 'Inicial', initial: true },
        { state_id: 'denied', label: 'Permiso denegado' },
      ],
    },
    {
      screen_id: 'notifications-schedule',
      route: '/(onboarding)/notifications/schedule',
      title: 'Horario de recordatorios',
      kind: 'html',
      state_label: 'Pasos de configuración',
      states: [
        { state_id: 'time', label: 'Elegir hora', initial: true },
        { state_id: 'custom-time', label: 'Hora personalizada' },
        { state_id: 'days', label: 'Elegir días' },
      ],
    },
    {
      screen_id: 'onboarding-ready',
      route: '/(onboarding)/ready',
      title: '¡Todo listo!',
      kind: 'html',
    },

    // ── Categorización ─────────────────────────────────────────────────────
    {
      screen_id: 'stage-intro',
      route: '/categorize/intro',
      title: 'Etapa 1 · Categorización inteligente',
      kind: 'html',
    },
    {
      screen_id: 'categorize',
      route: '/categorize',
      title: 'Categorizar transacción',
      kind: 'html',
      state_label: 'Estados de la tarjeta',
      states: [
        { state_id: 'expense', label: 'Gasto · con sugerencia', initial: true },
        { state_id: 'income', label: 'Ingreso' },
        { state_id: 'not-sure', label: '¿No estás seguro? abierto' },
        { state_id: 'advanced', label: 'Opciones avanzadas · inclusión parcial' },
        { state_id: 'exclude-sheet', label: 'Sheet «Excluir del análisis»' },
      ],
    },
    {
      screen_id: 'merchant-edit',
      route: '/categorize/merchant/[merchantId]',
      title: 'Configurar comercio',
      kind: 'html',
      state_label: 'Estados del editor',
      states: [
        { state_id: 'default', label: 'Inicial', initial: true },
        { state_id: 'suggestions', label: 'Sugerencias de la comunidad' },
        { state_id: 'category-picker', label: 'Selector de categoría' },
      ],
    },
    {
      screen_id: 'categorize-complete',
      route: '/categorize/complete',
      title: 'Categorización completada',
      kind: 'html',
      state_label: 'Cierre de sesión de trabajo',
      states: [
        { state_id: 'partial', label: 'Quedan pendientes', initial: true },
        { state_id: 'done', label: 'Todo categorizado' },
      ],
    },

    // ── App ────────────────────────────────────────────────────────────────
    {
      screen_id: 'home',
      route: '/(tabs)/home',
      nav_screen: 'home',
      title: 'Inicio',
      kind: 'html',
      state_label: 'Estados del inicio',
      states: [
        { state_id: 'pending', label: 'Con transacciones por categorizar', initial: true },
        { state_id: 'all-clear', label: 'Todo al día' },
        { state_id: 'empty', label: 'Sin datos · primer sync' },
        { state_id: 'sync-error', label: 'Error de sincronización' },
      ],
    },
    {
      screen_id: 'transactions',
      route: '/(tabs)/transactions',
      title: 'Transacciones',
      kind: 'html',
      state_label: 'Estados del listado',
      states: [
        { state_id: 'list', label: 'Listado agrupado por mes', initial: true },
        { state_id: 'search', label: 'Búsqueda activa' },
        { state_id: 'filters', label: 'Panel de filtros' },
        { state_id: 'empty', label: 'Sin resultados' },
      ],
    },
    {
      screen_id: 'transaction-detail',
      route: '/transactions/[transactionId]',
      title: 'Detalle de transacción',
      kind: 'html',
      state_label: 'Estados del detalle',
      states: [
        { state_id: 'categorized', label: 'Categorizada', initial: true },
        { state_id: 'uncategorized', label: 'Sin categorizar' },
        { state_id: 'excluded', label: 'Excluida del análisis' },
        { state_id: 'exclude-sheet', label: 'Sheet «Excluir del análisis»' },
      ],
    },
    {
      screen_id: 'dashboard',
      route: '/dashboard',
      title: 'Dashboard',
      kind: 'html',
      state_label: 'Período',
      states: [
        { state_id: 'month', label: 'Mensual', initial: true },
        { state_id: 'week', label: 'Semanal' },
      ],
    },

    // ── Presupuestos · fuera del MVP de desarrollo ──────────────────────────
    {
      screen_id: 'budgets',
      route: '/(tabs)/budgets',
      title: 'Presupuestos',
      kind: 'html',
      mvp: false,
      state_label: 'Estados de presupuestos',
      states: [
        { state_id: 'empty', label: 'Sin presupuestos', initial: true },
        { state_id: 'active', label: 'Con presupuestos activos' },
      ],
    },
    {
      screen_id: 'budget-create',
      route: '/budgets/new',
      title: 'Crear presupuesto',
      kind: 'html',
      mvp: false,
      state_label: 'Estados del formulario',
      states: [
        { state_id: 'empty', label: 'Inicial', initial: true },
        { state_id: 'filled', label: 'Categoría y monto elegidos' },
      ],
    },
    {
      screen_id: 'planning',
      route: '/planning',
      title: 'Planificación',
      kind: 'html',
      mvp: false,
      state_label: 'Pestañas',
      states: [
        { state_id: 'projections', label: 'Proyecciones', initial: true },
        { state_id: 'goals', label: 'Metas' },
      ],
    },
    {
      screen_id: 'planning-life',
      route: '/planning/life',
      title: 'Planificación de vida',
      kind: 'html',
      mvp: false,
      state_label: 'Pasos del asistente',
      states: [
        { state_id: 'step-1', label: '1 · Estilo de vida deseado', initial: true },
        { state_id: 'step-2', label: '2 · Realidad actual' },
      ],
    },

    // ── Beneficios · fuera del MVP de desarrollo ────────────────────────────
    {
      screen_id: 'benefits',
      route: '/(tabs)/benefits',
      title: 'Beneficios',
      kind: 'html',
      mvp: false,
      state_label: 'Pestañas',
      states: [
        { state_id: 'discounts', label: 'Descuentos', initial: true },
        { state_id: 'premium', label: 'Premium' },
      ],
    },
    {
      screen_id: 'benefit-category',
      route: '/benefits/[categoryId]',
      title: 'Beneficios por categoría',
      kind: 'html',
      mvp: false,
      state_label: 'Estados del listado',
      states: [
        { state_id: 'list', label: 'Con ofertas', initial: true },
        { state_id: 'empty', label: 'Sin ofertas' },
      ],
    },

    // ── Configuración ──────────────────────────────────────────────────────
    {
      screen_id: 'settings',
      route: '/settings',
      title: 'Configuración',
      kind: 'html',
    },
    {
      screen_id: 'settings-account',
      route: '/settings/account',
      title: 'Cuenta',
      kind: 'html',
      state_label: 'Confirmaciones',
      states: [
        { state_id: 'default', label: 'Inicial', initial: true },
        { state_id: 'sign-out-confirm', label: 'Confirmar cerrar sesión' },
        { state_id: 'delete-confirm', label: 'Confirmar eliminar cuenta' },
      ],
    },
    {
      screen_id: 'settings-banks',
      route: '/settings/banks',
      title: 'Bancos conectados',
      kind: 'html',
      state_label: 'Estados del listado',
      states: [
        { state_id: 'list', label: 'Con bancos', initial: true },
        { state_id: 'empty', label: 'Sin bancos' },
        { state_id: 'disconnect-confirm', label: 'Confirmar desconectar' },
      ],
    },
    {
      screen_id: 'bank-review',
      route: '/settings/banks/[bankId]',
      title: 'Detalle del banco',
      kind: 'html',
      state_label: 'Estado de sincronización',
      states: [
        { state_id: 'ok', label: 'Sincronizado', initial: true },
        { state_id: 'error', label: 'Con error · requiere credenciales' },
      ],
    },
    {
      screen_id: 'settings-notifications',
      route: '/settings/notifications',
      title: 'Recordatorios',
      kind: 'html',
      state_label: 'Estados',
      states: [
        { state_id: 'enabled', label: 'Activados', initial: true },
        { state_id: 'disabled', label: 'Desactivados a nivel de sistema' },
      ],
    },
    {
      screen_id: 'settings-categories',
      route: '/settings/categories',
      title: 'Categorías',
      kind: 'html',
      state_label: 'Pestañas y modales',
      states: [
        { state_id: 'expense', label: 'Gastos', initial: true },
        { state_id: 'income', label: 'Ingresos' },
        { state_id: 'edit', label: 'Editar categoría' },
        { state_id: 'delete-confirm', label: 'Confirmar eliminar' },
      ],
    },
    {
      screen_id: 'settings-about',
      route: '/settings/about',
      title: 'Acerca de',
      kind: 'html',
    },

    // ── Design system ──────────────────────────────────────────────────────
    { screen_id: 'ds-colors', route: 'design-system/colors', title: 'DS · Colores', kind: 'html' },
    { screen_id: 'ds-typography', route: 'design-system/typography', title: 'DS · Tipografía', kind: 'html' },
    { screen_id: 'ds-components', route: 'design-system/components', title: 'DS · Componentes', kind: 'html' },
  ],
};
