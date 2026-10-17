// 데모용 NIM 프록시 — 웹 CORS 해결 (브라우저 → localhost:8787/nim → NIM)
// 실행: node nim-proxy.js (앱의 npm start와 별도로 켜둘 것)
// 키는 app/.env에서만 읽음 — 이 파일에 키를 쓰지 않는다
const http = require('http');
const fs = require('fs');
const path = require('path');

const envText = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
const keyMatch = envText.match(/EXPO_PUBLIC_NVIDIA_API_KEY=(.+)/);
if (!keyMatch) {
  console.error('app/.env에 EXPO_PUBLIC_NVIDIA_API_KEY가 없습니다.');
  process.exit(1);
}
const KEY = keyMatch[1].trim();
const UPSTREAM = 'https://integrate.api.nvidia.com/v1/chat/completions';
const PORT = 8787;

http
  .createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method !== 'POST' || !req.url.startsWith('/nim')) {
      res.writeHead(404);
      res.end('not found');
      return;
    }

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    try {
      const upstream = await fetch(UPSTREAM, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
        body: Buffer.concat(chunks),
      });
      const text = await upstream.text();
      res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
      res.end(text);
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'upstream failed', detail: String(e) }));
    }
  })
  .listen(PORT, () => console.log(`NIM proxy: http://localhost:${PORT}/nim`));
