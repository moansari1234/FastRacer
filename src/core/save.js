const PROFILE_KEY = "nitroapex_profile_v1";
const SETTINGS_KEY = "nitroapex_settings_v1";

export const DEFAULT_PROFILE = {
  credits: 3500,
  owned: ["vento"],
  selectedCar: "vento",
  upgrades: {},
  customization: {},
  careerDone: {},
  stars: 0,
  bestTimes: {}
};

export const DEFAULT_SETTINGS = {
  master: 0.8,
  music: 0.55,
  sfx: 0.9,
  units: "kmh",
  cam: "chase",
  quality: "auto",
  touchDrive: false,
  shake: true,
  fps: false,
  speedLines: true
};

function hasStorage() {
  return typeof localStorage !== "undefined";
}

export class SaveManager {
  constructor() {
    this.profile = this.load(PROFILE_KEY, DEFAULT_PROFILE);
    this.settings = Object.assign({}, DEFAULT_SETTINGS, this.load(SETTINGS_KEY, {}));
  }
  load(key, fallback) {
    if (!hasStorage()) return JSON.parse(JSON.stringify(fallback));
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return JSON.parse(JSON.stringify(fallback));
      const data = JSON.parse(raw);
      return Object.assign(JSON.parse(JSON.stringify(fallback)), data);
    } catch (e) {
      return JSON.parse(JSON.stringify(fallback));
    }
  }
  saveProfile() {
    if (hasStorage()) localStorage.setItem(PROFILE_KEY, JSON.stringify(this.profile));
  }
  saveSettings() {
    if (hasStorage()) localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
  }
  owns(id) {
    return this.profile.owned.includes(id);
  }
  buy(carId, price) {
    if (!this.owns(carId) && this.profile.credits >= price) {
      this.profile.credits -= price;
      this.profile.owned.push(carId);
      this.saveProfile();
      return true;
    }
    return false;
  }
  addCredits(n) {
    this.profile.credits = Math.max(0, Math.round(this.profile.credits + n));
    this.saveProfile();
  }
  upgradesFor(carId) {
    const u = this.profile.upgrades;
    if (!u[carId]) u[carId] = { topSpeed: 0, accel: 0, handling: 0, nitro: 0 };
    return u[carId];
  }
  upgrade(carId, stat, cost) {
    const u = this.upgradesFor(carId);
    if (u[stat] >= 5 || this.profile.credits < cost) return false;
    u[stat]++;
    this.profile.credits -= cost;
    this.recalcStars();
    this.saveProfile();
    return true;
  }
  recalcStars() {
    let total = 0;
    for (const id of this.profile.owned) {
      const u = this.upgradesFor(id);
      total += u.topSpeed + u.accel + u.handling + u.nitro;
    }
    this.profile.stars = total;
    this.saveProfile();
  }
  customizationFor(carId) {
    const c = this.profile.customization;
    if (!c[carId]) c[carId] = { paint: null, rim: "#181c22", spoiler: "stock" };
    return c[carId];
  }
  setBestTime(trackId, time) {
    const bt = this.profile.bestTimes;
    if (!bt[trackId] || time < bt[trackId]) {
      bt[trackId] = time;
      this.saveProfile();
      return true;
    }
    return false;
  }
  markCareerDone(eventId, starsEarned) {
    const prev = this.profile.careerDone[eventId] || 0;
    this.profile.careerDone[eventId] = Math.max(prev, starsEarned);
    this.saveProfile();
  }
  careerStarsFor(eventId) {
    return this.profile.careerDone[eventId] || 0;
  }
  exportSave() {
    return JSON.stringify({ profile: this.profile, settings: this.settings }, null, 1);
  }
  importSave(json) {
    try {
      const data = JSON.parse(json);
      if (data.profile && Array.isArray(data.profile.owned)) {
        this.profile = Object.assign(JSON.parse(JSON.stringify(DEFAULT_PROFILE)), data.profile);
        this.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings);
        this.saveProfile();
        this.saveSettings();
        return true;
      }
    } catch (e) { /* ignore */ }
    return false;
  }
  resetAll() {
    this.profile = JSON.parse(JSON.stringify(DEFAULT_PROFILE));
    this.settings = Object.assign({}, DEFAULT_SETTINGS);
    this.saveProfile();
    this.saveSettings();
  }
}
