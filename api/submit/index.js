export const config = { runtime: "edge" };

const BASEROW_API = "https://api.baserow.io/api/database/rows/table/742957/";
const TOKEN = process.env.BASEROW_TOKEN;

async function baserowCreate(payload) {
  const res = await fetch(BASEROW_API, {
    method: "POST",
    headers: {
      Authorization: `Token ${TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      field_6258634: payload.bird_name || "",
      field_6258635: payload.bird_id || "",
      field_6258636: payload.action,
      field_6258638: new Date().toISOString().slice(0, 10),
      field_6258637: payload.action,   // action id
      field_6258639: payload.latitude, // must be ≤10 decimals
      field_6258640: payload.longitude,
      field_6258641: payload.territory || ""
    })
  });

  if (!res.ok) {
    const text = await res.text();
    return new Response(text, { status: 400 });
  }
  return res;
}

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode");

    // GET → return latest
    if (mode === "list") {
      const rows = await fetch(BASEROW_API, {
        headers: { Authorization: `Token ${TOKEN}` }
      }).then(r => r.json());

      return new Response(JSON.stringify(rows.results || []), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // POST → delete
    if (req.method === "POST") {
      const body = await req.json();

      if (body.mode === "delete") {
        const id = body.id;

        const del = await fetch(BASEROW_API + id + "/", {
          method: "DELETE",
          headers: { Authorization: `Token ${TOKEN}` }
        });

        return new Response("deleted");
      }

      // POST → create new row
      return baserowCreate(body);
    }

    return new Response("Invalid method", { status: 405 });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Invalid JSON" }),
      { status: 400 }
    );
  }
}
