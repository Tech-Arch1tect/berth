import { test, expect } from '../fixtures/test';

test.describe('PWA shell', () => {
  test('serves the web app manifest with the icons installability needs', async ({ request }) => {
    const res = await request.get('/pwa/manifest.webmanifest');

    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/manifest+json');

    const manifest = (await res.json()) as {
      name: string;
      start_url: string;
      display: string;
      icons: { sizes: string; type: string; purpose?: string }[];
    };

    expect(manifest.name).toBe('berth');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');

    const sizes = manifest.icons.map((icon) => icon.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
  });

  test('serves the service worker with a root-scope grant', async ({ request }) => {
    const res = await request.get('/build/sw.js');

    expect(res.status()).toBe(200);
    expect(res.headers()['service-worker-allowed']).toBe('/');
    expect(res.headers()['content-type']).toContain('javascript');
  });

  test('links the manifest and registers the service worker at root scope', async ({ page }) => {
    await page.goto('/');

    const manifestHref = await page.getAttribute('link[rel="manifest"]', 'href');
    expect(manifestHref).toBe('/pwa/manifest.webmanifest');

    const scriptURL = await page.evaluate(async () => {
      return Promise.race([
        navigator.serviceWorker.ready.then((reg) => reg.active?.scriptURL ?? null),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 10_000)),
      ]);
    });

    expect(scriptURL, 'service worker did not activate').not.toBeNull();
    expect(scriptURL).toMatch(/\/build\/sw\.js$/);
  });
});
