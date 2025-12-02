// -----------------------------------------------------------------------------
// /api/submit  – FINAL FIXED VERSION
// Works with Baserow table 742957
// Removes forbidden fields (created_on), validates payload,
// and inserts correct numeric lat/lng (≤10 decimals)
// -----------------------------------------------------------------------------

export default async function handler(req, res) {
  // Allow only POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body;
  try {
    body = req.body;   // Vercel already parses JSON (no need for JSON.parse)
  } catch (err) {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  // Extract safe fields only
  const bird_name = body.bird_name || "";
  const bird_id = body.bird_id || "";
  const action = body.action;      // 4519311 / 4519312
  const territory = body.territory || "";

  // FIX: SAFE lat/lng rounding
  function safeNum(n) {
    if (n === null || n === undefined) return null;
    const f = Number(n);
    if (isNaN(f)) return null;
    return Number(f.toFixed(10));  // ≤10 decimals
  }

  const latitude = safeNum(body.latitude);
  const longitude = safeNum(body.longitude);

  // ---------------------------------------------------------------------------
  // Build payload EXACTLY matching Baserow fields (NO created_on!!)
  // ---------------------------------------------------------------------------
  const baserowRow = {
    field_6258633: bird_name,
    field_6258634: bird_id,
    field_6258637: action,
    field_6258639: latitude,
    field_6258640: longitude,
    field_6258635: territory,
  };

  // Send to Baserow
  try {
    const r = await fetch(
      "https://api.baserow.io/api/database/rows/table/742957/?user_field_names=false",
      {
        method: "POST",
        headers: {
          "Authorization": `Token ${process.env.BASEROW_API_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(baserowRow)
      }
    );

    if (!r.ok) {
      const txt = await r.text();
      return res.status(400).json({ error: "Baserow error", detail: txt });
    }

    const data = await r.json();
    return res.status(200).json({ ok: true, id: data.id });

  } catch (err) {
    return res.status(500).json({ error: "Server exception", detail: err.toString() });
  }
}
