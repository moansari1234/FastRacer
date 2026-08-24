import * as THREE from "three";
import { EffectComposer } from "../../vendor/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "../../vendor/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "../../vendor/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "../../vendor/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "../../vendor/addons/postprocessing/OutputPass.js";

const SpeedGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 0.32 },
    uAberration: { value: 0.0 },
    uSaturation: { value: 0.0 }
  },
  vertexShader: `varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uAberration;
    uniform float uSaturation;
    varying vec2 vUv;
    void main(){
      vec2 uv = vUv;
      vec2 dir = uv - 0.5;
      float d2 = dot(dir, dir);
      vec3 col;
      if (uAberration > 0.001) {
        float ab = uAberration * d2;
        col.r = texture2D(tDiffuse, uv - dir * ab).r;
        col.g = texture2D(tDiffuse, uv).g;
        col.b = texture2D(tDiffuse, uv + dir * ab).b;
      } else {
        col = texture2D(tDiffuse, uv).rgb;
      }
      col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, 1.0 + uSaturation);
      float vig = smoothstep(0.95, 0.35, d2 * (1.0 + uVignette * 2.0));
      col *= mix(1.0 - uVignette, 1.0, vig);
      gl_FragColor = vec4(col, 1.0);
    }`
};

export class RenderPipeline {
  constructor(renderer, quality) {
    this.renderer = renderer;
    this.enabled = quality !== "low";
    this.grade = null;
    if (!this.enabled) return;
    this.composer = new EffectComposer(renderer);
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(2, 2), 0.42, 0.32, 0.86);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(SpeedGradeShader);
    this.composer.addPass(this.grade);
    this.out = new OutputPass();
    this.composer.addPass(this.out);
    this.resize(window.innerWidth, window.innerHeight);
  }
  setScene(scene, camera) {
    if (!this.enabled) return;
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
  }
  resize(w, h) {
    if (!this.enabled) return;
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w, h);
  }
  update(speed01, boostLevel) {
    if (!this.grade) return;
    const targetAb = boostLevel >= 2 ? 1.6 : speed01 > 0.8 ? (speed01 - 0.8) * 2.2 : 0;
    this.grade.uniforms.uAberration.value += (targetAb - this.grade.uniforms.uAberration.value) * 0.08;
    const targetSat = 0.06 + (boostLevel > 0 ? 0.14 : 0);
    this.grade.uniforms.uSaturation.value += (targetSat - this.grade.uniforms.uSaturation.value) * 0.05;
  }
  render(scene, camera) {
    if (!this.enabled) {
      this.renderer.render(scene, camera);
      return;
    }
    this.setScene(scene, camera);
    this.composer.render();
  }
}
