const APP_VERSION = "mazraat-al-akhirah-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>مزرعة الآخرة</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: system-ui, sans-serif;
      background: #020617;
      color: #f8fafc;
      text-align: center;
      padding: 24px;
    }
    .card {
      max-width: 420px;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 24px;
      padding: 24px;
      background: rgba(15,23,42,.85);
    }
    h1 { margin: 0 0 12px; font-size: 24px; }
    p { margin: 0; color: #cbd5e1; line-height: 1.8; }
  </style>
</head>
<body>
  <div class="card">
    <h1>أنت غير متصل بالإنترنت</h1>
    <p>افتح المنصة مرة أخرى عند عودة الاتصال. لم نقم بتخزين بيانات Firebase محليًا في هذه النسخة الآمنة.</p>
  </div>
</body>
</html>`,
          {
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "X-App-Version": APP_VERSION,
            },
          },
        );
      }),
    );
  }
});
