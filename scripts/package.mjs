/**
 * Assembles a self-contained deploy folder after `next build`:
 *
 *   deploy/
 *     server.js            ← start with:  node server.js
 *     .next/  node_modules/ (only what the server needs)  public/
 *     .env.example  start.sh  start.cmd  ecosystem.config.cjs  Dockerfile  DEPLOY.md
 *
 * and deploy.zip next to it. Copy the folder (or zip) to any host with Node.js ≥ 20.
 * Run: npm run package
 */
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync, copyFileSync, chmodSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");
const out = path.join(root, "deploy");

if (!existsSync(path.join(standalone, "server.js"))) {
  console.error("✖ .next/standalone/server.js not found — run `next build` first (npm run package does this).");
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// 1. Minimal server + traced node_modules
cpSync(standalone, out, { recursive: true, dereference: true });
// Never ship local env files that the build may have traced in.
for (const f of [".env", ".env.local", ".env.production", ".env.production.local", ".env.development", ".env.development.local"]) {
  rmSync(path.join(out, f), { force: true });
}
// 2. Static assets the minimal server serves itself
cpSync(path.join(root, ".next", "static"), path.join(out, ".next", "static"), { recursive: true });
cpSync(path.join(root, "public"), path.join(out, "public"), { recursive: true });
// 3. Config template + helpers
copyFileSync(path.join(root, ".env.example"), path.join(out, ".env.example"));

writeFileSync(
  path.join(out, "start.sh"),
  `#!/usr/bin/env sh
# Starts the booking site. Reads settings from .env in this folder (copy .env.example to .env).
cd "$(dirname "$0")"
export NODE_ENV=production
export PORT="\${PORT:-3000}"
export HOSTNAME="\${HOSTNAME:-0.0.0.0}"
exec node server.js
`,
);
chmodSync(path.join(out, "start.sh"), 0o755);

writeFileSync(
  path.join(out, "start.cmd"),
  `@echo off\r\nREM Starts the booking site on Windows. Reads settings from .env in this folder.\r\ncd /d "%~dp0"\r\nset NODE_ENV=production\r\nif "%PORT%"=="" set PORT=3000\r\nnode server.js\r\n`,
);

writeFileSync(
  path.join(out, "ecosystem.config.cjs"),
  `// PM2: pm2 start ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [
    {
      name: "human-compass-booking",
      script: "server.js",
      cwd: __dirname,
      instances: 1, // keep 1: rate limiting and the slot lock are per process
      env: { NODE_ENV: "production", PORT: 3000, HOSTNAME: "0.0.0.0" },
    },
  ],
};
`,
);

writeFileSync(
  path.join(out, "Dockerfile"),
  `# docker build -t human-compass . && docker run -p 3000:3000 --env-file .env human-compass
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY . .
RUN rm -f .env
USER node
EXPOSE 3000
CMD ["node", "server.js"]
`,
);
writeFileSync(path.join(out, ".dockerignore"), ".env\n*.zip\n");

writeFileSync(
  path.join(out, "DEPLOY.md"),
  `# Deploying the Human Compass booking site

This folder is the complete, built site. It needs **Node.js 20 or newer** on the host — nothing else
(no \`npm install\`, no build step). Plain static/PHP hosting cannot run it: the Google Calendar
connection runs on the server.

## 1. Configure

Copy \`.env.example\` to \`.env\` in this folder and fill in the Google values
(see the main README, "Setup with Google Calendar"). The server reads \`.env\` on start.
Alternatively set the same variables in your host's control panel.

## 2. Start

| Host | How |
|---|---|
| Any Linux/macOS server | \`./start.sh\`  (or \`PORT=8080 node server.js\`) |
| Windows | \`start.cmd\` |
| PM2 (keeps it running, restarts on reboot) | \`pm2 start ecosystem.config.cjs && pm2 save && pm2 startup\` |
| Docker | \`docker build -t human-compass . && docker run -d -p 3000:3000 --env-file .env human-compass\` |
| cPanel / Plesk "Node.js App" (Phusion Passenger) | Application root = this folder · Startup file = \`server.js\` · Node 20+ · add the env vars in the panel · Restart |
| Render / Railway / Fly / Hostinger VPS / DigitalOcean App | Upload the folder, start command \`node server.js\`, set env vars |

Then open \`https://your-domain/api/health\` — it should return \`"ok": true\`.

## 3. Put it behind HTTPS

Point your domain at the server and terminate HTTPS in front of it (Nginx, Caddy, Cloudflare, or your
panel's SSL). Example Nginx:

\`\`\`nginx
server {
  server_name book.example.com;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
\`\`\`

\`X-Forwarded-For\` matters: the booking rate limit is per visitor IP.

## Notes

- Run **one** process (PM2 \`instances: 1\`). The rate limit and per-slot lock live in memory.
- \`NEXT_PUBLIC_SITE_URL\` is baked in when the folder is built (used for link previews). Rebuild with
  \`npm run package\` after changing it. Every other variable is read at runtime from \`.env\`.
- To update: rebuild with \`npm run package\` from the source repo, replace this folder, keep your \`.env\`, restart.
`,
);

// 4. Zip it
rmSync(path.join(root, "deploy.zip"), { force: true });
try {
  execSync(`cd "${out}" && zip -qr ../deploy.zip . -x ".env"`, { stdio: "inherit" });
  console.log("✓ deploy.zip");
} catch {
  console.log("(zip not available — skipped deploy.zip; the deploy/ folder is complete)");
}
console.log("✓ deploy/ ready — copy it to any host with Node.js ≥ 20 and run: node server.js");
