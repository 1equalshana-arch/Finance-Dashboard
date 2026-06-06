// api/finance.js — Vercel Serverless Function
 
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
 
const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com/',
};
 
// YF는 ^ 기호를 인코딩 없이 그대로 받아야 하는 경우가 있음
// 두 엔드포인트 모두 시도해서 성공한 것 반환
async function fetchYF(ticker) {
  // ^VIX, ^KS11 등: 인코딩 버전과 raw 버전 모두 시도
  const urls = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=3mo`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=3mo`,
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=3mo`,
  ];
 
  for (const url of urls) {
    try {
      const r = await fetch(url, { headers: YF_HEADERS });
      if (!r.ok) continue;
      const data = await r.json();
      if (data?.chart?.result?.[0]) return data;
    } catch {}
  }
  return null;
}
 
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).set(CORS_HEADERS).end();
  }
 
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
 
  const { ticker, type } = req.query;
 
  // ── FX ────────────────────────────────────────────────────────
  if (type === 'fx') {
    try {
      const r = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!r.ok) throw new Error(`er-api ${r.status}`);
      return res.status(200).json(await r.json());
    } catch (e) {
      return res.status(502).json({ error: e.message });
    }
  }
 
  // ── 주가 ──────────────────────────────────────────────────────
  if (!ticker) return res.status(400).json({ error: 'ticker required' });
 
  const data = await fetchYF(ticker);
  if (!data) return res.status(502).json({ error: `No data for ${ticker}` });
  return res.status(200).json(data);
}
