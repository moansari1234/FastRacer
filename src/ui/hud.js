import { fmtTime } from "../utils.js";

export class HUD {
  constructor(root, opts) {
    this.root = root;
    this.opts = opts;
    this.input = opts.input;
    this.settings = opts.settings;
    this.el = {};
    this.notifQueue = [];
    this._notifCd = new Map();
    root.innerHTML = `
      <div class="hud-topleft">
        <div class="hud-pos"><span id="h-pos">1</span><small id="h-total">/8</small></div>
        <div class="hud-lap">LAP <span id="h-lap">1</span>/<span id="h-laps">3</span></div>
        <div class="hud-time" id="h-time">0:00.000</div>
        <div class="hud-damage"><i id="h-dmgbar"></i></div>
      </div>
      <div class="hud-topcenter">
        <div id="h-countdown"></div>
        <div id="h-notifs"></div>
        <div id="h-wrongway" class="hidden">&#9888; WRONG WAY &#9888;</div>
        <div id="h-elim" class="hidden">ELIMINATION IN <span id="h-elimt">18</span>s &middot; <span id="h-alive">6</span> LEFT</div>
      </div>
      <div class="hud-topright">
        <canvas id="h-minimap" width="150" height="150"></canvas>
      </div>
      <div class="hud-bottomright">
        <div id="h-boostlabel"></div>
        <div class="nitro-wrap"><div class="nitro-zone"></div><i id="h-nitrofill"></i><b id="h-perfectmark" class="hidden"></b></div>
        <canvas id="h-speedo" width="190" height="150"></canvas>
      </div>
      <canvas id="h-speedlines"></canvas>
      <div id="h-flash"></div>
      <div id="h-touchui" class="hidden">
        <div class="t-left">
          <button data-k="left" class="tbtn t-steer">&#9664;</button>
          <button data-k="right" class="tbtn t-steer">&#9654;</button>
        </div>
        <div class="t-right">
          <button data-k="shock" class="tbtn t-shock">SW</button>
          <button data-k="nitro" class="tbtn t-nitro">NITRO</button>
          <button data-k="drift" class="tbtn t-drift">DRIFT</button>
          <button data-k="down" class="tbtn t-brake">BRAKE</button>
        </div>
      </div>
      <div id="h-fps" class="hidden"></div>
    `;
    const q = (id) => root.querySelector("#" + id);
    this.el.pos = q("h-pos");
    this.el.total = q("h-total");
    this.el.lap = q("h-lap");
    this.el.laps = q("h-laps");
    this.el.time = q("h-time");
    this.el.dmg = q("h-dmgbar");
    this.el.countdown = q("h-countdown");
    this.el.notifs = q("h-notifs");
    this.el.wrongway = q("h-wrongway");
    this.el.elim = q("h-elim");
    this.el.elimT = q("h-elimt");
    this.el.alive = q("h-alive");
    this.el.nitro = q("h-nitrofill");
    this.el.perfectMark = q("h-perfectmark");
    this.el.boostLabel = q("h-boostlabel");
    this.el.speedlines = q("h-speedlines");
    this.el.flash = q("h-flash");
    this.el.fps = q("h-fps");
    this.minimap = q("h-minimap");
    this.mmCtx = this.minimap.getContext("2d");
    this.speedo = q("h-speedo");
    this.soCtx = this.speedo.getContext("2d");

    if (opts.isTouch) {
      const ui = q("h-touchui");
      ui.classList.remove("hidden");
      ui.querySelectorAll("button").forEach((btn) => {
        const k = btn.dataset.k;
        const down = (e) => {
          e.preventDefault();
          btn.classList.add("active");
          this.input.setVirtual(k, true);
        };
        const up = (e) => {
          e.preventDefault();
          btn.classList.remove("active");
          this.input.setVirtual(k, false);
        };
        btn.addEventListener("pointerdown", down);
        btn.addEventListener("pointerup", up);
        btn.addEventListener("pointercancel", up);
        btn.addEventListener("pointerleave", up);
      });
    }
    this._slT = 0;
    window.addEventListener("resize", () => this._sizeSpeedLines());
    this._sizeSpeedLines();
  }

  _sizeSpeedLines() {
    this.el.speedlines.width = window.innerWidth;
    this.el.speedlines.height = window.innerHeight;
  }

  buildMinimap(track) {
    const pad = 12;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < track.n; i++) {
      minX = Math.min(minX, track.px[i]);
      maxX = Math.max(maxX, track.px[i]);
      minZ = Math.min(minZ, track.pz[i]);
      maxZ = Math.max(maxZ, track.pz[i]);
    }
    const w = this.minimap.width - pad * 2;
    const h = this.minimap.height - pad * 2;
    const scale = Math.min(w / (maxX - minX || 1), h / (maxZ - minZ || 1));
    this.mmTransform = (x, z) => [
      pad + (x - minX) * scale + (w - (maxX - minX) * scale) / 2,
      pad + (maxZ - z) * scale + (h - (maxZ - minZ) * scale) / 2
    ];
    const off = document.createElement("canvas");
    off.width = this.minimap.width;
    off.height = this.minimap.height;
    const g = off.getContext("2d");
    g.strokeStyle = "rgba(0,229,255,0.85)";
    g.lineWidth = 3;
    g.beginPath();
    for (let i = 0; i <= track.n; i++) {
      const idx = i % track.n;
      const [px, py] = this.mmTransform(track.px[idx], track.pz[idx]);
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.stroke();
    this.mmPath = off;
  }

  showCountdown(txt) {
    const el = this.el.countdown;
    el.textContent = txt;
    el.classList.remove("pop");
    void el.offsetWidth;
    el.classList.add("pop");
    if (txt === "GO!") {
      setTimeout(() => { el.textContent = ""; }, 900);
    }
  }

  notify(text, cls) {
    const now = performance.now();
    const cd = this._notifCd.get(text) || 0;
    if (now - cd < 1400) return;
    this._notifCd.set(text, now);
    const d = document.createElement("div");
    d.className = "notif " + (cls || "");
    d.textContent = text;
    this.el.notifs.appendChild(d);
    requestAnimationFrame(() => d.classList.add("in"));
    setTimeout(() => {
      d.classList.remove("in");
      setTimeout(() => d.remove(), 350);
    }, 1600);
    while (this.el.notifs.children.length > 4) this.el.notifs.firstChild.remove();
  }

  flash() {
    this.el.flash.style.opacity = "0.85";
    setTimeout(() => { this.el.flash.style.opacity = "0"; }, 90);
  }

  setFps(fps) {
    if (!this.opts.settings.fps) return;
    this.el.fps.classList.remove("hidden");
    this.el.fps.textContent = fps.toFixed(0) + " FPS";
  }

  setState(s) {
    this.el.pos.textContent = s.pos;
    this.el.total.textContent = "/" + s.totalCars;
    this.el.lap.textContent = s.lap;
    this.el.laps.textContent = s.laps;
    this.el.time.textContent = fmtTime(s.time);
    this.el.dmg.style.width = `${Math.round(s.damage * 100)}%`;
    this.el.nitro.style.width = s.nitro.toFixed(1) + "%";
    this.el.perfectMark.classList.toggle("hidden", !(s.perfectWindow > 0));
    if (s.perfectWindow > 0) {
      this.el.perfectMark.style.left = `calc(${(s.perfectWindow * 100).toFixed(1)}% - 4px)`;
    }
    this.el.boostLabel.textContent = s.boostLevel === 3 ? "SHOCKWAVE" : s.boostLevel === 2 ? "PERFECT NITRO" : s.boostLevel === 1 ? "NITRO" : "";
    this.el.boostLabel.className = s.boostLevel === 3 ? "shock" : s.boostLevel === 2 ? "perfect" : s.boostLevel === 1 ? "normal" : "";
    document.querySelector(".nitro-wrap").classList.toggle("shock-ready", s.shockReady);
    this.el.wrongway.classList.toggle("hidden", !s.wrongWay);
    if (s.elimT != null) {
      this.el.elim.classList.remove("hidden");
      this.el.elimT.textContent = Math.ceil(s.elimT);
      this.el.alive.textContent = s.aliveCount;
    } else {
      this.el.elim.classList.add("hidden");
    }
    this._drawSpeedo(s);
    this._drawMinimap(s);
    this._drawSpeedLines(s);
  }

  _drawSpeedo(s) {
    const c = this.soCtx;
    const W = this.speedo.width;
    const H = this.speedo.height;
    c.clearRect(0, 0, W, H);
    const cx = W - 78;
    const cy = H - 42;
    const r = 66;
    const a0 = Math.PI * 1.05;
    const a1 = Math.PI * 2.0;
    const frac = Math.min(1, s.speed / Math.max(60, s.topSpeedDisplay));
    c.lineWidth = 10;
    c.lineCap = "round";
    c.strokeStyle = "rgba(255,255,255,0.13)";
    c.beginPath();
    c.arc(cx, cy, r, a0, a1);
    c.stroke();
    const grad = c.createLinearGradient(0, H, W, 0);
    grad.addColorStop(0, "#00e5ff");
    grad.addColorStop(0.7, "#ff7a18");
    grad.addColorStop(1, "#ff2d55");
    c.strokeStyle = s.boostLevel > 0 ? "#7cf7ff" : grad;
    c.beginPath();
    c.arc(cx, cy, r, a0, a0 + (a1 - a0) * frac);
    c.stroke();
    const na = a0 + (a1 - a0) * frac;
    c.strokeStyle = "#ffffff";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx + Math.cos(na) * (r - 16), cy + Math.sin(na) * (r - 16));
    c.stroke();
    c.fillStyle = "#ffffff";
    c.font = "bold 30px Arial";
    c.textAlign = "center";
    c.fillText(String(Math.round(s.speed)), cx, cy - 8);
    c.font = "11px Arial";
    c.fillStyle = "rgba(255,255,255,0.6)";
    c.fillText(this.opts.settings.units === "mph" ? (s.speed * 0.621371).toFixed(0) + " MPH" : "KM/H", cx, cy + 10);
    if (s.drifting) {
      c.fillStyle = "#ffd23e";
      c.font = "bold 13px Arial";
      c.fillText("DRIFT", cx, cy + 26);
    } else if (s.airborne) {
      c.fillStyle = "#7cf7ff";
      c.font = "bold 13px Arial";
      c.fillText("AIRBORNE", cx, cy + 26);
    }
  }

  _drawMinimap(s) {
    if (!this.mmPath) return;
    const c = this.mmCtx;
    c.clearRect(0, 0, 150, 150);
    c.drawImage(this.mmPath, 0, 0);
    for (const m of s.minimap) {
      const [px, py] = this.mmTransform(m.x, m.z);
      c.beginPath();
      c.arc(px, py, m.player ? 5 : 3.4, 0, Math.PI * 2);
      c.fillStyle = m.player ? "#ffffff" : m.eliminated ? "#444444" : "#ff7a18";
      c.fill();
      if (m.player) {
        c.strokeStyle = "#00e5ff";
        c.lineWidth = 2;
        c.stroke();
      }
    }
  }

  _drawSpeedLines(s) {
    if (!this.opts.settings.speedLines) return;
    const c = this.el.speedlines.getContext("2d");
    const W = this.el.speedlines.width;
    const H = this.el.speedlines.height;
    c.clearRect(0, 0, W, H);
    const intensity = Math.max(0, s.speed01 - 0.55) / 0.45 + (s.boostLevel > 0 ? 0.35 : 0);
    if (intensity <= 0.02) return;
    const n = Math.floor(intensity * 34);
    const cx = W / 2;
    const cy = H * 0.42;
    c.strokeStyle = `rgba(255,255,255,${Math.min(0.4, intensity * 0.32)})`;
    c.lineWidth = 1.6;
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r0 = 120 + Math.random() * (Math.min(W, H) * 0.45);
      const len = 60 + intensity * 160;
      c.beginPath();
      c.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0 * 0.75);
      c.lineTo(cx + Math.cos(ang) * (r0 + len), cy + Math.sin(ang) * (r0 + len) * 0.75);
      c.stroke();
    }
  }

  reset() {
    this.el.notifs.innerHTML = "";
    this.el.countdown.textContent = "";
    this.el.fps.classList.add("hidden");
    this._notifCd.clear();
  }
}
