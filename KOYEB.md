# Deploying to Koyeb

This assumes the `Dockerfile` at the repo root builds and runs the app on port `3000`.

## 1. Build and test locally

```bash
# Build the Docker image
docker build -t insane-crazy-8 .

# Run it (visit http://localhost:3000)
docker run -p 3000:3000 insane-crazy-8

# Or with an admin key
docker run -p 3000:3000 -e ADMIN_KEY=your-secret-key insane-crazy-8
```

## 2. Deploy with the Koyeb CLI

Install the CLI and log in:

```bash
koyeb login
```

Connect your GitHub repo and create the app/service. Koyeb will detect the `Dockerfile`:

```bash
koyeb app create insane-crazy-8

koyeb service create web \
  --app insane-crazy-8 \
  --git github.com/<your-username>/crazy-8 \
  --git-branch main \
  --port 3000 \
  --route /:3000 \
  --instance-type nano
```

Wait a few minutes, then:

```bash
koyeb app get insane-crazy-8
```

Open the returned `URL`.

## 3. Optional: set environment variables

```bash
koyeb service update web \
  --app insane-crazy-8 \
  --env ADMIN_KEY=your-secret-admin-key
```

## Notes

- Koyeb’s free tier gives you one always-running nano instance, which is good enough for a small group of friends.
- The app keeps all game state in memory, so a container restart will clear all rooms. That matches the existing design and is fine for casual games.
