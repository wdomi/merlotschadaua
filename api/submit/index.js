export const config = {
  runtime: "edge"
};

export default async function handler(req) {
  const TABLE_ID = 742957;
  const BASEROW_URL = `https://api.baserow.io/api/database/rows/table/${TABLE_ID}/`;

  const token = process.env.BASEROW_TOKEN;
  if (!token)
    return new Response(JSON.stringify({ error: "BASEROW_TOKEN not set" }), {
      status: 500
    });

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Token ${token}`
  };

  // ---------------------- PARSE JSON BODY ----------------------
  let b = {};
  if (req.method === "POST") {
    try {
      b = await req.json();   // THIS is the correct Edge Runtime parser
    } catch (err) {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400
      });
    }
  }

  // ---------------------- LIST (GET) ----------------------
  if (req.method === "GET") {
    const r = await fetch(`${BASEROW_URL}?user_field_names=true`, { headers });
    const data = await r.json();

    if (!r.ok)
      return new Response(JSON.stringify({ error: data }), {
        status: r.status
      });

    const filtered = data.results.filter(r => !r.deleted);

    return new Response(
      JSON.stringify(
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
      ),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // ---------------------- CREATE ----------------------
  if (req.method === "POST" && (!b.mode || b.mode === "create")) {
    const action = Number(b.action);
    if (![4519311, 4519312].includes(action))
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400
      });

    const clean = v => (v === "" ? null : v);

    const payload = {
      field_6258635: clean(b.bird_name),
      field_6258636: clean(b.bird_id),
      field_6258637: action,
      field_6258638: new Date().toISOString(), // date
      field_6258639: b.latitude ?? null,
      field_6258640: b.longitude ?? null,
      field_6318262: clean(b.territory),
      field_6351349: false
    };

    const r = await fetch(`${BASEROW_URL}?user_field_names=false`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    const data = await r.json();

    if (!r.ok)
      return new Response(JSON.stringify({ error: data }), {
        status: r.status
      });

    return new Response(JSON.stringify({ ok: true, row: data }), {
      status: 200
    });
  }

  // ---------------------- DELETE ----------------------
  if (req.method === "POST" && b.mode === "delete") {
    if (!b.id)
      return new Response(JSON.stringify({ error: "id required" }), {
        status: 400
      });

    const payload = { field_6351349: true };

    const r = await fetch(`${BASEROW_URL}${b.id}/?user_field_names=false`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(payload)
    });

    const data = await r.json();
    if (!r.ok)
      return new Response(JSON.stringify({ error: data }), {
        status: r.status
      });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
    status: 405
  });
}
