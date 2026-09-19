const { buildPain001 } = require("../../src/pain001");
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors() };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors(), body: "POST only" };
  try {
    const p = JSON.parse(event.body || "{}");
    const required = ["msgId","pmtInfId","endToEndId","debtorName","debtorIban","debtorBic","creditorName","creditorIban","amount"];
    for (const k of required) {
      if (p[k] == null || p[k] === "") return json(400, { error: `missing ${k}` });
    }
    const xml = buildPain001(p);
    return { statusCode: 200, headers: { ...cors(), "content-type": "application/xml; charset=utf-8" }, body: xml };
  } catch (e) {
    return json(500, { error: e.message });
  }
};
function cors() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "POST,OPTIONS",
  };
}
function json(code, obj) {
  return { statusCode: code, headers: { ...cors(), "content-type": "application/json" }, body: JSON.stringify(obj) };
}
