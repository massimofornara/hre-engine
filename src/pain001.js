function isoNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}
function isoDate() {
  return new Date().toISOString().slice(0, 10);
}
function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function buildPain001(p) {
  const ccy = p.currency || "EUR";
  const amt = Number(p.amount).toFixed(2);
  const exec = p.execDate || isoDate();
  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${esc(p.msgId)}</MsgId>
      <CreDtTm>${isoNow()}</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <CtrlSum>${amt}</CtrlSum>
      <InitgPty><Nm>${esc(p.debtorName || "ORCHESTRATOR ENGINE")}</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${esc(p.pmtInfId)}</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <BtchBookg>false</BtchBookg>
      <NbOfTxs>1</NbOfTxs>
      <CtrlSum>${amt}</CtrlSum>
      <ReqdExctnDt>${exec}</ReqdExctnDt>
      <Dbtr><Nm>${esc(p.debtorName)}</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>${esc(p.debtorIban)}</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BIC>${esc(p.debtorBic)}</FinInstnId></DbtrAgt>
      <CdtTrfTxInf>
        <PmtId><EndToEndId>${esc(p.endToEndId)}</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="${ccy}">${amt}</InstdAmt></Amt>
        <Cdtr><Nm>${esc(p.creditorName)}</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>${esc(p.creditorIban)}</IBAN></Id></CdtrAcct>
      </CdtTrfTxInf>
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>
`;
}
module.exports = { buildPain001 };
