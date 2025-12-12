// -----------------------------------------------------------------------------
// /api/submit
// Extended version:
// - CREATE observation (existing behavior, unchanged)
// - LIST observations (excluding deleted)
// - SOFT DELETE via "deleted" boolean
// -----------------------------------------------------------------------------

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body || {};

  const TABLE_ID = 742957;
  const BASE_URL =
    `https://api.baserow.io/api/database/rows/table/${TABLE_ID}/?user_field_names=false`;

  const headers = {
    "Authorization": `Token ${process.env.BASEROW_API_TOKEN}`,
    "Content-Type": "application/json"
  };

  // ===========================================================================
  // NEW: LIST (only non-deleted)
  // ===========================================================================
  if (body.mode === "list") {
    try {
      const r = await fetch(
        `${BASE_URL}&filter__field_DELETED__equal=false&size=30`,
        { method: "GET", headers }
      );

      if (!r.ok) {
        const txt = await r.text();
        return res.status(500).json({ error: txt });
      }

      const data = await r.json();
return res.status(200).json(
  (data.results || []).map(r => ({
    id: r.id,
    date: r.field_6258638 || "",
    bird_name: r.field_6258635 || "",
    bird_id: r.field_6258636 || "",
    action: r.field_6258637?.value ?? r.field_6258637,
    latitude: r.field_6258639,
    longitude: r.field_6258640,
    territory: r.field_6258643,
    deleted: r.field_DELETED
  }))
);
    } catch (err) {
      return res.status(500).json({ error: err.toString() });
    }
  }

  // ===========================================================================
  // NEW: SOFT DELETE (toggle deleted flag)
  // ===========================================================================
  if (body.mode === "set_deleted") {
    if (typeof body.id !== "number" || typeof body.deleted !== "boolean") {
      return res.status(400).json({ error: "Invalid parameters" });
    }

    try {
      const r = await fetch(
        `https://api.baserow.io/api/database/rows/table/${TABLE_ID}/${body.id}/?user_field_names=false`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            field_DELETED: body.deleted
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
  const date = body.date || "";
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
    field_6258638: date,
    field_6258635: bird_name,
    field_6258636: bird_id,
    field_6258637: action,
    field_6258639: latitude,
    field_6258640: longitude,
    field_6258643: territory,
    field_DELETED: false        // 👈 NEW, safe default
  };

  try {
    const r = await fetch(BASE_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(baserowRow)
    });

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
