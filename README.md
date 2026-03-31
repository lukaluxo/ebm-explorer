# ⚡ EBM Explorer

## [🚀 Try Me: https://lukaluxo.github.io/ebm-explorer/](https://lukaluxo.github.io/ebm-explorer/)

A gamified daily learning app for **Energy-Based Models** — the framework quietly unifying diffusion models, Hopfield networks, LLMs, and reinforcement learning.

![EBM Explorer](https://img.shields.io/badge/React-18-blue) ![Vite](https://img.shields.io/badge/Vite-6-purple) ![License](https://img.shields.io/badge/license-MIT-green)

## Features

- **📖 Daily Lessons** — 20 bite-sized lessons across 4 weeks, each with a summary, deep dive, and quiz. Earn XP, level up, maintain your streak.
- **🌳 Knowledge Tree** — Visual progress map showing your growing understanding across Foundations → Training → Connections → Applications.
- **📡 Headline Hunter** — AI-powered search for the latest EBM breakthroughs using Claude + web search (requires API key).
- **📄 Weekly Paper Spotlight** — Personalized paper digest that connects recent research to concepts you've already learned.

## Quick Start

```bash
# Clone the repo
git clone https://github.com/lukaluxo/ebm-explorer.git
cd ebm-explorer

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Enabling AI Features

The daily lessons and knowledge tree work out of the box. For the **Headline Hunter** and **Weekly Paper** features, you need an Anthropic API key:

1. Get a key from [console.anthropic.com](https://console.anthropic.com/)
2. Copy `.env.example` to `.env`
3. Add your key:

```env
VITE_ANTHROPIC_API_KEY=sk-ant-your-key-here
```

> ⚠️ **Security note**: `VITE_` env vars are bundled into the client-side code. For production deployment, proxy API calls through a serverless function (see below).

## Deploy to Vercel (Recommended)

### Option A: Static deploy (no AI features)

```bash
npm run build
# Upload the `dist/` folder to Vercel, Netlify, or any static host
```

### Option B: With serverless API proxy (full features)

1. Push to GitHub
2. Connect repo to [vercel.com](https://vercel.com)
3. Add `ANTHROPIC_API_KEY` (without `VITE_` prefix) as an environment variable in Vercel dashboard
4. Create `api/claude.js` serverless function:

```js
// api/claude.js
export default async function handler(req, res) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(req.body),
  });
  const data = await response.json();
  res.status(200).json(data);
}
```

Then update `App.jsx` to call `/api/claude` instead of the Anthropic API directly.

## Curriculum

| Week | Branch | Topics |
|------|--------|--------|
| 1 | ⚡ Foundations | Energy functions, Boltzmann distribution, partition function, score functions |
| 2 | 🔧 Training | Contrastive divergence, Langevin dynamics, score matching, NCE, replay buffers |
| 3 | 🔗 Connections | Diffusion↔EBM, Hopfield networks, Modern Hopfield = Attention, RL, ARM↔EBM bijection |
| 4 | 🚀 Applications | Compositional generation, logical operators, Energy Matching, EDLM, future outlook |

## Tech Stack

- **React 18** + **Vite 6**
- **localStorage** for persistent progress
- **Anthropic Claude API** with web search for AI features
- Zero dependencies beyond React

## License

MIT
