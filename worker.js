export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
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
        return await createClaim(request, env, cors);
      }

      if (request.method === "GET" && path === "/api/status") {
        return await checkStatus(url, env, cors);
      }

      if (request.method === "POST" && path === "/telegram-webhook") {
        return await telegramWebhook(request, url, env, cors);
      }

      return json({ success: false, message: "Endpoint tidak ditemukan." }, 404, cors);
    } catch (error) {
      return json(
        { success: false, message: error?.message || "Terjadi kesalahan server." },
        500,
        cors
      );
    }
  }
};

async function createClaim(request, env, cors) {
  if (!env.DB) throw new Error("Binding D1 bernama DB belum dipasang.");

  const form = await request.formData();
  const get = key => String(form.get(key) || "").trim();

  let phone = get("customerContact").replace(/\D/g, "");
  if (phone.startsWith("0")) phone = "62" + phone.slice(1);
  else if (phone.startsWith("8")) phone = "62" + phone;

  if (!/^62\d{8,13}$/.test(phone)) {
    return json({ success: false, message: "Nomor WhatsApp tidak valid." }, 400, cors);
  }

  const required = ["customerName", "productName", "orderId", "problem"];
  for (const key of required) {
    if (!get(key)) {
      return json({ success: false, message: `Field ${key} wajib diisi.` }, 400, cors);
    }
  }

  const claimId =
    `GRN-${new Date().toISOString().slice(0,10).replaceAll("-","")}-` +
    crypto.randomUUID().slice(0,6).toUpperCase();

  const now = new Date().toISOString();
  const status = "Menunggu";

  await env.DB.prepare(`
    INSERT INTO claims (
      id, customer_name, whatsapp, product_name, price, duration,
      order_date, order_id, payment, claim_type, problem,
      status, admin_note, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    claimId,
    get("customerName"),
    phone,
    get("productName"),
    get("price"),
    get("duration"),
    get("orderDate"),
    get("orderId"),
    get("payment"),
    get("claimType") || "Garansi",
    get("problem"),
    status,
    "",
    now,
    now
  ).run();

  const text = buildTelegramText({
    claimId,
    customerName: get("customerName"),
    phone,
    productName: get("productName"),
    price: get("price"),
    duration: get("duration"),
    orderDate: get("orderDate"),
    orderId: get("orderId"),
    payment: get("payment"),
    claimType: get("claimType") || "Garansi",
    problem: get("problem"),
    status
  });

  const keyboard = {
    inline_keyboard: [
      [
        { text: "✅ Terima", callback_data: `claim:${claimId}:Diterima` },
        { text: "🟡 Proses", callback_data: `claim:${claimId}:Diproses` },
        { text: "❌ Tolak", callback_data: `claim:${claimId}:Ditolak` }
      ],
      [
        {
          text: "💬 Balas WhatsApp",
          url: makeWhatsAppLink(phone, claimId)
        }
      ]
    ]
  };

  const base = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;
  const evidence = form.get("evidence");
  let response;

  if (evidence && typeof evidence !== "string" && evidence.size > 0) {
    if (evidence.size > 5 * 1024 * 1024) {
      return json({ success: false, message: "Screenshot maksimal 5 MB." }, 400, cors);
    }

    const tg = new FormData();
    tg.append("chat_id", env.TELEGRAM_CHAT_ID);
    tg.append("caption", text.slice(0, 1024));
    tg.append("parse_mode", "HTML");
    tg.append("reply_markup", JSON.stringify(keyboard));
    tg.append("photo", evidence, evidence.name || "bukti.jpg");

    response = await fetch(`${base}/sendPhoto`, {
      method: "POST",
      body: tg
    });
  } else {
    response = await fetch(`${base}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: keyboard
      })
    });
  }

  const raw = await response.text();
  let tgResult;

  try {
    tgResult = JSON.parse(raw);
  } catch {
    throw new Error("Telegram memberi respons bukan JSON: " + raw.slice(0, 200));
  }

  if (!tgResult.ok) {
    throw new Error(tgResult.description || "Telegram API gagal.");
  }

  await env.DB.prepare(`
    UPDATE claims
    SET telegram_chat_id=?, telegram_message_id=?, updated_at=?
    WHERE id=?
  `).bind(
    String(tgResult.result?.chat?.id || ""),
    Number(tgResult.result?.message_id || 0),
    new Date().toISOString(),
    claimId
  ).run();

  return json(
    {
      success: true,
      ok: true,
      claimId,
      warrantyId: claimId,
      message: "Pengajuan berhasil dikirim."
    },
    200,
    cors
  );
}

async function checkStatus(url, env, cors) {
  if (!env.DB) throw new Error("Binding D1 bernama DB belum dipasang.");

  const q = String(url.searchParams.get("q") || "").trim();
  if (!q) {
    return json(
      { success: false, message: "Masukkan ID garansi atau nomor WhatsApp." },
      400,
      cors
    );
  }

  let normalized = q;
  if (!q.toUpperCase().startsWith("GRN-")) {
    normalized = q.replace(/\D/g, "");
    if (normalized.startsWith("0")) normalized = "62" + normalized.slice(1);
    else if (normalized.startsWith("8")) normalized = "62" + normalized;
  } else {
    normalized = q.toUpperCase();
  }

  const result = await env.DB.prepare(`
    SELECT id, whatsapp, product_name, duration, order_id,
           claim_type, status, admin_note, created_at, updated_at
    FROM claims
    WHERE id=? OR whatsapp=?
    ORDER BY created_at DESC
    LIMIT 20
  `).bind(normalized, normalized).all();

  return json({ success: true, data: result.results || [] }, 200, cors);
}

async function telegramWebhook(request, url, env, cors) {
  if (!env.TELEGRAM_WEBHOOK_SECRET) {
    throw new Error("TELEGRAM_WEBHOOK_SECRET belum dipasang.");
  }

  const key = url.searchParams.get("key") || "";
  if (key !== env.TELEGRAM_WEBHOOK_SECRET) {
    return json({ success: false, message: "Webhook ditolak." }, 401, cors);
  }

  const update = await request.json();
  const callback = update.callback_query;

  if (!callback) {
    return json({ success: true }, 200, cors);
  }

  const parts = String(callback.data || "").split(":");
  if (parts.length !== 3 || parts[0] !== "claim") {
    await answerCallback(env, callback.id, "Perintah tidak dikenal.");
    return json({ success: true }, 200, cors);
  }

  const claimId = parts[1];
  const status = parts[2];
  const allowed = ["Diterima", "Diproses", "Ditolak"];

  if (!allowed.includes(status)) {
    await answerCallback(env, callback.id, "Status tidak valid.");
    return json({ success: true }, 200, cors);
  }

  await env.DB.prepare(`
    UPDATE claims SET status=?, updated_at=? WHERE id=?
  `).bind(status, new Date().toISOString(), claimId).run();

  await answerCallback(env, callback.id, `Status diubah menjadi ${status}.`);

  const row = await env.DB.prepare(`
    SELECT whatsapp FROM claims WHERE id=?
  `).bind(claimId).first();

  const message = callback.message;
  const oldText = message.caption || message.text || "";
  const newText = replaceStatus(oldText, status);

  const keyboard = {
    inline_keyboard: [
      [
        { text: "✅ Terima", callback_data: `claim:${claimId}:Diterima` },
        { text: "🟡 Proses", callback_data: `claim:${claimId}:Diproses` },
        { text: "❌ Tolak", callback_data: `claim:${claimId}:Ditolak` }
      ],
      [
        {
          text: "💬 Balas WhatsApp",
          url: makeWhatsAppLink(row?.whatsapp || "", claimId)
        }
      ]
    ]
  };

  const base = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;
  const method = message.photo ? "editMessageCaption" : "editMessageText";
  const payload = {
    chat_id: message.chat.id,
    message_id: message.message_id,
    parse_mode: "HTML",
    reply_markup: keyboard
  };

  if (message.photo) payload.caption = newText.slice(0, 1024);
  else payload.text = newText;

  await fetch(`${base}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  return json({ success: true }, 200, cors);
}

async function answerCallback(env, callbackId, text) {
  await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackId,
        text,
        show_alert: false
      })
    }
  );
}

function buildTelegramText(data) {
  return [
    "🛡️ <b>PENGAJUAN GARANSI BARU — JUASTORE</b>",
    "",
    `🆔 ID Garansi: <code>${esc(data.claimId)}</code>`,
    `👤 Nama: ${esc(data.customerName)}`,
    `📱 WhatsApp: <code>${esc(data.phone)}</code>`,
    "",
    `📦 Produk: ${esc(data.productName)}`,
    `💰 Harga: Rp ${esc(data.price || "0")}`,
    `⏳ Durasi: ${esc(data.duration || "-")}`,
    `📅 Tanggal Order: ${esc(data.orderDate || "-")}`,
    `🧾 ID Order: ${esc(data.orderId)}`,
    `💳 Pembayaran: ${esc(data.payment || "-")}`,
    `🛡 Jenis: ${esc(data.claimType || "Garansi")}`,
    "",
    "<b>📝 Masalah / Kendala:</b>",
    esc(data.problem),
    "",
    `⏱ <b>Status:</b> ${esc(data.status)}`
  ].join("\n");
}

function replaceStatus(text, status) {
  const line = `⏱ <b>Status:</b> ${esc(status)}`;

  if (/⏱\s*<b>Status:<\/b>.*$/m.test(text)) {
    return text.replace(/⏱\s*<b>Status:<\/b>.*$/m, line);
  }

  return `${text}\n\n${line}`;
}

function makeWhatsAppLink(phone, claimId) {
  const message =
    `Halo, pengajuan garansi JuaStore dengan ID ${claimId} sedang kami tindak lanjuti.`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-store"
    }
  });
}
