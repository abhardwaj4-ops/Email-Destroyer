# Email Destroyer (HTML5 Canvas)

A tiny, client-side web toy: upload an image (like a screenshot of an email), then "destroy" it with different tools (gun, knife, machete, flamethrower, grenade). It uses canvas blend modes: **multiply** for scorch/burn, **destination-out** for cutouts, plus simple particles and WebAudio blips — no external libraries.

## How to run
- Just open `index.html` in your browser — no build step needed.
- For local dev with auto-reload, you can use any static server (optional).

## How to deploy for free
- **GitHub Pages**: new repo → upload these files → Settings → Pages → Deploy from Branch → select `main` + root → Save.
- **Netlify**: drag-and-drop this folder onto app.netlify.com → it auto hosts.
- **Vercel**: `vercel` command in the folder or import via dashboard.
- **itch.io**: Create a new "HTML" project → upload ZIP → mark as "This file will be played in the browser".

## Notes
- Images stay in your browser; nothing is uploaded to a server by default.
- Keep it non-graphic; this is for cathartic fun (think Desktop Destroyer vibes).
- You can customize weapons/effects inside `main.js`.
