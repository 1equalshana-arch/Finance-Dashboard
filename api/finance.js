export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
 
  const { ticker, type } = req.query;
 
  if (type === 'fx') {
    try {
      const r = await fetch('https://open.er-api.com/v6/latest/USD');
      const d = await r.json();
      return res.status(200).json(d);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
 
  if (!ticker) return res.status(400).json({ error: 'ticker required' });
 
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=60d`;
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      }
    });
    const d = await r.json();
    return res.status(200).json(d);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
 
