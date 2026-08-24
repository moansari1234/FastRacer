import { CARS, CAR_MAP, PAINTS, RIMS, upgradeCost, derived, rating } from "../data/cars.js";
import { TRACKS, TRACK_MAP, DIFFICULTIES, CAREER } from "../data/tracks.js";
import { fmtCredits, fmtTime } from "../utils.js";

const $ = (sel, el) => (el || document).querySelector(sel);

export class Screens {
  constructor(root, bus) {
    this.root = root;
    this.bus = bus;
    this.quick = { mode: "race", trackId: "cape", diff: "medium" };
    this.garageIdx = 0;
    root.innerHTML = `<div id="screens"></div><div id="pausemenu" class="hidden"></div>`;
    this.el = $("#screens", root);
    this.pauseEl = $("#pausemenu", root);
  }

  _snap() {
    return this.bus.getProfileSnapshot();
  }

  show(screenName, data) {
    this.current = screenName;
    switch (screenName) {
      case "main": return this._main();
      case "career": return this._career();
      case "quick": return this._quick();
      case "garage": return this._garage(data);
      case "settings": return this._settings();
      case "results": return this._results(data);
      case "credits": return this._credits();
    }
  }

  _set(html) {
    this.el.innerHTML = html;
    this.el.classList.remove("hidden");
  }

  hide() {
    this.el.classList.add("hidden");
  }

  _header(title, backTo) {
    const s = this._snap();
    return `
      <div class="scr-top">
        <button class="btn btn-back" id="btn-back">&#9664; BACK</button>
        <h1 class="scr-title">${title}</h1>
        <div class="wallet">
          <span class="cred">&#11042; ${fmtCredits(s.credits)}</span>
          <span class="starz">&#9733; ${s.stars}</span>
        </div>
      </div>`;
  }

  _bindBack(backTo) {
    $("#btn-back", this.el).onclick = () => {
      this.bus.click();
      this.bus.showcase(null);
      this.show(backTo);
    };
  }

  _main() {
    const s = this._snap();
    const selCar = CAR_MAP.get(s.selectedCar);
    this.bus.showcase(s.selectedCar);
    this._set(`
      <div class="screen screen-main">
        <div class="logo">
          <h1><em>NITRO</em> APEX</h1>
          <p class="tag">LEGENDS OF ARCADE SPEED</p>
        </div>
        <div class="main-stats">
          <span>&#11042; ${fmtCredits(s.credits)}</span>
          <span>&#9733; ${s.stars}</span>
          <span>${selCar ? selCar.name : ""}</span>
        </div>
        <nav class="main-nav">
          <button id="m-career" class="mbtn primary">CAREER</button>
          <button id="m-quick" class="mbtn">QUICK RACE</button>
          <button id="m-garage" class="mbtn">GARAGE</button>
          <button id="m-settings" class="mbtn">SETTINGS</button>
          <button id="m-credits" class="mbtn small">CREDITS</button>
        </nav>
      </div>`);
    $("#m-career").onclick = () => { this.bus.click(); this.show("career"); };
    $("#m-quick").onclick = () => { this.bus.click(); this.show("quick"); };
    $("#m-garage").onclick = () => { this.bus.click(); this.show("garage"); };
    $("#m-settings").onclick = () => { this.bus.click(); this.show("settings"); };
    $("#m-credits").onclick = () => { this.bus.click(); this.show("credits"); };
  }

  _credits() {
    this._set(`
      <div class="screen">
        ${this._header("CREDITS", "main")}
        <div class="panel center-panel">
          <h2>NITRO APEX</h2>
          <p>An original arcade racer built with Three.js and WebAudio.</p>
          <p class="dim">All vehicles, tracks and brands are fictional.<br>Inspired by the golden era of arcade racing.</p>
        </div>
      </div>`);
    this._bindBack("main");
  }

  _career() {
    const s = this._snap();
    let html = `<div class="screen">${this._header("CAREER", "main")}`;
    for (const ch of CAREER) {
      const unlocked = s.stars >= ch.needStars;
      html += `<section class="chapter ${unlocked ? "" : "locked"}">
        <h2>CHAPTER ${ch.chapter} — ${ch.name} ${unlocked ? "" : `<small>(&#9733;${ch.needStars} required)</small>`}</h2>
        <div class="events">`;
      for (const ev of ch.events) {
        const done = s.careerDone[ev.id] || 0;
        const evUnlocked = unlocked;
        html += `
          <div class="event-card ${evUnlocked ? "" : "locked"} ${done ? "done" : ""}">
            <div class="ev-head">
              <b>${ev.name}</b>
              <span class="mode-tag">${this._modeLabel(ev.mode)}</span>
            </div>
            <div class="ev-track">${TRACK_MAP.get(ev.track).name} · ${ev.laps > 90 ? "—" : ev.laps + " lap" + (ev.laps > 1 ? "s" : "")} · ${DIFFICULTIES[ev.diff].label}${ev.special ? " · SPECIAL" : ""}</div>
            <div class="ev-desc">${ev.desc}</div>
            <div class="ev-foot">
              <span class="reward">&#11042; ${fmtCredits(ev.reward)}${ev.rewardCar ? ` + ${CAR_MAP.get(ev.rewardCar).name}` : ""}</span>
              <span class="stars">${"&#9733;".repeat(done)}${done < 3 ? `<i>${"&#9734;".repeat(3 - done)}</i>` : ""}</span>
              ${evUnlocked ? `<button class="btn btn-play" data-ev="${ev.id}">${done ? "REPLAY" : "PLAY"}</button>` : `<span class="lock">&#128274;</span>`}
            </div>
          </div>`;
      }
      html += `</div></section>`;
    }
    html += `</div>`;
    this._set(html);
    this._bindBack("main");
    this.el.querySelectorAll("[data-ev]").forEach((b) => {
      b.onclick = () => {
        const ev = CAREER.flatMap((c) => c.events).find((e) => e.id === b.dataset.ev);
        this.bus.click();
        this.bus.startCareerEvent(ev);
      };
    });
  }

  _modeLabel(m) {
    return { race: "RACE", timeattack: "TIME ATTACK", elimination: "ELIMINATION", versus: "DUEL" }[m] || m.toUpperCase();
  }

  _quick() {
    const q = this.quick;
    const modes = [
      ["race", "CLASSIC RACE", "Beat them to the line."],
      ["timeattack", "TIME ATTACK", "Solo. Chase your ghost."],
      ["elimination", "ELIMINATION", "Last place is out. Repeatedly."],
      ["versus", "VERSUS DUEL", "One rival. Pure hate."]
    ];
    let html = `<div class="screen">${this._header("QUICK RACE", "main")}
      <h3 class="sect">MODE</h3><div class="row-cards modes">`;
    for (const [id, label, desc] of modes) {
      html += `<button class="card mode ${q.mode === id ? "sel" : ""}" data-mode="${id}"><b>${label}</b><span>${desc}</span></button>`;
    }
    html += `</div><h3 class="sect">TRACK</h3><div class="row-cards tracks">`;
    const s = this._snap();
    for (const t of TRACKS) {
      const locked = s.stars < t.unlockStars;
      html += `<button class="card track ${q.trackId === t.id ? "sel" : ""} ${locked ? "lockedcard" : ""}" data-track="${t.id}" ${locked ? "disabled" : ""}>
        <b>${t.name}</b>
        <span class="t-theme">${t.theme.toUpperCase()} · ${t.time.toUpperCase()}</span>
        <span>${t.weather !== "clear" ? t.weather.toUpperCase() + " · " : ""}${t.desc || ""}</span>
        ${locked ? `<em>&#9733;${t.unlockStars}</em>` : ""}
      </button>`;
    }
    html += `</div><h3 class="sect">DIFFICULTY</h3><div class="row-diffs">`;
    for (const [id, d] of Object.entries(DIFFICULTIES)) {
      html += `<button class="chip ${q.diff === id ? "sel" : ""}" data-diff="${id}">${d.label}</button>`;
    }
    html += `</div><div class="start-row"><button id="q-start" class="mbtn primary big">START ENGINE &#9654;</button></div></div>`;
    this._set(html);
    this._bindBack("main");
    this.el.querySelectorAll("[data-mode]").forEach((b) => {
      b.onclick = () => {
        this.quick.mode = b.dataset.mode;
        this.bus.click();
        this._quick();
      };
    });
    this.el.querySelectorAll("[data-track]").forEach((b) => {
      b.onclick = () => {
        this.quick.trackId = b.dataset.track;
        this.bus.click();
        this._quick();
      };
    });
    this.el.querySelectorAll("[data-diff]").forEach((b) => {
      b.onclick = () => {
        this.quick.diff = b.dataset.diff;
        this.bus.click();
        this._quick();
      };
    });
    $("#q-start", this.el).onclick = () => {
      this.bus.click();
      this.bus.startQuick({ ...this.quick });
    };
  }

  _statBar(label, val01, cls) {
    return `<div class="stat"><label>${label}</label><div class="bar"><i class="${cls || ""}" style="width:${Math.round(val01 * 100)}%"></i></div></div>`;
  }

  _garage(previewId) {
    const s = this._snap();
    const ids = CARS.map((c) => c.id);
    if (!previewId) {
      const cur = CAR_MAP.get(this.garageCurrent || s.selectedCar);
      previewId = cur ? cur.id : ids[0];
    }
    this.garageCurrent = previewId;
    const spec = CAR_MAP.get(previewId);
    const owned = s.owned.includes(previewId);
    const up = s.upgrades[previewId] || { topSpeed: 0, accel: 0, handling: 0, nitro: 0 };
    const stats = derived(spec, up);
    const cust = s.customization[previewId] || { paint: spec.color, rim: "#181c22", spoiler: "stock" };
    const pr = rating(spec);

    let html = `<div class="screen screen-garage">${this._header("GARAGE", "main")}
      <div class="garage-grid">
        <aside class="car-list">`;
    for (const c of CARS) {
      const own = s.owned.includes(c.id);
      html += `<button class="car-item ${c.id === previewId ? "sel" : ""} ${own ? "" : "locked"}" data-car="${c.id}">
        <i style="background:${c.color}"></i>
        <div><b>${c.name}</b><small>${c.cls}-class ${own ? "· " + "&#9733;".repeat(derived(c, s.upgrades[c.id] || { topSpeed: 0, accel: 0, handling: 0, nitro: 0 }).starLevel) : ""}</small></div>
        ${own ? "" : `<em>${c.unlock && c.unlock.event ? "&#128274;" : fmtCredits(c.price)}</em>`}
      </button>`;
    }
    html += `</aside>
      <div class="car-show">
        <div class="show-head"><b>${spec.name}</b><span class="cls-badge ${spec.cls}">${spec.cls}</span><span class="rate">PWR ${Math.round(pr)}</span></div>
        <div id="showcase3d"></div>
        <div class="cust-row">
          <label>PAINT</label>${PAINTS.map((p) => `<button class="swatch ${cust.paint === p ? "sel" : ""}" data-paint="${p}" style="background:${p}"></button>`).join("")}
          <label>RIMS</label>${RIMS.map((p) => `<button class="swatch ${cust.rim === p ? "sel" : ""}" data-rim="${p}" style="background:${p}"></button>`).join("")}
          <label>KIT</label><button class="chip small ${cust.spoiler !== "none" ? "sel" : ""}" data-spoiler="stock">WING</button>
          <button class="chip small ${cust.spoiler === "none" ? "sel" : ""}" data-spoiler="none">CLEAN</button>
        </div>
      </div>
      <aside class="car-side">
        ${this._statBar("TOP SPEED", stats.topSpeed / 430)}
        ${this._statBar("ACCELERATION", 2.2 / Math.max(2.2, stats.accel))}
        ${this._statBar("HANDLING", stats.handling / 10)}
        ${this._statBar("NITRO", stats.nitro / 10)}
        <div class="starrow">${"&#9733;".repeat(stats.starLevel)}<i>${"&#9734;".repeat(5 - stats.starLevel)}</i></div>
        <div class="upg-grid">
          ${[["topSpeed", "SPEED"], ["accel", "ACCEL"], ["handling", "GRIP"], ["nitro", "NITRO"]].map(([k, label]) => {
            const lvl = up[k];
            const cost = upgradeCost(spec, k, lvl);
            const maxed = lvl >= 5;
            return `<button class="upg ${maxed || !owned || s.credits < cost ? "off" : ""}" data-upg="${k}" ${!owned ? "disabled" : ""}>
              <b>${label}</b>
              <span class="pips">${"&#9679;".repeat(lvl)}<i>${"&#9675;".repeat(5 - lvl)}</i></span>
              <em>${maxed ? "MAX" : fmtCredits(cost)}</em>
            </button>`;
          }).join("")}
        </div>
        ${owned
          ? `<button id="g-select" class="mbtn primary" ${s.selectedCar === previewId ? "disabled" : ""}>${s.selectedCar === previewId ? "SELECTED" : "SELECT"}</button>`
          : `<button id="g-buy" class="mbtn buy" ${this._canBuy(spec, s) ? "" : "disabled"}>BUY — ${fmtCredits(spec.price)}</button>
             <p class="locknote">${this._lockReason(spec, s)}</p>`}
      </aside>
      </div></div>`;
    this._set(html);
    this._bindBack("main");
    this.bus.showcase(previewId, $("#showcase3d", this.el));
    this.el.querySelectorAll("[data-car]").forEach((b) => {
      b.onclick = () => {
        this.bus.click();
        this._garage(b.dataset.car);
      };
    });
    this.el.querySelectorAll("[data-paint]").forEach((b) => {
      b.onclick = () => {
        if (!owned) return;
        this.bus.setPaint(previewId, b.dataset.paint);
        this.bus.click();
        this._garage(previewId);
      };
    });
    this.el.querySelectorAll("[data-rim]").forEach((b) => {
      b.onclick = () => {
        if (!owned) return;
        this.bus.setRim(previewId, b.dataset.rim);
        this.bus.click();
        this._garage(previewId);
      };
    });
    this.el.querySelectorAll("[data-spoiler]").forEach((b) => {
      b.onclick = () => {
        if (!owned) return;
        this.bus.setSpoiler(previewId, b.dataset.spoiler);
        this.bus.click();
        this._garage(previewId);
      };
    });
    this.el.querySelectorAll("[data-upg]").forEach((b) => {
      b.onclick = () => {
        const ok = this.bus.upgrade(previewId, b.dataset.upg);
        if (ok) this.bus.buySound();
        this.bus.refreshShowcaseStats(previewId, up);
        this._garage(previewId);
      };
    });
    const selBtn = $("#g-select", this.el);
    if (selBtn) selBtn.onclick = () => {
      this.bus.selectCar(previewId);
      this.bus.click();
      this._garage(previewId);
    };
    const buyBtn = $("#g-buy", this.el);
    if (buyBtn) buyBtn.onclick = () => {
      if (this.bus.buy(previewId)) {
        this.bus.buySound();
        this._garage(previewId);
      }
    };
  }

  _canBuy(spec, s) {
    if (s.credits < spec.price) return false;
    if (!spec.unlock) return true;
    if (spec.unlock.stars && s.stars < spec.unlock.stars) return false;
    if (spec.unlock.event && !(s.careerDone[spec.unlock.event] >= 2)) return false;
    return true;
  }

  _lockReason(spec, s) {
    if (!spec.unlock) return "";
    if (spec.unlock.stars && s.stars < spec.unlock.stars) return `Requires ${spec.unlock.stars} upgrade stars`;
    if (spec.unlock.event && !(s.careerDone[spec.unlock.event] >= 2)) return "Complete its career trial first";
    return "";
  }

  _results(res) {
    const posWord = ["WINNER!", "2ND PLACE", "3RD PLACE"][res.playerPos - 1] || `P${res.playerPos}`;
    let rowsHtml = res.rows.map((r) => `
      <tr class="${r.isPlayer ? "me" : ""} ${r.eliminated ? "out" : ""}">
        <td>${r.pos}</td><td>${r.name}</td><td>${r.car}</td>
        <td>${r.time != null ? fmtTime(r.time) : r.eliminated ? "OUT" : "DNF"}</td>
      </tr>`).join("");
    let brk = res.breakdown.map(([l, v]) => `<li><span>${l}</span><b>+${fmtCredits(v)}</b></li>`).join("");
    this._set(`
      <div class="screen screen-results">
        <div class="res-hero ${res.success ? "" : "fail"}">
          <h1>${res.failReason || posWord}</h1>
          ${res.playerTime != null ? `<p class="res-time">${fmtTime(res.playerTime)}</p>` : ""}
          <p class="res-stars">${"&#9733;".repeat(res.stars)}<i>${"&#9734;".repeat(3 - res.stars)}</i></p>
        </div>
        <div class="res-cols">
          <table class="res-table"><thead><tr><th>#</th><th>DRIVER</th><th>CAR</th><th>TIME</th></tr></thead><tbody>${rowsHtml}</tbody></table>
          <div class="res-side">
            <div class="panel">
              <h3>PERFORMANCE</h3>
              <ul class="perf">
                <li><span>Top speed</span><b>${Math.round(res.stats.topSpeedKmh)} km/h</b></li>
                <li><span>Drift distance</span><b>${Math.round(res.stats.driftDist)} m</b></li>
                <li><span>Near misses</span><b>${res.stats.nearMisses}</b></li>
                <li><span>Knockdowns</span><b>${res.stats.knockdowns}</b></li>
                <li><span>360 stunts</span><b>${res.stats.stunts}</b></li>
              </ul>
            </div>
            <div class="panel">
              <h3>REWARDS <b class="tot">+${fmtCredits(res.credits)} &#11042;</b></h3>
              <ul class="brk">${brk || "<li class='dim'>No bonuses</li>"}</ul>
            </div>
            <div class="res-actions">
              <button id="r-retry" class="mbtn">RETRY</button>
              <button id="r-next" class="mbtn primary">${this.bus.hasNext() ? "CONTINUE &#9654;" : "MAIN MENU"}</button>
              <button id="r-garage" class="mbtn">GARAGE</button>
            </div>
          </div>
        </div>
      </div>`);
    $("#r-retry", this.el).onclick = () => { this.bus.click(); this.bus.retry(); };
    $("#r-next", this.el).onclick = () => { this.bus.click(); this.bus.next(); };
    $("#r-garage", this.el).onclick = () => { this.bus.click(); this.show("garage"); };
  }

  _settings() {
    const st = this.bus.settings;
    this._set(`
      <div class="screen">
        ${this._header("SETTINGS", "main")}
        <div class="settings-grid">
          <div class="panel">
            <h3>AUDIO</h3>
            <label class="slider">MASTER<input type="range" min="0" max="1" step="0.05" value="${st.master}" data-set="master"><span>${Math.round(st.master * 100)}%</span></label>
            <label class="slider">MUSIC<input type="range" min="0" max="1" step="0.05" value="${st.music}" data-set="music"><span>${Math.round(st.music * 100)}%</span></label>
            <label class="slider">SFX<input type="range" min="0" max="1" step="0.05" value="${st.sfx}" data-set="sfx"><span>${Math.round(st.sfx * 100)}%</span></label>
          </div>
          <div class="panel">
            <h3>GAMEPLAY</h3>
            <label class="select">UNITS<select data-set="units">
              <option value="kmh" ${st.units === "kmh" ? "selected" : ""}>KM/H</option>
              <option value="mph" ${st.units === "mph" ? "selected" : ""}>MPH</option></select></label>
            <label class="select">CAMERA<select data-set="cam">
              <option value="chase" ${st.cam === "chase" ? "selected" : ""}>CHASE</option>
              <option value="far" ${st.cam === "far" ? "selected" : ""}>FAR CHASE</option>
              <option value="hood" ${st.cam === "hood" ? "selected" : ""}>HOOD</option></select></label>
            <label class="check"><input type="checkbox" data-set="shake" ${st.shake ? "checked" : ""}> SCREEN SHAKE</label>
            <label class="check"><input type="checkbox" data-set="speedLines" ${st.speedLines ? "checked" : ""}> SPEED LINES</label>
            <label class="check"><input type="checkbox" data-set="touchDrive" ${st.touchDrive ? "checked" : ""}> TOUCHDRIVE ASSIST</label>
          </div>
          <div class="panel">
            <h3>GRAPHICS</h3>
            <label class="select">QUALITY<select data-set="quality">
              <option value="auto" ${st.quality === "auto" ? "selected" : ""}>AUTO</option>
              <option value="low" ${st.quality === "low" ? "selected" : ""}>LOW</option>
              <option value="medium" ${st.quality === "medium" ? "selected" : ""}>MEDIUM</option>
              <option value="high" ${st.quality === "high" ? "selected" : ""}>HIGH</option></select></label>
            <label class="check"><input type="checkbox" data-set="fps" ${st.fps ? "checked" : ""}> SHOW FPS</label>
            <p class="dim small-note">Quality applies on next race.</p>
          </div>
          <div class="panel">
            <h3>DATA</h3>
            <div class="data-btns">
              <button id="d-export" class="btn">EXPORT SAVE</button>
              <label class="btn filelab">IMPORT SAVE<input type="file" id="d-import" accept=".json"></label>
              <button id="d-reset" class="btn danger">RESET PROGRESS</button>
            </div>
          </div>
        </div>
      </div>`);
    this._bindBack("main");
    this.el.querySelectorAll("[data-set]").forEach((inp) => {
      inp.onchange = () => {
        const v = inp.type === "checkbox" ? inp.checked : inp.value;
        this.bus.setSetting(inp.dataset.set, inp.type === "range" ? parseFloat(v) : v);
        const span = inp.parentElement.querySelector("span");
        if (span) span.textContent = Math.round(parseFloat(v) * 100) + "%";
        this.bus.applySettings();
      };
    });
    $("#d-export", this.el).onclick = () => this.bus.exportSave();
    $("#d-import", this.el).onchange = (e) => {
      const f = e.target.files[0];
      if (!f) return;
      f.text().then((txt) => {
        if (this.bus.importSave(txt)) this.bus.toast("Save imported");
        else this.bus.toast("Invalid save file");
      });
    };
    $("#d-reset", this.el).onclick = () => {
      if (confirm("Erase all progress?")) {
        this.bus.resetSave();
        this._settings();
      }
    };
  }

  showPause(show, handlers) {
    if (!show) {
      this.pauseEl.classList.add("hidden");
      return;
    }
    this.pauseEl.innerHTML = `
      <div class="pause-box">
        <h2>PAUSED</h2>
        <button id="p-resume" class="mbtn primary">RESUME</button>
        <button id="p-restart" class="mbtn">RESTART</button>
        <button id="p-quit" class="mbtn">QUIT TO MENU</button>
      </div>`;
    this.pauseEl.classList.remove("hidden");
    $("#p-resume", this.pauseEl).onclick = handlers.onResume;
    $("#p-restart", this.pauseEl).onclick = handlers.onRestart;
    $("#p-quit", this.pauseEl).onclick = handlers.onQuit;
  }
}
