// ============================================================
// SELL.DO LEAD CREATE
// Handles both message.received & message.sent webhook events.
// Forwards all messages to Sell.do CRM.
// ============================================================

const SELL_DO_URL = 'https://app.sell.do/api/leads/create?api_key=44953fc7f6591aa66828ba30c00adddf';

export default {
  async fetch(request, env) {
    try {
      const body = await request.json();
      const wp   = body.whatsapp || {};

      // Skip template messages
      if (wp.type === 'template') {
        console.log('[sell_do] skipped: template message');
        return new Response(JSON.stringify({ skipped: true }), { status: 200 });
      }

      // Determine direction
      const direction = body.sender === body.contactId ? 'message.received' : 'message.sent';

      // ── Name ──────────────────────────────────────────────
      const name =
        body.contact?.name ||
        wp.pushname        ||
        wp.notifyName      ||
        '';

      // ── Phone ─────────────────────────────────────────────
      // const phone = wp.from || wp.to || '';
      const phone = 919176045004; // Hardcoded for testing

      // ── Message ───────────────────────────────────────────
      // message.sent (rule-based bot): wp.type=interactive → wp.interactive.body.text
      // message.sent (AI bot):         wp.type=text        → wp.text.body
      // message.sent (human agent):    wp.type=text        → wp.text.body
      // message.received:              wp.type=text        → wp.text.body
      const message =
        wp.interactive?.body?.text ||   // rule-based bot (interactive list/button)
        wp.text?.body              ||   // AI bot / human agent / received text
        body.body                  ||   // fallback outgoing text
        wp.body                    ||
        wp.message                 ||
        wp.caption                 ||
        '';

      console.log(`\n[sell_do] ${direction}\n  name   : ${name || '(empty)'}\n  phone  : ${phone}\n  msg    : ${message || '(empty)'}\n`);

      // ── Build & send Sell.do request ──────────────────────
      const params = new URLSearchParams();
      params.append('sell_do[form][lead][name]',    name);
      params.append('sell_do[form][lead][phone]',   phone);
      params.append('sell_do[form][note][content]', message);

      const sellDoRes  = await fetch(SELL_DO_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    params.toString(),
      });

      let sellDoBody = null;
      try { sellDoBody = await sellDoRes.json(); } catch (_) { /* non-JSON response */ }

      const leadId =
        sellDoBody?.lead?.id      ||
        sellDoBody?.data?.id      ||
        sellDoBody?.lead_id       ||
        sellDoBody?.id            ||
        null;

      const errors = sellDoBody?.errors ?? sellDoBody?.error ?? null;

      if (!sellDoRes.ok) {
        console.error(`\n[sell_do] API error: ${sellDoRes.status}\n  errors : ${JSON.stringify(errors)}\n  body   : ${JSON.stringify(sellDoBody, null, 2)}\n`);
      } else {
        console.log(`\n[sell_do] API ok: ${sellDoRes.status}\n  lead_id: ${leadId ?? '(unknown)'}\n  errors : ${JSON.stringify(errors)}\n  full   :\n${JSON.stringify(sellDoBody, null, 2)}\n`);
      }

      return new Response(JSON.stringify({ ok: true, direction, selldo: sellDoRes.status }), {
        status:  200,
        headers: { 'Content-Type': 'application/json' },
      });

    } catch (err) {
      console.error('[sell_do] ERROR:', err.message);
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  },
};
