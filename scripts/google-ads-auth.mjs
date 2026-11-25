#!/usr/bin/env node
/**
 * One-time helper to get a Google Ads OAuth refresh token.
 *
 * Usage:
 *   GOOGLE_ADS_CLIENT_ID=xxx GOOGLE_ADS_CLIENT_SECRET=yyy node scripts/google-ads-auth.mjs
 *
 * What it does:
 *   1. Opens your browser to Google's OAuth consent screen (adwords scope)
 *   2. Starts a local server on port 4567 to catch the redirect
 *   3. Exchanges the auth code for tokens and prints the refresh token
 *
 * Copy the refresh token into apps/admin/.env.local as GOOGLE_ADS_REFRESH_TOKEN.
 */

import http from "http";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const PORT = 4567;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPE = "https://www.googleapis.com/auth/adwords";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(`
ERROR: Set GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET first.

  On Windows (PowerShell):
    $env:GOOGLE_ADS_CLIENT_ID="your-client-id.apps.googleusercontent.com"
    $env:GOOGLE_ADS_CLIENT_SECRET="your-client-secret"
    node scripts/google-ads-auth.mjs

How to get these:
  1. Go to console.cloud.google.com
  2. Create a project (or select one)
  3. Enable "Google Ads API" in APIs & Services → Library
  4. Go to APIs & Services → Credentials → Create Credentials → OAuth client ID
  5. Application type: Desktop app
  6. Copy the Client ID and Client Secret
`);
  process.exit(1);
}

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth?` +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
  }).toString();

console.log("\n=== Google Ads OAuth Setup ===\n");
console.log("Opening browser to Google sign-in...");
console.log("If the browser doesn't open, paste this URL manually:\n");
console.log(authUrl + "\n");

// Open browser cross-platform
const openBrowser = (url) => {
  const cmd =
    process.platform === "win32"
      ? `start "" "${url}"`
      : process.platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  return execAsync(cmd).catch(() => {});
};

await openBrowser(authUrl);

// Local server to catch the OAuth redirect
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== "/callback") {
    res.writeHead(404);
    res.end();
    return;
  }

  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<h2>Error: ${error ?? "no code returned"}</h2><p>Close this tab and try again.</p>`);
    console.error("\nAuth failed:", error ?? "no code returned");
    server.close();
    return;
  }

  // Exchange code for tokens
  let tokens;
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    tokens = await tokenRes.json();
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/html" });
    res.end(`<h2>Token exchange failed</h2><p>${err.message}</p>`);
    console.error("\nToken exchange failed:", err.message);
    server.close();
    return;
  }

  if (tokens.error) {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<h2>Token error: ${tokens.error}</h2><p>${tokens.error_description ?? ""}</p>`);
    console.error("\nToken error:", tokens.error_description ?? tokens.error);
    server.close();
    return;
  }

  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(`
    <h2 style="color:green">Success! You can close this tab.</h2>
    <p>Your refresh token has been printed in the terminal.</p>
  `);

  console.log("\n=== SUCCESS ===\n");
  console.log("Add these to apps/admin/.env.local:\n");
  console.log(`GOOGLE_ADS_CLIENT_ID=${CLIENT_ID}`);
  console.log(`GOOGLE_ADS_CLIENT_SECRET=${CLIENT_SECRET}`);
  console.log(`GOOGLE_ADS_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log("\nDo NOT paste these in chat. Save them directly to .env.local.\n");

  server.close();
});

server.listen(PORT, () => {
  console.log(`Waiting for Google to redirect to localhost:${PORT}/callback ...\n`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\nERROR: Port ${PORT} is already in use. Close whatever is using it and try again.`);
  } else {
    console.error("\nServer error:", err.message);
  }
  process.exit(1);
});
