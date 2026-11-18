import { getStore } from "@netlify/blobs";

// GET  /api/data          -> latest dashboard data (public, for viewers)
// GET  /api/data?auth=1   -> 204 if x-admin-key is correct, else 401
// POST /api/data          -> save data (requires x-admin-key = ADMIN_KEY)
const json = (body, status = 200) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export default async (req) => {
  const store = getStore({ name: "w7-dashboard", consistency: "strong" });
  const adminKey = process.env.ADMIN_KEY || "";
  const given = req.headers.get("x-admin-key") || "";
  const isAdmin = adminKey.length > 0 && given === adminKey;
  const url = new URL(req.url);

  if (req.method === "GET") {
    if (url.searchParams.has("auth")) return new Response(null, { status: isAdmin ? 204 : 401 });
    const data = await store.get("state", { type: "text" });
    return json(data || "null");
  }

  if (req.method === "POST") {
    if (!isAdmin) return json({ error: "unauthorized" }, 401);
    const body = await req.text();
    if (body.length > 4_000_000) return json({ error: "too large" }, 413);
    let parsed;
    try { parsed = JSON.parse(body); } catch { return json({ error: "bad json" }, 400); }
    if (!parsed || !Array.isArray(parsed.rows)) return json({ error: "missing rows" }, 400);
    await store.set("state", body);
    return json({ ok: true });
  }

  return json({ error: "method not allowed" }, 405);
};

export const config = { path: "/api/data" };
