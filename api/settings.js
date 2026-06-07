// api/settings.js — Upstash Redis REST API로 설정 저장/불러오기
// Vercel이 자동 주입하는 환경변수: KV_REST_API_URL, KV_REST_API_TOKEN

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Upstash는 KV_REST_API_URL / KV_REST_API_TOKEN 으로 주입됨
const BASE  = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;

async function redisGet(key) {
  const r = await fetch(`${BASE}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!r.ok) throw new Error(`redis GET ${r.status}`);
  const d = await r.json();
  // Upstash REST: { result: "json-string" | null }
  return d.result != null ? JSON.parse(d.result) : null;
}

async function redisSet(key, value) {
  const r = await fetch(`${BASE}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    // Upstash REST: body = ["SET", key, value] 또는 단순 JSON string
    body: JSON.stringify(JSON.stringify(value)),
  });
  if (!r.ok) throw new Error(`redis SET ${r.status}`);
}

const ALLOWED_KEYS = ['sigma_pf', 'sigma_mcap', 'sigma_sectors', 'sigma_entry'];

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).set(CORS).end();
  }
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));

  if (!BASE || !TOKEN) {
    return res.status(500).json({ error: 'Upstash env vars not set (KV_REST_API_URL / KV_REST_API_TOKEN)' });
  }

  const { key } = req.query;
  if (!ALLOWED_KEYS.includes(key)) {
    return res.status(400).json({ error: `invalid key: ${key}` });
  }

  if (req.method === 'GET') {
    try {
      const value = await redisGet(key);
      return res.status(200).json({ value });
    } catch (e) {
      return res.status(502).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      await redisSet(key, body.value);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(502).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'method not allowed' });
}
