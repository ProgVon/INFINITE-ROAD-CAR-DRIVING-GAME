// main.js - Core Game Loop, State Machine, and Arcade HUD Controller

import { Input } from './engine/Input.js';
import { Renderer } from './engine/Renderer.js';
import { Storage } from './engine/Storage.js';
import { SoundManager } from './audio/SoundManager.js';
import { PlayerCar } from './entities/PlayerCar.js';
import { TrafficManager } from './entities/TrafficManager.js';
import { ParticleSystem } from './entities/ParticleSystem.js';

const STATES = {
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAMEOVER: 'gameover'
};

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.state = STATES.MENU;

    // Subsystems
    this.input = new Input();
    this.renderer = new Renderer(this.canvas);
    this.sound = new SoundManager();
    this.particles = new ParticleSystem();
    this.player = new PlayerCar();
    this.traffic = new TrafficManager();

    // Game Metrics
    this.score = 0;
    this.displayScore = 0;
    this.highScore = Storage.getHighScore();
    this.bestDistance = Storage.getBestDistance();
    this.distance = 0; // km
    this.cameraZ = 0;

    // UI Cache
    this.ui = {
      score: document.getElementById('hud-score'),
      highScore: document.getElementById('hud-highscore'),
      speed: document.getElementById('hud-speed'),
      speedBar: document.getElementById('speed-bar-fill'),
      distance: document.getElementById('hud-distance'),
      comboContainer: document.getElementById('combo-container'),
      comboMultiplier: document.getElementById('hud-combo-multiplier'),
      comboTimerBar: document.getElementById('combo-timer-fill'),
      menuScreen: document.getElementById('menu-screen'),
      pauseScreen: document.getElementById('pause-screen'),
      gameOverScreen: document.getElementById('gameover-screen'),
      finalScore: document.getElementById('gameover-score'),
      finalDistance: document.getElementById('gameover-distance'),
      finalCloseCalls: document.getElementById('gameover-closecalls'),
      finalHighscoreBadge: document.getElementById('gameover-new-highscore')
    };

    this.lastTime = performance.now();
    this.initUI();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  initUI() {
    // Initial display of High Score
    this.ui.highScore.textContent = this.highScore.toLocaleString();
    this.ui.score.textContent = '0';
    this.ui.speed.textContent = '0';
    this.ui.distance.textContent = '0.0';

    // Start Button Click
    const startBtn = document.getElementById('btn-start');
    if (startBtn) {
      startBtn.addEventListener('click', () => this.startGame());
    }

    // Restart Button Click
    const restartBtn = document.getElementById('btn-restart');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => this.startGame());
    }

    // Resume Button Click
    const resumeBtn = document.getElementById('btn-resume');
    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => this.togglePause());
    }

    // Toggle CRT Filter Button
    const crtToggle = document.getElementById('btn-toggle-crt');
    if (crtToggle) {
      crtToggle.addEventListener('click', () => {
        document.getElementById('crt-overlay').classList.toggle('active');
      });
    }
  }

  startGame() {
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
    window.focus();

    this.player.reset();
    this.traffic.reset(this.player.z);
    this.particles.reset();

    this.score = 0;
    this.displayScore = 0;
    this.distance = 0;
    this.cameraZ = this.player.z - 1100;

    this.state = STATES.PLAYING;
    this.ui.menuScreen.classList.add('hidden');
    this.ui.gameOverScreen.classList.add('hidden');
    this.ui.pauseScreen.classList.add('hidden');
    this.ui.finalHighscoreBadge.classList.add('hidden');
  }

  togglePause() {
    if (this.state === STATES.PLAYING) {
      this.state = STATES.PAUSED;
      this.ui.pauseScreen.classList.remove('hidden');
    } else if (this.state === STATES.PAUSED) {
      this.state = STATES.PLAYING;
      this.ui.pauseScreen.classList.add('hidden');
    }
  }

  handleCrash(obstacleCar) {
    this.player.crash();
    this.particles.addExplosion(this.player.screenX || 400, this.player.screenY || 500);
    this.sound.playCrash();

    // Save records
    const stats = Storage.saveRun(Math.round(this.score), this.distance, this.traffic.totalCloseCalls);

    // Delay showing game over screen for crash impact effect
    setTimeout(() => {
      this.state = STATES.GAMEOVER;
      this.ui.finalScore.textContent = Math.round(this.score).toLocaleString();
      this.ui.finalDistance.textContent = `${this.distance.toFixed(1)} KM`;
      this.ui.finalCloseCalls.textContent = this.traffic.totalCloseCalls.toString();

      if (stats.isNewHighScore) {
        this.ui.finalHighscoreBadge.classList.remove('hidden');
        this.highScore = stats.highScore;
        this.ui.highScore.textContent = this.highScore.toLocaleString();
      }

      this.ui.gameOverScreen.classList.remove('hidden');
    }, 1100);
  }

  loop(currentTime) {
    const dt = Math.min(0.05, (currentTime - this.lastTime) / 1000); // capped delta time
    this.lastTime = currentTime;

    // Handle global inputs
    if (this.input.consumePause()) {
      this.togglePause();
    }

    if (this.input.consumeAction()) {
      if (this.state === STATES.MENU || this.state === STATES.GAMEOVER) {
        this.startGame();
      }
    }

    // State Updates
    if (this.state === STATES.PLAYING || (this.state === STATES.GAMEOVER && this.player.isCrashed)) {
      this.update(dt);
    } else if (this.state === STATES.MENU) {
      // Menu background ambient cruise
      this.cameraZ += 4500 * dt;
      this.player.z = this.cameraZ + 1100;
      this.particles.update(dt);
    }

    // Render 3D Scene
    this.renderer.render(this.cameraZ, this.player, this.traffic, this.particles);

    // Update HUD
    this.updateHUD(dt);

    requestAnimationFrame(this.loop);
  }

  update(dt) {
    // 1. Update Player Car
    this.player.update(dt, this.input, this.particles);

    // Camera tracks player along highway with dynamic screen nudge
    this.cameraZ = this.player.z - (1100 + (this.player.screenNudge * 240));

    // 2. Accumulate Distance & Score
    if (!this.player.isCrashed) {
      const distanceDelta = (this.player.speed * dt) / 10000;
      this.distance += distanceDelta;

      // Base score accumulation based on speed (more speed = much faster score)
      const speedScoreMultiplier = (this.player.speed / 5000);
      this.score += 45 * speedScoreMultiplier * dt * (1 + (this.traffic.combo * 0.5));
    }

    // 3. Update Traffic and Near-Misses
    this.traffic.update(
      dt,
      this.player,
      this.particles,
      this.sound,
      (bonusPoints) => {
        this.score += bonusPoints;
      },
      (obstacleCar) => {
        this.handleCrash(obstacleCar);
      }
    );

    // 4. Update Particle System & Camera Shake
    this.particles.update(dt);
  }

  updateHUD(dt) {
    if (this.state === STATES.PLAYING) {
      // Smooth score roll animation
      const diff = this.score - this.displayScore;
      this.displayScore += diff * Math.min(1.0, dt * 10);
      this.ui.score.textContent = Math.round(this.displayScore).toLocaleString();

      // High Score display
      if (this.score > this.highScore) {
        this.ui.highScore.textContent = Math.round(this.score).toLocaleString();
        this.ui.highScore.classList.add('beating');
      } else {
        this.ui.highScore.textContent = this.highScore.toLocaleString();
        this.ui.highScore.classList.remove('beating');
      }

      // Speedometer (Simulated MPH from 70 to 185 MPH)
      const currentMPH = Math.round(this.player.speed * 0.016);
      this.ui.speed.textContent = currentMPH.toString();

      const speedRatio = Math.min(1.0, (this.player.speed - this.player.minSpeed) / (this.player.maxSpeed - this.player.minSpeed));
      if (this.ui.speedBar) {
        this.ui.speedBar.style.width = `${Math.round(speedRatio * 100)}%`;
      }

      // Distance
      this.ui.distance.textContent = this.distance.toFixed(1);

      // Near-Miss Combo UI
      if (this.traffic.combo > 0) {
        this.ui.comboContainer.classList.remove('hidden');
        this.ui.comboMultiplier.textContent = `${this.traffic.combo}x`;
        const timerPercent = (this.traffic.comboTimer / 3.8) * 100;
        this.ui.comboTimerBar.style.width = `${Math.max(0, timerPercent)}%`;
      } else {
        this.ui.comboContainer.classList.add('hidden');
      }
    }
  }
}

// Boot game when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
