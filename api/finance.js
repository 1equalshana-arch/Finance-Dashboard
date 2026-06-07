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

// chart v8: 히스토리 + meta
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

// quoteSummary: 시총 등 상세 정보
async function fetchQuoteSummary(ticker) {
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=summaryDetail,price`;
  try {
    const r = await fetch(url, { headers: YF_HEADERS });
    if (!r.ok) return null;
    const d = await r.json();
    const price = d?.quoteSummary?.result?.[0]?.price;
    const summary = d?.quoteSummary?.result?.[0]?.summaryDetail;
    if (!price) return null;
    return {
      marketCap: price.marketCap?.raw ?? summary?.marketCap?.raw ?? null,
      longName: price.longName ?? null,
      sector: price.sector ?? null,
    };
  } catch { return null; }
}

// ^VIX 전용
async function fetchVIX() {
  const chartData = await fetchChart('^VIX');
  if (chartData) return chartData;
  try {
    const r = await fetch(
      'https://query1.finance.yahoo.com/v7/finance/quote?symbols=%5EVIX',
      { headers: YF_HEADERS }
    );
    if (!r.ok) throw new Error('quote failed');
    const d = await r.json();
    const q = d?.quoteResponse?.result?.[0];
    if (!q) throw new Error('no quote result');
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
  } catch {}
  return null;
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
  const [chartData, extraData] = await Promise.all([
    isVIX ? fetchVIX() : fetchChart(ticker),
    isVIX ? Promise.resolve(null) : fetchQuoteSummary(ticker),
  ]);

  if (!chartData) return res.status(502).json({ error: `No data for ${ticker}` });

  // extraData의 marketCap을 chart meta에 병합
  if (extraData && chartData.chart?.result?.[0]?.meta) {
    const meta = chartData.chart.result[0].meta;
    if (!meta.marketCap && extraData.marketCap) meta.marketCap = extraData.marketCap;
    if (!meta.longName  && extraData.longName)  meta.longName  = extraData.longName;
  }

  return res.status(200).json(chartData);
}
