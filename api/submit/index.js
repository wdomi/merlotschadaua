// /api/submit.js – FINAL WORKING VERSION

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const TOKEN = process.env.BASEROW_TOKEN;
  const TABLE_ID = 742957;

  if (!TOKEN) {
    return res.status(500).json({ error: "Missing BASEROW_TOKEN" });
  }

  // -----------------------------------------------------------
  // LIST MODE
  // -----------------------------------------------------------
  if (req.method === "GET") {
    const url = `https://api.baserow.io/api/database/rows/table/${TABLE_ID}/?user_field_names=true`;

    const r = await fetch(url, {
      headers: { Authorization: `Token ${TOKEN}` }
    });

    const data = await r.json();

    return res.status(r.ok ? 200 : 400).json(
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
  }

  // -----------------------------------------------------------
  // CREATE OR DELETE
  // -----------------------------------------------------------
  if (req.method === "POST") {
    let body = req.body;
    if (typeof body === "string") {
      body = JSON.parse(body);
    }

    // Delete row
    if (body.mode === "delete") {
      const url = `https://api.baserow.io/api/database/rows/table/${TABLE_ID}/${body.id}/`;
      const r = await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Token ${TOKEN}` }
      });
      return res.status(200).json({ ok: true });
    }

    // CREATE row
    const payload = {
      field_6258641: body.bird_name || "",
      field_6258642: body.bird_id || "",
      field_6258637: body.action,
      field_6258639: Number(Number(body.latitude).toFixed(10)),
      field_6258640: Number(Number(body.longitude).toFixed(10)),
      field_6258643: body.territory || "",
      field_6258638: new Date().toISOString().split("T")[0]
    };

    const url = `https://api.baserow.io/api/database/rows/table/${TABLE_ID}/?user_field_names=false`;

    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Token ${TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await r.json();

    if (!r.ok) {
      return res.status(400).json({ error: "Baserow error", detail: data });
    }

    return res.status(200).json({ ok: true, row: data });
  }
}
