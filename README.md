# GTA6 TSX Demo (minimal)

Small demo scaffold using React + TypeScript + Vite + React-Three-Fiber.

Quick start:

```bash
npm install
npm run dev
```

Open http://localhost:5173 and use WASD or arrow keys to move the red box.

## Publish

### GitHub + GitHub Pages

1. Create a new empty GitHub repository.
2. Push this project to the `main` branch.
3. In GitHub: `Settings -> Pages -> Build and deployment -> Source`, select `GitHub Actions`.
4. After push, workflow `.github/workflows/deploy-gh-pages.yml` deploys automatically.

Site URL format:

`https://<github-username>.github.io/<repo-name>/`

### Vercel (alternative)

1. Import this repo in Vercel.
2. Framework: `Vite`.
3. Build command: `npm run build`
4. Output directory: `dist`
