export const theme = {
  layout: {
    appShell:
      'min-h-screen bg-zinc-50 text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-200',
    authShell: 'min-h-screen bg-zinc-50 dark:bg-zinc-950',
  },
  surface: {
    sidebar: 'bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800',
    panel: 'bg-white border border-zinc-200 shadow-sm dark:bg-zinc-900 dark:border-zinc-800',
    muted: 'bg-zinc-50 dark:bg-zinc-800',
    subtle: 'bg-zinc-50 dark:bg-zinc-800/50',
    soft: 'bg-zinc-50 dark:bg-zinc-800/30',
    code: 'bg-zinc-100 dark:bg-zinc-800',
  },
  text: {
    subtle: 'text-zinc-500 dark:text-zinc-400',
    muted: 'text-zinc-600 dark:text-zinc-400',
    standard: 'text-zinc-700 dark:text-zinc-300',
    strong: 'text-zinc-900 dark:text-white',
    success: 'text-emerald-600 dark:text-emerald-400',
    danger: 'text-rose-600 dark:text-rose-400',
    info: 'text-teal-600 dark:text-teal-400',
    warning: 'text-amber-600 dark:text-amber-400',
  },
  brand: {
    // Solid brand colors
    accent: 'bg-teal-600 text-white',
    titleColor: 'text-zinc-900 dark:text-white',
    serverOnline: 'bg-teal-600 text-white',
    serverOffline: 'bg-zinc-400 text-white',
    stack: 'bg-teal-600 text-white',
    // Gradients
    gradient: 'bg-gradient-to-br from-teal-500 to-emerald-500',
    gradientHorizontal: 'bg-gradient-to-r from-teal-500 to-emerald-500',
    gradientAccent: 'h-1 bg-gradient-to-r from-teal-500 to-emerald-500',
  },
  navigation: {
    itemBase:
      'group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
    itemActive: 'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300',
    itemInactive:
      'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white',
    iconBase: 'mr-3 h-5 w-5 transition-colors',
    iconActive: 'text-teal-600 dark:text-teal-400',
    iconInactive:
      'text-zinc-500 group-hover:text-zinc-700 dark:text-zinc-400 dark:group-hover:text-zinc-200',
    indicator: 'ml-auto h-2 w-2 rounded-full bg-teal-600 dark:bg-teal-400',
  },
  tabs: {
    container: 'flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-700',
    trigger:
      'relative rounded-t-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
    active: 'border-b-2 border-teal-500 text-teal-600 dark:text-teal-400',
    inactive:
      'border-b-2 border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200',
    badge:
      'absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-semibold text-white',
  },
  buttons: {
    ghost: 'rounded-lg p-2 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800',
    info: 'inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-teal-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-600 dark:hover:bg-teal-700 dark:shadow-teal-500/20',
    primary:
      'inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-teal-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-600 dark:hover:bg-teal-700 dark:shadow-teal-500/20',
    secondary:
      'inline-flex items-center justify-center gap-2 rounded-lg border-2 border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-all hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-750',
    subtle:
      'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-60 dark:text-zinc-300 dark:hover:bg-zinc-800',
    danger:
      'inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-rose-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-rose-600 dark:hover:bg-rose-700 dark:shadow-rose-500/20',
    success:
      'inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-700 dark:shadow-emerald-500/20',
    warning:
      'inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm transition-all hover:bg-amber-600 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-amber-500 dark:hover:bg-amber-600 dark:text-zinc-900 dark:shadow-amber-500/20',
    sm: 'px-3 py-1.5 text-xs font-semibold',
    icon: 'inline-flex items-center justify-center rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200',
  },
  badges: {
    userInitials:
      'flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-sm font-bold text-white shadow-sm',
    pillMuted:
      'inline-flex items-center gap-2 rounded-full border-2 border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    status: {
      base: 'flex items-center space-x-2 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm',
      online: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
      offline: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    },
    connection: {
      base: 'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm flex-shrink-0',
      connected: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      connecting: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      disconnected: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
    },
    connectionDot: {
      base: 'w-2 h-2 rounded-full',
      connected: 'bg-emerald-500',
      connecting: 'bg-amber-500',
      disconnected: 'bg-rose-500',
      pulse: 'animate-pulse',
    },
    statusDot: {
      base: 'h-2 w-2 rounded-full shadow-sm',
      online: 'bg-emerald-500',
      offline: 'bg-zinc-400',
      pulse: 'animate-pulse',
    },
    health: {
      base: 'inline-flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm',
      healthy: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
      unhealthy: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
    },
    tag: {
      base: 'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold shadow-sm',
      neutral: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
      info: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
      success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
      danger: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
      warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    },
    dot: {
      base: 'h-2 w-2 rounded-full',
      success: 'bg-emerald-500',
      warning: 'bg-yellow-400',
      danger: 'bg-rose-500',
      neutral: 'bg-zinc-400',
      info: 'bg-teal-500',
    },
  },
  cards: {
    auth: 'rounded-2xl border border-zinc-200 bg-white p-8 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-2xl dark:shadow-black/20 sm:px-8',
    shell: 'group relative block cursor-pointer rounded-xl border transition-all duration-200',
    translucent:
      'bg-white border-zinc-200 shadow-sm dark:bg-zinc-900 dark:border-zinc-800 dark:shadow-black/10',
    interactive:
      'hover:border-teal-300 hover:shadow-xl hover:shadow-teal-500/10 dark:hover:border-teal-700 dark:hover:shadow-teal-500/5',
    lift: 'hover:-translate-y-1 hover:scale-[1.01]',
    padded: 'p-6',
    sectionDivider: 'border-t border-zinc-200 dark:border-zinc-800',
    enhanced: {
      base: 'relative overflow-hidden rounded-xl border transition-all duration-200 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm',
      hover: 'hover:shadow-lg',
      lift: 'hover:-translate-y-0.5',
    },
    stack: {
      compact: {
        base: 'group relative block rounded-xl border-2 transition-all duration-200 overflow-hidden bg-white dark:bg-zinc-900',
        healthy:
          'border-emerald-200 hover:border-emerald-400 dark:border-emerald-900/50 dark:hover:border-emerald-700',
        unhealthy:
          'border-rose-200 hover:border-rose-400 dark:border-rose-900/50 dark:hover:border-rose-700',
        lift: 'hover:shadow-xl hover:-translate-y-0.5',
      },
      normal: {
        base: 'group relative block rounded-xl border transition-all duration-200 overflow-hidden bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm',
        hover:
          'hover:border-teal-300 hover:shadow-xl hover:-translate-y-1 dark:hover:border-teal-700',
      },
    },
  },
  overlays: {
    sidebarBackdrop: 'fixed inset-0 z-40 bg-zinc-900/30 backdrop-blur-sm lg:hidden',
  },
  toast: {
    container: 'backdrop-blur-sm',
  },
  containers: {
    panel:
      'rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/10',
    subtle:
      'rounded-2xl border border-zinc-200 bg-white p-6 shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/10',
    inset:
      'rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50',
    card: 'rounded-xl border border-zinc-200 bg-white shadow-md transition-all dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/10',
    cardSoft:
      'rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/5',
    sectionHeader:
      'flex items-center justify-between border-b border-zinc-200 pb-4 mb-4 dark:border-zinc-800',
  },
  intent: {
    neutral: {
      surface: 'bg-zinc-50 dark:bg-zinc-700/50',
      surfaceSoft: 'bg-zinc-100/70 dark:bg-zinc-800/40',
      textStrong: 'text-zinc-900 dark:text-white',
      textMuted: 'text-zinc-600 dark:text-zinc-400',
      border: 'border-zinc-200 dark:border-zinc-700',
      icon: 'bg-zinc-500 text-white',
    },
    success: {
      surface: 'bg-emerald-50 dark:bg-emerald-900/20',
      surfaceSoft: 'bg-emerald-100/70 dark:bg-emerald-900/30',
      textStrong: 'text-emerald-700 dark:text-emerald-300',
      textMuted: 'text-emerald-600 dark:text-emerald-400',
      border: 'border-emerald-200 dark:border-emerald-800',
      icon: 'bg-emerald-500 text-white',
    },
    info: {
      surface: 'bg-teal-50 dark:bg-teal-900/20',
      textStrong: 'text-teal-700 dark:text-teal-300',
      textMuted: 'text-teal-600 dark:text-teal-400',
      border: 'border-teal-200 dark:border-teal-800',
      icon: 'bg-teal-500 text-white',
    },
    warning: {
      surface: 'bg-amber-50 dark:bg-amber-900/20',
      textStrong: 'text-amber-700 dark:text-amber-300',
      textMuted: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-200 dark:border-amber-800',
      icon: 'bg-amber-500 text-zinc-900',
    },
    danger: {
      surface: 'bg-rose-50 dark:bg-rose-900/20',
      textStrong: 'text-rose-700 dark:text-rose-300',
      textMuted: 'text-rose-600 dark:text-rose-400',
      border: 'border-rose-200 dark:border-rose-800',
      icon: 'bg-rose-500 text-white',
    },
  },
  progress: {
    track: 'h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700',
    healthy: 'h-full bg-emerald-500 rounded-full',
    unhealthy: 'h-full bg-rose-500 rounded-full',
    warning: 'h-full bg-amber-500 rounded-full',
    info: 'h-full bg-teal-500 rounded-full',
    neutral: 'h-full bg-zinc-400 rounded-full',
    healthyGradient:
      'h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all',
    unhealthyGradient:
      'h-full bg-gradient-to-r from-rose-500 to-rose-400 rounded-full transition-all',
    compactHealthy:
      'absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 dark:bg-emerald-400 transition-all',
    compactUnhealthy:
      'absolute bottom-0 left-0 right-0 h-1 bg-rose-500 dark:bg-rose-400 transition-all',
  },
  forms: {
    input:
      'w-full rounded-lg border-2 border-zinc-200 bg-white px-4 py-2.5 text-zinc-900 placeholder:text-zinc-400 shadow-sm transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-teal-500',
    inputIcon:
      'pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500',
    textarea:
      'w-full rounded-lg border-2 border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-sm transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-teal-500',
    label: 'block text-sm font-semibold text-zinc-700 mb-2 dark:text-zinc-300',
    select:
      'w-full rounded-lg border-2 border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-teal-500',
    checkbox:
      'h-4 w-4 rounded border-2 border-zinc-300 text-teal-600 transition-colors focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-800',
  },
  table: {
    outer: 'mt-8 flex flex-col',
    scroll: '-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8',
    inner: 'inline-block min-w-full py-2 align-middle md:px-6 lg:px-8',
    panel:
      'overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/10',
    element: 'min-w-full divide-y divide-zinc-200 dark:divide-zinc-800',
    head: 'bg-zinc-50 dark:bg-zinc-800/50',
    headCell:
      'px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300',
    body: 'bg-white divide-y divide-zinc-100 dark:bg-zinc-900 dark:divide-zinc-800',
    row: 'hover:bg-zinc-50 transition-colors dark:hover:bg-zinc-800/50',
    cell: 'whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zinc-300',
    cellStrong: 'text-sm font-semibold text-zinc-900 dark:text-white',
    empty: 'px-6 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400',
  },
  pagination: {
    container: 'mt-4 flex items-center justify-between',
    summary: 'text-sm text-zinc-600 dark:text-zinc-300',
    group: 'flex items-center gap-2',
    button:
      'inline-flex items-center rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700',
    page: 'px-3 py-2 text-sm text-zinc-600 dark:text-zinc-300',
  },
  modal: {
    overlay: 'fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/80 p-4',
    content:
      'flex h-[80vh] w-full max-w-6xl flex-col rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/40',
    header:
      'flex items-center justify-between border-b border-zinc-200 px-6 py-5 dark:border-zinc-800',
    title: 'text-xl font-bold text-zinc-900 dark:text-white',
    subtitle: 'text-sm text-zinc-500 dark:text-zinc-400',
    footer:
      'flex items-center justify-end gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-800/50',
  },
  effects: {
    hoverGlow:
      'pointer-events-none absolute inset-0 rounded-xl bg-zinc-50/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:bg-zinc-800/30',
    emptyAura: 'bg-zinc-50 dark:bg-zinc-800/30',
    spinner:
      'h-4 w-4 animate-spin rounded-full border-2 border-teal-600 border-t-transparent dark:border-teal-400',
    spinnerSm: 'h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent',
  },
  selectable: {
    tileBase: 'rounded-lg border px-3 py-2 text-left text-sm transition-all duration-200',
    tileActive:
      'border-teal-500 bg-teal-50 text-teal-800 shadow-sm dark:border-teal-400 dark:bg-teal-900/30 dark:text-teal-200',
    tileInactive:
      'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700',
    tileDisabled: 'cursor-not-allowed opacity-50',
    pill: 'inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  },
  toolbar: {
    container: 'inline-flex items-center gap-1.5',
    button:
      'inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-60',
    buttonInfo:
      'bg-teal-100 text-teal-700 hover:bg-teal-200 dark:bg-teal-500/30 dark:text-teal-100 dark:hover:bg-teal-500/45',
    buttonSuccess:
      'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/25 dark:text-emerald-100 dark:hover:bg-emerald-500/40',
    buttonDanger:
      'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-500/25 dark:text-rose-100 dark:hover:bg-rose-500/40',
    buttonWarning:
      'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-500/25 dark:text-amber-100 dark:hover:bg-amber-500/40',
    buttonSecondary:
      'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700/40 dark:text-zinc-200 dark:hover:bg-zinc-700/60',
    disabled: 'cursor-not-allowed opacity-50',
    icon: 'h-3.5 w-3.5',
  },
  logs: {
    shell:
      'flex min-h-[600px] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900',
    header: 'border-b border-zinc-200 px-6 py-4 dark:border-zinc-800',
    headerAccent: 'hidden', // Removed gradient accent
    headerContent: 'flex items-center justify-between',
    headerMeta: 'flex items-center gap-2 text-sm font-medium',
    stats: 'hidden items-center gap-4 text-xs md:flex',
    statsItem: 'flex items-center gap-1.5 font-medium',
    stream: 'relative flex-1 overflow-y-auto bg-zinc-950 text-zinc-100 dark:bg-zinc-950',
    streamInner: 'absolute inset-0 overflow-y-auto p-6',
    line: 'flex items-start gap-4 border-b border-zinc-800/60 py-2 text-sm last:border-transparent',
    timestamp: 'whitespace-nowrap font-mono text-xs text-zinc-500',
    message: 'flex-1 whitespace-pre-wrap break-words text-zinc-200',
    toolbar: 'flex items-center gap-2',
    toolbarButton: 'text-sm font-medium',
    badge:
      'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
    level: {
      error: 'text-rose-400',
      warn: 'text-amber-400',
      info: 'text-teal-400',
      debug: 'text-zinc-400',
      trace: 'text-zinc-500',
      success: 'text-emerald-400',
    },
  },
  selection: {
    tile: {
      base: 'rounded-lg border-2 p-4 text-left transition-all cursor-pointer',
      selected: 'border-teal-500 bg-teal-50 dark:bg-teal-900/20',
      unselected:
        'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600',
    },
    radio: {
      base: 'rounded-lg border p-3 text-left transition-all cursor-pointer',
      selected: 'border-teal-500 bg-teal-50 dark:bg-teal-900/20',
      unselected: 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50',
    },
  },
  iconBackground: {
    primary: 'rounded-lg bg-teal-600 p-2 text-white',
    success: 'rounded-lg bg-emerald-600 p-2 text-white',
    danger: 'rounded-lg bg-rose-600 p-2 text-white',
    warning: 'rounded-lg bg-amber-500 p-2 text-white',
    info: 'rounded-lg bg-teal-600 p-2 text-white',
    neutral: 'rounded-lg bg-zinc-500 p-2 text-white',
  },
  link: {
    base: 'text-sm font-medium transition-colors',
    primary: 'text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300',
    subtle: 'text-zinc-600 hover:text-teal-600 dark:text-zinc-400 dark:hover:text-teal-400',
    underlined:
      'text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 underline',
  },
  syntax: {
    keyword: 'text-purple-400',
    string: 'text-emerald-400',
    number: 'text-teal-400',
    comment: 'text-zinc-500',
    function: 'text-yellow-400',
    property: 'text-cyan-400',
    operator: 'text-zinc-300',
    punctuation: 'text-zinc-400',
  },
  icon: {
    squareLg: 'flex h-12 w-12 items-center justify-center rounded-2xl text-white',
    squareMd: 'flex h-10 w-10 items-center justify-center rounded-xl text-white',
    squareSm: 'flex h-8 w-8 items-center justify-center rounded-lg text-white',
    gradientLg:
      'w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg bg-gradient-to-br from-teal-500 to-emerald-500',
    gradientMd:
      'w-10 h-10 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 bg-gradient-to-br from-teal-500 to-emerald-500',
    gradientSm:
      'w-6 h-6 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0 bg-gradient-to-br from-teal-500 to-emerald-500',
    emptyState:
      'mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-200/50 bg-gradient-to-br from-zinc-100 to-zinc-200 text-zinc-400 dark:border-zinc-700/50 dark:from-zinc-800 dark:to-zinc-700 dark:text-zinc-500',
  },
  alerts: {
    base: 'rounded-xl border-2 p-4 text-sm font-medium shadow-sm',
    variants: {
      success:
        'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
      error:
        'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
      warning:
        'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
      info: 'border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
      default:
        'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300',
    },
  },
};

export type Theme = typeof theme;
