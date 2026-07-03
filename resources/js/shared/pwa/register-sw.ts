import { registerSW } from 'virtual:pwa-register';

export function registerServiceWorker(): void {
  const updateSW = registerSW({
    onNeedRefresh() {
      showReloadPrompt(() => {
        void updateSW(true);
      });
    },
  });
}

function showReloadPrompt(onReload: () => void): void {
  if (document.getElementById('pwa-update-prompt')) return;

  const bar = document.createElement('div');
  bar.id = 'pwa-update-prompt';
  bar.setAttribute('role', 'status');
  bar.style.cssText = [
    'position:fixed',
    'left:50%',
    'bottom:calc(1rem + env(safe-area-inset-bottom))',
    'transform:translateX(-50%)',
    'z-index:2147483647',
    'display:flex',
    'align-items:center',
    'gap:0.75rem',
    'max-width:calc(100vw - 2rem)',
    'padding:0.625rem 0.875rem',
    'border-radius:0.75rem',
    'background:#0d9488',
    'color:#ffffff',
    'font:500 0.875rem/1.2 system-ui,sans-serif',
    'box-shadow:0 10px 25px rgba(0,0,0,0.25)',
  ].join(';');

  const label = document.createElement('span');
  label.textContent = 'A new version is available.';

  const reload = document.createElement('button');
  reload.type = 'button';
  reload.textContent = 'Reload';
  reload.style.cssText = [
    'flex:none',
    'padding:0.375rem 0.75rem',
    'border:0',
    'border-radius:0.5rem',
    'background:#ffffff',
    'color:#0f766e',
    'font:600 0.875rem/1 system-ui,sans-serif',
    'cursor:pointer',
  ].join(';');
  reload.addEventListener('click', onReload);

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.setAttribute('aria-label', 'Dismiss');
  dismiss.textContent = '×';
  dismiss.style.cssText = [
    'flex:none',
    'border:0',
    'background:transparent',
    'color:#ffffff',
    'font:400 1.25rem/1 system-ui,sans-serif',
    'cursor:pointer',
  ].join(';');
  dismiss.addEventListener('click', () => bar.remove());

  bar.append(label, reload, dismiss);
  document.body.appendChild(bar);
}
