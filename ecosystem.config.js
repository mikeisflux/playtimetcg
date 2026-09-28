// PM2 process definition for Play Time (playtimetcg.com).
//
// Runs the Next.js production server in cluster mode so `pm2 reload playtime`
// is a zero-downtime restart: PM2 starts fresh workers, waits for them to
// bind the port, then drains the old ones.

const fs = require("fs");
const path = require("path");

// Read APP_DIR/.env so the workers always get DATABASE_URL even when
// launched without it exported (e.g. a manual `pm2 restart`).
function loadEnvFile(file) {
  const out = {};
  try {
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      out[m[1]] = v;
    }
  } catch { /* no .env yet */ }
  return out;
}

const fileEnv = loadEnvFile(path.join(__dirname, ".env"));
const PORT = process.env.PORT || fileEnv.PORT || "3000";
const DATABASE_URL = process.env.DATABASE_URL || fileEnv.DATABASE_URL || "";

module.exports = {
  apps: [
    {
      name: process.env.SERVICE || "playtime",
      script: "node_modules/next/dist/bin/next",
      // Keep port 3000 off the public internet with the host firewall (only
      // 80/443 open); Caddy proxies to localhost.
      args: `start -p ${PORT}`,
      cwd: __dirname,
      instances: 2,
      exec_mode: "cluster",
      listen_timeout: 10000,
      kill_timeout: 5000,
      max_memory_restart: "600M",
      env: {
        NODE_ENV: "production",
        PORT,
        DATABASE_URL,
        AUTH_SECRET: process.env.AUTH_SECRET || fileEnv.AUTH_SECRET || "",
      },
    },
  ],
};
