// api/settings.js — Upstash Redis REST API
 
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
 
const BASE  = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;
 
// Upstash REST API: GET /get/:key
async function redisGet(key) {
  const r = await fetch(`${BASE}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!r.ok) throw new Error(`redis GET ${r.status}: ${await r.text()}`);
  const d = await r.json();
  return d.result != null ? JSON.parse(d.result) : null;
}
 
// Upstash REST API: POST /set/:key/:value (값을 URL 경로에 인코딩해서 전달)
async function redisSet(key, value) {
  const serialized = encodeURIComponent(JSON.stringify(value));
  const r = await fetch(`${BASE}/set/${encodeURIComponent(key)}/${serialized}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!r.ok) throw new Error(`redis SET ${r.status}: ${await r.text()}`);
  return r.json();
}
 
const ALLOWED_KEYS = ['sigma_pf', 'sigma_mcap', 'sigma_sectors', 'sigma_entry'];
 
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).set(CORS).end();
  }
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
 
  if (!BASE || !TOKEN) {
    return res.status(500).json({ error: 'KV_REST_API_URL / KV_REST_API_TOKEN not set' });
  }
 
  const { key } = req.query;
  if (!ALLOWED_KEYS.includes(key)) {
    return res.status(400).json({ error: `invalid key: ${key}` });
  }
 
  // GET: 불러오기
  if (req.method === 'GET') {
    try {
      const value = await redisGet(key);
      return res.status(200).json({ value });
    } catch (e) {
      console.error('GET error:', e.message);
      return res.status(502).json({ error: e.message });
    }
  }
 
  // POST: 저장
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (body?.value === undefined) {
        return res.status(400).json({ error: 'body.value required' });
      }
      await redisSet(key, body.value);
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('SET error:', e.message);
      return res.status(502).json({ error: e.message });
    }
  }
 
  return res.status(405).json({ error: 'method not allowed' });
}
