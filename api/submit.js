const TABLE_ID = 742957;
const BASEROW_URL = `https://api.baserow.io/api/database/rows/table/${TABLE_ID}/`;

export default async function handler(req, res) {
  const token = process.env.BASEROW_TOKEN;
  if (!token) return res.status(500).json({ error: "BASEROW_TOKEN not set" });

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Token ${token}`
  };

  // ------------------ LIST ROWS ---------------------
  if (req.method === "GET") {
    try {
      const r = await fetch(`${BASEROW_URL}?user_field_names=true`, { headers });
      const data = await r.json();

      if (!r.ok) return res.status(r.status).json({ error: data });

      const filtered = data.results.filter(r => !r.deleted);

      return res.status(200).json(
        filtered.map(r => ({
          id: r.id,
          bird_name: r.bird_name,
          bird_id: r.bird_id,
          action: r.action?.value ?? r.action,
          date: r.date,
          latitude: r.latitude,
          longitude: r.longitude,
          territory: r.territory
        }))
      );
    } catch (err) {
      return res.status(500).json({ error: String(err) });
    }
  }

  // ------------------ CREATE / DELETE ---------------------
  if (req.method === "POST") {
    const b = req.body || {};
    const mode = b.mode || "create";

    if (mode === "create") {
      const action = Number(b.action);
      if (![4519311, 4519312].includes(action))
        return res.status(400).json({ error: "Invalid action" });

      // IMPORTANT: flat structure — no "fields"
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
        const r = await fetch(`${BASEROW_URL}?user_field_names=false`, {
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

    if (mode === "delete") {
      if (!b.id) return res.status(400).json({ error: "id required" });

      const payload = { field_6351349: true };

      try {
        const r = await fetch(
          `${BASEROW_URL}${b.id}/?user_field_names=false`,
          {
            method: "PATCH",
            headers,
            body: JSON.stringify(payload)
          }
        );

        const data = await r.json();
        if (!r.ok) return res.status(r.status).json({ error: data });

        return res.status(200).json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: String(err) });
      }
    }

    return res.status(400).json({ error: "Unknown mode" });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end("Method Not Allowed");
}
