import * as THREE from "three";
import { RoomEnvironment } from "../../vendor/addons/environments/RoomEnvironment.js";

const cache = new Map();

export function initEnvironment(renderer, scene) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  if ("environmentIntensity" in scene) scene.environmentIntensity = 0.9;
  pmrem.dispose();
}

export const MAT = {
  paint: (color) => {
    const key = `paint:${color}`;
    if (!cache.has(key)) {
      cache.set(key, new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(color),
        metalness: 0,
        roughness: 0.38,
        clearcoat: 0.9,
        clearcoatRoughness: 0.16,
        envMapIntensity: 1.05
      }));
    }
    return cache.get(key);
  },
  paintDark: (color) => {
    const key = `paintDark:${color}`;
    if (!cache.has(key)) {
      cache.set(key, new THREE.MeshStandardMaterial({
        color: new THREE.Color(color).multiplyScalar(0.34),
        metalness: 0.1,
        roughness: 0.6,
        envMapIntensity: 0.7
      }));
    }
    return cache.get(key);
  },
  carbon: () => {
    if (!cache.has("carbon")) {
      cache.set("carbon", new THREE.MeshStandardMaterial({ color: 0x14171c, metalness: 0.25, roughness: 0.55, envMapIntensity: 0.8 }));
    }
    return cache.get("carbon");
  },
  chrome: () => {
    if (!cache.has("chrome")) {
      cache.set("chrome", new THREE.MeshStandardMaterial({ color: 0xb9c1cc, metalness: 1, roughness: 0.32, envMapIntensity: 1.2 }));
    }
    return cache.get("chrome");
  },
  rubber: () => {
    if (!cache.has("rubber")) {
      cache.set("rubber", new THREE.MeshStandardMaterial({ color: 0x0b0c0f, metalness: 0, roughness: 0.92, envMapIntensity: 0.3 }));
    }
    return cache.get("rubber");
  },
  glass: () => {
    if (!cache.has("glass")) {
      cache.set("glass", new THREE.MeshPhysicalMaterial({
        color: 0x88ccff, metalness: 0, roughness: 0.08,
        transparent: true, opacity: 0.3, clearcoat: 1, envMapIntensity: 1.6, depthWrite: false
      }));
    }
    return cache.get("glass");
  },
  signal: (color, intensity = 2.2) => {
    const key = `sig:${color}:${intensity}`;
    if (!cache.has(key)) {
      cache.set(key, new THREE.MeshStandardMaterial({
        color: 0x0a0a0a, emissive: new THREE.Color(color), emissiveIntensity: intensity,
        metalness: 0, roughness: 0.4
      }));
    }
    return cache.get(key);
  },
  basicGlow: (color, opacity = 1) => {
    const key = `glow:${color}:${opacity}`;
    if (!cache.has(key)) {
      cache.set(key, new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: opacity < 1, opacity }));
    }
    return cache.get(key);
  },
  dispose() {
    for (const m of cache.values()) m.dispose();
    cache.clear();
  }
};
