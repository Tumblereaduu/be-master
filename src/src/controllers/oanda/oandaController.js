const fetch = require("node-fetch");

const oandaprice = async (req, res) => {
  try {
    const pair_id = req.params.pair; // e.g. EUR_USD
    const url = `https://api-fxpractice.oanda.com/v3/instruments/${pair_id}/candles?count=1&price=M&granularity=S5`;

    const options = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer b9b3f98a38ea19509fcb1810a376bab6-e9d0f4c1e94d53acdd892b7e808e88ce"
      }
    };

    const response = await fetch(url, options);
    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: "Upstream error", detail: text });
    }

    const data = await response.json();
    console.log("data", data);
    return res.json(data);

    

  } catch (err) {
    console.error("Error fetching OANDA price:", err);
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { oandaprice }
