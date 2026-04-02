import OpenAI from "openai";

// ==============================
// CONFIG
// ==============================
const WAIT_MS = 70_000;   // wait 90 seconds for audio processing
const MIN_VALID_AUDIO = 200;  // minimum bytes required for transcription

// ==============================
// HELPERS
// ==============================
async function safeJson(res) {
  if (!res) return null;
  const text = await res.text();
  if (!text?.trim()) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function cleanNumber(n) {
  if (!n) return "";
  return String(n).replace(/\D/g, "");
}

function safeDecode(url) {
  try {
    const once = decodeURIComponent(url);
    if (once.startsWith("http")) return once;
  } catch {}
  return url;
}

// ==============================
// MAIN WORKER
// ==============================
export default {
  async fetch(request, env) {
    try {
      console.log("=== NEW WEBHOOK RECEIVED ===");

      // ---------------- Parse Body ----------------
      const raw = await request.text();
      let body;

      try { body = JSON.parse(raw); }
      catch { body = Object.fromEntries(new URLSearchParams(raw)); }

      const recordingUrlRaw = body.recording_url;
      const callType = body.call_type;
      const caller = body.caller_id_number;
      const callee = body.call_to_number;
      const callStart = body.start_stamp || "";
      const duration = body.billsec || body.duration || "0";
      const agent = body.answered_agent_name || "Unknown";

      if (!recordingUrlRaw)
        return new Response(JSON.stringify({ error: "recording_url missing" }), { status: 400 });
      if (!callType)
        return new Response(JSON.stringify({ error: "call_type missing" }), { status: 400 });

      const recordingUrl = safeDecode(recordingUrlRaw);
      const phone = cleanNumber(callType === "inbound" ? caller : callee);

      console.log(`CallType=${callType} Caller=${caller} Callee=${callee} Phone=${phone}`);

      // ---------------- Zoho Token ----------------
      const oauthURL =
        "https://accounts.zoho.in/oauth/v2/token?refresh_token=1000.a5a3b2eab5d90aa47156315f5ebb1bb8.caac58eb6431a787189a34284a669dde&client_id=1000.NQDGPN3F0OU2HJ8TVAO4TYVLX6B5EH&client_secret=6405cc9263714508df9a4f10270a997f6f3cc90d2f&grant_type=refresh_token";

      const tokenJson = await safeJson(await fetch(oauthURL, { method: "POST" }));
      if (!tokenJson?.access_token)
        return new Response(JSON.stringify({ error: "Zoho Token Failed" }), { status: 502 });

      const zohoToken = tokenJson.access_token;

      // ---------------- CRM Search ----------------
      console.log("Searching CRM...");

      async function search(module, field, value) {
        const q = `select id from ${module} where ${field} like '%${value}%'`;
        const res = await fetch("https://www.zohoapis.in/crm/v5/coql", {
          method: "POST",
          headers: {
            "Authorization": `Zoho-oauthtoken ${zohoToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ select_query: q })
        });
        return safeJson(res);
      }

      const modules = ["Leads", "Deals"];
      const fields = ["Mobile", "Phone"];

      let moduleFound = null;
      let recordId = null;

      for (const mod of modules) {
        for (const field of fields) {
          const result = await search(mod, field, phone);
          if (result?.data?.length) {
            moduleFound = mod;
            recordId = result.data[0].id;
            break;
          }
        }
        if (recordId) break;
      }

      if (!recordId) {
        console.log("CRM not found");
        return new Response(JSON.stringify({ success: false, reason: "CRM not found" }), { status: 200 });
      }

      console.log(`CRM Match: ${moduleFound} → ${recordId}`);

      // ---------------- WAIT 90 sec ----------------
      await new Promise(r => setTimeout(r, WAIT_MS));

      // ---------------- DOWNLOAD AUDIO ----------------
      console.log("Downloading audio...");
      const audioRes = await fetch(recordingUrl, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });

      const buffer = await audioRes.arrayBuffer();
      const byteLen = buffer.byteLength;
      console.log("Audio Bytes =", byteLen);

      // ---------------- TRANSCRIPTION ----------------
      let transcript = null;

      if (byteLen > MIN_VALID_AUDIO) {
        try {
          console.log("Transcribing...");
          const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
          const file = new File([buffer], "call.mp3", { type: "audio/mpeg" });

          const resp = await client.audio.transcriptions.create({
            file,
            model: "gpt-4o-transcribe"
          });

          transcript = resp?.text?.trim() || null;
          console.log("Transcript:", transcript || "Transcript empty");
        } catch (err) {
          console.log("Transcription failed:", err?.message || err);
          transcript = null;
        }
      } else {
        console.log("Audio too small for transcription");
      }

      // ---------------- SAVE NOTE ----------------
      const noteContent =
`Phone: ${phone}
Agent: ${agent}
Start: ${callStart}
Duration: ${duration}s
Transcript:
${transcript || "Transcript not available."}
Recording URL: ${recordingUrl}
`;

      const notePayload = {
        data: [
          { Note_Title: `Call Summary (${callType})`, Note_Content: noteContent }
        ]
      };

      await fetch(
        `https://www.zohoapis.in/crm/v8/${moduleFound}/${recordId}/Notes`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${zohoToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(notePayload)
        }
      );

      console.log(`Note posted ${moduleFound} → ${recordId}`);

      return new Response(JSON.stringify({
        success: true,
        module: moduleFound,
        recordId,
        audioBytes: byteLen,
        transcriptPresent: !!transcript
      }), { status: 200 });

    } catch (err) {
      console.log("FATAL ERROR:", err);
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }
};
