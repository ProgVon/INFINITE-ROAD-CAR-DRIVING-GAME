// PlayerCar.js - Controls the iconic retro sports car with discrete lane transitions and screen depth nudging

export const LANE_COORDINATES = [-0.75, -0.25, 0.25, 0.75]; // 4 distinct lanes

export class PlayerCar {
  constructor() {
    this.reset();
  }

  reset() {
    this.currentLane = 1; // start in mid-left lane (0, 1, 2, 3)
    this.targetLane = 1;
    this.x = LANE_COORDINATES[this.targetLane];
    this.targetX = this.x;

    // Forward/backward screen depth offset
    this.screenNudge = 0;
    this.targetNudge = 0;

    // Dynamics & Speed (in game world units / second)
    this.baseSpeed = 6000;
    this.maxSpeed = 11500;
    this.minSpeed = 3500;
    this.speed = this.baseSpeed;
    this.z = 0;

    // Visual tilt & crash state
    this.tilt = 0;
    this.isCrashed = false;
    this.crashSpin = 0;
    this.crashScale = 1.0;
    this.exhaustTimer = 0;

    // Animation state
    this.bouncePhase = 0;   // suspension oscillation phase
    this.bounceY = 0;       // current vertical bounce offset
    this.wheelAngle = 0;    // spinning rim angle
    this.roadCurve = 0;     // current road curve set by Renderer each frame
    this.bodySquat = 0;     // smooth body squat offset

    // Dimensions for collision
    this.width = 0.28;
    this.length = 180;
  }

  switchLaneLeft() {
    if (this.isCrashed) return;
    if (this.targetLane > 0) {
      this.targetLane--;
      this.targetX = LANE_COORDINATES[this.targetLane];
      return true;
    }
    return false;
  }

  switchLaneRight() {
    if (this.isCrashed) return;
    if (this.targetLane < LANE_COORDINATES.length - 1) {
      this.targetLane++;
      this.targetX = LANE_COORDINATES[this.targetLane];
      return true;
    }
    return false;
  }

  update(dt, input, particleSystem) {
    if (this.isCrashed) {
      // Cinematic spin-out
      this.crashSpin += dt * 10;
      this.crashScale = Math.max(0.2, this.crashScale - dt * 0.4);
      this.speed = Math.max(0, this.speed - dt * 12000);
      this.z += this.speed * dt;
      return;
    }

    // Process discrete lane switch inputs
    if (input.consumeLaneLeft()) {
      if (this.switchLaneLeft()) {
        particleSystem.addSkid(this.screenX || 400, this.screenY || 500);
      }
    }
    if (input.consumeLaneRight()) {
      if (this.switchLaneRight()) {
        particleSystem.addSkid(this.screenX || 400, this.screenY || 500);
      }
    }

    // Process Up / Down screen positioning & throttle
    const isAccelerating = input.keys.up;
    const isBraking = input.keys.down;

    if (isAccelerating) {
      this.targetNudge = 0.65; // move forward towards horizon
      this.speed = Math.min(this.maxSpeed, this.speed + dt * 4500);
    } else if (isBraking) {
      this.targetNudge = -0.55; // pull back towards bottom screen
      this.speed = Math.max(this.minSpeed, this.speed - dt * 6000);
    } else {
      this.targetNudge = 0.0; // return to center cruising position
      // Gradual natural return to base cruising speed
      if (this.speed > this.baseSpeed) {
        this.speed = Math.max(this.baseSpeed, this.speed - dt * 2500);
      } else if (this.speed < this.baseSpeed) {
        this.speed = Math.min(this.baseSpeed, this.speed + dt * 2000);
      }
    }

    // Smooth lane interpolation with responsive easing
    const dx = this.targetX - this.x;
    this.x += dx * Math.min(1.0, dt * 14);

    // More dramatic banking tilt — wider range for visible lean
    const targetTilt = Math.max(-0.42, Math.min(0.42, dx * 1.5));
    this.tilt += (targetTilt - this.tilt) * Math.min(1.0, dt * 10);

    // Smooth screen nudge interpolation
    this.screenNudge += (this.targetNudge - this.screenNudge) * Math.min(1.0, dt * 6);

    // Suspension bounce — amplitude scales with speed
    this.bouncePhase += dt * this.speed * 0.0016;
    this.bounceY = Math.sin(this.bouncePhase) * Math.min(2.8, this.speed * 0.00022);

    // Wheel rim spin
    this.wheelAngle = (this.wheelAngle + dt * this.speed * 0.005) % (Math.PI * 2);

    // Body squat on throttle / lift on braking
    const targetSquat = isAccelerating ? 3.5 : (isBraking ? -2.5 : 0);
    this.bodySquat += (targetSquat - this.bodySquat) * Math.min(1.0, dt * 8);

    // Progress along highway
    this.z += this.speed * dt;

    // Spawn exhaust particles
    this.exhaustTimer += dt;
    if (this.exhaustTimer > 0.035 && this.screenX && this.screenY) {
      this.exhaustTimer = 0;
      const curScale = this.drawScale || 1.0;
      particleSystem.addExhaust(
        this.screenX - 18 * curScale,
        this.screenY + 28 * curScale,
        isAccelerating
      );
      particleSystem.addExhaust(
        this.screenX + 18 * curScale,
        this.screenY + 28 * curScale,
        isAccelerating
      );
    }
  }

  crash() {
    if (!this.isCrashed) {
      this.isCrashed = true;
    }
  }

  // Draw the iconic 80s synthwave sports car with full live animations
  draw(ctx, screenX, screenY, scale = 1.0) {
    if (screenX === undefined || screenY === undefined) {
      screenX = 640 + (this.x * 480);
      screenY = 572;
      scale = 0.90;
    }

    this.screenX = screenX;
    this.screenY = screenY;
    this.drawScale = scale;

    // Combined lean: lane-change banking + road curve lean
    // NOTE: positive roadCurve shifts road RIGHT on screen = visual LEFT turn,
    // so we negate to make the car lean into the correct direction of the bend.
    const roadLean    = -(this.roadCurve || 0) * 0.07;
    const totalTilt   = this.tilt + roadLean;

    // Cabin perspective shift — roof slides in tilt direction for 3D lean illusion
    const cabinShift  = totalTilt * 26;   // px offset at top of cabin
    const spoilerShift = totalTilt * 14;  // slightly less for the mid spoiler

    // Vertical bounce + throttle squat
    const vertOffset  = (this.bounceY || 0) + (this.bodySquat || 0);

    const isBraking   = this.targetNudge < -0.1;
    const isHighSpeed = this.speed > 9000;

    ctx.save();
    ctx.translate(screenX, screenY - (12 * scale) + vertOffset * scale);

    if (this.isCrashed) {
      ctx.rotate(this.crashSpin);
      ctx.scale(this.crashScale * scale, this.crashScale * scale);
    } else {
      ctx.rotate(totalTilt);
      ctx.scale(scale, scale);
    }

    // ── Speed streaks (motion lines at sides when going fast) ──────────────
    if (isHighSpeed && !this.isCrashed) {
      const streakAlpha = Math.min(0.55, (this.speed - 9000) / 5000);
      ctx.save();
      ctx.globalAlpha = streakAlpha;
      ctx.strokeStyle = '#ff1a53';
      ctx.lineWidth = 1.5;
      for (let s = 0; s < 5; s++) {
        const sy = -8 + s * 8;
        const len = 18 + s * 6;
        ctx.beginPath(); ctx.moveTo(-52, sy); ctx.lineTo(-52 - len, sy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo( 52, sy); ctx.lineTo( 52 + len, sy); ctx.stroke();
      }
      ctx.restore();
    }

    // ── 1. Shadow (stretches with tilt) ────────────────────────────────────
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.50)';
    ctx.beginPath();
    ctx.ellipse(totalTilt * 18, 34, 54 + Math.abs(totalTilt) * 12, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ── 2. Rear Wheels with spinning rims ──────────────────────────────────
    const drawWheel = (wx, wy) => {
      // Tire body
      ctx.fillStyle = '#0d1014';
      ctx.fillRect(wx, wy, 16, 24);
      // Rim circle
      const cx = wx + 8, cy = wy + 12;
      ctx.fillStyle = '#1e2330';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 6, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      // Spinning spokes
      ctx.strokeStyle = '#ff007f';
      ctx.lineWidth = 1.2;
      for (let s = 0; s < 5; s++) {
        const a = s * Math.PI * 2 / 5 + this.wheelAngle;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * 5.5, cy + Math.sin(a) * 8);
        ctx.stroke();
      }
      // Neon hub glow
      ctx.fillStyle = '#ff007f';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 1.8, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    drawWheel(-53, 10);
    drawWheel(37, 10);

    // ── 3. Main Wedge Body ─────────────────────────────────────────────────
    const bodyGrad = ctx.createLinearGradient(0, -35, 0, 25);
    bodyGrad.addColorStop(0,   '#ff1a53');
    bodyGrad.addColorStop(0.5, '#cc0033');
    bodyGrad.addColorStop(1,   '#80001f');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(-40, -10);
    ctx.lineTo(-48,  20);
    ctx.lineTo(-44,  28);
    ctx.lineTo( 44,  28);
    ctx.lineTo( 48,  20);
    ctx.lineTo( 40, -10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ff3388';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ── 4. Cabin with 3D lean shift ────────────────────────────────────────
    // Bottom of cabin is anchored to body; top shifts with cabinShift
    ctx.fillStyle = '#0a0d18';
    ctx.beginPath();
    ctx.moveTo(-26 + cabinShift, -10);
    ctx.lineTo(-32, 6);
    ctx.lineTo( 32, 6);
    ctx.lineTo( 26 + cabinShift, -10);
    ctx.closePath();
    ctx.fill();

    // Rear window louver slats — also shifted
    ctx.save();
    ctx.translate(cabinShift * 0.85, 0);
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    for (let ly = -6; ly <= 3; ly += 3) {
      ctx.beginPath(); ctx.moveTo(-24, ly); ctx.lineTo(24, ly); ctx.stroke();
    }
    ctx.restore();

    // ── 5. Roof & Spoiler (shifted with cabinShift) ────────────────────────
    ctx.fillStyle = '#ff1a53';
    ctx.fillRect(-22 + cabinShift, -15, 44, 5);

    // Elevated rear spoiler — partial shift
    ctx.fillStyle = '#200510';
    ctx.fillRect(-46 + spoilerShift, 5, 92, 6);
    ctx.fillStyle = '#ff0055';
    ctx.fillRect(-48 + spoilerShift, 4, 96, 3);

    // ── 6. Taillight Bar ───────────────────────────────────────────────────
    ctx.save();
    ctx.shadowColor = isBraking ? '#ff0000' : '#ff0055';
    ctx.shadowBlur  = isBraking ? 22 : 12;
    ctx.fillStyle = '#1a0008';
    ctx.fillRect(-42, 13, 84, 8);
    ctx.fillStyle = isBraking ? '#ffffff' : '#ff2a6d';
    ctx.fillRect(-40, 14, 80, isBraking ? 7 : 5);
    if (isBraking) {
      ctx.fillStyle = '#ff0033';
      ctx.fillRect(-42, 13, 84, 8);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-36, 15, 72, 4);
    }
    ctx.restore();

    // ── 7. License Plate ───────────────────────────────────────────────────
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-14, 22, 28, 7);
    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 5px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('OUTRUN', 0, 27);

    // ── 8. Exhausts (flare at high speed / accel) ──────────────────────────
    const exhaustFlare = this.targetNudge > 0.3 ? 1.8 : 1.0;
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(-22, 29, 3.5, 0, Math.PI * 2);
    ctx.arc( 22, 29, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-22, 29, 2, 0, Math.PI * 2);
    ctx.arc( 22, 29, 2, 0, Math.PI * 2);
    ctx.fill();
    if (exhaustFlare > 1.2) {
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#ff6600';
      ctx.beginPath();
      ctx.arc(-22, 32, 3 * exhaustFlare, 0, Math.PI * 2);
      ctx.arc( 22, 32, 3 * exhaustFlare, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }
}
