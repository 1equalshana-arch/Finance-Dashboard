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

async function fetchChart(ticker) {
  const candidates = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=3mo`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=3mo`,
  ];
  for (const url of candidates) {
    try {
      const r = await fetch(url, { headers: YF_HEADERS });
      if (!r.ok) continue;
      const data = await r.json();
      if (data?.chart?.result?.[0]) return data;
    } catch {}
  }
  return null;
}

// v7 quote: marketCap, longName 등 포함
async function fetchQuote(ticker) {
  const candidates = [
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}`,
    `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}`,
  ];
  for (const url of candidates) {
    try {
      const r = await fetch(url, { headers: YF_HEADERS });
      if (!r.ok) continue;
      const d = await r.json();
      const q = d?.quoteResponse?.result?.[0];
      if (q) return q;
    } catch {}
  }
  return null;
}

async function fetchVIX() {
  const chartData = await fetchChart('^VIX');
  if (chartData) return chartData;
  // fallback: quote만
  const q = await fetchQuote('^VIX');
  if (!q) return null;
  return {
    chart: {
      result: [{
        meta: {
          regularMarketPrice: q.regularMarketPrice,
          previousClose: q.regularMarketPreviousClose,
          fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
        },
        timestamp: [Date.now() / 1000],
        indicators: { quote: [{ close: [q.regularMarketPrice] }] }
      }]
    }
  };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).set(CORS_HEADERS).end();
  }
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  const { ticker, type } = req.query;

  // ── FX ──────────────────────────────────────────────────────
  if (type === 'fx') {
    try {
      const r = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!r.ok) throw new Error(`er-api ${r.status}`);
      return res.status(200).json(await r.json());
    } catch (e) {
      return res.status(502).json({ error: e.message });
    }
  }

  // ── 주가 ────────────────────────────────────────────────────
  if (!ticker) return res.status(400).json({ error: 'ticker required' });

  const isVIX = ticker === '^VIX';

  // chart + quote 병렬 fetch
  const [chartData, quoteData] = await Promise.all([
    isVIX ? fetchVIX() : fetchChart(ticker),
    isVIX ? Promise.resolve(null) : fetchQuote(ticker),
  ]);

  if (!chartData) return res.status(502).json({ error: `No data for ${ticker}` });

  // quote에서 marketCap, sharesOutstanding, longName을 chart meta에 병합
  if (quoteData && chartData.chart?.result?.[0]?.meta) {
    const meta = chartData.chart.result[0].meta;
    if (quoteData.marketCap)        meta.marketCap        = quoteData.marketCap;
    if (quoteData.sharesOutstanding) meta.sharesOutstanding = quoteData.sharesOutstanding;
    if (quoteData.longName)         meta.longName         = quoteData.longName;
    if (quoteData.sector)           meta.sector           = quoteData.sector;
  }

  return res.status(200).json(chartData);
}
