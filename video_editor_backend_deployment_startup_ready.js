// =========================
// BACKEND SERVER (NODE + EXPRESS)
// =========================

import express from "express";
import cors from "cors";
import multer from "multer";
import { exec } from "child_process";
import { createClient } from "redis";
import fs from "fs";

const app = express();
app.use(cors());
app.use(express.json());

// =========================
// FILE UPLOAD (TEMP STORAGE)
// =========================

const upload = multer({ dest: "uploads/" });

// =========================
// REDIS QUEUE SETUP
// =========================

const redis = createClient();
await redis.connect();

// =========================
// JOB QUEUE
// =========================

app.post("/api/render", async (req, res) => {
  const jobId = Date.now().toString();
  await redis.set(jobId, JSON.stringify({ status: "queued", progress: 0 }));

  await redis.lPush("renderQueue", JSON.stringify({ jobId, data: req.body }));

  res.json({ jobId });
});

// =========================
// JOB STATUS
// =========================

app.get("/api/status/:id", async (req, res) => {
  const job = await redis.get(req.params.id);
  res.json(JSON.parse(job));
});

// =========================
// WORKER PROCESS (FFMPEG)
// =========================

async function worker() {
  while (true) {
    const jobData = await redis.brPop("renderQueue", 0);
    const { jobId, data } = JSON.parse(jobData.element);

    await redis.set(jobId, JSON.stringify({ status: "processing", progress: 10 }));

    const input = "uploads/input.mp4";
    const output = `outputs/${jobId}.mp4`;

    // Example FFmpeg command
    exec(`ffmpeg -i ${input} -vf scale=1280:720 ${output}`, async () => {
      await redis.set(jobId, JSON.stringify({ status: "done", progress: 100, output }));
    });
  }
}

worker();

// =========================
// SAVE PROJECT
// =========================

app.post("/api/save", (req, res) => {
  fs.writeFileSync(`projects/${Date.now()}.json`, JSON.stringify(req.body));
  res.json({ ok: true });
});

// =========================
// START SERVER
// =========================

app.listen(3000, () => console.log("VOIDIX backend running on port 3000"));

// =========================
// DEPLOYMENT GUIDE
// =========================

/*
1. Install dependencies:
   npm install express cors multer redis

2. Install FFmpeg on server:
   sudo apt install ffmpeg

3. Run Redis:
   redis-server

4. Start server:
   node server.js

5. Deploy options:
   - Backend: Railway / Render / AWS EC2
   - Frontend: Vercel

6. Storage:
   Replace local uploads with AWS S3

7. Production improvements:
   - Use BullMQ instead of raw Redis
   - Add authentication (JWT)
   - Add Stripe billing
   - Use Docker containers for scaling
*/
