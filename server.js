import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.get("/api/leaderboard", async (req, res) => {
  const { data, error } = await supabase
    .from("players")
    .select("pseudo,score,places,title,last_seen")
    .order("score", { ascending: false })
    .limit(100);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ rows: data, participants: data.length });
});

app.put("/api/progress", async (req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  const { data: auth, error: authError } = await supabase.auth.getUser(token);

  if (authError || !auth?.user) {
    return res.status(401).json({ error: "Non authentifié" });
  }

  const user = auth.user;
  const progress = req.body?.data || {};
  const pts = progress.pts || {};
  const score = pts.e || 0;
  const places = pts.own || [];

  const { error: progressError } = await supabase
    .from("progress")
    .upsert({
      user_id: user.id,
      score,
      places: places.length,
      unlocked_places: places,
      updated_at: new Date().toISOString()
    });

  const { error: playerError } = await supabase
    .from("players")
    .upsert({
      user_id: user.id,
      pseudo: user.email?.split("@")[0] || "Joueur",
      score,
      places: places.length,
      last_seen: new Date().toISOString()
    });

  if (progressError || playerError) {
    return res.status(500).json({
      error: progressError?.message || playerError?.message
    });
  }

  res.json({ ok: true });
});

const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log("API Historia prête sur le port " + port);
});
