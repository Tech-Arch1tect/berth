export const theme = {
  layout: {
    appShell:
      'min-h-screen bg-slate-50/50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-200',
    authShell:
      'min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950',
  },
  surface: {
    sidebar:
      'bg-white/90 border border-slate-200/60 backdrop-blur-xl dark:bg-slate-900/90 dark:border-slate-800/60',
    panel:
      'bg-white/70 border border-slate-200/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/70 dark:border-slate-800/60',
    muted: 'bg-slate-50/70 dark:bg-slate-800/60',
    subtle: 'bg-slate-50 dark:bg-slate-800/50',
    soft: 'bg-slate-50 dark:bg-slate-700/50',
    code: 'bg-slate-100 dark:bg-slate-700',
  },
  text: {
    subtle: 'text-slate-500 dark:text-slate-400',
    muted: 'text-slate-600 dark:text-slate-400',
    standard: 'text-slate-700 dark:text-slate-300',
    strong: 'text-slate-900 dark:text-white',
    success: 'text-emerald-600 dark:text-emerald-400',
    danger: 'text-red-600 dark:text-red-400',
    info: 'text-blue-600 dark:text-blue-400',
    warning: 'text-amber-600 dark:text-amber-400',
  },
  brand: {
    accent: 'bg-gradient-to-r from-blue-600 to-purple-600 text-white',
    titleGradient:
      'bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent dark:from-white dark:to-slate-300',
    serverOnline: 'bg-gradient-to-br from-blue-500 to-purple-600 text-white',
    serverOffline: 'bg-gradient-to-br from-slate-400 to-slate-500 text-white',
    stack: 'bg-gradient-to-br from-blue-500 to-purple-600 text-white',
    // Compose Editor specific gradients
    composeHeader: 'bg-gradient-to-r from-indigo-600 to-purple-600',
    composeButton:
      'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg',
    composePreview:
      'bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800',
    composeAccent:
      'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md hover:shadow-lg',
    composeSelected: 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20',
  },
  navigation: {
    itemBase:
      'group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
    itemActive:
      'border border-blue-200/30 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 text-blue-600 shadow-sm dark:border-blue-800/30 dark:text-blue-300',
    itemInactive:
      'text-slate-700 hover:bg-slate-100/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/50 dark:hover:text-white',
    iconBase: 'mr-3 h-5 w-5 transition-colors',
    iconActive: 'text-blue-600 dark:text-blue-300',
    iconInactive:
      'text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200',
    indicator: 'ml-auto h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400',
  },
  tabs: {
    container: 'flex items-center gap-1 border-b border-slate-200 dark:border-slate-700',
    trigger:
      'relative rounded-t-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
    active: 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400',
    inactive:
      'border-b-2 border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
    badge:
      'absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white',
  },
  buttons: {
    ghost: 'rounded-lg p-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800',
    info: 'inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-500 dark:hover:bg-blue-400',
    primary:
      'inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-500 dark:hover:bg-blue-400',
    secondary:
      'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
    subtle:
      'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-300 dark:hover:bg-slate-800',
    danger:
      'inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-500 dark:hover:bg-red-400',
    success:
      'inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-500 dark:hover:bg-emerald-400',
    warning:
      'inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-amber-400 dark:hover:bg-amber-300 dark:text-slate-900',
    sm: 'px-2 py-1 text-xs font-medium',
    icon: 'inline-flex items-center justify-center rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200',
  },
  badges: {
    userInitials:
      'flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-emerald-400 to-blue-500 text-sm font-semibold text-white',
    pillMuted:
      'inline-flex items-center gap-2 rounded-full border border-slate-200/60 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700/60 dark:bg-slate-800 dark:text-slate-300',
    status: {
      base: 'flex items-center space-x-2 rounded-full px-3 py-1.5 text-xs font-medium',
      online: 'bg-emerald-100/70 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      offline: 'bg-slate-100/70 text-slate-700 dark:bg-slate-800/70 dark:text-slate-300',
    },
    statusDot: {
      base: 'h-2 w-2 rounded-full',
      online: 'bg-emerald-500',
      offline: 'bg-slate-400',
      pulse: 'animate-pulse',
    },
    health: {
      base: 'inline-flex items-center space-x-1 rounded-lg px-2.5 py-1 text-xs font-medium',
      healthy: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
      unhealthy: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    },
    tag: {
      base: 'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium',
      neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      danger: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    },
    dot: {
      base: 'h-2 w-2 rounded-full',
      success: 'bg-emerald-500',
      warning: 'bg-yellow-400',
      danger: 'bg-red-500',
      neutral: 'bg-slate-400',
      info: 'bg-blue-500',
    },
  },
  cards: {
    auth: 'rounded-2xl border border-white/20 bg-white/70 p-8 shadow-xl backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/60 sm:px-8',
    shell:
      'group relative block cursor-pointer rounded-2xl border backdrop-blur-sm transition-all duration-300',
    translucent: 'bg-white/70 border-slate-200/50 dark:bg-slate-800/70 dark:border-slate-700/50',
    interactive:
      'hover:border-slate-300/50 dark:hover:border-slate-600/50 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-slate-900/20',
    lift: 'hover:scale-[1.02]',
    padded: 'p-6',
    sectionDivider: 'border-t border-slate-200 dark:border-slate-700',
  },
  overlays: {
    sidebarBackdrop: 'fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm lg:hidden',
  },
  toast: {
    container: 'backdrop-blur-sm',
  },
  containers: {
    panel:
      'rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm dark:border-slate-800/60 dark:bg-slate-900',
    subtle:
      'rounded-2xl border border-slate-200/40 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-slate-800/40 dark:bg-slate-900/70',
    inset:
      'rounded-xl border border-slate-200/60 bg-slate-50/70 p-4 dark:border-slate-800/60 dark:bg-slate-900/60',
    card: 'rounded-xl border border-slate-200/60 bg-white shadow-sm transition-colors dark:border-slate-800/60 dark:bg-slate-900',
    cardSoft:
      'rounded-xl border border-slate-200/40 bg-white/70 shadow-sm backdrop-blur dark:border-slate-800/40 dark:bg-slate-900/60',
    sectionHeader:
      'flex items-center justify-between border-b border-slate-200/60 pb-4 dark:border-slate-700/60',
  },
  intent: {
    neutral: {
      surface: 'bg-slate-50 dark:bg-slate-700/50',
      surfaceSoft: 'bg-slate-100/70 dark:bg-slate-800/40',
      textStrong: 'text-slate-900 dark:text-white',
      textMuted: 'text-slate-600 dark:text-slate-400',
      border: 'border-slate-200 dark:border-slate-700',
      icon: 'bg-slate-500 text-white',
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
      surface: 'bg-blue-50 dark:bg-blue-900/20',
      textStrong: 'text-blue-700 dark:text-blue-300',
      textMuted: 'text-blue-600 dark:text-blue-400',
      border: 'border-blue-200 dark:border-blue-800',
      icon: 'bg-blue-500 text-white',
    },
    warning: {
      surface: 'bg-amber-50 dark:bg-amber-900/20',
      textStrong: 'text-amber-700 dark:text-amber-300',
      textMuted: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-200 dark:border-amber-800',
      icon: 'bg-amber-500 text-slate-900',
    },
    danger: {
      surface: 'bg-red-50 dark:bg-red-900/20',
      textStrong: 'text-red-700 dark:text-red-300',
      textMuted: 'text-red-600 dark:text-red-400',
      border: 'border-red-200 dark:border-red-800',
      icon: 'bg-red-500 text-white',
    },
  },
  progress: {
    track: 'h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700',
    healthy: 'h-full bg-gradient-to-r from-emerald-500 to-green-500',
    unhealthy: 'h-full bg-gradient-to-r from-red-500 to-orange-500',
    warning: 'h-full bg-gradient-to-r from-amber-500 to-orange-500',
    info: 'h-full bg-gradient-to-r from-blue-500 to-indigo-500',
    neutral: 'h-full bg-slate-400',
  },
  forms: {
    input:
      'w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 placeholder:text-slate-500 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-400',
    inputIcon:
      'pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400',
    textarea:
      'w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-400',
    label: 'block text-sm font-medium text-slate-600 dark:text-slate-300',
    select:
      'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white',
    checkbox:
      'h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900',
  },
  table: {
    outer: 'mt-8 flex flex-col',
    scroll: '-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8',
    inner: 'inline-block min-w-full py-2 align-middle md:px-6 lg:px-8',
    panel:
      'overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow dark:border-slate-800/60 dark:bg-slate-900',
    element: 'min-w-full divide-y divide-slate-200 dark:divide-slate-800',
    head: 'bg-slate-50 dark:bg-slate-900/60',
    headCell:
      'px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300',
    body: 'bg-white dark:bg-slate-950/40',
    row: 'divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-950/40',
    cell: 'whitespace-nowrap px-6 py-4 text-sm text-slate-600 dark:text-slate-300',
    cellStrong: 'text-sm font-medium text-slate-900 dark:text-white',
    empty: 'px-6 py-4 text-center text-sm text-slate-500 dark:text-slate-400',
  },
  pagination: {
    container: 'mt-4 flex items-center justify-between',
    summary: 'text-sm text-slate-600 dark:text-slate-300',
    group: 'flex items-center gap-2',
    button:
      'inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
    page: 'px-3 py-2 text-sm text-slate-600 dark:text-slate-300',
  },
  modal: {
    overlay:
      'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur',
    content:
      'flex h-[80vh] w-full max-w-6xl flex-col rounded-2xl border border-slate-200/50 bg-white shadow-2xl dark:border-slate-700/50 dark:bg-slate-900',
    header:
      'flex items-center justify-between border-b border-slate-200/60 px-6 py-4 dark:border-slate-700/60',
    title: 'text-lg font-semibold text-slate-900 dark:text-white',
    subtitle: 'text-sm text-slate-500 dark:text-slate-400',
    footer:
      'border-t border-slate-200/60 bg-slate-50/70 px-6 py-4 dark:border-slate-700/60 dark:bg-slate-900/60',
  },
  effects: {
    hoverGlow:
      'pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100',
    emptyAura:
      'bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20',
    spinner:
      'h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent dark:border-blue-400',
    spinnerSm: 'h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent',
  },
  selectable: {
    tileBase: 'rounded-lg border px-3 py-2 text-left text-sm transition-all duration-200',
    tileActive:
      'border-blue-500 bg-blue-50 text-blue-800 shadow-sm dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-200',
    tileInactive:
      'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
    tileDisabled: 'cursor-not-allowed opacity-50',
    pill: 'inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  toolbar: {
    container: 'inline-flex items-center gap-1.5',
    button:
      'inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60',
    buttonInfo:
      'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-500/30 dark:text-blue-100 dark:hover:bg-blue-500/45',
    buttonSuccess:
      'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/25 dark:text-emerald-100 dark:hover:bg-emerald-500/40',
    buttonDanger:
      'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-500/25 dark:text-rose-100 dark:hover:bg-rose-500/40',
    buttonWarning:
      'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-500/25 dark:text-amber-100 dark:hover:bg-amber-500/40',
    buttonSecondary:
      'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700/40 dark:text-slate-200 dark:hover:bg-slate-700/60',
    disabled: 'cursor-not-allowed opacity-50',
    icon: 'h-3.5 w-3.5',
  },
  logs: {
    shell:
      'flex min-h-[600px] flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-gradient-to-br from-slate-50/80 to-white/80 shadow-xl shadow-slate-200/20 backdrop-blur-sm dark:border-slate-700/60 dark:from-slate-900/80 dark:to-slate-800/80 dark:shadow-slate-900/20',
    header: 'relative border-b border-slate-200/60 px-6 py-4 dark:border-slate-700/60',
    headerAccent: 'absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5',
    headerContent: 'relative flex items-center justify-between',
    headerMeta: 'flex items-center gap-2 text-sm font-medium',
    stats: 'hidden items-center gap-4 text-xs md:flex',
    statsItem: 'flex items-center gap-1.5 font-medium',
    stream: 'relative flex-1 overflow-y-auto bg-slate-950 text-slate-100 dark:bg-slate-950',
    streamInner: 'absolute inset-0 overflow-y-auto p-6',
    line: 'flex items-start gap-4 border-b border-slate-800/60 py-2 text-sm last:border-transparent',
    timestamp: 'whitespace-nowrap font-mono text-xs text-slate-500',
    message: 'flex-1 whitespace-pre-wrap break-words text-slate-200',
    toolbar: 'flex items-center gap-2',
    toolbarButton: 'text-sm font-medium',
    badge:
      'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
    level: {
      error: 'text-red-400',
      warn: 'text-amber-400',
      info: 'text-blue-400',
      debug: 'text-slate-400',
      trace: 'text-slate-500',
      success: 'text-emerald-400',
    },
  },
  selection: {
    tile: {
      base: 'rounded-lg border-2 p-4 text-left transition-all cursor-pointer',
      selected: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
      unselected:
        'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600',
    },
    radio: {
      base: 'rounded-lg border p-3 text-left transition-all cursor-pointer',
      selected: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
      unselected:
        'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50',
    },
  },
  iconBackground: {
    primary: 'rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 p-2 text-white',
    success: 'rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 p-2 text-white',
    danger: 'rounded-lg bg-gradient-to-br from-red-500 to-orange-600 p-2 text-white',
    warning: 'rounded-lg bg-gradient-to-br from-amber-500 to-yellow-600 p-2 text-white',
    info: 'rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 p-2 text-white',
    neutral: 'rounded-lg bg-gradient-to-br from-slate-400 to-slate-500 p-2 text-white',
  },
  link: {
    base: 'text-sm font-medium transition-colors',
    primary: 'text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300',
    subtle: 'text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400',
    underlined:
      'text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline',
  },
  syntax: {
    keyword: 'text-purple-400',
    string: 'text-emerald-400',
    number: 'text-blue-400',
    comment: 'text-slate-500',
    function: 'text-yellow-400',
    property: 'text-cyan-400',
    operator: 'text-slate-300',
    punctuation: 'text-slate-400',
  },
  icon: {
    squareLg: 'flex h-12 w-12 items-center justify-center rounded-2xl text-white',
    squareMd: 'flex h-10 w-10 items-center justify-center rounded-xl text-white',
    emptyState:
      'mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200/50 bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400 dark:border-slate-700/50 dark:from-slate-800 dark:to-slate-700 dark:text-slate-500',
  },
  alerts: {
    base: 'rounded-lg border p-4 text-sm',
    variants: {
      success:
        'border-emerald-200 bg-emerald-100/70 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
      error:
        'border-red-200 bg-red-100/70 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300',
      warning:
        'border-amber-200 bg-amber-100/70 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
      info: 'border-blue-200 bg-blue-100/70 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      default:
        'border-slate-200 bg-slate-100/70 text-slate-700 dark:border-slate-700 dark:bg-slate-900/20 dark:text-slate-300',
    },
  },
};

export type Theme = typeof theme;
