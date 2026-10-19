
import { timingSafeEqual } from "node:crypto";

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function stringParam(value) {
  return `<param><value><string>${escapeXml(value)}</string></value></param>`;
}

function decodeXml(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    SMSGATE_URL,
    SMSGATE_API_TOKEN,
    SMSGATE_SENDER = "",
    SMSGATE_TEST_TO,
    SMS_TRIGGER_PIN
  } = process.env;

  if (
    !SMSGATE_URL ||
    !SMSGATE_API_TOKEN ||
    !SMSGATE_TEST_TO ||
    !SMS_TRIGGER_PIN
  ) {
    return res.status(500).json({
      error: "SMSgate environment variables are missing."
    });
  }

  const supplied = Buffer.from(String(req.body?.pin ?? ""));
  const expected = Buffer.from(SMS_TRIGGER_PIN);

  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    return res.status(401).json({ error: "Invalid PIN." });
  }

  const message = String(req.body?.message ?? "").trim();

  if (!message || message.length > 500) {
    return res.status(400).json({ error: "Invalid message." });
  }

  let endpoint;

  try {
    endpoint = new URL(SMSGATE_URL);

    if (endpoint.protocol !== "https:") {
      return res.status(400).json({
        error: "SMSGATE_URL must use HTTPS."
      });
    }
  } catch {
    return res.status(400).json({
      error: "Invalid SMSgate URL."
    });
  }

  const params = [
    stringParam(SMSGATE_API_TOKEN),
    stringParam(SMSGATE_SENDER),
    stringParam(SMSGATE_TEST_TO),
    stringParam(message),
    "<param><value><boolean>0</boolean></value></param>"
  ].join("");

  const requestXml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    "<methodCall><methodName>send_sms</methodName><params>" +
    params +
    "</params></methodCall>";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8"
      },
      body: requestXml
    });

    const responseXml = await response.text();

    if (!response.ok || /<fault>/.test(responseXml)) {
      const faultMatch = responseXml.match(
        /<name>faultString<\/name>\s*<value>\s*<string>([\s\S]*?)<\/string>/i
      );

      console.error(
        "SMSgate error:",
        faultMatch ? decodeXml(faultMatch[1]) : "RPC request failed"
      );

      return res.status(502).json({
        error: "SMSgate rejected the request. Check its configuration."
      });
    }

    const paramsMatch = responseXml.match(
      /<params>([\s\S]*?)<\/params>/i
    );
    const idMatch = paramsMatch?.[1].match(
      /<string>([\s\S]*?)<\/string>/i
    );

    if (!idMatch) {
      return res.status(502).json({
        error: "SMSgate returned an unexpected response."
      });
    }

    return res.status(200).json({
      success: true,
      smsId: decodeXml(idMatch[1]),
      status: "queued",
      message: "SMS accepted by SMSgate; delivery is not yet confirmed."
    });
  } catch (error) {
    console.error("SMSgate connection error:", error.message);

    return res.status(502).json({
      error: "Cannot reach SMSgate. Check its HTTPS address and connection."
    });
  }
}
