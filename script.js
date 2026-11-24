(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  /* ============================================================
     Mapa esquemático do Chifre da África (projeção equirretangular)
     ============================================================ */
  const K = 20, LON0 = 32, LAT0 = 30.5, W = 410, H = 670;
  const P = ([lon, lat]) => [((lon - LON0) * K).toFixed(1), ((LAT0 - lat) * K).toFixed(1)];
  const poly = (pts) => "M" + pts.map((p) => P(p).join(",")).join(" L") + " Z";

  // Catmull-Rom → Bézier para uma rota suave
  const smooth = (pts) => {
    const q = pts.map((p) => P(p).map(Number));
    let d = `M${q[0][0]},${q[0][1]}`;
    for (let i = 0; i < q.length - 1; i++) {
      const p0 = q[i - 1] || q[i], p1 = q[i], p2 = q[i + 1], p3 = q[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  };

  const AFRICA = [
    [30, 31], [32.55, 31], [32.55, 29.95], [32.6, 29.4], [32.9, 28.6], [33.6, 27.3], [34.0, 26.5], [35.4, 24.0],
    [36.9, 22.0], [37.2, 19.6], [38.6, 18.0], [39.5, 15.6], [40.2, 14.9], [41.7, 13.6], [42.7, 13.0], [43.25, 12.5],
    [43.1, 11.6], [43.3, 11.45], [44.2, 10.7], [45.0, 10.45], [46.5, 10.75], [47.5, 11.1], [48.9, 11.25], [49.2, 11.3],
    [50.4, 11.6], [51.27, 11.8], [51.1, 11.0], [51.4, 10.4], [50.8, 9.3], [49.8, 7.95], [48.5, 5.35], [47.3, 3.9],
    [45.3, 2.05], [43.7, 0.9], [42.5, -0.36], [41.55, -1.67], [40.9, -2.3], [40.2, -3.5], [30, -3.5],
  ];
  const ARABIA = [
    [32.75, 31], [32.75, 29.85], [33.25, 28.9], [34.2, 27.75], [34.45, 28.3], [34.9, 29.5], [35.0, 29.3], [34.85, 28.1],
    [35.6, 27.3], [36.6, 25.9], [37.3, 24.5], [38.1, 24.0], [39.1, 21.5], [40.5, 19.0], [41.6, 17.0], [42.5, 16.0],
    [42.8, 14.8], [43.5, 12.7], [45.0, 12.8], [46.5, 13.4], [48.7, 14.0], [50.5, 15.0], [53, 16.2], [53, 31],
  ];
  const SOMALIA = [
    [43.3, 11.45], [44.2, 10.7], [45.0, 10.45], [46.5, 10.75], [47.5, 11.1], [48.9, 11.25], [49.2, 11.3], [50.4, 11.6],
    [51.27, 11.8], [51.1, 11.0], [51.4, 10.4], [50.8, 9.3], [49.8, 7.95], [48.5, 5.35], [47.3, 3.9], [45.3, 2.05],
    [43.7, 0.9], [42.5, -0.36], [41.55, -1.67], [41.0, -0.9], [41.0, 2.8], [41.9, 3.95], [43.6, 4.0], [45.0, 4.9],
    [47.9, 8.0], [44.0, 9.0], [42.9, 10.95],
  ];
  const SOMALILAND = [
    [43.3, 11.45], [44.2, 10.7], [45.0, 10.45], [46.5, 10.75], [47.5, 11.1], [48.9, 11.25], [49.0, 9.6], [47.9, 8.0],
    [44.0, 9.0], [42.9, 10.95],
  ];
  const ROUTE = [
    [51.9, 4.5], [52.0, 10.6], [51.6, 12.25], [47.5, 12.85], [45.2, 11.95], [43.38, 12.6], [42.3, 14.2],
    [40.3, 17.5], [38.2, 21.5], [35.6, 25.5], [34.0, 27.3], [33.4, 28.4], [32.85, 29.3], [32.65, 29.95],
  ];
  // pontos de parada (Índico, Áden, Bab-el-Mandeb, Mar Vermelho, Suez)
  const STOPS = [[51.9, 4.5], [47.5, 12.85], [43.38, 12.6], [38.2, 21.5], [32.65, 29.95]];
  const PORTS = [
    { name: "Berbera", at: [45.0, 10.45], dx: -8, dy: 22, anchor: "end" },
    { name: "Bosaso", at: [49.2, 11.3], dx: 0, dy: 22, anchor: "middle" },
    { name: "Mogadíscio", at: [45.3, 2.05], dx: -10, dy: 4, anchor: "end" },
  ];

  const text = (lonlat, str, cls, extra = "") => {
    const [x, y] = P(lonlat);
    return `<text class="lbl ${cls}" x="${x}" y="${y}" ${extra}>${str}</text>`;
  };

  function buildMap(kind) {
    const route = smooth(ROUTE);
    let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
    s += `<rect class="sea" width="${W}" height="${H}"/>`;
    // ondulações decorativas no oceano
    for (let i = 0; i < 6; i++) {
      const y = 430 + i * 38;
      s += `<path class="wiggle" d="M${300 + (i % 2) * 20},${y} q10,-6 20,0 t20,0 t20,0 t20,0"><animateTransform attributeName="transform" type="translate" values="0 0; 8 0; 0 0" dur="${4 + i}s" repeatCount="indefinite"/></path>`;
    }
    s += `<path class="land" d="${poly(AFRICA)}"/>`;
    s += `<path class="land" d="${poly(ARABIA)}"/>`;
    s += `<g data-group="risk eth tur ports"><path class="somalia" d="${poly(SOMALIA)}"/></g>`;
    s += `<g data-group="risk"><path class="somaliland" d="${poly(SOMALILAND)}"/></g>`;

    s += text([40.5, 25.5], "Mar Vermelho", "lbl--sea", `transform="rotate(-58 ${P([38.6, 22.6]).join(" ")})"`);
    s += text([45.5, 11.5], "Golfo de Áden", "lbl--sea", `font-size="10"`);
    s += text([46.5, -1.5], "Oceano Índico", "lbl--sea");
    s += text([45.0, 21], "Arábia Saudita", "lbl--country");
    s += text([46.8, 15.6], "Iêmen", "lbl--country");
    s += text([36.0, 8], "Etiópia", "lbl--country", `data-group="eth"`);
    s += text([37.2, 0.5], "Quênia", "lbl--country");
    s += text([32.9, 24.2], "Egito", "lbl--country", `data-group="eth"`);
    s += text([45.6, 6.4], "Somália", "lbl--somalia");

    if (kind === "route") {
      s += `<path class="route-bg" d="${route}"/>`;
      s += `<path class="route" id="ship-route" d="${route}"/>`;
      STOPS.forEach((st, i) => {
        const [x, y] = P(st);
        s += `<circle class="stop" data-stop="${i}" cx="${x}" cy="${y}" r="5"/>`;
      });
      s += text([42.9, 12.75], "Bab-el-Mandeb", "", `text-anchor="end"`);
      s += text([33.2, 30.15], "Suez", "", `text-anchor="start" dx="4"`);
      s += `<g class="ship-g"><path class="ship-wake" d="M-14,-4 Q-8,0 -14,4"/><path class="ship" d="M-8,-5 L9,0 L-8,5 L-5,0 Z"/></g>`;
    } else {
      s += `<path class="route-bg" d="${route}"/>`;
      s += `<path class="route" d="${route}"/>`;
      // Etiópia buscando o mar
      const e1 = P([39.0, 9.5]), e2 = P([44.6, 10.9]);
      s += `<g data-group="eth"><path d="M${e1[0]},${e1[1]} Q${(+e1[0] + +e2[0]) / 2},${+e1[1] - 60} ${e2[0]},${e2[1]}" fill="none" stroke="#d8952a" stroke-width="2.5" stroke-dasharray="6 6"><animate attributeName="stroke-dashoffset" from="24" to="0" dur="1s" repeatCount="indefinite"/></path></g>`;
      PORTS.forEach((p) => {
        const [x, y] = P(p.at);
        const grp = p.name === "Mogadíscio" ? "ports tur" : "ports";
        s += `<g data-group="${grp}"><circle class="port-ring" cx="${x}" cy="${y}" r="6"/><circle class="port" cx="${x}" cy="${y}" r="5"/>`;
        s += `<text class="lbl" x="${+x + p.dx}" y="${+y + p.dy}" text-anchor="${p.anchor}">${p.name}</text></g>`;
      });
      const [tx, ty] = P([45.3, 2.05]);
      s += `<g data-group="tur"><text class="lbl" x="${+tx + 12}" y="${+ty + 24}" fill="#5aa0e6" style="fill:#5aa0e6">base turca</text></g>`;
      s += `<g data-group="risk"><text class="lbl" x="${P([47.4, 9.7])[0]}" y="${P([47.4, 9.7])[1]}" text-anchor="middle" font-size="9">Somalilândia</text></g>`;
    }
    s += `</svg>`;
    return s;
  }

  $$("[data-map]").forEach((el) => (el.innerHTML = buildMap(el.dataset.map)));

  /* ---------- rota do navio (seção 01) ---------- */
  const routePath = $("#ship-route");
  const ship = $(".ship-g");
  let routeLen = 0, stopFractions = [];
  if (routePath) {
    routeLen = routePath.getTotalLength();
    routePath.style.strokeDasharray = routeLen;
    routePath.style.strokeDashoffset = routeLen;
    // fração do comprimento mais próxima de cada parada
    const samples = [];
    for (let i = 0; i <= 400; i++) samples.push(routePath.getPointAtLength((i / 400) * routeLen));
    stopFractions = STOPS.map((st) => {
      const [sx, sy] = P(st).map(Number);
      let best = 0, bd = Infinity;
      samples.forEach((pt, i) => { const d = (pt.x - sx) ** 2 + (pt.y - sy) ** 2; if (d < bd) { bd = d; best = i / 400; } });
      return best;
    });
  }
  const stopDots = $$(".map .stop");
  const stopNames = $$(".route-steps li");
  const locSec = $("#localizacao");

  function updateShip() {
    if (!routePath) return;
    const r = locSec.getBoundingClientRect();
    const vh = window.innerHeight;
    const t = clamp((vh * 0.6 - r.top) / (r.height - vh * 0.4), 0, 1);
    const len = t * routeLen;
    routePath.style.strokeDashoffset = routeLen - len;
    const p = routePath.getPointAtLength(len);
    const p2 = routePath.getPointAtLength(Math.min(routeLen, len + 2));
    const ang = (Math.atan2(p2.y - p.y, p2.x - p.x) * 180) / Math.PI;
    ship.setAttribute("transform", `translate(${p.x},${p.y}) rotate(${len >= routeLen - 2 ? -60 : ang})`);
    let here = -1;
    stopFractions.forEach((f, i) => {
      const on = t >= f - 0.005;
      if (on) here = i;
      stopDots[i]?.classList.toggle("is-on", on);
      stopNames[i]?.classList.toggle("is-on", on);
    });
    stopNames.forEach((n, i) => n.classList.toggle("is-here", i === here));
  }

  /* ============================================================
     Mar animado (hero e rodapé): linhas batimétricas fluindo
     ============================================================ */
  function sea(canvas, { lines = 26, color = "246,238,219", accent = "90,160,230", interactive = true } = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let w, h, dpr, mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999 }, visible = true, t = 0;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    if (interactive) {
      const host = canvas.parentElement;
      host.addEventListener("pointermove", (e) => {
        const r = canvas.getBoundingClientRect();
        mouse.tx = e.clientX - r.left; mouse.ty = e.clientY - r.top;
        if (mouse.x < -9000) { mouse.x = mouse.tx; mouse.y = mouse.ty; }
      });
      host.addEventListener("pointerleave", () => { mouse.tx = -9999; mouse.ty = -9999; mouse.x = -9999; mouse.y = -9999; });
    }
    new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      mouse.x += (mouse.tx - mouse.x) * 0.08;
      mouse.y += (mouse.ty - mouse.y) * 0.08;
      const gap = h / (lines + 1);
      for (let i = 1; i <= lines; i++) {
        const base = i * gap;
        const depth = i / lines;
        ctx.beginPath();
        for (let x = -10; x <= w + 10; x += 12) {
          let y = base
            + Math.sin(x * 0.004 + t * 0.6 + i * 0.5) * (10 + depth * 18)
            + Math.sin(x * 0.011 - t * 0.9 + i) * 6
            + Math.sin(x * 0.0015 + t * 0.25) * 30 * depth;
          const dx = x - mouse.x, dy = base - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 220) y += (dy > 0 ? 1 : -1) * (1 - dist / 220) ** 2 * 46;
          x === -10 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        const hi = i % 7 === 3;
        ctx.strokeStyle = hi ? `rgba(${accent},${0.25 + depth * 0.3})` : `rgba(${color},${0.04 + depth * 0.1})`;
        ctx.lineWidth = hi ? 1.6 : 1;
        ctx.stroke();
      }
    };
    const loop = () => {
      if (visible) { t += 0.016; draw(); }
      if (!reduceMotion) requestAnimationFrame(loop);
    };
    reduceMotion ? draw() : loop();
  }
  sea($(".hero__sea"));
  sea($(".end__sea"), { lines: 16, interactive: false });

  /* ============================================================
     Linha do tempo horizontal (seção 02)
     ============================================================ */
  const histSec = $("#historia");
  const track = $(".history__track");
  const eras = $$(".era");
  function updateHistory() {
    const r = histSec.getBoundingClientRect();
    const vh = window.innerHeight;
    const p = clamp(-r.top / (r.height - vh), 0, 1);
    const max = track.scrollWidth - window.innerWidth + window.innerWidth * 0.1;
    track.style.transform = `translate3d(${-p * Math.max(0, max)}px,0,0)`;
    histSec.style.setProperty("--hp", p);
    const focus = window.innerWidth * (window.innerWidth < 900 ? 0.35 : 0.45);
    eras.forEach((e) => {
      const er = e.getBoundingClientRect();
      e.classList.toggle("is-near", er.left < focus + 40 && er.left > -er.width * 0.5);
    });
  }

  /* ---------- linha das missões da ONU ---------- */
  const missions = $(".missions");
  function updateMissions() {
    const r = missions.getBoundingClientRect();
    const vh = window.innerHeight;
    missions.style.setProperty("--mp", clamp((vh * 0.8 - r.top) / r.height, 0, 1));
  }

  /* ---------- navegação lateral ---------- */
  const nav = $(".route-nav");
  const navLinks = $$(".route-nav a");
  const targets = navLinks.map((a) => $(a.getAttribute("href")));
  function updateNav() {
    const doc = document.documentElement;
    const p = clamp(window.scrollY / (doc.scrollHeight - window.innerHeight), 0, 1);
    nav.style.setProperty("--p", p);
    let active = -1;
    targets.forEach((t, i) => { if (t.getBoundingClientRect().top < window.innerHeight * 0.45) active = i; });
    navLinks.forEach((a, i) => {
      a.classList.toggle("is-active", i === active);
      if (i === active) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
    });
  }

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateShip(); updateHistory(); updateMissions(); updateNav();
      ticking = false;
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();

  /* ============================================================
     Revelações pontuais e contadores
     ============================================================ */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in-view");
      $$(".count", e.target).forEach(countUp);
      if (e.target.classList.contains("count")) countUp(e.target);
      io.unobserve(e.target);
    });
  }, { threshold: 0.35 });
  $$(".loop, .scale, .chain, .peace__path, .bignum, [data-reveal]").forEach((el) => io.observe(el));

  function countUp(el) {
    if (el.dataset.done) return;
    el.dataset.done = "1";
    const to = +el.dataset.to, pre = el.dataset.prefix || "", suf = el.dataset.suffix || "";
    if (reduceMotion) return;
    const start = performance.now(), dur = 1600;
    const step = (now) => {
      const k = clamp((now - start) / dur, 0, 1);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = pre + Math.round(e * to) + suf;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ============================================================
     Paradoxo do Al-Shabaab (comparador)
     ============================================================ */
  const stage = $(".paradox__stage");
  const range = $("#paradox-range");
  if (stage && range) {
    const set = (v) => { stage.style.setProperty("--split", v + "%"); range.value = v; };
    range.addEventListener("input", () => set(range.value));
    let dragging = false;
    const fromEvent = (e) => {
      const r = stage.getBoundingClientRect();
      set(clamp(((e.clientX - r.left) / r.width) * 100, 8, 92).toFixed(1));
    };
    stage.addEventListener("pointerdown", (e) => { dragging = true; stage.setPointerCapture(e.pointerId); fromEvent(e); });
    stage.addEventListener("pointermove", (e) => dragging && fromEvent(e));
    stage.addEventListener("pointerup", () => (dragging = false));
    stage.style.cursor = "ew-resize";
    stage.style.touchAction = "pan-y";
  }

  /* ============================================================
     Distribuição do poder (rede)
     ============================================================ */
  const POWER = [
    { id: "gov", label: "Governo Federal", x: 50, y: 50, center: true,
      text: "Sediado em Mogadíscio: autoridade nacional e relações externas, mas sem controle pleno do território." },
    { id: "est", label: "Estados regionais", x: 17, y: 16,
      text: "Puntlândia, Jubalândia, Galmudug, Hirshabelle, Sudoeste e Banadir: autonomia, recursos e segurança local." },
    { id: "sl", label: "Somalilândia", x: 50, y: 8,
      text: "Autodeclarada independente desde 1991, sem reconhecimento internacional amplo." },
    { id: "cla", label: "Clãs", x: 83, y: 16,
      text: "Darod, Hawiye, Dir, Isaaq e Rahanweyn: base de pertencimento, representação e barganha política." },
    { id: "ext", label: "Forças estrangeiras", x: 84, y: 76,
      text: "Missões africanas, aliados como a Turquia e operações aéreas externas sustentam a segurança, mas também disputam influência." },
    { id: "mil", label: "Milícias", x: 50, y: 92,
      text: "Grupos armados locais, muitas vezes ligados a clãs, que impedem o monopólio da violência pelo Estado." },
    { id: "ash", label: "Al-Shabaab", x: 16, y: 76, hostile: true,
      text: "Insurgência que controla áreas do centro-sul e disputa governança com o Estado." },
  ];
  const web = $(".power__web");
  const nodesBox = $(".power__nodes");
  const detail = $(".power__detail");
  if (web && nodesBox) {
    const c = POWER[0];
    POWER.slice(1).forEach((n) => {
      web.insertAdjacentHTML("beforeend",
        `<line data-id="${n.id}" x1="${c.x * 8}" y1="${c.y * 5.6}" x2="${n.x * 8}" y2="${n.y * 5.6}" />`);
    });
    POWER.forEach((n, i) => {
      const b = document.createElement("button");
      b.className = "pnode" + (n.center ? " pnode--center" : "") + (n.hostile ? " pnode--hostile" : "");
      b.textContent = n.label;
      b.style.setProperty("--x", n.x + "%");
      b.style.setProperty("--y", n.y + "%");
      b.style.setProperty("--d", -i * 0.9 + "s");
      b.setAttribute("aria-pressed", n.center ? "true" : "false");
      b.addEventListener("click", () => {
        $$(".pnode", nodesBox).forEach((x) => x.setAttribute("aria-pressed", "false"));
        b.setAttribute("aria-pressed", "true");
        $$("line", web).forEach((l) => l.classList.toggle("is-hot", l.dataset.id === n.id));
        $(".power__detail-title").textContent = n.label;
        $(".power__detail-text").textContent = n.text;
        detail.classList.remove("swap"); void detail.offsetWidth; detail.classList.add("swap");
      });
      nodesBox.appendChild(b);
    });
  }

  /* ============================================================
     Influência estrangeira: abas destacam partes do mapa
     ============================================================ */
  const tabs = $$(".influence__tabs [role=tab]");
  const portsMap = $('[data-map="ports"]');
  const focusMap = (key) => {
    portsMap.classList.add("dim-others");
    $$("[data-group]", portsMap).forEach((g) => g.classList.toggle("on", g.dataset.group.split(" ").includes(key)));
  };
  tabs.forEach((tab, idx) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.setAttribute("aria-selected", t === tab ? "true" : "false"));
      $$(".influence__panel [data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== tab.dataset.focus));
      focusMap(tab.dataset.focus);
    });
    tab.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const next = tabs[(idx + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      next.focus(); next.click();
    });
  });
  if (portsMap) focusMap("ports");

  /* ============================================================
     Mapa de tensões: núcleo puxado por molas
     ============================================================ */
  const tension = $(".tension");
  if (tension) {
    const core = $(".tension__core", tension);
    const svg = $(".tension__lines", tension);
    const forces = $$(".force", tension);
    const paths = $$("path", svg);
    let pos = { x: 0, y: 0 }, vel = { x: 0, y: 0 }, target = { x: 0, y: 0 }, visible = false;
    let rect = tension.getBoundingClientRect();

    tension.addEventListener("pointermove", (e) => {
      rect = tension.getBoundingClientRect();
      const mx = e.clientX - rect.left - rect.width / 2;
      const my = e.clientY - rect.top - rect.height / 2;
      const lim = Math.min(rect.width, rect.height) * 0.22;
      const d = Math.hypot(mx, my) || 1;
      const k = Math.min(1, lim / d);
      target = { x: mx * k, y: my * k };
    });
    tension.addEventListener("pointerleave", () => (target = { x: 0, y: 0 }));
    new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(tension);

    let t = 0;
    const tick = () => {
      if (visible) {
        t += 0.016;
        rect = tension.getBoundingClientRect();
        const W2 = rect.width, H2 = rect.height;
        svg.setAttribute("viewBox", `0 0 ${W2} ${H2}`);
        // deriva lenta quando ninguém interage
        const idle = target.x === 0 && target.y === 0;
        const tx = idle ? Math.sin(t * 0.7) * W2 * 0.04 : target.x;
        const ty = idle ? Math.cos(t * 0.5) * H2 * 0.04 : target.y;
        vel.x = (vel.x + (tx - pos.x) * 0.06) * 0.86;
        vel.y = (vel.y + (ty - pos.y) * 0.06) * 0.86;
        pos.x += vel.x; pos.y += vel.y;
        core.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
        const cx = W2 / 2 + pos.x, cy = H2 / 2 + pos.y;
        let nearest = null, nd = Infinity;
        forces.forEach((f, i) => {
          const fx = (parseFloat(getComputedStyle(f).getPropertyValue("--x")) / 100) * W2;
          const fy = (parseFloat(getComputedStyle(f).getPropertyValue("--y")) / 100) * H2;
          const d = Math.hypot(fx - cx, fy - cy);
          if (d < nd) { nd = d; nearest = f; }
          // curva com "folga" proporcional à velocidade
          const gap = Math.min(d * 0.5, f.offsetHeight * 0.75 + 8);
          const ex = fx + ((cx - fx) / (d || 1)) * gap, ey = fy + ((cy - fy) / (d || 1)) * gap;
          const mx = (cx + ex) / 2 - vel.y * 6, my = (cy + ey) / 2 + vel.x * 6;
          const p = paths.find((pp) => pp.dataset.to === f.dataset.id);
          p.setAttribute("d", `M${cx},${cy} Q${mx},${my} ${ex},${ey}`);
          p.style.strokeWidth = 1.5 + Math.max(0, 1 - d / (Math.max(W2, H2) * 0.6)) * 4;
        });
        forces.forEach((f) => f.classList.toggle("is-pull", f === nearest && Math.hypot(pos.x, pos.y) > 20));
      }
      if (!reduceMotion) requestAnimationFrame(tick);
    };
    if (reduceMotion) { visible = true; tick(); } else tick();
  }

  /* ============================================================
     Questões
     ============================================================ */
  $$(".q").forEach((q) => {
    const answer = q.dataset.answer;
    const btns = $$(".q__opts button", q);
    btns.forEach((b) => {
      b.addEventListener("click", () => {
        const right = b.dataset.opt === answer;
        btns.forEach((x) => {
          x.disabled = true;
          if (x.dataset.opt === answer) x.classList.add("is-right");
        });
        if (!right) b.classList.add("is-wrong");
        const why = $(".q__why", q);
        why.hidden = false;
        $$(".q__flow li", why).forEach((li) => { li.style.animation = "none"; void li.offsetWidth; li.style.animation = ""; });
      });
    });
  });
})();
