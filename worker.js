const JSON_HEADERS={"Content-Type":"application/json; charset=UTF-8"};

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    try {
      if (request.method === "GET" && path === "/") {
        return json({ success: true, message: "Sistem Garansi API aktif." }, 200, cors);
      }

      if (request.method === "POST" && path === "/api/claims") {
        if (!env.DB) throw new Error("Binding D1 DB belum dipasang.");
        const body = await request.json();

        const name = clean(body.name);
        const whatsapp = normalizeWhatsapp(body.whatsapp);
        const product = clean(body.product);
        const account = clean(body.account);
        const orderId = clean(body.orderId);
        const orderDate = clean(body.orderDate);
        const duration = clean(body.duration);
        const claimType = clean(body.claimType || "Garansi");
        const problem = clean(body.problem);

        if (!name || !whatsapp || !product || !problem) {
          return json({ success: false, message: "Nama, WhatsApp, produk, dan kendala wajib diisi." }, 400, cors);
        }

        const id = generateId();
        const now = new Date().toISOString();

        await env.DB.prepare(`
          INSERT INTO claims (
            id,name,whatsapp,product,account,order_id,order_date,
            duration,claim_type,problem,status,admin_note,created_at,updated_at
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).bind(
          id,name,whatsapp,product,account,orderId,orderDate,
          duration,claimType,problem,"Menunggu","",now,now
        ).run();

        return json({ success: true, warrantyId: id, message: "Pengajuan berhasil disimpan." }, 200, cors);
      }

      if (request.method === "GET" && path.startsWith("/api/status/")) {
        if (!env.DB) throw new Error("Binding D1 DB belum dipasang.");
        const id = decodeURIComponent(path.slice("/api/status/".length)).toUpperCase();
        const row = await env.DB.prepare(`
          SELECT id,product,claim_type,status,admin_note,created_at,updated_at
          FROM claims WHERE id=?
        `).bind(id).first();

        if (!row) {
          return json({ success: false, message: "ID garansi tidak ditemukan." }, 404, cors);
        }

        return json({ success: true, data: row }, 200, cors);
      }

      return json({ success: false, message: "Endpoint tidak ditemukan." }, 404, cors);
    } catch (error) {
      return json({ success: false, message: error.message || "Kesalahan server." }, 500, cors);
    }
  }
};

function clean(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeWhatsapp(value) {
  let number = clean(value).replace(/\D/g, "");
  if (number.startsWith("0")) number = "62" + number.slice(1);
  else if (number.startsWith("8")) number = "62" + number;
  return number;
}

function generateId() {
  const d = new Date();
  const date =
    String(d.getUTCFullYear()).slice(-2) +
    String(d.getUTCMonth()+1).padStart(2,"0") +
    String(d.getUTCDate()).padStart(2,"0");
  const random = crypto.getRandomValues(new Uint32Array(1))[0] % 100000;
  return `GRN-${date}-${String(random).padStart(5,"0")}`;
}

function json(data,status,cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, ...JSON_HEADERS, "Cache-Control":"no-store" }
  });
}
