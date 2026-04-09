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

      // Skip template messages — not real conversation content
      if (wp.type === 'template') {
        console.log('[sell_do] skipped: template message');
        return new Response(JSON.stringify({ skipped: true }), { status: 200 });
      }

      // Determine direction
      const direction = body.sender === body.contactId ? 'message.received' : 'message.sent';
      console.log('[sell_do] direction:', direction);

      const name    = body.contact?.name || '';
      const phone   = wp.from || wp.to   || '';
     //const phone   = 919176045004;  // Hardcoded for testing
      const message = wp.text?.body      || '';

      console.log('[sell_do] name   :', name);
      console.log('[sell_do] phone  :', phone);
      console.log('[sell_do] message:', message);

      const params = new URLSearchParams();
      params.append('sell_do[form][lead][name]',    name);
      params.append('sell_do[form][lead][phone]',   phone);
      params.append('sell_do[form][note][content]', message);

      const sellDoRes  = await fetch(SELL_DO_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    params.toString(),
      });

      const sellDoBody = await sellDoRes.text();
      console.log('[sell_do] response:', sellDoRes.status, sellDoBody);

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
