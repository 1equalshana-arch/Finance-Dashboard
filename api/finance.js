// api/finance.js — Vercel Serverless Function
// Yahoo Finance 프록시. CORS 헤더를 붙여서 브라우저에 반환.
 
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
 
export default async function handler(req, res) {
  // Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).set(CORS).end();
  }
 
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
 
  const { ticker, type } = req.query;
 
  // ── FX: open.er-api.com (무료, 키 불필요) ──────────────────
  if (type === 'fx') {
    try {
      const r = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!r.ok) throw new Error(`er-api ${r.status}`);
      const data = await r.json();
      return res.status(200).json(data);
    } catch (e) {
      return res.status(502).json({ error: e.message });
    }
  }
 
  // ── 주가: Yahoo Finance v8 ──────────────────────────────────
  if (!ticker) {
    return res.status(400).json({ error: 'ticker required' });
  }
 
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=3mo`;
 
  try {
    const r = await fetch(url, {
      headers: {
        // YF는 브라우저처럼 보이는 UA를 선호
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': 'application/json',
      },
    });
    if (!r.ok) throw new Error(`YF ${r.status}`);
    const data = await r.json();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
 
