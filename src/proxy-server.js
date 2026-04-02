// import express from "express";
// import fetch from "node-fetch";
// import cors from "cors";

// const app = express();
// app.use(cors());

// const SECRET = process.env.PROXY_SECRET;

// // Health Check
// app.get("/", (req, res) => {
//   res.json({ status: "Proxy running", region: "India" });
// });

// // Main proxy route
// app.get("/fetch", async (req, res) => {
//   try {
//     const providedSecret = req.headers["x-proxy-secret"];
//     if (providedSecret !== SECRET) {
//       return res.status(403).json({ error: "Forbidden" });
//     }

//     const url = req.query.url;
//     if (!url) return res.status(400).json({ error: "Missing url" });

//     const upstream = await fetch(url, {
//       headers: {
//         "User-Agent": "Mozilla/5.0",
//         "Accept": "audio/*;q=1.0,*/*;q=0.1"
//       }
//     });

//     res.set("content-type", upstream.headers.get("content-type") || "audio/mpeg");

//     upstream.body.pipe(res);

//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // PORT for Render/Railway/Fly.io
// const port = process.env.PORT || 3000;
// app.listen(port, () => console.log("Proxy running on", port));
