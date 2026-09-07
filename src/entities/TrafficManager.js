// TrafficManager.js - Spawns and simulates multi-class highway traffic with lane switching and near-miss scoring

import { LANE_COORDINATES } from './PlayerCar.js';

export const TRAFFIC_TYPES = {
  TRUCK: 'truck',
  SEDAN: 'sedan',
  SPORTS: 'sports'
};

export class TrafficManager {
  constructor() {
    this.reset();
  }

  reset(playerZ = 0) {
    this.cars = [];
    this.spawnTimer = 0;
    this.spawnInterval = 1.0; // seconds between spawns, decreases with difficulty
    this.difficultyTimer = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.totalCloseCalls = 0;

    // Immediately populate initial traffic ahead so highway is active right away
    this.spawnCar({ z: playerZ }, playerZ + 750, 0, TRAFFIC_TYPES.TRUCK);
    this.spawnCar({ z: playerZ }, playerZ + 1500, 2, TRAFFIC_TYPES.SEDAN);
    this.spawnCar({ z: playerZ }, playerZ + 2300, 1, TRAFFIC_TYPES.SPORTS);
    this.spawnCar({ z: playerZ }, playerZ + 3200, 3, TRAFFIC_TYPES.TRUCK);
    this.spawnCar({ z: playerZ }, playerZ + 4200, 0, TRAFFIC_TYPES.SEDAN);
    this.spawnCar({ z: playerZ }, playerZ + 5300, 2, TRAFFIC_TYPES.SPORTS);
  }

  update(dt, player, particleSystem, soundManager, onScoreBonus, onCrash) {
    if (player.isCrashed) return;

    // Difficulty scaling: gradually increase traffic frequency over time
    this.difficultyTimer += dt;
    this.spawnInterval = Math.max(0.45, 1.0 - (this.difficultyTimer * 0.008));

    // Combo timer decay: resets combo if no near-miss performed within 3.5s
    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
      }
    }

    // Spawn new traffic cars
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnCar(player);
    }

    // Update traffic cars
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const car = this.cars[i];

      // Update position along road
      car.z += car.speed * dt;

      // Update AI lane switching
      if (car.type === TRAFFIC_TYPES.SEDAN && car.canSwitchLane) {
        this.updateAILaneSwitch(car, dt);
      }

      // Check Collision with Player
      const dz = Math.abs(car.z - player.z);
      const dx = Math.abs(car.x - player.x);

      // Collision box dimensions (scaled to vehicle class)
      const hitZ = (player.length + car.length) * 0.42;
      const hitX = (player.width + car.width) * 0.42;

      if (dz < hitZ && dx < hitX) {
        // Sudden death collision!
        onCrash(car);
        return;
      }

      // Check Near-Miss ("Cut Through" Close Call)
      // Player is overtaking the vehicle within close lateral distance
      if (!car.nearMissAwarded && car.z < player.z + 80 && car.z > player.z - 80) {
        const nearMissMaxX = (player.width + car.width) * 0.95;
        if (dx >= hitX && dx <= nearMissMaxX) {
          car.nearMissAwarded = true;
          this.triggerNearMiss(car, player, particleSystem, soundManager, onScoreBonus);
        }
      }

      // Despawn if far behind player or excessively far ahead beyond horizon
      if (car.z < player.z - 1800 || car.z > player.z + 45000) {
        this.cars.splice(i, 1);
      }
    }
  }

  updateAILaneSwitch(car, dt) {
    car.aiTimer += dt;
    if (car.aiState === 'cruising') {
      if (car.aiTimer > car.nextDecisionTime) {
        car.aiTimer = 0;
        // 45% chance to attempt lane change
        if (Math.random() < 0.45) {
          const possibleLanes = [];
          if (car.laneIndex > 0) possibleLanes.push(car.laneIndex - 1);
          if (car.laneIndex < LANE_COORDINATES.length - 1) possibleLanes.push(car.laneIndex + 1);

          if (possibleLanes.length > 0) {
            car.targetLaneIndex = possibleLanes[Math.floor(Math.random() * possibleLanes.length)];
            car.aiState = 'signaling';
            car.signalBlink = 0;
            car.signalDirection = car.targetLaneIndex < car.laneIndex ? 'left' : 'right';
          }
        }
      }
    } else if (car.aiState === 'signaling') {
      // Signal blinker for 1.2s before moving
      car.signalBlink += dt * 6;
      if (car.aiTimer >= 1.2) {
        car.aiState = 'moving';
        car.targetX = LANE_COORDINATES[car.targetLaneIndex];
      }
    } else if (car.aiState === 'moving') {
      car.signalBlink += dt * 6;
      const dX = car.targetX - car.x;
      // Slower lerp to prevent overshoot / off-road drift
      car.x += dX * Math.min(1.0, dt * 1.6);
      if (Math.abs(dX) < 0.005) {
        // Hard snap and clamp to ensure the car lands exactly on lane coordinate
        car.x = Math.max(-0.88, Math.min(0.88, car.targetX));
        car.laneIndex = car.targetLaneIndex;
        car.aiState = 'cruising';
        car.aiTimer = 0;
        car.signalDirection = null;
        car.nextDecisionTime = Math.random() * 5 + 4;
      }
    }
  }

  triggerNearMiss(car, player, particleSystem, soundManager, onScoreBonus) {
    this.combo++;
    this.comboTimer = 3.8;
    this.totalCloseCalls++;

    const bonusPoints = 500 * this.combo;
    onScoreBonus(bonusPoints);

    // Camera micro-shake
    particleSystem.shake(0.22);
    soundManager.playNearMiss(this.combo);

    // Floating text feedback
    const screenX = player.screenX || 400;
    const screenY = (player.screenY || 500) - 50;
    const label = this.combo > 1 ? `CLOSE CALL! +${bonusPoints} [${this.combo}x]` : `CLOSE CALL! +${bonusPoints}`;
    const color = this.combo >= 4 ? '#ffe600' : (this.combo >= 2 ? '#ff007f' : '#00ffff');
    
    particleSystem.addFloatingText(label, screenX, screenY, color, this.combo > 1 ? 22 : 18);
  }

  spawnCar(player, customZ = null, forcedLane = null, forcedType = null) {
    const lane = forcedLane !== null ? forcedLane : Math.floor(Math.random() * LANE_COORDINATES.length);
    // Spawn deep in the background at the horizon (16,000 to 24,000 units ahead)
    const spawnZ = customZ !== null ? customZ : player.z + Math.random() * 8000 + 16000;

    // Check if slot is occupied
    const occupied = this.cars.some(c => c.laneIndex === lane && Math.abs(c.z - spawnZ) < 800);
    if (occupied) return;

    // Determine type
    const roll = Math.random();
    let type = forcedType || TRAFFIC_TYPES.SEDAN;
    let speed = 4600 + Math.random() * 1100;
    let width = 0.28;
    let length = 170;
    let color = '#3b82f6'; // vibrant blue

    if (!forcedType) {
      if (roll < 0.35) {
        type = TRAFFIC_TYPES.TRUCK;
      } else if (roll > 0.68) {
        type = TRAFFIC_TYPES.SPORTS;
      }
    }

    if (type === TRAFFIC_TYPES.TRUCK) {
      speed = 2800 + Math.random() * 800; // slow moving obstacle
      width = 0.36;
      length = 260;
      color = '#f59e0b'; // amber/orange
    } else if (type === TRAFFIC_TYPES.SPORTS) {
      speed = 6400 + Math.random() * 1400; // fast moving
      width = 0.27;
      length = 160;
      const sportsColors = ['#10b981', '#8b5cf6', '#ec4899', '#06b6d4'];
      color = sportsColors[Math.floor(Math.random() * sportsColors.length)];
    } else {
      const sedanColors = ['#3b82f6', '#6366f1', '#64748b', '#0ea5e9'];
      color = sedanColors[Math.floor(Math.random() * sedanColors.length)];
    }

    this.cars.push({
      type,
      laneIndex: lane,
      targetLaneIndex: lane,
      x: LANE_COORDINATES[lane],
      targetX: LANE_COORDINATES[lane],
      z: spawnZ,
      speed,
      width,
      length,
      color,
      nearMissAwarded: false,
      canSwitchLane: type === TRAFFIC_TYPES.SEDAN,
      aiState: 'cruising',
      aiTimer: 0,
      nextDecisionTime: Math.random() * 3 + 2,
      signalDirection: null,
      signalBlink: 0
    });
  }

  // Draw an individual obstacle car based on projected 3D perspective
  drawCar(ctx, car, screenX, screenY, scale) {
    if (scale <= 0) return;

    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.scale(scale, scale);

    if (car.type === TRAFFIC_TYPES.TRUCK) {
      this.drawTruck(ctx, car);
    } else if (car.type === TRAFFIC_TYPES.SPORTS) {
      this.drawSportsCar(ctx, car);
    } else {
      this.drawSedan(ctx, car);
    }

    ctx.restore();
  }

  // Semi-Truck rendering
  drawTruck(ctx, car) {
    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.ellipse(0, 48, 62, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tires
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-56, 18, 16, 32);
    ctx.fillRect(40, 18, 16, 32);

    // Mudflaps with hazard stripes
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-56, 44, 16, 8);
    ctx.fillRect(40, 44, 16, 8);

    // High Trailer Box Body
    const trailerGrad = ctx.createLinearGradient(0, -90, 0, 30);
    trailerGrad.addColorStop(0, '#e2e8f0');
    trailerGrad.addColorStop(0.5, '#cbd5e1');
    trailerGrad.addColorStop(1, '#94a3b8');

    ctx.fillStyle = trailerGrad;
    ctx.fillRect(-50, -85, 100, 115);

    // Trailer Door Frame & Roll-up slats
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.strokeRect(-48, -83, 96, 111);

    ctx.strokeStyle = 'rgba(71, 85, 105, 0.4)';
    for (let y = -75; y <= 15; y += 12) {
      ctx.beginPath();
      ctx.moveTo(-44, y);
      ctx.lineTo(44, y);
      ctx.stroke();
    }

    // Rear Hazard Chevron Stripe
    const stripeGrad = ctx.createLinearGradient(-48, 0, 48, 0);
    stripeGrad.addColorStop(0, '#f59e0b');
    stripeGrad.addColorStop(0.5, '#000000');
    stripeGrad.addColorStop(1, '#f59e0b');
    ctx.fillStyle = stripeGrad;
    ctx.fillRect(-48, 18, 96, 10);

    // High Marker Lights
    ctx.fillStyle = '#ff0033';
    ctx.fillRect(-44, -80, 8, 4);
    ctx.fillRect(-4, -80, 8, 4);
    ctx.fillRect(36, -80, 8, 4);

    // Taillights
    ctx.save();
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ff1122';
    ctx.fillRect(-44, 20, 14, 6);
    ctx.fillRect(30, 20, 14, 6);
    ctx.restore();
  }

  // Sedan / Family Cruiser rendering
  drawSedan(ctx, car) {
    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.ellipse(0, 30, 50, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tires
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-44, 10, 12, 22);
    ctx.fillRect(32, 10, 12, 22);

    // Main Car Body
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-40, -6, 80, 32, 4);
    ctx.fill();

    // Cabin / Roof
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(-28, -6);
    ctx.lineTo(-20, -28);
    ctx.lineTo(20, -28);
    ctx.lineTo(28, -6);
    ctx.closePath();
    ctx.fill();

    // Rear Windshield Reflection
    ctx.fillStyle = 'rgba(186, 230, 253, 0.35)';
    ctx.beginPath();
    ctx.moveTo(-24, -8);
    ctx.lineTo(-18, -25);
    ctx.lineTo(18, -25);
    ctx.lineTo(24, -8);
    ctx.closePath();
    ctx.fill();

    // Taillights
    ctx.save();
    ctx.shadowColor = '#ff2200';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ff0033';
    ctx.fillRect(-38, 2, 16, 8);
    ctx.fillRect(22, 2, 16, 8);
    ctx.restore();

    // License Plate
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-12, 12, 24, 8);

    // Turn Blinkers (Signaling AI Lane Switch)
    if (car.signalDirection && Math.floor(car.signalBlink) % 2 === 0) {
      ctx.save();
      ctx.shadowColor = '#ffaa00';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#ffbb00';
      if (car.signalDirection === 'left') {
        ctx.fillRect(-40, 2, 8, 8);
      } else {
        ctx.fillRect(32, 2, 8, 8);
      }
      ctx.restore();
    }
  }

  // Sports Car rendering
  drawSportsCar(ctx, car) {
    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.ellipse(0, 28, 48, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wide Tires
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-46, 8, 14, 22);
    ctx.fillRect(32, 8, 14, 22);

    // Aerodynamic Wedge Body
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.moveTo(-38, -12);
    ctx.lineTo(-44, 16);
    ctx.lineTo(44, 16);
    ctx.lineTo(38, -12);
    ctx.closePath();
    ctx.fill();

    // Cabin & Slanted Rear Window
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.moveTo(-26, -10);
    ctx.lineTo(-20, -24);
    ctx.lineTo(20, -24);
    ctx.lineTo(26, -10);
    ctx.closePath();
    ctx.fill();

    // Rear Spoiler
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-42, -2, 84, 4);

    // Glowing Neon Taillight Bar
    ctx.save();
    ctx.shadowColor = '#ff0055';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ff0044';
    ctx.fillRect(-36, 6, 72, 5);
    ctx.restore();

    // Dual Exhausts
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.arc(-18, 20, 3, 0, Math.PI * 2);
    ctx.arc(18, 20, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
