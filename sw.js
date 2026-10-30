// 앱 화면과 판매점 자료를 저장해 두고, 먼저 저장본을 보여준 뒤 뒤에서 새로 받아 갱신함
// 파일을 바꿔 배포할 때는 CACHE 이름의 숫자를 올리면 예전 저장본이 지워짐
const CACHE = "lotto-map-v2";
const SHELL = ["./", "index.html", "app.js", "config.js", "manifest.webmanifest", "stores.json", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // 카카오 지도 SDK·지도 그림 같은 외부 요청은 그대로 통과
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(e.request, { ignoreSearch: true });
    const fresh = fetch(e.request).then(res => {
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    }).catch(() => cached);
    return cached || fresh;
  }));
});
