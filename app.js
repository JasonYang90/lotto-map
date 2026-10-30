(() => {
  const $ = id => document.getElementById(id);
  const SI_ORDER = ["서울","부산","대구","인천","광주","전남광주","대전","울산","세종","경기","강원","충북","충남","전북","전남","경북","경남","제주"];
  const PAGE = 80;
  const BALL = ["", "#f5b800", "#3fa6dc", "#ec5a5a"];
  const MODE = { A: "자동", M: "수동", S: "반자동" };

  let stores = [], meta = {}, filtered = [], shown = PAGE, selected = null, origin = null;
  const state = { q: "", si: "", gu: "", onlyWin: false, sort: "wins" };

  // ---------- 데이터 ----------
  function parseStore(r) {
    const wins = r[8] ? r[8].split(",").map(w => ({ draw: +w.slice(0, -1), mode: w.slice(-1) })) : [];
    const words = (r[2] || "").split(/\s+/);
    return { id: r[0], name: r[1], addr: r[2] || "", tel: r[3], si: r[4] || words[0] || "기타", gu: r[5] || (r[4] ? "" : words[1] || ""),
             lat: r[6], lon: r[7], wins, n: wins.length,
             key: (r[1] + " " + (r[2] || "") + " " + (r[4] || "") + " " + (r[5] || "")).toLowerCase().replace(/\s+/g, "") };
  }
  const tier = n => n >= 5 ? 3 : n >= 2 ? 2 : n >= 1 ? 1 : 0;
  function km(a, b) {
    const R = 6371, t = Math.PI / 180, dLat = (b.lat - a.lat) * t, dLon = (b.lon - a.lon) * t;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  const fmtKm = d => d < 1 ? Math.round(d * 1000) + "m" : d.toFixed(d < 10 ? 1 : 0) + "km";
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  let toastTimer = 0;
  function toast(msg, ms = 3500) {
    const t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  }

  // ---------- 아래 시트 (peek / half / full) ----------
  const sheet = $("sheet");
  let sheetState = "peek";
  const desktop = () => matchMedia("(min-width: 900px)").matches;
  function heights() {
    const topH = document.querySelector(".top").getBoundingClientRect().height;
    const vh = innerHeight || document.documentElement.clientHeight || 700;
    return { peek: 150, half: Math.round(vh * 0.48), full: Math.round(vh - topH - 4) };
  }
  function setSheet(s, px) {
    if (desktop()) { sheet.style.height = ""; $("locate").style.bottom = ""; return; }
    sheetState = s || sheetState;
    const h = px != null ? px : heights()[sheetState];
    sheet.style.height = h + "px";
    $("locate").style.bottom = `calc(${Math.min(h, heights().half)}px + 12px)`;
  }
  (() => {
    const grab = $("grab"); let y0 = 0, h0 = 0, moved = false, dragging = false;
    grab.addEventListener("pointerdown", e => { dragging = true; moved = false; y0 = e.clientY; h0 = sheet.getBoundingClientRect().height; grab.setPointerCapture(e.pointerId); sheet.classList.add("dragging"); });
    grab.addEventListener("pointermove", e => {
      if (!dragging) return;
      const dy = y0 - e.clientY; if (Math.abs(dy) > 5) moved = true;
      const H = heights(); setSheet(null, Math.max(H.peek - 40, Math.min(H.full, h0 + dy)));
    });
    const end = () => {
      if (!dragging) return; dragging = false; sheet.classList.remove("dragging");
      const H = heights(), h = sheet.getBoundingClientRect().height;
      if (!moved) { setSheet(sheetState === "peek" ? "half" : sheetState === "half" ? "full" : "peek"); return; }
      setSheet(Object.keys(H).reduce((a, b) => Math.abs(H[b] - h) < Math.abs(H[a] - h) ? b : a));
    };
    grab.addEventListener("pointerup", end); grab.addEventListener("pointercancel", end);
    addEventListener("resize", () => setSheet());
  })();

  // ---------- 카카오 지도 ----------
  let map = null, clusterer = null, meOverlay = null, selOverlay = null;
  const markers = new Map(), images = {};
  function loadKakao() {
    const key = ((window.APP_CONFIG || {}).kakaoKey || "").trim();
    if (!key) return Promise.reject("nokey");
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=clusterer&autoload=false`;
      s.onload = () => { const t = setTimeout(() => rej("timeout"), 8000); kakao.maps.load(() => { clearTimeout(t); res(); }); };
      s.onerror = () => rej("load");
      document.head.append(s);
    });
  }
  function svgUrl(svg) { return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); }
  function markerImage(n) {
    if (images[n]) return images[n];
    let svg, w;
    if (!n) {
      w = 14;
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"><circle cx="7" cy="7" r="5.5" fill="#33507e" stroke="#fff" stroke-width="1.6"/></svg>`;
    } else {
      w = n >= 10 ? 30 : 26; const r = w / 2 - 1.5;
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${w}"><circle cx="${w / 2}" cy="${w / 2}" r="${r}" fill="${BALL[tier(n)]}" stroke="#fff" stroke-width="2"/>` +
            `<text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="Consolas,monospace" font-weight="700" font-size="${n >= 10 ? 12 : 13}" fill="#1b1b1b">${n}</text></svg>`;
    }
    return images[n] = new kakao.maps.MarkerImage(svgUrl(svg), new kakao.maps.Size(w, w), { offset: new kakao.maps.Point(w / 2, w / 2) });
  }
  function markerFor(s) {
    let m = markers.get(s.id);
    if (!m) {
      m = new kakao.maps.Marker({ position: new kakao.maps.LatLng(s.lat, s.lon), image: markerImage(s.n), title: s.name, zIndex: s.n + 1 });
      kakao.maps.event.addListener(m, "click", () => select(s, false));
      markers.set(s.id, m);
    }
    return m;
  }
  function initMap() {
    map = new kakao.maps.Map($("map"), { center: new kakao.maps.LatLng(36.2, 127.8), level: 13 });
    const bubble = (size, bg) => ({ width: size + "px", height: size + "px", lineHeight: size + "px", background: bg, color: "#fff", borderRadius: "50%", textAlign: "center", fontWeight: "700", fontSize: "13px", border: "2px solid rgba(255,255,255,0.9)", boxShadow: "0 2px 6px rgba(0,0,0,0.25)" });
    clusterer = new kakao.maps.MarkerClusterer({
      map, averageCenter: true, minLevel: 6, gridSize: 70, disableClickZoom: false,
      calculator: [20, 100, 500],
      styles: [bubble(34, "rgba(31,79,184,0.82)"), bubble(42, "rgba(31,79,184,0.88)"), bubble(50, "rgba(22,58,140,0.9)"), bubble(58, "rgba(16,40,100,0.92)")]
    });
    kakao.maps.event.addListener(map, "click", () => { if (selected) closeDetail(); });
  }
  function updateMarkers() {
    if (!clusterer) return;
    clusterer.clear();
    clusterer.addMarkers(filtered.map(markerFor));
  }
  function fitTo(list) {
    if (!map || !list.length) return;
    const b = new kakao.maps.LatLngBounds();
    list.forEach(s => b.extend(new kakao.maps.LatLng(s.lat, s.lon)));
    map.setBounds(b, 140, 30, heights().half, 30);
  }
  function focusStore(s) {
    if (!map) return;
    const pos = new kakao.maps.LatLng(s.lat, s.lon);
    if (map.getLevel() > 4) map.setLevel(3);
    map.panTo(pos);
    const label = el("div", "pick", s.name);
    if (selOverlay) selOverlay.setMap(null);
    selOverlay = new kakao.maps.CustomOverlay({ position: pos, content: label, yAnchor: 1, zIndex: 100 });
    selOverlay.setMap(map);
  }

  // ---------- 목록 ----------
  function applyFilter() {
    const terms = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    filtered = stores.filter(s => (!state.si || s.si === state.si) && (!state.gu || s.gu === state.gu) &&
      (!state.onlyWin || s.n > 0) && terms.every(t => s.key.includes(t)));
    if (origin) for (const s of filtered) s.d = km(origin, s);
    const byName = (a, b) => a.name.localeCompare(b.name, "ko");
    if (state.sort === "dist" && origin) filtered.sort((a, b) => a.d - b.d);
    else if (state.sort === "name") filtered.sort(byName);
    else filtered.sort((a, b) => b.n - a.n || (origin ? a.d - b.d : byName(a, b)));
    shown = PAGE;
    renderList();
    updateMarkers();
  }
  function renderList() {
    const list = $("list"), wins = filtered.reduce((c, s) => c + (s.n > 0), 0);
    $("count").textContent = `${filtered.length.toLocaleString()}곳 · 1등 배출 ${wins.toLocaleString()}곳`;
    list.textContent = "";
    if (!filtered.length) { list.append(el("li", "empty", "조건에 맞는 판매점이 없어요. 검색어를 줄이거나 지역을 '전국'으로 바꿔 보세요.")); return; }
    const frag = document.createDocumentFragment();
    for (const s of filtered.slice(0, shown)) {
      const li = el("li", "item"); li.dataset.id = s.id; li.tabIndex = 0;
      const ball = el("div", "ball" + (s.n ? "" : " none"), s.n ? String(s.n) : "");
      if (s.n) ball.style.background = BALL[tier(s.n)];
      const body = el("div"); body.style.minWidth = "0";
      body.append(el("div", "name", s.name), el("div", "addr", s.addr));
      li.append(ball, body, el("div", "dist", origin ? fmtKm(s.d) : ""));
      frag.append(li);
    }
    list.append(frag);
    if (filtered.length > shown) {
      const b = el("button", "more", `더 보기 (남은 ${(filtered.length - shown).toLocaleString()}곳)`);
      b.onclick = () => { const top = list.scrollTop; shown += PAGE; renderList(); list.scrollTop = top; };
      list.append(b);
    }
  }
  const byId = id => stores.find(s => s.id === id);
  $("list").addEventListener("click", e => { const li = e.target.closest(".item"); if (li) select(byId(li.dataset.id), true); });
  $("list").addEventListener("keydown", e => { const li = e.target.closest(".item"); if (li && e.key === "Enter") select(byId(li.dataset.id), true); });

  // ---------- 상세 ----------
  function select(s) {
    selected = s;
    const d = $("detail"); d.textContent = "";
    const back = el("button", "back", "‹ 목록으로"); back.onclick = closeDetail;
    const meta = el("div", "meta", s.addr);
    if (origin) meta.append(el("div", "", `내 위치에서 ${fmtKm(km(origin, s))}`));
    d.append(back, el("h2", "", s.name), meta);

    const acts = el("div", "actions");
    const a = (cls, text, href) => { const x = el("a", cls, text); x.href = href; if (href.startsWith("http")) { x.target = "_blank"; x.rel = "noopener"; } acts.append(x); };
    a("primary", "길찾기", `https://map.kakao.com/link/to/${encodeURIComponent(s.name)},${s.lat},${s.lon}`);
    if (s.tel) a("", "전화", `tel:${s.tel.replace(/[^\d+]/g, "")}`);
    a("", "카카오맵에서 보기", `https://map.kakao.com/link/map/${encodeURIComponent(s.name)},${s.lat},${s.lon}`);
    d.append(acts);
    if (s.tel) d.append(el("div", "meta", `전화 ${s.tel}`));

    const w = el("div", "wins"), sum = el("div", "sum");
    const ball = el("div", "ball" + (s.n ? "" : " none"), s.n ? String(s.n) : "");
    if (s.n) ball.style.background = BALL[tier(s.n)];
    sum.append(ball);
    if (s.n) {
      const c = { A: 0, M: 0, S: 0 }; s.wins.forEach(x => c[x.mode]++);
      const t = el("div", "", `1등 ${s.n}회 배출`);
      t.append(el("div", "split", [c.A && `자동 ${c.A}`, c.M && `수동 ${c.M}`, c.S && `반자동 ${c.S}`].filter(Boolean).join(" · ")));
      sum.append(t); w.append(sum);
      const dr = el("div", "draws"), LIMIT = 12;
      const fill = n => { dr.textContent = ""; s.wins.slice(0, n).forEach(x => dr.append(el("span", "", `${x.draw}회 ${MODE[x.mode]}`))); };
      fill(LIMIT); w.append(dr);
      if (s.n > LIMIT) { const m = el("button", "chip", `이전 ${s.n - LIMIT}회 더 보기`); m.onclick = () => { fill(s.n); m.remove(); }; w.append(m); }
    } else {
      sum.append(el("div", "split", `${meta.drawMin || ""}~${meta.drawMax || ""}회 동안 1등 기록 없음`.replace(/^~회 /, ""))); w.append(sum);
    }
    d.append(w);
    $("listView").hidden = true; d.hidden = false; d.scrollTop = 0;
    if (sheetState === "peek" || sheetState === "full") setSheet("half");
    focusStore(s);
  }
  function closeDetail() {
    selected = null; $("detail").hidden = true; $("listView").hidden = false;
    if (selOverlay) { selOverlay.setMap(null); selOverlay = null; }
  }

  // ---------- 내 위치 ----------
  function getPosition() {
    return new Promise((res, rej) => {
      if (!navigator.geolocation) return rej(new Error("unsupported"));
      // 권한 창에 답하지 않으면 브라우저 timeout이 시작되지 않으므로 따로 끊음
      setTimeout(() => rej(new Error("timeout")), 15000);
      toast("위치를 확인하는 중이에요…", 15000);
      navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lon: p.coords.longitude }), rej, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
    });
  }
  function showMe(p) {
    if (!map) return;
    const pos = new kakao.maps.LatLng(p.lat, p.lon);
    if (!meOverlay) meOverlay = new kakao.maps.CustomOverlay({ content: el("div", "me"), zIndex: 50 });
    meOverlay.setPosition(pos); meOverlay.setMap(map);
    map.setLevel(4); map.panTo(pos);
  }
  async function useNear() {
    let p, label = "내 위치";
    try { p = await getPosition(); $("toast").hidden = true; }
    catch (e) {
      if (!map) { toast("위치를 확인할 수 없어요. 폰 설정에서 이 앱(브라우저)의 위치 권한을 켜 주세요."); return false; }
      const c = map.getCenter(); p = { lat: c.getLat(), lon: c.getLng() }; label = "지도 가운데";
      toast("위치 권한이 없어 지도 가운데를 기준으로 찾았어요.");
    }
    origin = p;
    state.si = ""; state.gu = ""; $("si").value = ""; fillGu();
    state.sort = "dist"; $("sort").value = "dist";
    $("near").setAttribute("aria-pressed", "true");
    applyFilter();
    if (label === "내 위치") showMe(p);
    $("list").scrollTop = 0; closeDetail(); setSheet("half");
    return true;
  }
  $("near").onclick = () => {
    if (origin) {
      origin = null; $("near").setAttribute("aria-pressed", "false");
      if (meOverlay) meOverlay.setMap(null);
      if (state.sort === "dist") { state.sort = "wins"; $("sort").value = "wins"; }
      applyFilter(); return;
    }
    useNear();
  };
  $("locate").onclick = async () => {
    try { const p = await getPosition(); $("toast").hidden = true; showMe(p); }
    catch { toast("위치를 확인할 수 없어요. 위치 권한을 허용했는지 확인해 주세요."); }
  };

  // ---------- 입력 ----------
  function fillGu() {
    const g = $("gu"); g.textContent = ""; g.append(new Option("구·군 전체", ""));
    if (!state.si) { g.hidden = true; return; }
    [...new Set(stores.filter(s => s.si === state.si && s.gu).map(s => s.gu))].sort((a, b) => a.localeCompare(b, "ko")).forEach(x => g.append(new Option(x, x)));
    g.hidden = false;
  }
  let qt = 0;
  $("q").addEventListener("input", e => {
    $("clearQ").hidden = !e.target.value;
    clearTimeout(qt); qt = setTimeout(() => { state.q = e.target.value.trim(); applyFilter(); if (state.q && filtered.length && filtered.length <= 300) fitTo(filtered); }, 220);
  });
  $("q").addEventListener("keydown", e => { if (e.key === "Enter") { e.target.blur(); setSheet("half"); } });
  $("clearQ").onclick = () => { $("q").value = ""; $("clearQ").hidden = true; state.q = ""; applyFilter(); };
  $("si").addEventListener("change", e => { state.si = e.target.value; state.gu = ""; fillGu(); applyFilter(); if (state.si) fitTo(filtered); else if (map) map.setLevel(13); });
  $("gu").addEventListener("change", e => { state.gu = e.target.value; applyFilter(); fitTo(filtered); });
  $("onlyWin").onclick = e => { state.onlyWin = !state.onlyWin; e.currentTarget.setAttribute("aria-pressed", state.onlyWin); applyFilter(); };
  $("sort").addEventListener("change", async e => {
    state.sort = e.target.value;
    if (state.sort === "dist" && !origin) { if (!(await useNear())) { state.sort = "wins"; e.target.value = "wins"; } return; }
    applyFilter();
  });

  // ---------- 시작 ----------
  setSheet("peek");
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});

  const mapReady = loadKakao().then(initMap).catch(reason => {
    const n = $("nomap"); n.hidden = false;
    const b = el("b", "", reason === "nokey" ? "지도 키가 아직 없어요" : "지도를 불러오지 못했어요");
    n.append(b, reason === "nokey"
      ? "config.js에 카카오 JavaScript 키를 넣으면 지도가 나와요. 목록·검색·내 주변 찾기는 지금도 쓸 수 있어요."
      : "인터넷 연결, 카카오 키, 카카오 개발자 사이트에 등록한 도메인을 확인해 주세요. 목록과 검색은 지금도 쓸 수 있어요.");
  });

  fetch("stores.json").then(r => r.json()).then(async sd => {
    meta = sd;
    stores = sd.rows.map(parseStore).filter(s => !s.name.includes("인터넷 복권판매사이트"));
    const sis = new Set(stores.map(s => s.si));
    [...SI_ORDER.filter(s => sis.has(s)), ...[...sis].filter(s => !SI_ORDER.includes(s)).sort()].forEach(s => $("si").append(new Option(s, s)));
    await mapReady;
    applyFilter();
  }).catch(() => { $("count").textContent = "판매점 자료를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 열어 주세요."; });
})();
