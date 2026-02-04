# Contributing Guidelines

## Git Workflow (Gitflow Lite)

We use a simplified gitflow strategy with three types of branches:

### Branch Structure

```
main (production-ready)
  ↑
develop (integration)
  ↑
feature/* or bugfix/* (active work)
```

### Branch Types

- **main**: Production-ready code only. Never commit directly.
- **develop**: Integration branch. All features merge here first.
- **feature/***: New features (e.g., `feature/plus-card-stacking`)
- **bugfix/***: Bug fixes (e.g., `bugfix/reconnection-error`)

### Workflow

1. **Start new work**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. **Work on feature**
   ```bash
   # Make changes
   git add .
   git commit -m "Description of changes"
   ```

3. **Merge to develop**
   ```bash
   git checkout develop
   git merge feature/your-feature-name
   git branch -d feature/your-feature-name
   ```

4. **Release to main** (when ready for production)
   ```bash
   git checkout main
   git merge develop
   git tag -a v1.0.0 -m "Release version 1.0.0"
   ```

### Commit Message Format

Use clear, descriptive commit messages:

```
Brief summary (50 chars or less)

More detailed explanation if needed. Wrap at 72 characters.
- Bullet points are fine
- Use present tense ("Add feature" not "Added feature")
```

### Current Branch

You are on: `feature/phase1-core-server`

This branch will implement:
- Bun HTTP server
- WebSocket handler
- Room manager
- Room code generation
