const API_HEADERS = {
  apiKey: "68eb5895ccf654dbab7ceb2b",
  apiSecret: "9797111813f34277ac9f4c70120cc363",
  "Content-Type": "application/json",
};

const TEAM_1 = "68e37da971e717fc178a77f9"; // CRM Team
const TEAM_2 = "68e9feacd5635bcce3bb9779"; // 24/7 Store Team

async function assignConversation(url, payload, conversationId) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: API_HEADERS,
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (data?.team) {
      console.log(
        `✅ Conversation ${conversationId} assigned to Team: { ID = ${data.team._id}, Name = ${data.team.name} }`
      );
    } else {
      console.log(`✅ API Response for conversation ${conversationId}`, response.status, data);
    }

    return response;
  } catch (err) {
    console.error(`❌ Failed to assign conversation ${conversationId}:`, err);
    return new Response("Error in assignConversation", { status: 500 });
  }
}

async function sendWhatsappMessage(accountId, channelId, contact, ctaUrl) {
  const url = `https://server.gallabox.com/devapi/messages/whatsapp`;

  const payload = {
    channelId,
    channelType: "whatsapp",
    recipient: {
      name: contact.name,
      phone: contact.phone[0],
    },
    whatsapp: {
      type: "interactive",
      interactive: {
        type: "cta_url",
        body: {
          text: `Dear ${contact.name}, All our pharmacists are currently assisting other customers. One of our agents will get back to you shortly by call.\n*Thank you for your patience — we’ll connect with you as soon as possible!*`,
        },
        action: {
          name: "cta_url",
          parameters: {
            display_text: "Visit Us",
            url: ctaUrl,
          },
        },
      },
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: API_HEADERS,
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    console.log(`✅ WhatsApp message sent to ${contact.name}:`, data);
    return response;
  } catch (err) {
    console.error(`❌ Failed to send WhatsApp message to ${contact.name}:`, err);
    return new Response("Error sending WhatsApp message", { status: 500 });
  }
}

export default {
  async fetch(request, env) {
    try {
      if (request.method !== "POST") {
        return new Response("OK: Worker running", { status: 200 });
      }

      const raw = await request.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch (err) {
        return new Response("Invalid JSON", { status: 400 });
      }

      const conversationId = data?.id;
      const accountId = data?.accountId;
      if (!conversationId || !accountId) {
        return new Response("Missing conversationId or accountId", { status: 400 });
      }

      const assignUrl = `https://server.gallabox.com/devapi/accounts/${accountId}/conversations/${conversationId}/assign`;
      const agentFallback = data.agentFallback;

      if (!agentFallback) {
        console.log(`⚠️ No agentFallback for conversation ${conversationId}`);
        return new Response("No fallback present", { status: 200 });
      }

      const attempt = agentFallback.attempt;

      // 1️⃣ Fallback attempt == 1 → assign to Team 1
      if (attempt === 1) {
        await assignConversation(assignUrl, { teamId: TEAM_1 }, conversationId);
        return new Response("Assigned to Team 1 (first fallback attempt)", { status: 200 });
      }

      // 2️⃣ Fallback attempt == 2 → assign to Team 2
      if (attempt === 2) {
        await assignConversation(assignUrl, { teamId: TEAM_2 }, conversationId);
        return new Response("Assigned to Team 2 (second fallback attempt)", { status: 200 });
      }

      // 3️⃣ Fallback attempt == 3 → send WhatsApp CTA message
      if (attempt === 3) {
        const channelId = data.channelId;
        const contact = data.contact;

        if (channelId && contact?.name && contact?.phone?.length) {
          // ✅ Determine URL based on channelId
          let ctaUrl = "https://medon.ae/branches-medon-pharmacy"; // default

          const medonChannels = ["68a86a4c1aebc473f4b1a865", "68df7304be28d8541440efc4"];
          const eightHundredPharmaChannels = ["68dcf70575dc55af17b1b082", "68df9f4c00beb2538e1529a5"];
          const pharmacy24hChannel = "68e903571923d920fdcb1d2f";

          if (medonChannels.includes(channelId)) {
            ctaUrl = "http://medon.ae/";
          } else if (eightHundredPharmaChannels.includes(channelId)) {
            ctaUrl = "http://800pharma.com/";
          } else if (channelId === pharmacy24hChannel) {
            ctaUrl = "https://24hourpharmacy.ae";
          }

          await sendWhatsappMessage(accountId, channelId, contact, ctaUrl);
          return new Response("WhatsApp CTA message sent on third fallback", { status: 200 });
        } else {
          return new Response("Missing channelId or contact info for WhatsApp message", { status: 400 });
        }
      }

      console.log(`⚠️ Fallback attempt ${attempt} — no further action.`);
      return new Response("No action for this fallback attempt", { status: 200 });
    } catch (err) {
      console.error("❌ Error processing webhook:", err);
      return new Response("Internal error", { status: 500 });
    }
  },
};
