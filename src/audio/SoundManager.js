// SoundManager.js - Extensible audio interface placeholder
// Audio is disabled by design per user preference ("no audio for now i will add it later").
// Ready for custom Web Audio API or HTML5 Audio integration.

export class SoundManager {
  constructor() {
    this.enabled = false;
    this.volume = 0.5;
  }

  // Lifecycle
  init() {
    // Audio context initialization hook for future expansion
  }

  // SFX Hooks
  playLaneSwitch() {
    if (!this.enabled) return;
    // e.g., quick whoosh / tire chirp
  }

  playNearMiss(comboLevel = 1) {
    if (!this.enabled) return;
    // e.g., ascending chime or arcade high-pitch reward
  }

  playCrash() {
    if (!this.enabled) return;
    // e.g., loud synth crunch / explosion
  }

  playAccelerate() {
    if (!this.enabled) return;
    // e.g., turbo spool / engine rev
  }

  playBrake() {
    if (!this.enabled) return;
    // e.g., tire screech
  }

  startEngine(speedRatio) {
    if (!this.enabled) return;
    // e.g., oscillator pitch modulation based on speed
  }

  stopEngine() {
    if (!this.enabled) return;
  }

  startBGM() {
    if (!this.enabled) return;
  }

  stopBGM() {
    if (!this.enabled) return;
  }
}
