
import { timingSafeEqual } from "node:crypto";

export default async function handler(req, res) {
  // Allow only POST requests.
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  // Credentials are stored securely in Vercel.
  const {
    SMSGATE_USERNAME,
    SMSGATE_PASSWORD,
    SMSGATE_DEVICE_ID,
    SMSGATE_TO_PHONE,
    SMS_TRIGGER_PIN
  } = process.env;

  if (
    !SMSGATE_USERNAME ||
    !SMSGATE_PASSWORD ||
    !SMSGATE_DEVICE_ID ||
    !SMSGATE_TO_PHONE ||
    !SMS_TRIGGER_PIN
  ) {
    return res.status(500).json({
      error: "SMS Gateway environment variables are missing."
    });
  }

  // Verify the secret PIN.
  const suppliedPin = Buffer.from(
    String(req.body?.pin ?? "")
  );
  const expectedPin = Buffer.from(SMS_TRIGGER_PIN);

  const validPin =
    suppliedPin.length === expectedPin.length &&
    timingSafeEqual(suppliedPin, expectedPin);

  if (!validPin) {
    return res.status(401).json({
      error: "Invalid PIN."
    });
  }

  const message = String(
    req.body?.message ?? ""
  ).trim();

  if (!message || message.length > 500) {
    return res.status(400).json({
      error: "Message must contain 1 to 500 characters."
    });
  }

  try {
    const credentials = Buffer.from(
      `${SMSGATE_USERNAME}:${SMSGATE_PASSWORD}`
    ).toString("base64");

    const response = await fetch(
      "https://api.sms-gate.app/3rdparty/v1/messages",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          textMessage: {
            text: message
          },
          phoneNumbers: [SMSGATE_TO_PHONE],
          deviceId: SMSGATE_DEVICE_ID,
          ttl: 3600,
          priority: 100
        })
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(
        "SMS Gateway error:",
        response.status,
        result
      );

      return res.status(502).json({
        error:
          "SMS Gateway rejected the request. Check your credentials, Device ID and phone connection."
      });
    }

    return res.status(200).json({
      success: true,
      message: "SMS accepted by the gateway.",
      smsId: result.id ?? null,
      status: result.state ?? "accepted"
    });
  } catch (error) {
    console.error(
      "SMS Gateway connection error:",
      error.message
    );

    return res.status(502).json({
      error: "Could not connect to the SMS Gateway."
    });
  }
}
