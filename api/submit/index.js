// api/submit.js – FINAL WORKING VERSION

const TABLE_ID = 742957;
const BASEROW_URL = `https://api.baserow.io/api/database/rows/table/${TABLE_ID}/`;

export default async function handler(req, res) {
  const token = process.env.BASEROW_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "BASEROW_TOKEN not set" });
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Token ${token}`
  };

  /* ------------------------------------------------------
   * GET — LIST NON-DELETED ROWS
   * ------------------------------------------------------ */
  if (req.method === "GET") {
    try {
      const url = `${BASEROW_URL}?user_field_names=true`;
      const r = await fetch(url, { headers });
      const data = await r.json();

      if (!r.ok) return res.status(r.status).json({ error: data });

      const filtered = (data.results || []).filter(r => !r.deleted);

      return res.status(200).json(
        filtered.map(row => ({
          id: row.id,
          bird_name: row.bird_name,
          bird_id: row.bird_id,
          action: row.action?.value ?? row.action,
          date: row.date,
          latitude: row.latitude,
          longitude: row.longitude,
          territory: row.territory
        }))
      );
    } catch (err) {
      return res.status(500).json({ error: String(err) });
    }
  }

  /* ------------------------------------------------------
   * POST — CREATE OR DELETE ROWS
   * ------------------------------------------------------ */
  if (req.method === "POST") {
const b = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const mode = b.mode || "create";

    /* ---------------- CREATE ------------------- */
    if (mode === "create") {
      const action = Number(b.action);
      if (![4519311, 4519312].includes(action)) {
        return res.status(400).json({ error: "Invalid action" });
      }

      // IMPORTANT: FLAT payload (Baserow rejects nested objects)
      const payload = {
        field_6258635: b.bird_name || "",
        field_6258636: b.bird_id || "",
        field_6258637: action,
        field_6258639: b.latitude ?? null,
        field_6258640: b.longitude ?? null,
        field_6318262: b.territory || "",
        field_6351349: false
      };

      try {
        const url = `${BASEROW_URL}?user_field_names=false`;
        const r = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(payload)
        });

        const data = await r.json();
        if (!r.ok) return res.status(r.status).json({ error: data });

        return res.status(200).json({ ok: true, row: data });

      } catch (err) {
        return res.status(500).json({ error: String(err) });
      }
    }

    /* ---------------- DELETE ------------------- */
    if (mode === "delete") {
      if (!b.id) return res.status(400).json({ error: "Missing id" });

      const payload = { field_6351349: true };

      try {
        const url = `${BASEROW_URL}${b.id}/?user_field_names=false`;
        const r = await fetch(url, {
          method: "PATCH",
          headers,
          body: JSON.stringify(payload)
        });

        const data = await r.json();
        if (!r.ok) return res.status(r.status).json({ error: data });

        return res.status(200).json({ ok: true });

      } catch (err) {
        return res.status(500).json({ error: String(err) });
      }
    }

    return res.status(400).json({ error: "Invalid mode" });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end("Method Not Allowed");
}




export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1mb"
    }
  }
};
