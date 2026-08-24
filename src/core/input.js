export class InputManager {
  constructor() {
    this.keys = new Set();
    this.virtual = new Set();
    this.nitroTaps = 0;
    this.shockTaps = 0;
    this.onPause = null;
    this.onCamera = null;
    this.onRespawn = null;
    this.enabled = true;
    this._keyMap = {
      ArrowUp: "up", KeyW: "up",
      ArrowDown: "down", KeyS: "down",
      ArrowLeft: "left", KeyA: "left",
      ArrowRight: "right", KeyRight: "right",
      Space: "drift",
      ShiftLeft: "nitro", KeyN: "nitro",
      KeyQ: "shock"
    };
    window.addEventListener("keydown", (e) => {
      if (e.code === "Escape" || e.code === "KeyP") {
        if (this.onPause) this.onPause();
        return;
      }
      if (e.code === "KeyC") { if (this.onCamera) this.onCamera(); return; }
      if (e.code === "KeyR") { if (this.onRespawn) this.onRespawn(); return; }
      const k = this._keyMap[e.code];
      if (!k) return;
      e.preventDefault();
      if (e.repeat) return;
      if (!this.keys.has(k)) {
        if (k === "nitro") this.nitroTaps++;
        if (k === "shock") this.shockTaps++;
      }
      this.keys.add(k);
    });
    window.addEventListener("keyup", (e) => {
      const k = this._keyMap[e.code];
      if (k) this.keys.delete(k);
    });
    window.addEventListener("blur", () => this.keys.clear());
  }
  setVirtual(name, down) {
    if (down) {
      if (!this.virtual.has(name)) {
        if (name === "nitro") this.nitroTaps++;
        if (name === "shock") this.shockTaps++;
      }
      this.virtual.add(name);
    } else {
      this.virtual.delete(name);
    }
  }
  clearTaps() {
    this.nitroTaps = 0;
    this.shockTaps = 0;
  }
  consumeNitroTap() {
    const t = this.nitroTaps;
    this.nitroTaps = 0;
    return t;
  }
  consumeShockTap() {
    const t = this.shockTaps;
    this.shockTaps = 0;
    return t;
  }
  read() {
    if (!this.enabled) return { throttle: 0, brake: 0, steer: 0, drift: false };
    const has = (...names) => names.some((n) => this.keys.has(n) || this.virtual.has(n));
    const throttle = has("up") ? 1 : 0;
    const brake = has("down") ? 1 : 0;
    let steer = 0;
    if (has("left")) steer -= 1;
    if (has("right")) steer += 1;
    return { throttle, brake, steer, drift: has("drift") };
  }
}
