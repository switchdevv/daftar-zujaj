// دفتر الزجاج — service worker: يخلي التطبيق يحل بلا أنترنت
const VERSION = 'tumayd-v82';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', './IBMPlexSansArabic-Regular.woff2', './IBMPlexSansArabic-Medium.woff2', './IBMPlexSansArabic-SemiBold.woff2', './IBMPlexSansArabic-Bold.woff2'];

// ?v=NN في رابط sw.js = نسخة جديدة؛ نجيب الصفحة والمانيفست بنفس الرقم باش نتجاوز cache تاع GitHub
const Q = self.location.search || '';
const FRESH = ['./index.html', './manifest.webmanifest'];
// التحديث: نجيبو غير الصفحة والمانيفست، والأيقونات والخطوط ناخذوهم من النسخة القديمة (أسرع بزاف)
const getFresh = async p => { for (let i = 0; i < 3; i++) { try { const r = await fetch(p + Q, { cache: 'no-store' }); if (r.ok) return r; } catch (_) {} await new Promise(s => setTimeout(s, 800 * (i + 1))); } throw new Error('fetch ' + p); };
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    for (const p of FRESH) { const r = await getFresh(p); await c.put(p, r.clone()); if (p === './index.html') await c.put('./', r.clone()); }
    await Promise.all(SHELL.filter(p => !FRESH.includes(p) && p !== './').map(async p => {
      try { const old = await caches.match(p); if (old) { await c.put(p, old.clone()); return; } const r = await fetch(p); if (r.ok) await c.put(p, r); } catch (_) {}
    }));
  })().then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // الصفحة: من الذاكرة فوراً (الفتح سريع حتى مع أنترنت ضعيف). التحديثات توصل عبر نسخة جديدة من sw.js
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match('./index.html').then(hit => hit || fetch(req, { cache: 'no-store' }).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put('./index.html', copy));
        return res;
      }))
    );
    return;
  }

  // الخطوط ومكتبة Firebase: من الذاكرة، وتتجدد في الخلفية
  if (url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com' || (url.host === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/'))) {
    e.respondWith(
      caches.open(VERSION).then(c => c.match(req).then(hit => {
        const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      }))
    );
    return;
  }

  // باقي الملفات تاع التطبيق
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    })));
  }
});
