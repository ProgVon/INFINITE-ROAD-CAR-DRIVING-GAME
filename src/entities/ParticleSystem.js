// ParticleSystem.js - Manages exhaust sparks, crash debris, floating score text, and screen shake

export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.floatingTexts = [];
    this.screenShake = 0;
  }

  // Add camera trauma (0.0 - 1.0)
  shake(amount) {
    this.screenShake = Math.min(1.0, this.screenShake + amount);
  }

  getShakeOffset() {
    if (this.screenShake <= 0.001) return { x: 0, y: 0 };
    const power = this.screenShake * this.screenShake * 24;
    return {
      x: (Math.random() * 2 - 1) * power,
      y: (Math.random() * 2 - 1) * power
    };
  }

  // Exhaust sparks & turbo flames behind player car
  addExhaust(x, y, isBoosting = false) {
    const count = isBoosting ? 4 : 1;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() * 20 - 10),
        y: y + (Math.random() * 6 - 3),
        vx: (Math.random() * 2 - 1) * 0.8,
        vy: (Math.random() * 3 + 2), // drifts downward/backward
        size: Math.random() * (isBoosting ? 5 : 3) + 2,
        color: isBoosting
          ? (Math.random() > 0.5 ? '#00ffff' : '#ff007f')
          : (Math.random() > 0.5 ? '#ff4500' : '#ffa500'),
        alpha: 0.9,
        decay: Math.random() * 0.04 + 0.03
      });
    }
  }

  // Skid smoke when switching lanes rapidly
  addSkid(x, y) {
    for (let i = 0; i < 3; i++) {
      this.particles.push({
        x: x + (Math.random() * 30 - 15),
        y: y + (Math.random() * 10),
        vx: (Math.random() * 2 - 1) * 1.5,
        vy: Math.random() * 2 + 1,
        size: Math.random() * 6 + 4,
        color: '#6e7a9c',
        alpha: 0.5,
        decay: 0.03
      });
    }
  }

  // Massive explosion on sudden death collision
  addExplosion(x, y) {
    this.shake(1.0);
    // Shockwave burst of particles
    for (let i = 0; i < 90; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 14 + 3;
      const colors = ['#ff0055', '#ffaa00', '#00ffff', '#ffffff', '#ff2a8d'];
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (Math.random() * 4), // upward explosion bias
        size: Math.random() * 9 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1.0,
        decay: Math.random() * 0.02 + 0.015
      });
    }
  }

  // Floating arcade score popups (e.g. "CLOSE CALL! +500 x2")
  addFloatingText(text, x, y, color = '#00ffff', size = 22) {
    this.floatingTexts.push({
      text,
      x,
      y,
      vy: -2.2,
      alpha: 1.0,
      scale: 1.4,
      color,
      size,
      decay: 0.018
    });
  }

  update(dt) {
    // Update camera shake decay
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 2.5);
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;
      p.size = Math.max(0.5, p.size * 0.96);

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const t = this.floatingTexts[i];
      t.y += t.vy;
      t.alpha -= t.decay;
      t.scale = Math.max(1.0, t.scale - 0.04);

      if (t.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    ctx.save();
    // Draw particles
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw floating texts
    for (const t of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, t.alpha);
      ctx.font = `900 ${Math.round(t.size * t.scale)}px 'Orbitron', monospace, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Neon glow outline
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 5;
      ctx.strokeText(t.text, t.x, t.y);

      ctx.fillStyle = t.color;
      ctx.shadowColor = t.color;
      ctx.shadowBlur = 12;
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    }
    ctx.restore();
  }

  reset() {
    this.particles = [];
    this.floatingTexts = [];
    this.screenShake = 0;
  }
}
