// Wave50 build: src/index.html (not in git) -> index.html (password gate + AES-GCM encrypted app).
// usage: WAVE50_PASSWORD=... node build.mjs  (W50_MODULES_DIR holds node_modules with d3, topojson-client, world-atlas — see build.sh)
import fs from 'node:fs';
import zlib from 'node:zlib';
import { webcrypto as crypto } from 'node:crypto';
import path from 'node:path';

const MODS = process.env.W50_MODULES_DIR || '/tmp/w50mods';
const pw = process.env.WAVE50_PASSWORD;
if (!pw) { console.error('Set WAVE50_PASSWORD'); process.exit(1); }
const cfg = JSON.parse(fs.readFileSync('.wave50.json', 'utf8'));
const rd = p => fs.readFileSync(path.join(MODS, 'node_modules', p), 'utf8');

const geo = JSON.parse(fs.readFileSync('collector/geo.json', 'utf8'));
const num2cc = Object.fromEntries(Object.entries(geo).map(([cc, v]) => [v[0], cc]));
const W = JSON.parse(fs.readFileSync('collector/world.json', 'utf8'));
for (const [cc, v] of Object.entries(W.countries)) { v.ru = geo[cc] ? geo[cc][2][0] : (v.native || cc); v.en = geo[cc] ? geo[cc][1][0] : (v.native || cc); }
const snapshot = fs.readFileSync(process.env.W50_SNAPSHOT || '/tmp/snap.json', 'utf8');
const libs = `<script>${rd('d3/dist/d3.min.js')}</script>\n<script>${rd('topojson-client/dist/topojson-client.min.js')}</script>\n<script>window.W50_WORLD=${rd('world-atlas/countries-110m.json')}</script>`;
let app = fs.readFileSync('src/index.html', 'utf8')
  .replace('<!--LIBS-->', () => libs)
  .replace('/*SNAPSHOT*/null', () => snapshot)
  .replace('/*NUM2CC*/{}', () => JSON.stringify(num2cc))
  .replace('/*WORLD*/{}', () => JSON.stringify(W));

const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: Buffer.from(cfg.salt, 'hex'), iterations: cfg.iter }, base, 256);
const key = await crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['encrypt']);
const iv = crypto.getRandomValues(new Uint8Array(12));
const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, zlib.gzipSync(app));
const blob = Buffer.concat([Buffer.from(iv), Buffer.from(ct)]).toString('base64');

const gate = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Wave50</title><meta name="robots" content="noindex">
<style>html,body{margin:0;height:100%;background:#070b10;color:#e6edf3;font:14px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.g{height:100%;display:flex;align-items:center;justify-content:center}.c{width:min(340px,90vw);text-align:center}
.l{font-size:40px;font-weight:900}.l span{color:#4fd1c5}.s{color:#8596ab;margin:4px 0 22px}
input[type=password]{width:100%;padding:12px;border-radius:9px;border:1px solid #1d2a38;background:#0e151d;color:#e6edf3;font-size:16px;box-sizing:border-box}
button{width:100%;margin-top:10px;padding:12px;border:0;border-radius:9px;background:#4fd1c5;color:#0b1016;font-weight:800;font-size:15px;cursor:pointer}
label{display:block;margin-top:12px;color:#8596ab;font-size:12px}.e{color:#f08a8f;min-height:20px;margin-top:10px;font-size:13px}</style></head>
<body><div class="g"><form class="c" id="f"><div class="l">Wave<span>50</span></div><div class="s">Epidemic detector · private beta<br>Детектор эпидемий · закрытая демо-версия</div>
<input type="password" id="p" placeholder="Password / Пароль" autofocus autocomplete="current-password"><button>ENTER · ВОЙТИ</button>
<label><input type="checkbox" id="r" checked> Remember 30 days · Запомнить</label><div class="e" id="e"></div></form></div>
<script>
const SALT='${cfg.salt}',IT=${cfg.iter},BLOB='${blob}';
const b64=u=>btoa(String.fromCharCode(...new Uint8Array(u)));
async function open(raw){const k=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt']);const b=Uint8Array.from(atob(BLOB),c=>c.charCodeAt(0));
 const p=await crypto.subtle.decrypt({name:'AES-GCM',iv:b.slice(0,12)},k,b.slice(12));
 const html=await new Response(new Blob([p]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
 sessionStorage.setItem('w50k',b64(raw));document.open();document.write(html);document.close()}
async function derive(pw){const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),'PBKDF2',false,['deriveBits']);
 return crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:Uint8Array.from(SALT.match(/../g),h=>parseInt(h,16)),iterations:IT},base,256)}
(async()=>{try{const s=sessionStorage.getItem('w50k');const r=JSON.parse(localStorage.getItem('w50r')||'null');
 const k=s||(r&&r.exp>Date.now()?r.k:null);if(k)await open(Uint8Array.from(atob(k),c=>c.charCodeAt(0)))}catch(e){localStorage.removeItem('w50r')}})();
document.getElementById('f').onsubmit=async e=>{e.preventDefault();const E=document.getElementById('e');E.textContent='…';
 try{const raw=await derive(document.getElementById('p').value);if(document.getElementById('r').checked)localStorage.setItem('w50r',JSON.stringify({k:b64(raw),exp:Date.now()+30*864e5}));await open(raw)}
 catch(x){E.textContent='Wrong password · Неверный пароль';localStorage.removeItem('w50r')}};
</script></body></html>`;
fs.writeFileSync('index.html', gate);
console.log('index.html', (gate.length / 1024).toFixed(0) + ' KB');
