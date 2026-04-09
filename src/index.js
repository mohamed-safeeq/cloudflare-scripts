import { getContactIdByPhone, updateReplyNeeded } from './hubspot.js';
import { logRequest } from './utils.js';
import medonHandler from './medon_pharmacy.js';
import smartflowTranscriptHandler from "./Internal_Smartflow_Transcript_Zoho";
import sellDoHandler from "./sell_do.js";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Allow only POST for all routes
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
    }

    try {
      switch (url.pathname) {

        // ===========================
        // 🔹 1️⃣ HUBSPOT WEBHOOK ROUTE
        // ===========================
        case '/webhook': {
          const body = await request.json();
          logRequest(body); // Optional logging

          const { status, type, from, to } = body?.whatsapp || {};
          const phone = from || to;

          // Validate essential fields
          if (!status || !type || !phone) {
            return new Response('Missing required fields.', { status: 400 });
          }

          // Determine replyNeeded value
          let replyNeeded = null;
          if (status === 'received') {
            replyNeeded = 'Yes';
          } else if (status === 'queued' && type !== 'template') {
            replyNeeded = 'No';
          } else {
            return new Response('Ignored: unhandled message type');
          }

          // Get HubSpot contact
          const contactId = await getContactIdByPhone(phone, env.HUBSPOT_API_TOKEN);
          if (!contactId) {
            return new Response('Contact not found.', { status: 404 });
          }

          // Update HubSpot property
          await updateReplyNeeded(contactId, replyNeeded, env.HUBSPOT_API_TOKEN, env.HUBSPOT_PROPERTY_NAME);

          return new Response('Contact updated.', { status: 200 });
        }

        // ===========================
        // 🔹 2️⃣ MEDON PHARMACY ROUTE
        // ===========================
        case '/accountId/68a86975426f9f0608f849a2/medon': {
          return await medonHandler.fetch(request, env);
        }

        // =======================================
        // 🔹3 SMARTFLOW TRANSCRIPT - INTERNAL 
        // =======================================
          case '/smartflow/zoho/internal': {      
        return await smartflowTranscriptHandler.fetch(request, env);
      }

        // ============================================
        // 🔹 4️⃣ SELL.DO — MESSAGE LOG
        // Endpoint: POST /message/log
        // ============================================
        case '/message/log': {
          return await sellDoHandler.fetch(request, env);
        }

        // ===========================
        // 🔹 5️⃣ SELL.DO LEAD CREATE
        // Endpoint: POST /sell_do
        // ===========================
        case '/sell_do': {
          return await sellDoHandler.fetch(request, env);
        }

        // ===========================
        // 🔹 DEFAULT — UNKNOWN PATH
        // ===========================
        default:
          return new Response('Not Found', { status: 404 });
      }

    } catch (error) {
      console.error('❌ Internal Error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
};
