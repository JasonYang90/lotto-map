// 앱 화면과 판매점 자료를 저장해 둠. 인터넷이 되면 항상 새 파일을 먼저 받고,
// 끊겼을 때만 저장본을 보여줌. 그래서 GitHub에서 파일을 고치면 다음에 열 때 바로 반영됨.
const CACHE = "lotto-map-v3";
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
  // 카카오·오픈스트리트맵 같은 외부 요청은 그대로 통과
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: "no-cache" }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
