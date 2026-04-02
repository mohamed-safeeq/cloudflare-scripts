export function logRequest(body) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Incoming Webhook`);
  console.log('Payload:', JSON.stringify(body));
}
