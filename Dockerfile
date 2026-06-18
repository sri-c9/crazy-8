# syntax=docker/dockerfile:1

FROM oven/bun:1

WORKDIR /app

# Copy dependency files first to leverage Docker layer caching
COPY package.json bun.lock ./

# Install dependencies
# (We let bun rebuild the lockfile if needed during local dev, but in CI this
# should use the committed bun.lock.)
RUN bun install --frozen-lockfile

# Copy the rest of the source
COPY . .

# Build browser bundles (public/dist/*)
RUN bun run build

# Port the Bun server listens on. Docker platforms (e.g. Render) will map their
# public HTTP traffic to this container port automatically.
EXPOSE 3000
ENV PORT=3000

# Run the Bun server
CMD ["bun", "start"]
