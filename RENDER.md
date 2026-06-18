# Deploying to Render

This project ships with a `Dockerfile` that builds and runs the Bun server on port `3000`. Render will detect the Dockerfile automatically.

## 1. Build and test locally with Docker

```bash
# Build the Docker image
docker build -t insane-crazy-8 .

# Run it (visit http://localhost:3000)
docker run -p 3000:3000 insane-crazy-8

# Or with a custom admin key
docker run -p 3000:3000 -e ADMIN_KEY=your-secret-key insane-crazy-8
```

## 2. Deploy with the Render dashboard

1. Push this repo to GitHub.
2. In the Render dashboard, click **New +** → **Web Service**.
3. Connect your GitHub repo and select the `main` branch.
4. Render should auto-detect the `Dockerfile` and set:
   - **Runtime**: Docker
   - **Port**: `3000`
5. Click **Deploy Web Service**.

After the build finishes, Render gives you a public URL.

## 3. Deploy with a Render Blueprint (`render.yaml`)

If you prefer Infrastructure-as-Code, use the included `render.yaml`:

1. Push this repo to GitHub.
2. In the Render dashboard, click **New +** → **Blueprint**.
3. Connect your GitHub repo.
4. Render reads `render.yaml` and creates the web service.

## 4. Optional: set environment variables

In the Render dashboard → your service → **Environment**:

| Key       | Value                              |
|-----------|------------------------------------|
| `ADMIN_KEY` | A strong secret for the admin panel |

If you don't set one, the server falls back to the default dev key (`dev-admin-2024`). The included `render.yaml` auto-generates a random `ADMIN_KEY` for you.

Access the admin panel at:

```text
https://<your-render-url>/admin.html?key=<ADMIN_KEY>
```

## Important caveats

- **In-memory state**: All rooms and game state live in RAM. A container restart or redeploy clears every room. This matches the existing local/ngrok design and is fine for casual games.
- **WebSockets on the free plan**: Render free web services spin down after ~15 minutes of inactivity. The first request after spin-down has a cold start (~30 seconds). For a real-time card game, this is fine for occasional play but can interrupt active sessions. Upgrade to a paid plan ($7/month minimum at the time of writing) for an always-on instance.
- **Logs**: Check the Render dashboard Logs tab for real-time server output.
