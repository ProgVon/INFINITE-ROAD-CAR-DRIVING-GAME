// Renderer.js - Authentic Pseudo-3D Synthwave Curved Highway Renderer

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Virtual Internal Resolution
    this.width = 1280;
    this.height = 720;
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    // Road Projection Parameters
    this.roadWidth = 850;        // virtual world road width
    this.segmentLength = 200;    // length of single road segment
    this.rumbleLength = 3;       // number of segments per rumble strip color cycle
    this.cameraHeight = 1000;    // camera height above road
    this.cameraDepth = 0.8;      // camera FOV / depth factor
    this.drawDistance = 200;     // how many segments forward to render

    // Highway segments buffer
    this.segments = [];
    this.totalSegments = 1600;
    this.trackLength = this.totalSegments * this.segmentLength;

    // Horizon animation & parallax
    this.curveParallax = 0;
    this.horizonY = this.height * 0.46;

    this.buildRoadTrack();
  }

  // Generate continuous curving track with gentle hills and turns
  buildRoadTrack() {
    this.segments = [];
    for (let i = 0; i < this.totalSegments; i++) {
      // Calculate curves and hills based on segment index
      let curve = 0;
      let y = 0;

      // Section 1: straight
      // Section 2: sweeping right curve
      if (i > 100 && i < 350) {
        curve = Math.sin((i - 100) / 250 * Math.PI) * 2.8;
      }
      // Section 3: gentle crest hill
      if (i > 250 && i < 500) {
        y = Math.sin((i - 250) / 250 * Math.PI) * 600;
      }
      // Section 4: sharp left S-turn
      if (i > 550 && i < 800) {
        curve = -Math.sin((i - 550) / 250 * Math.PI) * 3.4;
      }
      // Section 5: roller-coaster dips
      if (i > 750 && i < 1100) {
        y = Math.sin((i - 750) / 175 * Math.PI * 2) * 500;
        curve = Math.sin((i - 750) / 350 * Math.PI) * 2.2;
      }
      // Section 6: high-speed long sweeping turn
      if (i > 1200 && i < 1500) {
        curve = Math.sin((i - 1200) / 300 * Math.PI) * 3.2;
      }

      // Alternating colors for retro synthwave look
      const isAlt = Math.floor(i / this.rumbleLength) % 2 === 0;

      // Side props (palm trees or neon pillars)
      let sprite = null;
      if (i % 16 === 0) {
        sprite = {
          type: (i % 32 === 0) ? 'neonPalm' : 'cyberPillar',
          offset: (i % 32 === 0) ? -1.35 : 1.35 // left or right of road
        };
      }

      this.segments.push({
        index: i,
        y: y,
        curve: curve,
        sprite: sprite,
        p1: { camera: {}, screen: {} },
        p2: { camera: {}, screen: {} },
        color: {
          road: isAlt ? '#141226' : '#1b1933',
          rumble: isAlt ? '#ff007f' : '#00f0ff', // neon magenta & neon cyan
          lane: isAlt ? '#00f0ff' : 'transparent', // dashed cyan lane markers
          ground: isAlt ? '#08051a' : '#0c0724'
        }
      });
    }
  }

  // Safe wrapping modulo (always returns 0 <= index < totalSegments)
  getSegmentIndex(n) {
    return ((n % this.totalSegments) + this.totalSegments) % this.totalSegments;
  }

  // 3D Perspective Projection for relative distance
  projectSegment(p, worldX, worldY, cameraZDist) {
    p.camera.x = worldX;
    p.camera.y = worldY - this.cameraHeight;
    p.camera.z = cameraZDist;

    if (p.camera.z <= 0) return;

    p.screen.scale = this.cameraDepth / p.camera.z;
    p.screen.x = Math.round((this.width / 2) + (p.screen.scale * p.camera.x * this.width / 2));
    p.screen.y = Math.round(this.horizonY - (p.screen.scale * p.camera.y * this.height / 2));
    p.screen.w = Math.round(p.screen.scale * this.roadWidth * this.width / 2);
  }

  // Render everything
  render(cameraZ, player, trafficManager, particleSystem) {
    const ctx = this.ctx;
    const shake = particleSystem.getShakeOffset();

    ctx.save();
    ctx.translate(shake.x, shake.y);

    // 1. Draw Synthwave Sunset & Background
    this.drawBackground(ctx, player);

    // 2. Render 3D Road Segments
    const baseSegmentIndex = this.getSegmentIndex(Math.floor(cameraZ / this.segmentLength));
    const startPos = ((cameraZ % this.segmentLength) + this.segmentLength) % this.segmentLength;

    let dx = 0;
    let camCurve = 0;
    let maxy = this.height; // for occlusion clipping

    // First pass: project segments
    const renderedSegments = [];

    for (let n = 0; n < this.drawDistance; n++) {
      const segIndex = this.getSegmentIndex(baseSegmentIndex + n);
      const segment = this.segments[segIndex];

      camCurve += segment.curve;
      dx += camCurve * 0.08;

      const z1 = (n * this.segmentLength) - startPos;
      const z2 = ((n + 1) * this.segmentLength) - startPos;

      this.projectSegment(segment.p1, dx, segment.y, z1);
      this.projectSegment(segment.p2, dx + segment.curve, segment.y, z2);

      // Only draw if within front frustum and below previous segment horizon
      if (z1 > 0 && segment.p2.screen && segment.p2.screen.y < maxy) {
        renderedSegments.push(segment);
        maxy = segment.p2.screen.y;
      }
    }

    // Render road segments from back to front
    for (let i = renderedSegments.length - 1; i >= 0; i--) {
      const seg = renderedSegments[i];
      this.drawSegment(ctx, seg);
    }

    // Render roadside scenery props
    for (let i = renderedSegments.length - 1; i >= 0; i--) {
      const seg = renderedSegments[i];
      if (seg.sprite) {
        this.drawRoadsideSprite(ctx, seg);
      }
    }

    // 3. Render traffic vehicles and player car sorted by distance
    // 3. Render traffic cars sorted by distance (back to front)
    const sortedTraffic = [...trafficManager.cars]
      .filter(car => {
        const relZ = car.z - cameraZ;
        return relZ > 40 && relZ < (this.drawDistance * this.segmentLength);
      })
      .sort((a, b) => b.z - a.z);

    for (const car of sortedTraffic) {
      const relZ = car.z - cameraZ;
      const segOffset = Math.floor(relZ / this.segmentLength);
      if (segOffset >= 0 && segOffset < this.drawDistance) {
        const segIndex = this.getSegmentIndex(baseSegmentIndex + segOffset);
        const seg = this.segments[segIndex];
        if (seg && seg.p1.screen && seg.p2.screen && seg.p1.camera.z > 0) {
          const p1 = seg.p1.screen;
          const p2 = seg.p2.screen;
          const percent = (((relZ % this.segmentLength) + this.segmentLength) % this.segmentLength) / this.segmentLength;

          const interpW = p1.w + (p2.w - p1.w) * percent;
          const interpCenterX = p1.x + (p2.x - p1.x) * percent;
          // Clamp car.x so traffic can never render outside road edges
          const clampedCarX = Math.max(-0.88, Math.min(0.88, car.x));
          const rawScreenX = interpCenterX + (clampedCarX * interpW);
          // Hard clamp screenX to visual road edges so no car drifts off-road
          const screenX = Math.max(interpCenterX - interpW * 0.92, Math.min(interpCenterX + interpW * 0.92, rawScreenX));
          const screenY = p1.y + (p2.y - p1.y) * percent;
          // Cap draw scale so close-up cars don't become oversized
          const drawScale = Math.max(0.04, Math.min(1.1, interpW * 0.0031));

          const trafficScale = car.type === 'truck' ? Math.min(1.35, drawScale * 1.25) : drawScale;
          // Smooth atmospheric horizon fade-in so cars never pop in abruptly
          const alpha = relZ > 18000 ? Math.max(0, Math.min(1.0, (35000 - relZ) / 17000)) : 1.0;
          ctx.save();
          ctx.globalAlpha = alpha;
          trafficManager.drawCar(ctx, car, screenX, screenY, trafficScale);
          ctx.restore();
        }
      }
    }

    // 4. Render Player Car — fixed X, but Y follows road hills to prevent levitation
    const BOTTOM_ROAD_HALF_W = 480;
    const playerScreenX = (this.width / 2) + (player.x * BOTTOM_ROAD_HALF_W);

    // Sample road hill Y at the player's current segment and smoothly lerp it
    // so the car rises/falls with crests and dips instead of floating above them.
    const playerSegIdx = this.getSegmentIndex(Math.floor(player.z / this.segmentLength));
    const playerSegY   = this.segments[playerSegIdx]?.y || 0;
    const targetHillOffset = playerSegY * 0.042;   // scale road height to screen px
    this.playerHillOffset  = (this.playerHillOffset || 0)
      + (targetHillOffset - (this.playerHillOffset || 0)) * 0.10;  // smooth lag
    const playerScreenY = this.height - 148 + this.playerHillOffset;

    const playerScale   = 0.90;

    // Feed road curve ahead to the player car so it leans into bends
    const lookAheadSeg = this.segments[this.getSegmentIndex(baseSegmentIndex + 12)];
    player.roadCurve = lookAheadSeg ? lookAheadSeg.curve : 0;

    player.draw(ctx, playerScreenX, playerScreenY, playerScale);

    // 5. Render Particles & Floating Score Popups
    particleSystem.draw(ctx);

    ctx.restore();
  }

  // Draw Segment Polygon (Road, Rumble Borders, 4 Lanes)
  drawSegment(ctx, seg) {
    const p1 = seg.p1.screen;
    const p2 = seg.p2.screen;

    // Ground / Horizon Plains
    ctx.fillStyle = seg.color.ground;
    ctx.fillRect(0, p2.y, this.width, p1.y - p2.y);

    // Rumble Strips (Neon Cyan / Magenta highway curb glow)
    const r1 = p1.w * 1.14;
    const r2 = p2.w * 1.14;
    this.drawQuad(ctx, seg.color.rumble,
      p1.x - r1, p1.y,
      p1.x + r1, p1.y,
      p2.x + r2, p2.y,
      p2.x - r2, p2.y
    );

    // Main Road Surface
    this.drawQuad(ctx, seg.color.road,
      p1.x - p1.w, p1.y,
      p1.x + p1.w, p1.y,
      p2.x + p2.w, p2.y,
      p2.x - p2.w, p2.y
    );

    // 4-Lane Dashed Divider Strips (3 dividers at -0.5, 0.0, +0.5 of p.w)
    if (seg.color.lane !== 'transparent') {
      const markerW1 = Math.max(2, p1.w * 0.015);
      const markerW2 = Math.max(2, p2.w * 0.015);

      const dividers = [-0.5, 0.0, 0.5];
      for (const d of dividers) {
        const lx1 = p1.x + (d * p1.w);
        const lx2 = p2.x + (d * p2.w);

        this.drawQuad(ctx, seg.color.lane,
          lx1 - markerW1, p1.y,
          lx1 + markerW1, p1.y,
          lx2 + markerW2, p2.y,
          lx2 - markerW2, p2.y
        );
      }
    }
  }

  drawQuad(ctx, color, x1, y1, x2, y2, x3, y3, x4, y4) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.closePath();
    ctx.fill();
  }

  // Roadside Neon Props (Synthwave Palm Tree or Glowing Cyber Pillar)
  drawRoadsideSprite(ctx, seg) {
    const p = seg.p1.screen;
    const sprite = seg.sprite;
    const spriteScale = p.w * 0.0028;
    if (spriteScale <= 0.01) return;

    const x = p.x + (p.w * sprite.offset);
    const y = p.y;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(spriteScale, spriteScale);

    if (sprite.type === 'neonPalm') {
      // Neon Palm Tree
      ctx.strokeStyle = '#ff007f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(sprite.offset > 0 ? 10 : -10, -50, sprite.offset > 0 ? 15 : -15, -100);
      ctx.stroke();

      // Fronds
      ctx.fillStyle = '#00f0ff';
      const crownX = sprite.offset > 0 ? 15 : -15;
      const crownY = -100;
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
        ctx.beginPath();
        ctx.arc(crownX + Math.cos(angle) * 25, crownY + Math.sin(angle) * 16, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Cyber Glowing Pillar
      ctx.fillStyle = '#ff2a8d';
      ctx.fillRect(-6, -80, 12, 80);
      ctx.fillStyle = '#00ffff';
      ctx.fillRect(-8, -84, 16, 6);
      ctx.fillRect(-8, -4, 16, 6);
    }

    ctx.restore();
  }

  // Draw Synthwave Sky, Mountains, and Glowing Sun
  drawBackground(ctx, player) {
    // 1. Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, this.horizonY);
    skyGrad.addColorStop(0.0, '#070114');
    skyGrad.addColorStop(0.4, '#1b032e');
    skyGrad.addColorStop(0.7, '#430d4b');
    skyGrad.addColorStop(1.0, '#791255');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.width, this.horizonY);

    // Stars / Neon Dust
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    for (let s = 0; s < 45; s++) {
      const sx = (s * 87) % this.width;
      const sy = (s * 41) % (this.horizonY - 80);
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    // 2. Parallax Mountain Silhouettes
    const parallaxOffset = (player.z * 0.0003) % this.width;

    ctx.fillStyle = '#160424';
    ctx.beginPath();
    ctx.moveTo(0, this.horizonY);
    for (let m = 0; m <= this.width + 100; m += 90) {
      const peakHeight = Math.sin((m + parallaxOffset) * 0.02) * 55 + 65;
      ctx.lineTo(m, this.horizonY - peakHeight);
    }
    ctx.lineTo(this.width, this.horizonY);
    ctx.closePath();
    ctx.fill();

    // 3. Iconic Synthwave Sun with Scanline Cuts
    const sunX = this.width / 2;
    const sunY = this.horizonY - 15;
    const sunRadius = 110;

    ctx.save();
    // Sun Glow Halo
    const haloGrad = ctx.createRadialGradient(sunX, sunY, 40, sunX, sunY, sunRadius + 50);
    haloGrad.addColorStop(0, 'rgba(255, 0, 128, 0.55)');
    haloGrad.addColorStop(0.6, 'rgba(255, 230, 0, 0.25)');
    haloGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius + 50, 0, Math.PI * 2);
    ctx.fill();

    // Sun Body Gradient
    const sunGrad = ctx.createLinearGradient(sunX, sunY - sunRadius, sunX, sunY + sunRadius);
    sunGrad.addColorStop(0, '#fffb00');
    sunGrad.addColorStop(0.5, '#ff007f');
    sunGrad.addColorStop(1, '#7a003c');

    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
    ctx.fill();

    // Horizontal Raster Scanline Cuts across bottom half of Sun
    ctx.fillStyle = '#070114';
    let cutY = sunY - 10;
    let cutH = 2.5;
    while (cutY < sunY + sunRadius) {
      ctx.fillRect(sunX - sunRadius, cutY, sunRadius * 2, cutH);
      cutY += cutH + 5.5;
      cutH += 1.4; // progressively wider cuts towards bottom
    }
    ctx.restore();

    // 4. Horizon Cyber Fog Glow
    const fogGrad = ctx.createLinearGradient(0, this.horizonY - 20, 0, this.horizonY + 20);
    fogGrad.addColorStop(0, 'rgba(255, 0, 128, 0)');
    fogGrad.addColorStop(0.5, 'rgba(255, 0, 128, 0.45)');
    fogGrad.addColorStop(1, 'rgba(0, 240, 255, 0.15)');
    ctx.fillStyle = fogGrad;
    ctx.fillRect(0, this.horizonY - 20, this.width, 40);
  }
}
