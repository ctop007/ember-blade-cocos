/** Canvas-drawn placeholder art used until _shared/assets are ready. Web only (uses DOM canvas). */

type Ctx = CanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return [c, c.getContext('2d')!];
}

function radial(g: Ctx, x: number, y: number, r: number, stops: [number, string][]) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    for (const s of stops) gr.addColorStop(s[0], s[1]);
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
}

function ellipse(g: Ctx, x: number, y: number, rx: number, ry: number, fill: string, stroke = '#1a0f14', lw = 5) {
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.fillStyle = fill; g.fill();
    if (lw > 0) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); }
}

// ---------------- characters ----------------
interface PoseP { lean: number; spear: number; crouch: number; arm: number; legs: number; tint?: string; spin?: number; }
const HERO_POSE: { [k: string]: PoseP } = {
    idle: { lean: 0, spear: -0.35, crouch: 0, arm: 0, legs: 0 },
    run: { lean: 0.18, spear: 0.15, crouch: 4, arm: 0.2, legs: 1 },
    attack1: { lean: 0.15, spear: -1.1, crouch: 6, arm: -0.6, legs: 0.5 },
    attack2: { lean: 0.12, spear: 0.6, crouch: 6, arm: 0.5, legs: 0.5 },
    attack3: { lean: 0.3, spear: 0.02, crouch: 10, arm: 0.0, legs: 1.2 },
    charge: { lean: -0.12, spear: 0.05, crouch: 14, arm: -0.2, legs: 0.8 },
    thrust: { lean: 0.42, spear: 0.0, crouch: 14, arm: 0.0, legs: 1.6 },
    jump: { lean: 0.05, spear: -0.8, crouch: -6, arm: -0.4, legs: -0.6 },
    slam: { lean: 0.2, spear: 1.35, crouch: 0, arm: 0.8, legs: -0.4 },
    dodge: { lean: 0.6, spear: 0.4, crouch: 26, arm: 0.3, legs: 1.4 },
    cast: { lean: -0.05, spear: -1.4, crouch: 0, arm: -1.2, legs: 0.3 },
    hurt: { lean: -0.35, spear: -0.1, crouch: 6, arm: 0.6, legs: 0.2 },
    dead: { lean: -1.45, spear: 0.2, crouch: 40, arm: 0.5, legs: 0.2 },
};

/** Hero (Deng): small spear maiden, ember orange + starlight. Canvas 384, feet at 0.92. */
function drawHero(g: Ctx, S: number, pose: string) {
    const p = HERO_POSE[pose] || HERO_POSE.idle;
    const k = S / 384, fx = S * 0.5, fy = S * 0.92;
    g.save(); g.translate(fx, fy); g.scale(k, k);
    // legs
    const lg = p.legs * 18;
    g.lineCap = 'round';
    g.strokeStyle = '#1a0f14'; g.lineWidth = 22;
    g.beginPath(); g.moveTo(-8, -60 + p.crouch); g.lineTo(-14 - lg, -4); g.stroke();
    g.beginPath(); g.moveTo(10, -60 + p.crouch); g.lineTo(14 + lg, -4); g.stroke();
    g.strokeStyle = '#3a2a40'; g.lineWidth = 13;
    g.beginPath(); g.moveTo(-8, -60 + p.crouch); g.lineTo(-14 - lg, -6); g.stroke();
    g.beginPath(); g.moveTo(10, -60 + p.crouch); g.lineTo(14 + lg, -6); g.stroke();
    g.translate(0, -60 + p.crouch);
    g.rotate(p.lean);
    // scarf trail
    g.fillStyle = '#ff6a2a'; g.strokeStyle = '#1a0f14'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(-6, -78); g.quadraticCurveTo(-70, -70 + p.lean * 40, -96, -40 + p.lean * 30); g.lineTo(-80, -30); g.quadraticCurveTo(-50, -56, -4, -62); g.closePath(); g.fill(); g.stroke();
    // body (robe)
    g.beginPath(); g.moveTo(-30, 4); g.lineTo(-22, -70); g.lineTo(22, -70); g.lineTo(34, 4); g.closePath();
    g.fillStyle = '#e8e2f0'; g.fill(); g.stroke();
    g.fillStyle = '#c03a2a'; g.fillRect(-26, -30, 56, 12); g.strokeRect(-26, -30, 56, 12);
    // spear (behind arm)
    g.save(); g.translate(14, -40); g.rotate(p.spear);
    g.strokeStyle = '#1a0f14'; g.lineWidth = 12; g.beginPath(); g.moveTo(-90, 0); g.lineTo(120, 0); g.stroke();
    g.strokeStyle = '#8a5a3a'; g.lineWidth = 6; g.beginPath(); g.moveTo(-88, 0); g.lineTo(118, 0); g.stroke();
    g.fillStyle = '#fff4d0'; g.strokeStyle = '#1a0f14'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(118, -12); g.lineTo(170, 0); g.lineTo(118, 12); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#ff8a3a'; g.beginPath(); g.moveTo(112, -8); g.lineTo(100, -20); g.lineTo(104, 0); g.lineTo(100, 20); g.lineTo(112, 8); g.fill();
    g.restore();
    // arm
    g.save(); g.translate(6, -58); g.rotate(p.arm);
    g.strokeStyle = '#1a0f14'; g.lineWidth = 16; g.beginPath(); g.moveTo(0, 0); g.lineTo(14, 26); g.stroke();
    g.strokeStyle = '#ffe0c8'; g.lineWidth = 9; g.beginPath(); g.moveTo(0, 0); g.lineTo(14, 26); g.stroke();
    g.restore();
    // head
    g.translate(0, -110);
    ellipse(g, -6, 0, 50, 46, '#5a3a6a'); // hair back
    ellipse(g, 4, 6, 40, 38, '#ffe6d2');
    g.fillStyle = '#5a3a6a'; g.beginPath(); g.moveTo(-40, -6); g.quadraticCurveTo(0, -60, 46, -6); g.quadraticCurveTo(20, -24, -8, -10); g.closePath(); g.fill(); g.lineWidth = 5; g.stroke();
    // ponytail
    g.beginPath(); g.moveTo(-40, -10); g.quadraticCurveTo(-90, 0, -80, 50); g.quadraticCurveTo(-60, 20, -38, 12); g.closePath(); g.fill(); g.stroke();
    // eye
    if (pose === 'dead') { g.strokeStyle = '#1a0f14'; g.lineWidth = 4; g.beginPath(); g.moveTo(14, 4); g.lineTo(28, 14); g.moveTo(28, 4); g.lineTo(14, 14); g.stroke(); }
    else if (pose === 'hurt') { g.strokeStyle = '#1a0f14'; g.lineWidth = 5; g.beginPath(); g.moveTo(14, 4); g.lineTo(28, 10); g.lineTo(14, 16); g.stroke(); }
    else { ellipse(g, 22, 10, 7, 10, '#ff9a2a', '#1a0f14', 3); g.fillStyle = '#fff'; g.fillRect(22, 4, 3, 4); }
    // ember hairpin star
    g.fillStyle = '#ffd36a'; star(g, -20, -30, 12, 5); g.fill(); g.strokeStyle = '#1a0f14'; g.lineWidth = 3; g.stroke();
    g.restore();
}

function star(g: Ctx, x: number, y: number, r: number, n: number) {
    g.beginPath();
    for (let i = 0; i < n * 2; i++) {
        const a = -Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? r * 0.45 : r;
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
        if (i) g.lineTo(px, py); else g.moveTo(px, py);
    }
    g.closePath();
}

function poseLean(pose: string): number {
    switch (pose) {
        case 'run': case 'move': case 'walk': return 0.12;
        case 'windup': case 'sweep_windup': case 'summon': return -0.3;
        case 'attack': case 'charge': case 'throw': case 'sweep': return 0.35;
        case 'hurt': return -0.35;
        case 'dead': return -1.4;
        case 'leap': return -0.1;
        case 'slam': return 0.4;
    }
    return 0;
}

/** Ember imp: small dark-red goblin with glowing eyes and claws. */
function drawImp(g: Ctx, S: number, pose: string) {
    const k = S / 256; g.save(); g.translate(S * 0.5, S * 0.92); g.scale(k, k);
    const lean = poseLean(pose);
    g.lineCap = 'round';
    g.strokeStyle = '#1a0f14'; g.lineWidth = 14;
    g.beginPath(); g.moveTo(-14, -30); g.lineTo(-20, -2); g.moveTo(14, -30); g.lineTo(20, -2); g.stroke();
    g.translate(0, -34); g.rotate(lean);
    ellipse(g, 0, -30, 40, 38, '#8a2a24');
    ellipse(g, 0, -20, 26, 20, '#c0503a', '#1a0f14', 0);
    // ears / horns
    g.fillStyle = '#5a1a18'; g.strokeStyle = '#1a0f14'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(-28, -56); g.lineTo(-50, -96); g.lineTo(-10, -66); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(26, -58); g.lineTo(46, -98); g.lineTo(8, -66); g.fill(); g.stroke();
    // eyes
    const ey = pose === 'windup' ? '#fff27a' : '#ffb13a';
    ellipse(g, 10, -40, 9, 7, ey, '#1a0f14', 3); ellipse(g, 30, -38, 7, 6, ey, '#1a0f14', 3);
    // claw arm
    const arm = pose === 'windup' ? -1.4 : pose === 'attack' ? 0.6 : 0.1;
    g.save(); g.translate(22, -24); g.rotate(arm);
    g.strokeStyle = '#1a0f14'; g.lineWidth = 12; g.beginPath(); g.moveTo(0, 0); g.lineTo(36, 0); g.stroke();
    g.strokeStyle = '#ffe0a0'; g.lineWidth = 4; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(36, i * 6); g.lineTo(54, i * 10); g.stroke(); }
    g.restore();
    g.restore();
}

/** Lantern ghoul: floating paper lantern with a flame mouth. */
function drawLantern(g: Ctx, S: number, pose: string) {
    const k = S / 256; g.save(); g.translate(S * 0.5, S * 0.92); g.scale(k, k);
    g.rotate(poseLean(pose) * 0.6);
    radial(g, 0, -100, 90, [[0, 'rgba(255,190,90,0.55)'], [1, 'rgba(255,120,40,0)']]);
    g.strokeStyle = '#1a0f14'; g.lineWidth = 5;
    g.fillStyle = '#3a2418'; g.fillRect(-26, -170, 52, 14); g.strokeRect(-26, -170, 52, 14);
    g.fillRect(-22, -42, 44, 12); g.strokeRect(-22, -42, 44, 12);
    ellipse(g, 0, -98, 52, 60, pose === 'windup' ? '#ffcf6a' : '#f0a040');
    g.strokeStyle = 'rgba(90,40,20,0.7)'; g.lineWidth = 3;
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.ellipse(0, -98, Math.abs(i) * 12 + 2, 58, 0, 0, Math.PI * 2); g.stroke(); }
    ellipse(g, -16, -110, 8, 10, '#1a0f14', '#1a0f14', 0); ellipse(g, 18, -110, 8, 10, '#1a0f14', '#1a0f14', 0);
    g.fillStyle = '#1a0f14'; g.beginPath(); g.ellipse(2, -80, 18, pose === 'throw' ? 16 : 8, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ff5a1a'; g.beginPath(); g.ellipse(2, -78, 10, pose === 'throw' ? 10 : 4, 0, 0, Math.PI * 2); g.fill();
    // tassel
    g.strokeStyle = '#c03a2a'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, -30); g.lineTo(0, -6); g.stroke();
    g.restore();
}

/** Bark brute: big armored tree-man with moss. */
function drawBrute(g: Ctx, S: number, pose: string) {
    const k = S / 320; g.save(); g.translate(S * 0.5, S * 0.92); g.scale(k, k);
    g.lineCap = 'round'; g.strokeStyle = '#1a0f14'; g.lineWidth = 26;
    g.beginPath(); g.moveTo(-30, -50); g.lineTo(-38, -4); g.moveTo(30, -50); g.lineTo(38, -4); g.stroke();
    g.translate(0, -60); g.rotate(poseLean(pose) * 0.7);
    g.fillStyle = '#5a3a24'; g.strokeStyle = '#1a0f14'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(-70, 10); g.lineTo(-60, -150); g.quadraticCurveTo(0, -190, 64, -150); g.lineTo(74, 10); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = '#3a2416'; g.lineWidth = 5;
    for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-50 + i * 24, -140); g.lineTo(-56 + i * 26, 0); g.stroke(); }
    g.fillStyle = '#4a7a3a'; g.beginPath(); g.ellipse(-10, -160, 56, 20, 0, 0, Math.PI * 2); g.fill();
    const glow = pose === 'windup' || pose === 'charge' ? '#ff4a2a' : '#ffb13a';
    ellipse(g, 20, -116, 12, 9, glow, '#1a0f14', 3); ellipse(g, 46, -112, 10, 8, glow, '#1a0f14', 3);
    // shoulder/arm
    g.save(); g.translate(50, -90); g.rotate(pose === 'charge' ? -0.2 : 0.5);
    g.strokeStyle = '#1a0f14'; g.lineWidth = 34; g.beginPath(); g.moveTo(0, 0); g.lineTo(40, 50); g.stroke();
    g.strokeStyle = '#6a4a2e'; g.lineWidth = 22; g.beginPath(); g.moveTo(0, 0); g.lineTo(40, 50); g.stroke();
    g.restore();
    g.restore();
}

/** Ash knight boss: armored knight, grey-ash with ember cracks and a great blade. */
function drawBoss(g: Ctx, S: number, pose: string) {
    const k = S / 512; g.save(); g.translate(S * 0.5, S * 0.92); g.scale(k, k);
    g.lineCap = 'round'; g.strokeStyle = '#1a0f14'; g.lineWidth = 34;
    g.beginPath(); g.moveTo(-40, -90); g.lineTo(-56, -6); g.moveTo(40, -90); g.lineTo(56, -6); g.stroke();
    g.strokeStyle = '#4a4650'; g.lineWidth = 20;
    g.beginPath(); g.moveTo(-40, -90); g.lineTo(-56, -10); g.moveTo(40, -90); g.lineTo(56, -10); g.stroke();
    g.translate(0, -100); g.rotate(poseLean(pose) * 0.5);
    // cape
    g.fillStyle = '#5a1a1a'; g.strokeStyle = '#1a0f14'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(-50, -200); g.quadraticCurveTo(-150, -80, -130, 40); g.lineTo(-30, 10); g.closePath(); g.fill(); g.stroke();
    // torso
    g.fillStyle = '#6a6670';
    g.beginPath(); g.moveTo(-80, 10); g.lineTo(-90, -190); g.quadraticCurveTo(0, -240, 90, -190); g.lineTo(80, 10); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = '#ff7a2a'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(-40, -170); g.lineTo(-10, -120); g.lineTo(-30, -70); g.moveTo(30, -150); g.lineTo(10, -100); g.lineTo(40, -40); g.stroke();
    // helm
    g.strokeStyle = '#1a0f14'; g.lineWidth = 6;
    ellipse(g, 6, -250, 56, 52, '#7a7680');
    g.fillStyle = '#1a0f14'; g.fillRect(-20, -262, 70, 14);
    g.fillStyle = '#ff5a2a'; g.fillRect(4, -258, 40, 6);
    g.fillStyle = '#c03a2a'; g.beginPath(); g.moveTo(-10, -300); g.quadraticCurveTo(-80, -330, -110, -270); g.quadraticCurveTo(-60, -300, -10, -282); g.fill(); g.stroke();
    // blade arm
    const ang = pose === 'sweep_windup' ? -2.2 : pose === 'sweep' ? 0.9 : pose === 'leap' ? -2.6 : pose === 'slam' ? 1.3 : pose === 'summon' ? -1.6 : -0.6;
    g.save(); g.translate(70, -160); g.rotate(ang);
    g.strokeStyle = '#1a0f14'; g.lineWidth = 16; g.beginPath(); g.moveTo(0, 0); g.lineTo(60, 0); g.stroke();
    g.fillStyle = '#c8c4d0'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(50, -16); g.lineTo(250, -10); g.lineTo(280, 0); g.lineTo(250, 10); g.lineTo(50, 16); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = '#ff7a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(70, 0); g.lineTo(240, 0); g.stroke();
    g.fillStyle = '#3a2a20'; g.fillRect(36, -26, 14, 52);
    g.restore();
    g.restore();
}

function shadow(g: Ctx, w: number, h: number) {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.save(); g.scale(1, h / w); g.fillStyle = gr; g.beginPath(); g.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2); g.fill(); g.restore();
}

export function drawCharPlaceholder(key: string, w: number, h: number): HTMLCanvasElement {
    const [c, g] = makeCanvas(w, h);
    const parts = key.split('/');            // chars/hero/idle
    const who = parts[1], pose = parts[2];
    if (pose === 'shadow') { shadow(g, w, h); return c; }
    if (who === 'hero') drawHero(g, w, pose);
    else if (who === 'imp') drawImp(g, w, pose);
    else if (who === 'lantern') drawLantern(g, w, pose);
    else if (who === 'brute') drawBrute(g, w, pose);
    else if (who === 'boss') drawBoss(g, w, pose);
    return c;
}

// placeholder for FX / UI / BG continue in PlaceholdersFx.ts
