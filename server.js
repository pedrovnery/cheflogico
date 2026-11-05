// Servidor do ranking "Fome de Lógica" — sem dependências.
// Uso: coloque este arquivo na MESMA pasta do HTML e rode:  node server.js
// Abra http://localhost:3000 (ou o endereço de rede mostrado no terminal).
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const PORT = process.env.PORT || 3000, DIR = __dirname, DB = path.join(DIR, 'ranking.json');
const GAME = fs.readdirSync(DIR).find(f => /^Fome.*\.html$/i.test(f)) || 'index.html';

let S = { resetT: 0, players: {} };
try { S = Object.assign(S, JSON.parse(fs.readFileSync(DB, 'utf8'))); } catch (e) {}

const clients = new Set();
let tm = null;
const view = () => JSON.stringify({ resetT: S.resetT, list: Object.keys(S.players).map(id => ({ id, ...S.players[id] })) });
const save = () => { clearTimeout(tm); tm = setTimeout(() => fs.writeFile(DB, JSON.stringify(S), () => {}), 300); };
const push = () => { const m = 'data: ' + view() + '\n\n'; for (const r of clients) r.write(m); };
const body = req => new Promise(ok => {
  let b = '';
  req.on('data', c => { b += c; if (b.length > 1e4) req.destroy(); });
  req.on('end', () => { try { ok(JSON.parse(b || '{}')); } catch (e) { ok({}); } });
});

http.createServer(async (req, res) => {
  const u = req.url.split('?')[0];
  if (u === '/api/ranking') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(view());
  }
  if (u === '/api/stream') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write('retry: 2000\n\ndata: ' + view() + '\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (u === '/api/score' && req.method === 'POST') {
    const d = await body(req);
    const id = String(d.id || '').slice(0, 40), name = String(d.name || '').slice(0, 14);
    const score = Math.max(0, Math.min(1e6, +d.score || 0));
    if (!id || !name) { res.writeHead(400); return res.end(); }
    const n = v => Math.max(0, Math.min(1e6, +v || 0));
    S.players[id] = { name, score, wins: n(d.wins), errs: n(d.errs), t: Date.now() };
    save(); push();
    res.writeHead(200); return res.end('ok');
  }
  if (u === '/api/clear' && req.method === 'POST') {
    S = { resetT: Date.now(), players: {} };
    save(); push();
    res.writeHead(200); return res.end('ok');
  }
  if (u === '/' || u === '/index.html' || decodeURIComponent(u) === '/' + GAME) {
    return fs.readFile(path.join(DIR, GAME), (e, d) => {
      if (e) { res.writeHead(404); return res.end('Coloque o HTML do jogo na mesma pasta do server.js'); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(d);
    });
  }
  res.writeHead(404); res.end();
}).listen(PORT, '0.0.0.0', () => {
  console.log('Jogo rodando em:  http://localhost:' + PORT);
  for (const l of Object.values(os.networkInterfaces()))
    for (const i of l) if (i.family === 'IPv4' && !i.internal) console.log('Na rede (celulares):  http://' + i.address + ':' + PORT);
});
setInterval(() => { for (const r of clients) r.write(': ping\n\n'); }, 25000);
