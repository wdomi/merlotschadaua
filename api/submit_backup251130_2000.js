// api/submit.js
// Vercel serverless function to proxy Baserow requests.
// Uses environment variable BASEROW_TOKEN so the token
// never appears in index.html.

// Baserow table / field info (from your description):
// Table ID: 742957  (dipper_rings)
//
// Fields:
// field_6258635  bird_name   (string)
// field_6258636  bird_id     (string)
// field_6258637  action      (single select: 4519311 = sighted, 4519312 = maybe)
// field_6258638  date        (created on, read-only)
// field_6258639  latitude    (decimal)
// field_6258640  longitude   (decimal)
// field_6318262  territory   (string)
// field_6351349  deleted     (boolean)

const TABLE_ID = 742957;
const BASEROW_BASE = "https://api.baserow.io/api/database/rows/table";

export default async function handler(req, res) {
  const token = process.env.BASEROW_TOKEN;
  if (!token) {
    res.status(500).json({ error: "BASEROW_TOKEN not set" });
    return;
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Token ${token}`,
  };

  if (req.method === "GET") {
    // mode=list: return non-deleted records
    const mode = req.query.mode || "list";
    if (mode !== "list") {
      res.status(400).json({ error: "Unsupported GET mode" });
      return;
    }

    try {
      const url = `${BASEROW_BASE}/${TABLE_ID}/?user_field_names=true`;
      const r = await fetch(url, { headers });
      if (!r.ok) {
        const text = await r.text();
        res.status(r.status).json({ error: text });
        return;
      }
      const data = await r.json();
      const filtered = (data.results || []).filter((row) => !row.deleted);
      // return a minimal subset for the client
      const mapped = filtered.map((row) => ({
        id: row.id,
        bird_name: row.bird_name,
        bird_id: row.bird_id,
        action: row.action && row.action.value ? row.action.value : row.action,
        date: row.date,
        latitude: row.latitude,
        longitude: row.longitude,
        territory: row.territory,
      }));
      res.status(200).json(mapped);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
    return;
  }

  if (req.method === "POST") {
    const body = req.body || {};
    const mode = body.mode || "create";

    if (mode === "create") {
      // Data from client
      const birdName = body.bird_name || "";
      const birdId = body.bird_id || "";
      const actionValue = body.action === "sighted" ? 4519311 : 4519312;
      const latitude = body.latitude;
      const longitude = body.longitude;
      const territory = body.territory || "";

      const payload = {
        field_6258635: birdName,      // bird_name
        field_6258636: birdId,        // bird_id
        field_6258637: actionValue,   // action (select option ID)
        field_6258639: latitude,      // latitude
        field_6258640: longitude,     // longitude
        field_6318262: territory,     // territory
        field_6351349: false,         // deleted = false
      };

      try {
        const url = `${BASEROW_BASE}/${TABLE_ID}/`;
        const r = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });
        const data = await r.json();
        if (!r.ok) {
          res.status(r.status).json({ error: data });
          return;
        }
        res.status(200).json({ ok: true, row: data });
      } catch (e) {
        res.status(500).json({ error: String(e) });
      }
      return;
    }

    if (mode === "delete") {
      const id = body.id;
      if (!id) {
        res.status(400).json({ error: "id required" });
        return;
      }

      const payload = {
        field_6351349: true, // deleted = true
      };

      try {
        const url = `${BASEROW_BASE}/${TABLE_ID}/${id}/`;
        const r = await fetch(url, {
          method: "PATCH",
          headers,
          body: JSON.stringify(payload),
        });
        const data = await r.json();
        if (!r.ok) {
          res.status(r.status).json({ error: data });
          return;
        }
        res.status(200).json({ ok: true });
      } catch (e) {
        res.status(500).json({ error: String(e) });
      }
      return;
    }

    res.status(400).json({ error: "Unknown mode" });
    return;
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end("Method Not Allowed");
}
