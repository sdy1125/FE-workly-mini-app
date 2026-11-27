# Run local

```bash
npm install
test -f .env || cp .env.example .env
${EDITOR:-nano} .env
npm run dev
```

# Run for Zalo Mini App

```bash
npm run build
npm run check:deploy
```
