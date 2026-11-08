#!/usr/bin/env node
// Copy assets with status=ready from _shared/assets (per manifest.json) into assets/resources/,
// and copy the shared config. Writes assets/resources/config/available.json listing what exists.
// Only mp3 is copied for audio (Web build; avoids duplicate same-name resources in Cocos).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const proj = path.resolve(here, '..');
const shared = path.resolve(proj, '../_shared');
const src = path.join(shared, 'assets');
const dst = path.join(proj, 'assets/resources');
const m = JSON.parse(fs.readFileSync(path.join(src, 'manifest.json'), 'utf8'));

const avail = { images: [], audio: [], manifestUpdated: m.updated, synced: new Date().toISOString() };
let copied = 0, skipped = 0;
function copy(rel) {
    const a = path.join(src, rel), b = path.join(dst, rel);
    if (!fs.existsSync(a)) return false;
    fs.mkdirSync(path.dirname(b), { recursive: true });
    const sa = fs.statSync(a);
    if (fs.existsSync(b) && fs.statSync(b).size === sa.size && fs.statSync(b).mtimeMs >= sa.mtimeMs) return true;
    fs.copyFileSync(a, b); copied++;
    return true;
}
for (const it of m.assets) {
    if (it.status !== 'ready') { skipped++; continue; }
    if (it.type === 'image') {
        if (copy(it.path)) avail.images.push(it.path.replace(/\.png$/, ''));
    } else if (it.type === 'audio') {
        const mp3 = (it.files || []).find(f => f.endsWith('.mp3')) || it.path + '.mp3';
        if (copy(mp3)) avail.audio.push(it.path);
    }
}
const cfgSrc = path.join(shared, 'config/game.json');
if (fs.existsSync(cfgSrc)) fs.copyFileSync(cfgSrc, path.join(dst, 'config/game.json'));
fs.copyFileSync(path.join(src, 'manifest.json'), path.join(dst, 'config/manifest.json'));
fs.writeFileSync(path.join(dst, 'config/available.json'), JSON.stringify(avail, null, 1));
console.log(`ready images=${avail.images.length} audio=${avail.audio.length} copied=${copied} pending=${skipped}`);
