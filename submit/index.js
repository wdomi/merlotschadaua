// -----------------------------------------------------------------------------
// /api/submit
// Extended version:
// - CREATE observation (existing behavior, unchanged)
// - LIST observations (same output as old working version)
// - SOFT DELETE via "deleted" boolean
// -----------------------------------------------------------------------------

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body || {};

  const TABLE_ID = 742957;
  const BASE_URL =
    `https://api.baserow.io/api/database/rows/table/${TABLE_ID}/`;

  const headers = {
    "Authorization": `Token ${process.env.BASEROW_API_TOKEN}`,
    "Content-Type": "application/json"
  };

  // ===========================================================================
  // LIST MODE — OUTPUT MATCHES OLD WORKING VERSION
  // ===========================================================================
  if (body.mode === "list") {
    try {
      const r = await fetch(
        `${BASE_URL}?user_field_names=true&filter__deleted__equal=false&order_by=-id&size=50`,
        { method: "GET", headers }
      );

      if (!r.ok) {
        const txt = await r.text();
        return res.status(500).json({ error: txt });
      }

      const data = await r.json();

      return res.status(200).json(
        (data.results || []).map(item => ({
          id: item.id,
          bird_name: item.bird_name,
          bird_id: item.bird_id,
          action: item.action?.value ?? item.action,
          date: item.date,
          latitude: item.latitude,
          longitude: item.longitude,
          territory: item.territory
        }))
      );
    } catch (err) {
      return res.status(500).json({ error: err.toString() });
    }
  }

  // ===========================================================================
  // SOFT DELETE (toggle deleted flag)
  // ===========================================================================
  if (body.mode === "set_deleted") {
    if (typeof body.id !== "number" || typeof body.deleted !== "boolean") {
      return res.status(400).json({ error: "Invalid parameters" });
    }

    try {
      const r = await fetch(
        `${BASE_URL}${body.id}/?user_field_names=false`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            deleted: body.deleted
          })
        }
      );

      if (!r.ok) {
        const txt = await r.text();
        return res.status(500).json({ error: txt });
      }

      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.toString() });
    }
  }

  // ===========================================================================
  // EXISTING CREATE LOGIC (UNCHANGED)
  // ===========================================================================
  const bird_name = body.bird_name || "";
  const bird_id = body.bird_id || "";
  const action = body.action;
  const territory = body.territory || "";

  function safeNum(n) {
    if (n === null || n === undefined) return null;
    const f = Number(n);
    if (isNaN(f)) return null;
    return Number(f.toFixed(10));
  }

  const latitude = safeNum(body.latitude);
  const longitude = safeNum(body.longitude);

  const baserowRow = {
    bird_name: bird_name,
    bird_id: bird_id,
    action: action,
    latitude: latitude,
    longitude: longitude,
    territory: territory,
    deleted: false
  };

  try {
    const r = await fetch(
      `${BASE_URL}?user_field_names=true`,
      {
        method: "POST",
        headers,
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
