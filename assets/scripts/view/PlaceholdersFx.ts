/** Placeholder FX (white, tintable), UI and BG art drawn on canvas. */
import { makeCanvas, drawCharPlaceholder } from './Placeholders';

type Ctx = CanvasRenderingContext2D;
const W = (a: number) => `rgba(255,255,255,${a})`;

function glow(g: Ctx, x: number, y: number, r: number, a = 1) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, W(a)); gr.addColorStop(0.35, W(a * 0.55)); gr.addColorStop(1, W(0));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
}

function ring(g: Ctx, w: number, h: number, thick: number, soft: boolean) {
    g.save(); g.translate(w / 2, h / 2); g.scale(1, h / w);
    const R = w / 2 - 4;
    const gr = g.createRadialGradient(0, 0, R - thick, 0, 0, R);
    gr.addColorStop(0, W(0)); gr.addColorStop(soft ? 0.6 : 0.8, W(1)); gr.addColorStop(1, W(0));
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
    g.restore();
}

function drawFx(name: string, w: number, h: number, g: Ctx) {
    switch (name) {
        case 'crescent_arc': {
            // thick crescent: outer arc minus offset inner arc, with soft edge
            g.save(); g.translate(w / 2, h / 2);
            const R = w * 0.46;
            for (let i = 0; i < 6; i++) {
                g.globalAlpha = 0.18 + i * 0.14;
                g.fillStyle = '#fff';
                g.beginPath();
                g.arc(0, 0, R - i * 3, -Math.PI * 0.95, Math.PI * 0.15);
                g.arc(R * 0.18, -R * 0.06, R * 0.86 - i * 2, Math.PI * 0.15, -Math.PI * 0.95, true);
                g.closePath(); g.fill();
            }
            g.restore(); break;
        }
        case 'fire_ring': ring(g, w, h, w * 0.12, true); break;
        case 'shock_ring': ring(g, w, h, w * 0.06, false); break;
        case 'warn_circle': {
            g.save(); g.translate(w / 2, h / 2); g.scale(1, h / w);
            const R = w / 2 - 6;
            g.fillStyle = W(0.28); g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
            g.lineWidth = 10; g.strokeStyle = W(1); g.stroke();
            g.lineWidth = 4; g.strokeStyle = W(0.6); g.beginPath(); g.arc(0, 0, R * 0.6, 0, Math.PI * 2); g.stroke();
            g.restore(); break;
        }
        case 'warn_bar': {
            const gr = g.createLinearGradient(0, 0, w, 0);
            gr.addColorStop(0, W(0.55)); gr.addColorStop(1, W(0.15));
            g.fillStyle = gr; g.fillRect(0, 6, w, h - 12);
            g.fillStyle = W(1); g.fillRect(0, 4, w, 4); g.fillRect(0, h - 8, w, 4);
            g.fillStyle = W(0.7);
            for (let x = 30; x < w - 20; x += 60) { g.beginPath(); g.moveTo(x, 16); g.lineTo(x + 22, h / 2); g.lineTo(x, h - 16); g.lineTo(x + 10, h / 2); g.fill(); }
            break;
        }
        case 'warn_fan': {
            // anchor (0,0.5): apex at left-center, 120deg fan to the right
            g.save(); g.translate(0, h / 2);
            const R = w - 6, a = Math.PI / 3;
            g.fillStyle = W(0.3); g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, -a, a); g.closePath(); g.fill();
            g.lineWidth = 8; g.strokeStyle = W(1); g.stroke();
            g.restore(); break;
        }
        case 'light_pillar': {
            const gr = g.createLinearGradient(0, 0, w, 0);
            gr.addColorStop(0, W(0)); gr.addColorStop(0.3, W(0.6)); gr.addColorStop(0.5, W(1)); gr.addColorStop(0.7, W(0.6)); gr.addColorStop(1, W(0));
            g.fillStyle = gr; g.fillRect(0, 0, w, h);
            const gv = g.createLinearGradient(0, 0, 0, h);
            gv.addColorStop(0, 'rgba(0,0,0,1)'); gv.addColorStop(0.25, 'rgba(0,0,0,0)');
            g.globalCompositeOperation = 'destination-out'; g.fillStyle = gv; g.fillRect(0, 0, w, h);
            g.globalCompositeOperation = 'source-over';
            break;
        }
        case 'comet_head': glow(g, w * 0.7, h / 2, h * 0.5); glow(g, w * 0.7, h / 2, h * 0.22, 1); break;
        case 'comet_trail': {
            const gr = g.createLinearGradient(0, 0, w, 0);
            gr.addColorStop(0, W(0)); gr.addColorStop(1, W(1));
            g.fillStyle = gr; g.beginPath(); g.moveTo(0, h / 2); g.quadraticCurveTo(w * 0.5, h * 0.1, w, h * 0.2); g.lineTo(w, h * 0.8); g.quadraticCurveTo(w * 0.5, h * 0.9, 0, h / 2); g.fill();
            break;
        }
        case 'ember': case 'glow': glow(g, w / 2, h / 2, w / 2); break;
        case 'spark': {
            g.save(); g.translate(w / 2, h / 2);
            const gr = g.createLinearGradient(-w / 2, 0, w / 2, 0);
            gr.addColorStop(0, W(0)); gr.addColorStop(0.5, W(1)); gr.addColorStop(1, W(0));
            g.fillStyle = gr; g.fillRect(-w / 2, -h * 0.08, w, h * 0.16); g.restore(); break;
        }
        case 'hit_spark': case 'flash_star': {
            g.save(); g.translate(w / 2, h / 2);
            glow(g, 0, 0, w * 0.22);
            g.fillStyle = W(1);
            const n = name === 'hit_spark' ? 6 : 4;
            for (let i = 0; i < n; i++) {
                g.save(); g.rotate(i * Math.PI * 2 / n + 0.3);
                g.beginPath(); g.moveTo(0, -w * 0.04); g.lineTo(w * (i % 2 ? 0.34 : 0.47), 0); g.lineTo(0, w * 0.04); g.fill();
                g.restore();
            }
            g.restore(); break;
        }
        case 'slash_trail': {
            g.save(); g.translate(w / 2, h);
            for (let i = 0; i < 5; i++) {
                g.globalAlpha = 0.2 + i * 0.18; g.fillStyle = '#fff';
                g.beginPath(); g.ellipse(0, 0, w * 0.48 - i * 4, h * 0.9 - i * 3, 0, Math.PI, Math.PI * 2);
                g.ellipse(0, h * 0.12, w * 0.4, h * 0.7, 0, Math.PI * 2, Math.PI, true); g.fill();
            }
            g.restore(); break;
        }
        case 'thrust_beam': {
            const gr = g.createLinearGradient(0, 0, w, 0);
            gr.addColorStop(0, W(0)); gr.addColorStop(0.7, W(0.9)); gr.addColorStop(1, W(1));
            g.fillStyle = gr; g.beginPath(); g.moveTo(0, h * 0.42); g.lineTo(w * 0.92, h * 0.2); g.lineTo(w, h / 2); g.lineTo(w * 0.92, h * 0.8); g.lineTo(0, h * 0.58); g.fill();
            break;
        }
        case 'afterimage': {
            const c = drawCharPlaceholder('chars/hero/dodge', w, h);
            g.drawImage(c, 0, 0);
            g.globalCompositeOperation = 'source-in'; g.fillStyle = W(0.9); g.fillRect(0, 0, w, h);
            break;
        }
        case 'rock_debris': {
            g.fillStyle = W(1); g.beginPath(); g.moveTo(w * 0.2, h * 0.3); g.lineTo(w * 0.6, h * 0.1); g.lineTo(w * 0.9, h * 0.5);
            g.lineTo(w * 0.6, h * 0.9); g.lineTo(w * 0.15, h * 0.75); g.closePath(); g.fill(); break;
        }
        case 'smoke': {
            for (let i = 0; i < 5; i++) glow(g, w * (0.3 + 0.1 * (i % 3)), h * (0.35 + 0.1 * (i % 2)), w * 0.3, 0.45);
            break;
        }
        case 'fireball': glow(g, w / 2, h / 2, w / 2); glow(g, w / 2, h / 2, w * 0.25, 1); break;
        case 'meteor': {
            g.save(); g.translate(w / 2, h / 2); g.rotate(Math.PI / 4);
            const gr = g.createLinearGradient(-w / 2, 0, w / 2, 0);
            gr.addColorStop(0, W(0)); gr.addColorStop(1, W(0.9));
            g.fillStyle = gr; g.beginPath(); g.moveTo(-w / 2, 0); g.lineTo(w * 0.3, -h * 0.16); g.lineTo(w * 0.3, h * 0.16); g.fill();
            g.restore(); glow(g, w * 0.72, h * 0.72, w * 0.22); break;
        }
        case 'ult_portrait': {
            // big hero bust, full color (not tinted)
            const c = drawCharPlaceholder('chars/hero/cast', w, h);
            g.drawImage(c, -w * 0.25, -h * 0.05, w * 1.5, h * 1.5);
            break;
        }
        case 'ult_banner': {
            const gr = g.createLinearGradient(0, 0, w, 0);
            gr.addColorStop(0, W(0)); gr.addColorStop(0.15, W(0.95)); gr.addColorStop(0.85, W(0.95)); gr.addColorStop(1, W(0));
            g.fillStyle = gr; g.beginPath(); g.moveTo(0, h * 0.2); g.lineTo(w, h * 0.1); g.lineTo(w, h * 0.9); g.lineTo(0, h * 0.8); g.fill();
            break;
        }
        default: glow(g, w / 2, h / 2, Math.min(w, h) / 2);
    }
}

function rr(g: Ctx, x: number, y: number, w: number, h: number, r: number) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

function roundBtn(g: Ctx, w: number, h: number, c1: string, c2: string, rim = '#ffcf7a') {
    const R = Math.min(w, h) / 2 - 6;
    const gr = g.createRadialGradient(w / 2, h * 0.38, R * 0.1, w / 2, h / 2, R);
    gr.addColorStop(0, c1); gr.addColorStop(1, c2);
    g.fillStyle = gr; g.beginPath(); g.arc(w / 2, h / 2, R, 0, Math.PI * 2); g.fill();
    g.lineWidth = 6; g.strokeStyle = '#1a0f14'; g.stroke();
    g.lineWidth = 3; g.strokeStyle = rim; g.beginPath(); g.arc(w / 2, h / 2, R - 5, 0, Math.PI * 2); g.stroke();
}

function icon(g: Ctx, name: string, w: number, h: number) {
    const cx = w / 2, cy = h / 2, s = w / 128;
    g.save(); g.translate(cx, cy); g.scale(s, s);
    g.lineCap = 'round'; g.lineJoin = 'round';
    switch (name) {
        case 'btn_attack': // spear tip
            g.rotate(-Math.PI / 4); g.fillStyle = '#fff4d0'; g.strokeStyle = '#1a0f14'; g.lineWidth = 6;
            g.beginPath(); g.moveTo(-40, 0); g.lineTo(18, -7); g.lineTo(48, 0); g.lineTo(18, 7); g.closePath(); g.fill(); g.stroke(); break;
        case 'btn_jump':
            g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -36); g.lineTo(30, 4); g.lineTo(12, 4); g.lineTo(12, 32); g.lineTo(-12, 32); g.lineTo(-12, 4); g.lineTo(-30, 4); g.closePath(); g.fill(); break;
        case 'btn_dodge':
            g.strokeStyle = '#fff'; g.lineWidth = 10; g.beginPath(); g.arc(0, 0, 26, -Math.PI * 0.2, Math.PI * 1.3); g.stroke();
            g.fillStyle = '#fff'; g.beginPath(); g.moveTo(30, -26); g.lineTo(34, 4); g.lineTo(10, -8); g.fill(); break;
        case 'icon_skill1': // fire crescent
            g.fillStyle = '#ff6a2a'; g.beginPath(); g.arc(0, 0, 44, -2.6, 1.2); g.arc(10, -4, 34, 1.2, -2.6, true); g.fill();
            g.fillStyle = '#ffd36a'; g.beginPath(); g.arc(0, 0, 36, -2.4, 0.9); g.arc(8, -3, 30, 0.9, -2.4, true); g.fill(); break;
        case 'icon_skill2': // light pillar
            g.fillStyle = '#8fd8ff'; g.fillRect(-12, -50, 24, 80); g.fillStyle = '#fff'; g.fillRect(-5, -50, 10, 80);
            g.strokeStyle = '#bfe8ff'; g.lineWidth = 6; g.beginPath(); g.ellipse(0, 32, 40, 12, 0, 0, Math.PI * 2); g.stroke(); break;
        case 'icon_skill3': // comet spear
            g.rotate(-Math.PI / 5);
            g.fillStyle = '#ff8a2a'; g.beginPath(); g.moveTo(-50, -14); g.lineTo(30, -6); g.lineTo(30, 6); g.lineTo(-50, 14); g.fill();
            g.fillStyle = '#fff4d0'; g.beginPath(); g.moveTo(24, -10); g.lineTo(54, 0); g.lineTo(24, 10); g.fill(); break;
        case 'icon_ult': // meteor star
            g.fillStyle = '#ffd36a';
            g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 18 : 44; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill();
            g.strokeStyle = '#1a0f14'; g.lineWidth = 4; g.stroke(); break;
        case 'btn_pause':
            g.fillStyle = '#fff'; rr(g, -24, -28, 16, 56, 4); g.fill(); rr(g, 8, -28, 16, 56, 4); g.fill(); break;
    }
    g.restore();
}

function drawUi(name: string, w: number, h: number, g: Ctx) {
    switch (name) {
        case 'joystick_base': {
            const R = w / 2 - 6;
            g.fillStyle = 'rgba(20,12,24,0.45)'; g.beginPath(); g.arc(w / 2, h / 2, R, 0, Math.PI * 2); g.fill();
            g.lineWidth = 6; g.strokeStyle = 'rgba(255,200,140,0.55)'; g.stroke();
            g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.arc(w / 2, h / 2, R * 0.65, 0, Math.PI * 2); g.stroke();
            break;
        }
        case 'joystick_knob': roundBtn(g, w, h, '#fff1dc', '#d08a4a'); break;
        case 'btn_attack': roundBtn(g, w, h, '#ff9a4a', '#8a2a1a'); icon(g, name, w, h); break;
        case 'btn_jump': roundBtn(g, w, h, '#6a7aa8', '#2a2440'); icon(g, name, w, h); break;
        case 'btn_dodge': roundBtn(g, w, h, '#6aa88a', '#1a3a30'); icon(g, name, w, h); break;
        case 'btn_frame': case 'btn_ult_frame': {
            const R = w / 2 - 4;
            g.lineWidth = 8; g.strokeStyle = '#1a0f14'; g.beginPath(); g.arc(w / 2, h / 2, R, 0, Math.PI * 2); g.stroke();
            g.lineWidth = 5; g.strokeStyle = name === 'btn_ult_frame' ? '#ffd36a' : '#e0a060'; g.beginPath(); g.arc(w / 2, h / 2, R - 5, 0, Math.PI * 2); g.stroke();
            break;
        }
        case 'icon_skill1': case 'icon_skill2': case 'icon_skill3': case 'icon_ult': {
            const bg = name === 'icon_skill2' ? ['#3a5a8a', '#141a30'] : name === 'icon_ult' ? ['#8a5a1a', '#2a140a'] : ['#8a3a1a', '#2a0f0a'];
            const gr = g.createRadialGradient(w / 2, h * 0.4, 4, w / 2, h / 2, w / 2);
            gr.addColorStop(0, bg[0]); gr.addColorStop(1, bg[1]);
            g.fillStyle = gr; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2); g.fill();
            icon(g, name, w, h); break;
        }
        case 'btn_pause': roundBtn(g, w, h, '#5a4a6a', '#1a1424', '#c0a0ff'); icon(g, name, w * 0.7, h * 0.7); break;
        case 'avatar': {
            roundBtn(g, w, h, '#5a3a6a', '#1a1024');
            const c = drawCharPlaceholder('chars/hero/idle', 384, 384);
            g.save(); g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 10, 0, Math.PI * 2); g.clip();
            g.drawImage(c, 96, 40, 200, 200, 0, 0, w, h); g.restore(); break;
        }
        case 'bar_frame': rr(g, 3, 3, w - 6, h - 6, h / 2 - 3); g.fillStyle = 'rgba(15,8,18,0.75)'; g.fill(); g.lineWidth = 5; g.strokeStyle = '#1a0f14'; g.stroke(); g.lineWidth = 2; g.strokeStyle = 'rgba(255,220,180,0.5)'; g.stroke(); break;
        case 'bar_fill': { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#fff'); gr.addColorStop(0.5, '#ddd'); gr.addColorStop(1, '#aaa'); rr(g, 8, 10, w - 16, h - 20, (h - 20) / 2); g.fillStyle = gr; g.fill(); break; }
        case 'card_common': case 'card_rare': case 'card_epic': case 'card_back': {
            const col = name === 'card_common' ? ['#5a6a80', '#1e2430', '#a8b8d0'] : name === 'card_rare' ? ['#3a5ab8', '#141c40', '#7ab0ff']
                : name === 'card_epic' ? ['#a8502a', '#2a100c', '#ffcf5a'] : ['#4a2a5a', '#160c1e', '#d08aff'];
            const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, col[0]); gr.addColorStop(1, col[1]);
            rr(g, 6, 6, w - 12, h - 12, 22); g.fillStyle = gr; g.fill();
            g.lineWidth = 8; g.strokeStyle = '#1a0f14'; g.stroke();
            g.lineWidth = 4; g.strokeStyle = col[2]; rr(g, 16, 16, w - 32, h - 32, 16); g.stroke();
            if (name === 'card_back') { g.fillStyle = col[2]; g.globalAlpha = 0.6; g.font = 'bold 120px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('烬', w / 2, h / 2); g.globalAlpha = 1; }
            else { g.fillStyle = 'rgba(0,0,0,0.25)'; rr(g, 30, h * 0.52, w - 60, h * 0.36, 12); g.fill(); }
            break;
        }
        case 'logo': {
            g.textAlign = 'center'; g.textBaseline = 'middle';
            g.font = 'bold 220px "PingFang SC", "Heiti SC", serif';
            g.lineWidth = 22; g.strokeStyle = '#1a0f14'; g.strokeText('烬刃', w / 2, h * 0.45);
            const gr = g.createLinearGradient(0, h * 0.15, 0, h * 0.75); gr.addColorStop(0, '#fff2b0'); gr.addColorStop(0.5, '#ff9a3a'); gr.addColorStop(1, '#c0301a');
            g.fillStyle = gr; g.fillText('烬刃', w / 2, h * 0.45);
            g.font = 'bold 48px "PingFang SC", sans-serif'; g.fillStyle = '#ffe0b0'; g.lineWidth = 8; g.strokeText('EMBER  BLADE', w / 2, h * 0.86); g.fillText('EMBER  BLADE', w / 2, h * 0.86);
            break;
        }
        case 'home_bg': drawBg('far', w, h, g); break;
        case 'btn_primary': {
            const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffb04a'); gr.addColorStop(1, '#b0401a');
            rr(g, 6, 6, w - 12, h - 12, h / 2 - 6); g.fillStyle = gr; g.fill(); g.lineWidth = 7; g.strokeStyle = '#1a0f14'; g.stroke();
            g.lineWidth = 3; g.strokeStyle = '#ffe0a0'; rr(g, 14, 14, w - 28, h - 28, h / 2 - 14); g.stroke(); break;
        }
        case 'panel': {
            const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3a2440'); gr.addColorStop(1, '#160c1a');
            rr(g, 6, 6, w - 12, h - 12, 26); g.fillStyle = gr; g.fill(); g.lineWidth = 8; g.strokeStyle = '#1a0f14'; g.stroke();
            g.lineWidth = 3; g.strokeStyle = '#e0a060'; rr(g, 18, 18, w - 36, h - 36, 18); g.stroke(); break;
        }
        case 'boss_title': {
            const gr = g.createLinearGradient(0, 0, w, 0);
            gr.addColorStop(0, 'rgba(60,0,0,0)'); gr.addColorStop(0.2, 'rgba(60,8,8,0.9)'); gr.addColorStop(0.8, 'rgba(60,8,8,0.9)'); gr.addColorStop(1, 'rgba(60,0,0,0)');
            g.fillStyle = gr; g.fillRect(0, h * 0.2, w, h * 0.6);
            g.fillStyle = '#ff7a3a'; g.fillRect(0, h * 0.2, w, 4); g.fillRect(0, h * 0.8 - 4, w, 4);
            break;
        }
        default: roundBtn(g, w, h, '#888', '#333');
    }
}

function drawBg(name: string, w: number, h: number, g: Ctx) {
    if (name === 'far') {
        const gr = g.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, '#0c0a1e'); gr.addColorStop(0.55, '#24163a'); gr.addColorStop(1, '#3a1e2a');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,240,220,${0.2 + (i * 37 % 10) / 14})`; g.fillRect((i * 211) % w, (i * 97) % (h * 0.5), 2, 2); }
        const mg = g.createRadialGradient(w * 0.3, h * 0.2, 10, w * 0.3, h * 0.2, 120);
        mg.addColorStop(0, '#fff2d0'); mg.addColorStop(0.35, 'rgba(255,220,170,0.9)'); mg.addColorStop(0.4, 'rgba(255,200,150,0.25)'); mg.addColorStop(1, 'rgba(255,180,120,0)');
        g.fillStyle = mg; g.beginPath(); g.arc(w * 0.3, h * 0.2, 120, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#1a1028';
        g.beginPath(); g.moveTo(0, h * 0.62);
        for (let x = 0; x <= w; x += 80) g.lineTo(x, h * 0.48 + Math.sin(x * 0.006) * 50 + Math.sin(x * 0.017) * 20);
        g.lineTo(w, h); g.lineTo(0, h); g.fill();
    } else if (name === 'mid') {
        // trunks rise from the ground line (h*0.5 = design y 360) up into a sparse canopy; top stays transparent
        for (let i = 0; i < 9; i++) {
            const x = (i * 241 + 60) % w, tw = h * (0.06 + (i * 31 % 40) / 1000);
            const top = h * (0.08 + (i * 13 % 7) * 0.02);
            g.fillStyle = i % 2 ? '#2a1a30' : '#33203a';
            g.fillRect(x - tw / 2, top, tw, h * 0.5 - top + 4);
            g.fillStyle = 'rgba(30,18,38,0.92)'; g.beginPath(); g.ellipse(x, top, tw * 2.4, h * 0.07, 0, 0, Math.PI * 2); g.fill();
            const gx = x + tw, gy = h * 0.47, gr0 = h * 0.05;
            const gg = g.createRadialGradient(gx, gy, 1, gx, gy, gr0); gg.addColorStop(0, 'rgba(255,170,80,0.9)'); gg.addColorStop(1, 'rgba(255,120,40,0)');
            g.fillStyle = gg; g.beginPath(); g.arc(gx, gy, gr0, 0, Math.PI * 2); g.fill();
        }
    } else if (name === 'ground') {
        const gr = g.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, '#2a1a1a'); gr.addColorStop(0.3, '#4a2e22'); gr.addColorStop(1, '#2a1812');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 160; i++) {
            g.fillStyle = i % 3 ? 'rgba(90,60,40,0.5)' : 'rgba(255,140,60,0.22)';
            g.beginPath(); g.ellipse((i * 173) % w, 40 + (i * 61) % (h - 50), 6 + i % 12, 2 + i % 4, 0, 0, Math.PI * 2); g.fill();
        }
        g.fillStyle = '#1a1014'; g.fillRect(0, 0, w, 10);
    } else {
        for (let i = 0; i < 60; i++) {
            const x = (i * 89) % w, hh = 60 + (i * 47 % 120);
            g.fillStyle = i % 2 ? '#0e0a10' : '#181018';
            g.beginPath(); g.moveTo(x - 20, h); g.quadraticCurveTo(x - 4, h - hh, x + 6, h - hh - 10); g.quadraticCurveTo(x + 6, h - hh * 0.5, x + 20, h); g.fill();
        }
    }
}

/** Entry: draw placeholder for manifest key (without .png). */
export function drawPlaceholder(key: string, w: number, h: number): HTMLCanvasElement {
    if (key.indexOf('chars/') === 0) return drawCharPlaceholder(key, w, h);
    const [c, g] = makeCanvas(w, h);
    const name = key.split('/').pop()!;
    if (key.indexOf('fx/') === 0) drawFx(name, w, h, g);
    else if (key.indexOf('ui/') === 0) drawUi(name, w, h, g);
    else if (key.indexOf('bg/') === 0) drawBg(name, w, h, g);
    return c;
}
