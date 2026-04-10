export function logRequest(body) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Incoming Webhook`);
  console.log('Full Payload:', JSON.stringify(body, null, 2));
}

export function logWhatsappFields(whatsapp = {}) {
  const fields = ['status', 'type', 'from', 'to', 'name', 'message', 'id', 'timestamp'];
  console.log('=== WhatsApp Field Breakdown ===');
  for (const field of fields) {
    const val = whatsapp[field];
    if (val === undefined) {
      console.log(`  ${field}: ❌ NOT PRESENT in payload`);
    } else if (val === null || val === '') {
      console.log(`  ${field}: ⚠️  EMPTY (value="${val}")`);
    } else {
      console.log(`  ${field}: ✅ "${val}"`);
    }
  }
  // Log any extra keys we didn't anticipate
  const known = new Set(fields);
  const extra = Object.keys(whatsapp).filter(k => !known.has(k));
  if (extra.length) {
    console.log(`  Extra keys present: ${extra.map(k => `${k}="${whatsapp[k]}"`).join(', ')}`);
  }
  console.log('================================');
}
