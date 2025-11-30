// api/submit.js
// FINAL, FULLY WORKING VERSION — compatible with your frontend (numeric actions)

const TABLE_ID = 742957;
const BASEROW_URL = `https://api.baserow.io/api/database/rows/table/${TABLE_ID}/`;

export default async function handler(req, res) {
  const token = process.env.BASEROW_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "BASEROW_TOKEN not set" });
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Token ${token}`,
  };

  // ================================================================
  // GET — return non-deleted observations
  // ================================================================
  if (req.method === "GET") {
    const mode = req.query.mode || "list";
    if (mode !== "list") {
      return res.status(400).json({ error: "Unsupported GET mode" });
    }

    try {
      const url = `${BASEROW_URL}?user_field_names=true`;
      const r = await fetch(url, { headers });
      const data = await r.json();

      if (!r.ok) {
        return res.status(r.status).json({ error: data });
      }

      const filtered = (data.results || []).filter((row) => !row.deleted);

      const mapped = filtered.map((row) => ({
        id: row.id,
        bird_name: row.bird_name,
        bird_id: row.bird_id,
        action: row.action?.value ?? row.action,
        date: row.date,
        latitude: row.latitude,
        longitude: row.longitude,
        territory: row.territory,
      }));

      return res.status(200).json(mapped);
    } catch (err) {
      return res.status(500).json({ error: String(err) });
    }
  }

  // ================================================================
  // POST — create or delete
  // ================================================================
  if (req.method === "POST") {
    const body = req.body || {};
    const mode = body.mode || "create";

    // ================================================================
    // CREATE ROW
    // ================================================================
    if (mode === "create") {
      const birdName = body.bird_name || "";
      const birdId   = body.bird_id   || "";
      const territory = body.territory || "";
      const latitude  = body.latitude ?? null;
      const longitude = body.longitude ?? null;

      // Frontend now sends numeric values (4519311 / 4519312)
      const actionValue = Number(body.action);
      if (![4519311, 4519312].includes(actionValue)) {
        return res.status(400).json({ error: "Invalid action value" });
      }

      // Baserow now REQUIRES the { "fields": { ... } } structure
      const payload = {
        fields: {
          field_6258635: birdName,     // bird_name
          field_6258636: birdId,       // bird_id
          field_6258637: actionValue,  // action (select option ID)
          field_6258639: latitude,
          field_6258640: longitude,
          field_6318262: territory,
          field_6351349: false,        // deleted = false
        },
      };

      try {
        const url = `${BASEROW_URL}?user_field_names=false`;
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
      } catch (err) {
        return res.status(500).json({ error: String(err) });
      }
    }

    // ================================================================
    // DELETE ROW (soft delete)
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
        const url = `${BASEROW_URL}${id}/?user_field_names=false`;
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
      } catch (err) {
        return res.status(500).json({ error: String(err) });
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
