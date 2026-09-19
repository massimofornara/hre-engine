exports.handler = async () => ({
  statusCode: 200,
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    engine: "HRE",
    status: "ok",
    chainId: 42161,
    channels: ["SEPA_CAMT054", "PAIN001_OUT", "ARBITRUM_L2"],
    ts: new Date().toISOString(),
  }),
});
