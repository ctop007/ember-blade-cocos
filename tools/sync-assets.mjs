#!/usr/bin/env node
// Copy assets with status=ready from _shared/assets (per manifest.json) into assets/resources/,
// and copy the shared config. Writes assets/resources/config/available.json listing what exists.
// Audio: mp3 -> resources/<path>.mp3, ogg -> resources/ogg/<path>.ogg (separate dirs: Cocos can't hold two same-name assets).
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
function copy(rel, to = rel) {
    const a = path.join(src, rel), b = path.join(dst, to);
    if (!fs.existsSync(a)) return false;
    fs.mkdirSync(path.dirname(b), { recursive: true });
    const sa = fs.statSync(a);
    if (fs.existsSync(b) && fs.statSync(b).size === sa.size && fs.statSync(b).mtimeMs >= sa.mtimeMs) return true;
    fs.copyFileSync(a, b); copied++;
    return true;
}
// No character voice lines in the game (lead requirement): any voice asset is excluded even if the manifest marks it ready.
const VOICE = /(^|\/)[^/]*voice[^/]*$/i;
for (const it of m.assets) {
    if (it.status !== 'ready') { skipped++; continue; }
    if (it.type === 'audio' && VOICE.test(it.path)) { skipped++; continue; }
    if (it.type === 'image') {
        if (copy(it.path)) avail.images.push(it.path.replace(/\.png$/, ''));
    } else if (it.type === 'audio') {
        const mp3 = (it.files || []).find(f => f.endsWith('.mp3')) || it.path + '.mp3';
        const ogg = (it.files || []).find(f => f.endsWith('.ogg')) || it.path + '.ogg';
        const hasMp3 = copy(mp3), hasOgg = copy(ogg, 'ogg/' + ogg);
        if (hasMp3 || hasOgg) avail.audio.push(it.path);
        if (hasOgg) (avail.ogg = avail.ogg || []).push(it.path);
        if (hasMp3) (avail.mp3 = avail.mp3 || []).push(it.path);
    }
}
const cfgSrc = path.join(shared, 'config/game.json');
if (fs.existsSync(cfgSrc)) {
    const cfg = JSON.parse(fs.readFileSync(cfgSrc, 'utf8')); // shared config as-is (no local overrides)
    fs.writeFileSync(path.join(dst, 'config/game.json'), JSON.stringify(cfg, null, 1));
}
// local manifest copy without voice entries, so no voice reference reaches Web/APK builds
fs.writeFileSync(path.join(dst, 'config/manifest.json'), JSON.stringify({ ...m, assets: m.assets.filter(it => !(it.type === 'audio' && VOICE.test(it.path))) }, null, 1));
fs.writeFileSync(path.join(dst, 'config/available.json'), JSON.stringify(avail, null, 1));
console.log(`ready images=${avail.images.length} audio=${avail.audio.length} copied=${copied} pending=${skipped}`);
