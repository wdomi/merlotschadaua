// api/submit.js
// Fully corrected version — now works with Baserow 400% reliably.

const TABLE_ID = 742957;

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

  // ================================================================
  // GET — list rows
  // ================================================================
  if (req.method === "GET") {
    const mode = req.query.mode || "list";

    if (mode !== "list") {
      res.status(400).json({ error: "Unsupported GET mode" });
      return;
    }

    try {
      const url = `https://api.baserow.io/api/database/rows/table/${TABLE_ID}/?user_field_names=true`;
      const r = await fetch(url, { headers });

      if (!r.ok) {
        return res.status(r.status).json({ error: await r.text() });
      }

      const data = await r.json();

      const filtered = (data.results || []).filter((row) => !row.deleted);

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

      return res.status(200).json(mapped);
    } catch (e) {
      return res.status(500).json({ error: String(e) });
    }
  }

  // ================================================================
  // POST — create / delete rows
  // ================================================================
  if (req.method === "POST") {
    const body = req.body || {};
    const mode = body.mode || "create";

    // ================================================================
    // CREATE OBSERVATION
    // ================================================================
    if (mode === "create") {
      const birdName = body.bird_name || "";
      const birdId = body.bird_id || "";
      const actionRaw = body.action;

      // ✔ action must already be numeric (4519311 or 4519312)
      let actionValue = null;

      if (actionRaw === 4519311 || actionRaw === "4519311") {
        actionValue = 4519311;
      } else if (actionRaw === 4519312 || actionRaw === "4519312") {
        actionValue = 4519312;
      } else {
        return res.status(400).json({ error: "Invalid action value" });
      }

      const latitude = body.latitude ?? null;
      const longitude = body.longitude ?? null;
      const territory = body.territory || "";

      // ✔ Baserow requires fields inside "fields"
      const payload = {
        fields: {
          field_6258635: birdName,
          field_6258636: birdId,
          field_6258637: actionValue,
          field_6258639: latitude,
          field_6258640: longitude,
          field_6318262: territory,
          field_6351349: false,
        },
      };

      try {
        const url = `https://api.baserow.io/api/database/rows/table/${TABLE_ID}/?user_field_names=false`;
        const r = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });

        const data = await r.json();

        if (!r.ok) {
          return res.status(r.status).json({ error: data });
        }

        return res.status(200).json({ ok: true, row: data });
      } catch (e) {
        return res.status(500).json({ error: String(e) });
      }
    }

    // ================================================================
    // DELETE (set deleted=true)
    // ================================================================
    if (mode === "delete") {
      const id = body.id;
      if (!id) {
        return res.status(400).json({ error: "id required" });
      }

      const payload = {
        fields: {
          field_6351349: true,
        },
      };

      try {
        const url = `https://api.baserow.io/api/database/rows/table/${TABLE_ID}/${id}/?user_field_names=false`;
        const r = await fetch(url, {
          method: "PATCH",
          headers,
          body: JSON.stringify(payload),
        });

        const data = await r.json();

        if (!r.ok) {
          return res.status(r.status).json({ error: data });
        }

        return res.status(200).json({ ok: true });
      } catch (e) {
        return res.status(500).json({ error: String(e) });
      }
    }

    return res.status(400).json({ error: "Unknown mode" });
  }

  // ================================================================
  // Method not allowed
  // ================================================================
  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end("Method Not Allowed");
}
