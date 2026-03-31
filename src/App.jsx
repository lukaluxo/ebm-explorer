import { useState, useEffect, useCallback } from "react";

// ═══════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════
// For the AI-powered features (Headline Hunter & Weekly Paper),
// set your Anthropic API key as an environment variable:
//   VITE_ANTHROPIC_API_KEY=sk-ant-...
//
// Without it, the app still works perfectly for the daily
// lessons and knowledge tree — the AI features just won't fire.
//
// ⚠️  For production, proxy API calls through a backend to
//     keep your key secret. See /api/README.md or deploy to
//     Vercel with a serverless function.
// ═══════════════════════════════════════════════

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || "";

// ═══ STORAGE HELPERS (localStorage) ═══
function loadFromStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Storage save failed:", e);
  }
}

// ═══ FULL KNOWLEDGE CURRICULUM (20 LESSONS, 4 WEEKS) ═══
const CURRICULUM = [
  // Week 1: Foundations
  { id: 1, day: 1, week: 1, branch: "foundations", title: "What is Energy?", emoji: "⚡", summary: "An EBM assigns a scalar energy E(x) to every configuration x. Low energy = likely, high energy = unlikely. That's the whole idea.", detail: "Think of a ball on a hilly landscape. It naturally rolls to the lowest point — a valley. Energy-Based Models work the same way: they learn an energy function over data, where observed data sits in valleys (low energy) and unlikely configurations sit on peaks (high energy). The probability of any configuration is p(x) ∝ exp(−E(x)).", quiz: "In an EBM, data points from the training set should have:", quizOptions: ["High energy", "Low energy", "Zero energy", "Random energy"], quizAnswer: 1 },
  { id: 2, day: 2, week: 1, branch: "foundations", title: "The Boltzmann Connection", emoji: "🌡️", summary: "EBMs borrow directly from statistical physics. The Boltzmann distribution p(x) = exp(−E(x))/Z is the bridge.", detail: "Ludwig Boltzmann showed that in a physical system at thermal equilibrium, the probability of a state is exponentially related to its energy. EBMs use this exact same math: p(x) = exp(−E(x)) / Z, where Z = ∫exp(−E(x))dx is the partition function. The catch? Z is almost always intractable to compute.", quiz: "What is the partition function Z?", quizOptions: ["The energy of the most likely state", "A normalizing constant that makes probabilities sum to 1", "The gradient of the energy", "The loss function"], quizAnswer: 1 },
  { id: 3, day: 3, week: 1, branch: "foundations", title: "The Partition Function Problem", emoji: "🧮", summary: "Computing Z requires summing exp(−E(x)) over ALL possible configurations — usually impossible.", detail: "For an image of just 32×32 pixels with 256 values each, the number of possible configurations is 256^(32×32×3) — astronomically large. You can't enumerate them all. This intractable partition function is the central challenge of EBMs, and most of the field's innovations are clever ways to train and sample without ever computing Z.", quiz: "Why is the partition function intractable?", quizOptions: ["It's always zero", "It requires summing over all possible configurations", "Neural networks can't compute divisions", "It only works for small images"], quizAnswer: 1 },
  { id: 4, day: 4, week: 1, branch: "foundations", title: "Energy vs. Other Generative Models", emoji: "⚖️", summary: "GANs, VAEs, and flows all make architectural compromises. EBMs trade those for sampling difficulty.", detail: "GANs need a separate discriminator and suffer mode collapse. VAEs require an encoder-decoder pair and produce blurry outputs. Normalizing flows need invertible architectures. EBMs have none of these restrictions — ANY function mapping input to a scalar works as an energy function. The price? You need MCMC or other iterative methods to generate samples.", quiz: "What is the main advantage of EBMs over GANs and VAEs?", quizOptions: ["Faster training", "No architectural restrictions on the energy function", "They always produce better images", "They don't need GPUs"], quizAnswer: 1 },
  { id: 5, day: 5, week: 1, branch: "foundations", title: "Score Functions", emoji: "📐", summary: "The score ∇ₓ log p(x) = −∇ₓ E(x) gives you the gradient of the energy landscape — no Z needed!", detail: "Here's a beautiful trick: the gradient of log p(x) with respect to x equals the negative gradient of E(x), because the partition function Z is a constant that vanishes under differentiation. This 'score function' tells you the direction toward lower energy (higher probability) at any point — and you never need to compute Z. This insight is the foundation of score matching and diffusion models.", quiz: "Why don't score functions require computing Z?", quizOptions: ["They use a different formula", "Z is a constant that disappears when you take gradients", "Score functions approximate Z", "They only work for small models"], quizAnswer: 1 },
  // Week 2: Training
  { id: 6, day: 1, week: 2, branch: "training", title: "Contrastive Divergence", emoji: "🔄", summary: "Hinton's trick: approximate the gradient of the log-likelihood using short MCMC chains instead of running to convergence.", detail: "Maximum likelihood training of EBMs requires samples from the model distribution — which requires long MCMC chains. Geoffrey Hinton's contrastive divergence (CD) shortcut: start from a data point, run just a few steps of MCMC, and use that 'negative sample' to approximate the gradient. CD-1 (just one step) made training RBMs practical and sparked the deep learning revolution.", quiz: "Contrastive divergence approximates the gradient by:", quizOptions: ["Computing the exact partition function", "Running short MCMC chains from data points", "Using a separate discriminator network", "Ignoring the negative phase entirely"], quizAnswer: 1 },
  { id: 7, day: 2, week: 2, branch: "training", title: "Langevin Dynamics", emoji: "🌊", summary: "Sample from an EBM by following the energy gradient downhill, plus noise. It's gradient descent with randomness.", detail: "Langevin dynamics generates samples by iterating: x_{t+1} = x_t − (ε/2)∇E(x_t) + √ε·noise. The gradient term pushes toward low energy regions; the noise term ensures exploration and prevents collapse to a single mode. Given enough steps with a decreasing step size, this provably converges to samples from the true distribution — no Z required.", quiz: "What role does noise play in Langevin dynamics?", quizOptions: ["It speeds up convergence", "It ensures exploration and prevents mode collapse", "It reduces the energy function", "It computes the partition function"], quizAnswer: 1 },
  { id: 8, day: 3, week: 2, branch: "training", title: "Score Matching", emoji: "🎯", summary: "Bypass Z entirely: train the model to match the score function ∇ₓ log p(x) of the data distribution.", detail: "Aapo Hyvärinen showed that you can train an EBM by minimizing the difference between the model's score and the data's score — without ever needing samples from the model or computing Z. Denoising score matching (Vincent 2011) simplifies this further: add noise to data, then train the model to denoise. This is exactly what diffusion models do!", quiz: "Score matching trains the model to match:", quizOptions: ["The energy values on data points", "The gradient of log-probability (the score)", "The partition function", "The noise distribution"], quizAnswer: 1 },
  { id: 9, day: 4, week: 2, branch: "training", title: "Noise Contrastive Estimation", emoji: "🔍", summary: "Turn density estimation into classification: train the model to distinguish real data from noise.", detail: "NCE (Gutmann & Hyvärinen 2010) avoids computing Z by reframing the problem: given a data point and a noise sample, can the model tell which is which? The discriminative objective implicitly learns the correct energy function. NVIDIA's 2025 EDLM paper uses NCE to fine-tune bidirectional transformers into energy functions for language modeling.", quiz: "NCE avoids the partition function by:", quizOptions: ["Ignoring it", "Turning density estimation into a classification problem", "Using a variational bound", "Computing it with Monte Carlo"], quizAnswer: 1 },
  { id: 10, day: 5, week: 2, branch: "training", title: "Replay Buffers", emoji: "💾", summary: "Store past MCMC samples and reuse them as starting points for future chains — dramatically improving training stability.", detail: "Du & Mordatch (2019) showed a crucial practical trick: maintain a buffer of past negative samples and use them to initialize new MCMC chains. This means chains don't start from scratch each iteration, leading to much better samples with fewer steps. Combined with Langevin dynamics from random noise, this made training EBMs on complex image distributions practical for the first time.", quiz: "Replay buffers improve EBM training by:", quizOptions: ["Reducing memory usage", "Providing better starting points for MCMC chains", "Computing Z exactly", "Replacing the energy function"], quizAnswer: 1 },
  // Week 3: Connections
  { id: 11, day: 1, week: 3, branch: "connections", title: "Diffusion Models Are EBMs", emoji: "🌀", summary: "Diffusion models learn score functions at each noise level — they're training a sequence of EBMs!", detail: "Score-based diffusion models (Song & Ermon 2019, Ho et al. 2020) learn ∇ₓ log p_t(x) at each noise level t. Since the score is the negative gradient of the energy, each denoising step is implicitly defining an energy landscape. The entire diffusion process can be viewed as a sequence of energy-based models, with sampling following the energy gradients from noise to data.", quiz: "Diffusion models relate to EBMs because they learn:", quizOptions: ["Energy functions directly", "Score functions, which are energy gradients", "Partition functions at each step", "Discriminator networks"], quizAnswer: 1 },
  { id: 12, day: 2, week: 3, branch: "connections", title: "Hopfield Networks", emoji: "🧲", summary: "The original energy-based neural network: memories are stored as energy minima, retrieval is energy minimization.", detail: "John Hopfield (1982, Nobel Prize 2024) showed that a recurrent neural network with symmetric weights has an energy function that always decreases during dynamics. Stored patterns become local energy minima — 'attractors.' Given a partial or noisy input, the network rolls downhill to the nearest memory. This was the first explicit use of energy minimization for computation in neural networks.", quiz: "In Hopfield networks, stored memories correspond to:", quizOptions: ["High energy states", "Local energy minima (attractors)", "Random configurations", "The partition function"], quizAnswer: 1 },
  { id: 13, day: 3, week: 3, branch: "connections", title: "Modern Hopfield = Attention", emoji: "🔗", summary: "Ramsauer et al. (2020) proved that the update rule of modern Hopfield networks IS transformer self-attention.", detail: "Modern (dense) Hopfield networks use exponential energy functions instead of quadratic ones, achieving exponential memory capacity. Their update rule involves computing softmax over stored patterns weighted by similarity to the query — which is exactly the attention mechanism in transformers. This means every transformer layer is performing energy minimization!", quiz: "Modern Hopfield networks connect to transformers through:", quizOptions: ["Backpropagation", "The softmax attention mechanism = Hopfield update rule", "Weight sharing", "Batch normalization"], quizAnswer: 1 },
  { id: 14, day: 4, week: 3, branch: "connections", title: "EBMs and Reinforcement Learning", emoji: "🎮", summary: "The soft Bellman equation in max-entropy RL is a special case of energy-based inference.", detail: "In maximum entropy reinforcement learning, the optimal policy is a Boltzmann distribution over actions: π*(a|s) ∝ exp(Q*(s,a)/τ). This is exactly an EBM! The Q-function is the negative energy, and the temperature τ controls exploration. The 2025 ARM↔EBM bijection paper shows this connection extends to autoregressive language models.", quiz: "In max-entropy RL, the optimal policy is:", quizOptions: ["A deterministic function", "A Boltzmann distribution (an EBM) over actions", "A uniform distribution", "A Gaussian distribution"], quizAnswer: 1 },
  { id: 15, day: 5, week: 3, branch: "connections", title: "LLMs Are Secretly EBMs", emoji: "🤫", summary: "Blondel et al. (Dec 2025) proved an exact bijection between autoregressive models and energy-based models.", detail: "Every autoregressive model p(x₁)p(x₂|x₁)...p(xₙ|x₁...xₙ₋₁) defines an energy function E(x) = −log p(x) over full sequences. Conversely, every EBM can be decomposed autoregressively via the chain rule. This bijection maps to the soft Bellman equation, revealing that next-token prediction implicitly performs 'planning' by encoding global sequence quality into local predictions.", quiz: "The ARM↔EBM bijection implies that next-token prediction:", quizOptions: ["Only looks at the next token", "Implicitly encodes global sequence quality (planning)", "Cannot capture long-range dependencies", "Is equivalent to random sampling"], quizAnswer: 1 },
  // Week 4: Compositionality & Applications
  { id: 16, day: 1, week: 4, branch: "applications", title: "Compositional Generation", emoji: "🧩", summary: "Add energies together to compose concepts: E_total = E_red + E_cube → generates red cubes, even if never seen together.", detail: "If E₁(x) captures 'redness' and E₂(x) captures 'cube-ness', then E₁(x) + E₂(x) captures 'red cube' — corresponding to p(x) ∝ p₁(x)·p₂(x), a product of experts. Yilun Du showed this enables generating novel attribute combinations never seen during training, by composing independently trained energy functions at inference time.", quiz: "Composing two EBMs by adding their energies corresponds to:", quizOptions: ["Averaging their outputs", "A product of experts (intersection of concepts)", "Training a new model", "Random combination"], quizAnswer: 1 },
  { id: 17, day: 2, week: 4, branch: "applications", title: "Negation & Logic", emoji: "🚫", summary: "EBMs support logical operators: AND (add energies), NOT (negate energy), enabling Boolean concept algebra.", detail: "Beyond conjunction (adding energies), you can negate a concept by flipping the sign: E_not_A(x) = −E_A(x). This pushes samples AWAY from concept A. You can build full logical expressions: 'red AND round AND NOT large' = E_red + E_round − E_large. No other generative framework supports this kind of compositional logic so naturally.", quiz: "To generate samples that are NOT concept A, you:", quizOptions: ["Train a new model without A", "Negate the energy: use −E_A(x)", "Remove A from the dataset", "Use a discriminator"], quizAnswer: 1 },
  { id: 18, day: 3, week: 4, branch: "applications", title: "Energy Matching (2025)", emoji: "🌟", summary: "NeurIPS 2025 breakthrough: combines optimal transport flow with EBM flexibility using a single scalar field.", detail: "Energy Matching (Balcerak et al.) uses optimal transport paths far from data (fast, deterministic movement) and Boltzmann equilibrium near data (proper density modeling). A single time-independent scalar potential — not a vector field, not a time-conditioned network — does both. It achieves FID ≈ 3.3 on CIFAR-10, vastly outperforming previous EBMs, and even demonstrates controlled protein design.", quiz: "Energy Matching's key innovation is:", quizOptions: ["Using GANs for training", "A single time-independent scalar field that combines OT and EBMs", "A new type of neural network", "Training on larger datasets"], quizAnswer: 1 },
  { id: 19, day: 4, week: 4, branch: "applications", title: "EDLM: Energy for Language", emoji: "📝", summary: "NVIDIA's EDLM uses an energy function over full sequences to fix discrete diffusion models' approximation errors.", detail: "Discrete diffusion models for text make an independence assumption at each denoising step that degrades quality. EDLM introduces a full-sequence EBM (either from a pretrained autoregressive model or fine-tuned via NCE) to correct this approximation. The result: diffusion language models that significantly outperform prior art and approach autoregressive perplexity, with 1.3× faster sampling.", quiz: "EDLM improves discrete diffusion LMs by:", quizOptions: ["Using larger models", "Adding a full-sequence energy function to correct approximation errors", "Training for longer", "Using continuous instead of discrete tokens"], quizAnswer: 1 },
  { id: 20, day: 5, week: 4, branch: "applications", title: "The Road Ahead", emoji: "🔮", summary: "EBMs are becoming the unifying language of generative AI — diffusion, attention, LLMs, and RL all speak 'energy.'", detail: "The boundaries are dissolving: diffusion models learn energy gradients, transformer attention is Hopfield energy minimization, LLMs have exact EBM duals, and RL optimal policies are Boltzmann distributions. Energy-based thinking may become less a specific model class and more the theoretical lingua franca of all generative AI — like how statistical mechanics unifies physics.", quiz: "The emerging 'unifying thesis' of EBMs suggests:", quizOptions: ["EBMs will replace all other models", "Energy-based principles underlie most of modern generative AI", "EBMs are only useful for physics", "Other models are unrelated to energy"], quizAnswer: 1 },
];

const BRANCHES = {
  foundations: { label: "Foundations", color: "#f59e0b", icon: "⚡" },
  training: { label: "Training", color: "#22d3ee", icon: "🔧" },
  connections: { label: "Connections", color: "#a78bfa", icon: "🔗" },
  applications: { label: "Applications", color: "#f43f5e", icon: "🚀" },
};

const WEEK_LABELS = [
  "Foundations",
  "Training Methods",
  "Deep Connections",
  "Frontiers & Applications",
];

// ═══ API HELPER ═══
async function callClaude(prompt) {
  if (!API_KEY) {
    throw new Error("No API key configured. Set VITE_ANTHROPIC_API_KEY in your .env file.");
  }
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API error ${response.status}: ${errText}`);
  }
  return response.json();
}

function extractTextFromResponse(data) {
  return data.content
    .map((item) => (item.type === "text" ? item.text : ""))
    .filter(Boolean)
    .join("\n");
}

function parseJSON(text) {
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

// ═══ MAIN APP ═══
export default function App() {
  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState("today");
  const [quizSelection, setQuizSelection] = useState(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [headlines, setHeadlines] = useState(null);
  const [headlinesLoading, setHeadlinesLoading] = useState(false);
  const [headlinesError, setHeadlinesError] = useState(null);
  const [weeklySummary, setWeeklySummary] = useState(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyError, setWeeklyError] = useState(null);
  const [celebrateAnim, setCelebrateAnim] = useState(false);

  // ── Initialize ──
  useEffect(() => {
    const saved = loadFromStorage("ebm-game-state");
    if (saved) {
      setGameState(saved);
    } else {
      const init = {
        currentDay: 1,
        completedDays: [],
        quizResults: {},
        streak: 0,
        lastActiveDate: new Date().toDateString(),
        xp: 0,
        level: 1,
      };
      setGameState(init);
      saveToStorage("ebm-game-state", init);
    }
    const savedHL = loadFromStorage("ebm-headlines");
    if (savedHL) setHeadlines(savedHL);
    const savedWS = loadFromStorage("ebm-weekly-summary");
    if (savedWS) setWeeklySummary(savedWS);
    setLoading(false);
  }, []);

  const persist = useCallback((newState) => {
    setGameState(newState);
    saveToStorage("ebm-game-state", newState);
  }, []);

  // ── Current lesson ──
  const todayLesson = gameState
    ? CURRICULUM.find((c) => c.id === gameState.currentDay) ||
      CURRICULUM[CURRICULUM.length - 1]
    : null;
  const isCompleted = gameState?.completedDays?.includes(gameState?.currentDay);

  // ── Complete a day ──
  const completeDay = (correct) => {
    if (!gameState) return;
    const xpGain = correct ? 50 : 20;
    const newCompleted = [
      ...new Set([...gameState.completedDays, gameState.currentDay]),
    ];
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const wasActiveYesterday = gameState.lastActiveDate === yesterday;
    const newStreak =
      wasActiveYesterday || gameState.lastActiveDate === today
        ? gameState.streak + (gameState.lastActiveDate === today ? 0 : 1)
        : 1;
    const newXP = gameState.xp + xpGain;
    const newLevel = Math.floor(newXP / 200) + 1;

    const newState = {
      ...gameState,
      completedDays: newCompleted,
      quizResults: {
        ...gameState.quizResults,
        [gameState.currentDay]: correct,
      },
      streak: newStreak,
      lastActiveDate: today,
      xp: newXP,
      level: newLevel,
      currentDay: Math.min(gameState.currentDay + 1, CURRICULUM.length),
    };
    persist(newState);
    setCelebrateAnim(true);
    setTimeout(() => setCelebrateAnim(false), 1500);
  };

  const handleQuizSubmit = () => {
    if (quizSelection === null) return;
    setQuizSubmitted(true);
    const correct = quizSelection === todayLesson.quizAnswer;
    setTimeout(() => completeDay(correct), 1200);
  };

  // ── Headline Hunter ──
  const fetchHeadlines = async () => {
    setHeadlinesLoading(true);
    setHeadlinesError(null);
    try {
      const data = await callClaude(
        `Search for the latest news and breakthroughs about energy-based models (EBMs) in machine learning and AI from the past week. Include developments about: diffusion models as EBMs, Hopfield networks, energy matching, compositional generation, score-based models, and EBM applications in protein design or language modeling.

Return ONLY a JSON array of 4-6 headline objects. No markdown, no backticks, no preamble. Each object must have:
- "title": headline string (max 80 chars)
- "source": source name
- "date": approximate date string
- "summary": 1-2 sentence summary (max 150 chars)
- "relevance": one of ["foundational", "training", "application", "breakthrough"]`
      );
      const text = extractTextFromResponse(data);
      const parsed = parseJSON(text);
      const hlData = { items: parsed, fetchedAt: new Date().toISOString() };
      setHeadlines(hlData);
      saveToStorage("ebm-headlines", hlData);
    } catch (e) {
      console.error("Headlines fetch error:", e);
      setHeadlinesError(e.message);
    }
    setHeadlinesLoading(false);
  };

  // ── Weekly Paper ──
  const fetchWeeklySummary = async () => {
    setWeeklyLoading(true);
    setWeeklyError(null);
    const completedLessons = CURRICULUM.filter((c) =>
      gameState?.completedDays?.includes(c.id)
    );
    const currentWeek = todayLesson?.week || 1;
    try {
      const data = await callClaude(
        `You are an AI research digest curator. The user is learning about Energy-Based Models and is currently on week ${currentWeek} of their learning journey. They've completed ${completedLessons.length} lessons so far covering: ${completedLessons.map((l) => l.title).join(", ") || "none yet"}.

Search for and find the single most interesting/impactful paper about energy-based models from the past 1-2 weeks. Then write a concise, engaging summary.

Return ONLY a JSON object (no markdown, no backticks, no preamble) with:
- "paperTitle": the paper title
- "authors": author list (abbreviated)
- "venue": where published or arXiv
- "tldr": 2-sentence plain-language summary
- "whyItMatters": 2-sentence explanation of significance
- "keyInsight": one memorable takeaway sentence
- "connectionToLearning": which of their completed topics this connects to`
      );
      const text = extractTextFromResponse(data);
      const parsed = parseJSON(text);
      setWeeklySummary(parsed);
      saveToStorage("ebm-weekly-summary", parsed);
    } catch (e) {
      console.error("Weekly summary error:", e);
      setWeeklyError(e.message);
    }
    setWeeklyLoading(false);
  };

  // ── Reset ──
  const resetProgress = () => {
    if (!window.confirm("Reset all progress? This cannot be undone.")) return;
    const init = {
      currentDay: 1,
      completedDays: [],
      quizResults: {},
      streak: 0,
      lastActiveDate: new Date().toDateString(),
      xp: 0,
      level: 1,
    };
    persist(init);
    setQuizSelection(null);
    setQuizSubmitted(false);
    setShowDetail(false);
  };

  // ── Loading State ──
  if (loading || !gameState) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#0a0908",
          color: "#fafaf9",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⚡</div>
          <div
            style={{
              fontSize: "0.8rem",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "#78716c",
            }}
          >
            Loading your knowledge tree...
          </div>
        </div>
      </div>
    );
  }

  const progress = (gameState.completedDays.length / CURRICULUM.length) * 100;
  const hasApiKey = !!API_KEY;

  const relevanceColors = {
    foundational: "#f59e0b",
    training: "#22d3ee",
    application: "#f43f5e",
    breakthrough: "#a78bfa",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0908",
        color: "#fafaf9",
        fontFamily: "'Instrument Sans', system-ui, sans-serif",
      }}
    >
      {/* ═══ TOP BAR ═══ */}
      <div
        style={{
          borderBottom: "1px solid #1c1917",
          padding: "0.75rem 1.25rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "1.3rem" }}>⚡</span>
          <span
            style={{
              fontWeight: 700,
              fontSize: "0.95rem",
              letterSpacing: "-0.01em",
            }}
          >
            EBM Explorer
          </span>
          <span
            style={{
              fontSize: "0.65rem",
              background: "#292524",
              padding: "0.2rem 0.6rem",
              borderRadius: "100px",
              color: "#a8a29e",
              fontFamily: "monospace",
            }}
          >
            Lv.{gameState.level}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            fontSize: "0.72rem",
            color: "#78716c",
            fontFamily: "monospace",
          }}
        >
          <span>🔥 {gameState.streak}d streak</span>
          <span>✨ {gameState.xp} XP</span>
          <span>
            {gameState.completedDays.length}/{CURRICULUM.length} lessons
          </span>
        </div>
      </div>

      {/* ═══ PROGRESS BAR ═══ */}
      <div style={{ height: "3px", background: "#1c1917" }}>
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background:
              "linear-gradient(90deg, #f59e0b, #22d3ee, #a78bfa, #f43f5e)",
            borderRadius: "0 2px 2px 0",
            transition: "width 0.5s ease",
          }}
        />
      </div>

      {/* ═══ NAV TABS ═══ */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #1c1917",
          overflow: "auto",
        }}
      >
        {[
          { id: "today", label: "Today's Lesson", icon: "📖" },
          { id: "tree", label: "Knowledge Tree", icon: "🌳" },
          { id: "headlines", label: "Headline Hunter", icon: "📡" },
          { id: "weekly", label: "Weekly Paper", icon: "📄" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveView(tab.id);
              setQuizSelection(null);
              setQuizSubmitted(false);
              setShowDetail(false);
            }}
            style={{
              flex: "1",
              padding: "0.8rem 0.5rem",
              background: activeView === tab.id ? "#1c1917" : "transparent",
              border: "none",
              borderBottom:
                activeView === tab.id
                  ? "2px solid #f59e0b"
                  : "2px solid transparent",
              color: activeView === tab.id ? "#fafaf9" : "#78716c",
              fontSize: "0.72rem",
              fontFamily: "inherit",
              cursor: "pointer",
              transition: "all 0.2s",
              whiteSpace: "nowrap",
              letterSpacing: "0.02em",
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ CONTENT ═══ */}
      <div
        style={{
          maxWidth: "700px",
          margin: "0 auto",
          padding: "1.5rem 1.25rem",
          minHeight: "calc(100vh - 140px)",
        }}
      >
        {/* ── TODAY'S LESSON ── */}
        {activeView === "today" && todayLesson && (
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "0.3rem",
              }}
            >
              <span
                style={{
                  fontSize: "0.6rem",
                  fontFamily: "monospace",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: BRANCHES[todayLesson.branch]?.color || "#f59e0b",
                }}
              >
                Week {todayLesson.week} · Day {todayLesson.day} —{" "}
                {BRANCHES[todayLesson.branch]?.label}
              </span>
            </div>

            <h2
              style={{
                fontSize: "1.7rem",
                fontWeight: 700,
                marginBottom: "0.4rem",
                lineHeight: 1.2,
              }}
            >
              <span style={{ marginRight: "0.5rem" }}>{todayLesson.emoji}</span>
              {todayLesson.title}
            </h2>

            {/* Summary Card */}
            <div
              style={{
                background: "#1c1917",
                border: "1px solid #292524",
                borderRadius: "12px",
                padding: "1.5rem",
                marginTop: "1.25rem",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "2px",
                  background: `linear-gradient(90deg, ${BRANCHES[todayLesson.branch]?.color || "#f59e0b"}, transparent)`,
                }}
              />
              <div
                style={{
                  fontSize: "0.65rem",
                  fontFamily: "monospace",
                  color: "#78716c",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  marginBottom: "0.75rem",
                }}
              >
                Today's Bite
              </div>
              <p style={{ fontSize: "1rem", lineHeight: 1.7, color: "#d6d3d1" }}>
                {todayLesson.summary}
              </p>

              {!showDetail && (
                <button
                  onClick={() => setShowDetail(true)}
                  style={{
                    marginTop: "1rem",
                    background: "none",
                    border: "1px solid #292524",
                    borderRadius: "8px",
                    color: "#a8a29e",
                    padding: "0.5rem 1rem",
                    fontSize: "0.78rem",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "all 0.2s",
                  }}
                  onMouseOver={(e) => {
                    e.target.style.borderColor = "#f59e0b";
                    e.target.style.color = "#f59e0b";
                  }}
                  onMouseOut={(e) => {
                    e.target.style.borderColor = "#292524";
                    e.target.style.color = "#a8a29e";
                  }}
                >
                  Go deeper →
                </button>
              )}

              {showDetail && (
                <div
                  style={{
                    marginTop: "1.25rem",
                    paddingTop: "1.25rem",
                    borderTop: "1px solid #292524",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.65rem",
                      fontFamily: "monospace",
                      color: "#78716c",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      marginBottom: "0.75rem",
                    }}
                  >
                    Deep Dive
                  </div>
                  <p
                    style={{
                      fontSize: "0.9rem",
                      lineHeight: 1.75,
                      color: "#a8a29e",
                    }}
                  >
                    {todayLesson.detail}
                  </p>
                </div>
              )}
            </div>

            {/* Quiz */}
            {!isCompleted && (
              <div
                style={{
                  background: "#1c1917",
                  border: "1px solid #292524",
                  borderRadius: "12px",
                  padding: "1.5rem",
                  marginTop: "1rem",
                }}
              >
                <div
                  style={{
                    fontSize: "0.65rem",
                    fontFamily: "monospace",
                    color: "#a78bfa",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    marginBottom: "0.75rem",
                  }}
                >
                  🧠 Quick Check
                </div>
                <p
                  style={{
                    fontSize: "0.92rem",
                    marginBottom: "1rem",
                    color: "#d6d3d1",
                  }}
                >
                  {todayLesson.quiz}
                </p>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  {todayLesson.quizOptions.map((opt, i) => {
                    let bg = quizSelection === i ? "#292524" : "transparent";
                    let border = quizSelection === i ? "#78716c" : "#292524";
                    let textColor = "#a8a29e";
                    if (quizSubmitted) {
                      if (i === todayLesson.quizAnswer) {
                        bg = "#052e16";
                        border = "#22c55e";
                        textColor = "#4ade80";
                      } else if (
                        i === quizSelection &&
                        i !== todayLesson.quizAnswer
                      ) {
                        bg = "#450a0a";
                        border = "#ef4444";
                        textColor = "#fca5a5";
                      }
                    }
                    return (
                      <button
                        key={i}
                        onClick={() => !quizSubmitted && setQuizSelection(i)}
                        style={{
                          textAlign: "left",
                          background: bg,
                          border: `1px solid ${border}`,
                          borderRadius: "8px",
                          padding: "0.65rem 1rem",
                          color: textColor,
                          fontSize: "0.82rem",
                          cursor: quizSubmitted ? "default" : "pointer",
                          fontFamily: "inherit",
                          transition: "all 0.2s",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.6rem",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "monospace",
                            fontSize: "0.7rem",
                            opacity: 0.5,
                          }}
                        >
                          {String.fromCharCode(65 + i)}
                        </span>
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {!quizSubmitted && (
                  <button
                    onClick={handleQuizSubmit}
                    disabled={quizSelection === null}
                    style={{
                      marginTop: "1rem",
                      background:
                        quizSelection !== null ? "#f59e0b" : "#292524",
                      border: "none",
                      borderRadius: "8px",
                      color: quizSelection !== null ? "#0a0908" : "#78716c",
                      padding: "0.6rem 1.5rem",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      cursor: quizSelection !== null ? "pointer" : "default",
                      fontFamily: "inherit",
                      transition: "all 0.2s",
                    }}
                  >
                    Check Answer
                  </button>
                )}
                {quizSubmitted && (
                  <div
                    style={{
                      marginTop: "1rem",
                      fontSize: "0.85rem",
                      color:
                        quizSelection === todayLesson.quizAnswer
                          ? "#4ade80"
                          : "#fca5a5",
                    }}
                  >
                    {quizSelection === todayLesson.quizAnswer
                      ? "✅ Correct! +50 XP"
                      : `❌ The answer was: ${todayLesson.quizOptions[todayLesson.quizAnswer]}. +20 XP for trying!`}
                  </div>
                )}
              </div>
            )}

            {isCompleted && (
              <div
                style={{
                  background: "#052e16",
                  border: "1px solid #166534",
                  borderRadius: "12px",
                  padding: "1.25rem",
                  marginTop: "1rem",
                  textAlign: "center",
                }}
              >
                <span style={{ fontSize: "1.3rem" }}>✅</span>
                <p
                  style={{
                    fontSize: "0.85rem",
                    color: "#4ade80",
                    marginTop: "0.3rem",
                  }}
                >
                  Lesson complete! Come back for the next one.
                </p>
              </div>
            )}

            {celebrateAnim && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                  zIndex: 999,
                }}
              >
                <div
                  style={{
                    fontSize: "4rem",
                    animation: "celebratePop 1.5s ease forwards",
                  }}
                >
                  ⚡
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── KNOWLEDGE TREE ── */}
        {activeView === "tree" && (
          <div>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              🌳 Your Knowledge Tree
            </h2>
            <p
              style={{
                fontSize: "0.82rem",
                color: "#78716c",
                marginBottom: "1.5rem",
              }}
            >
              Each completed lesson grows a node. Watch your understanding branch
              out!
            </p>

            {[1, 2, 3, 4].map((week) => {
              const weekLessons = CURRICULUM.filter((c) => c.week === week);
              const branch = weekLessons[0]?.branch;
              const branchInfo = BRANCHES[branch] || {};
              const completedInWeek = weekLessons.filter((c) =>
                gameState.completedDays.includes(c.id)
              ).length;

              return (
                <div key={week} style={{ marginBottom: "1.5rem" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.6rem",
                      marginBottom: "0.75rem",
                    }}
                  >
                    <span style={{ fontSize: "1rem" }}>{branchInfo.icon}</span>
                    <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                      Week {week}: {WEEK_LABELS[week - 1]}
                    </span>
                    <span
                      style={{
                        fontSize: "0.65rem",
                        fontFamily: "monospace",
                        color: branchInfo.color,
                        marginLeft: "auto",
                      }}
                    >
                      {completedInWeek}/{weekLessons.length}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                    {weekLessons.map((lesson) => {
                      const done = gameState.completedDays.includes(lesson.id);
                      const isCurrent = gameState.currentDay === lesson.id;
                      const quizResult = gameState.quizResults[lesson.id];

                      return (
                        <div
                          key={lesson.id}
                          style={{
                            flex: "1 1 120px",
                            minWidth: "120px",
                            maxWidth: "160px",
                            background: done
                              ? "#1c1917"
                              : isCurrent
                                ? "#1c1917"
                                : "#0f0e0d",
                            border: `1px solid ${isCurrent ? branchInfo.color : done ? "#292524" : "#1c1917"}`,
                            borderRadius: "10px",
                            padding: "0.75rem",
                            opacity: done || isCurrent ? 1 : 0.4,
                            position: "relative",
                            transition: "all 0.3s",
                          }}
                        >
                          {done && (
                            <div
                              style={{
                                position: "absolute",
                                top: "0.4rem",
                                right: "0.5rem",
                                fontSize: "0.7rem",
                              }}
                            >
                              {quizResult ? "✅" : "☑️"}
                            </div>
                          )}
                          <div
                            style={{ fontSize: "1.1rem", marginBottom: "0.3rem" }}
                          >
                            {lesson.emoji}
                          </div>
                          <div
                            style={{
                              fontSize: "0.72rem",
                              fontWeight: 600,
                              lineHeight: 1.3,
                              color: done ? "#d6d3d1" : "#78716c",
                            }}
                          >
                            {lesson.title}
                          </div>
                          <div
                            style={{
                              fontSize: "0.6rem",
                              fontFamily: "monospace",
                              color: "#57534e",
                              marginTop: "0.3rem",
                            }}
                          >
                            Day {lesson.day}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {week < 4 && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        padding: "0.5rem 0",
                      }}
                    >
                      <div
                        style={{
                          width: "1px",
                          height: "20px",
                          background:
                            completedInWeek === weekLessons.length
                              ? branchInfo.color
                              : "#292524",
                          opacity: 0.5,
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            <div style={{ marginTop: "2rem", textAlign: "center" }}>
              <button
                onClick={resetProgress}
                style={{
                  background: "none",
                  border: "1px solid #292524",
                  borderRadius: "8px",
                  color: "#57534e",
                  padding: "0.4rem 1rem",
                  fontSize: "0.7rem",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Reset Progress
              </button>
            </div>
          </div>
        )}

        {/* ── HEADLINE HUNTER ── */}
        {activeView === "headlines" && (
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "0.5rem",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <h2 style={{ fontSize: "1.4rem", fontWeight: 700 }}>
                📡 Headline Hunter
              </h2>
              <button
                onClick={fetchHeadlines}
                disabled={headlinesLoading || !hasApiKey}
                style={{
                  background: headlinesLoading ? "#292524" : hasApiKey ? "#f59e0b" : "#292524",
                  border: "none",
                  borderRadius: "8px",
                  color: headlinesLoading ? "#78716c" : hasApiKey ? "#0a0908" : "#78716c",
                  padding: "0.5rem 1.2rem",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: headlinesLoading || !hasApiKey ? "default" : "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                {headlinesLoading ? (
                  <>
                    <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span> Scanning...
                  </>
                ) : (
                  "🔍 Hunt for Headlines"
                )}
              </button>
            </div>
            <p
              style={{
                fontSize: "0.82rem",
                color: "#78716c",
                marginBottom: "1.5rem",
              }}
            >
              AI-powered search for the latest EBM breakthroughs, papers, and
              news.
            </p>

            {!hasApiKey && (
              <div
                style={{
                  background: "#1c1917",
                  border: "1px solid #292524",
                  borderRadius: "12px",
                  padding: "1.25rem",
                  marginBottom: "1rem",
                }}
              >
                <div
                  style={{
                    fontSize: "0.65rem",
                    fontFamily: "monospace",
                    color: "#f59e0b",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    marginBottom: "0.5rem",
                  }}
                >
                  ⚙️ Setup Required
                </div>
                <p style={{ fontSize: "0.82rem", color: "#a8a29e", lineHeight: 1.6 }}>
                  To enable AI-powered headline hunting, create a{" "}
                  <code
                    style={{
                      background: "#292524",
                      padding: "0.1rem 0.4rem",
                      borderRadius: "4px",
                      fontSize: "0.78rem",
                      fontFamily: "monospace",
                    }}
                  >
                    .env
                  </code>{" "}
                  file in the project root with:
                </p>
                <pre
                  style={{
                    background: "#0f0e0d",
                    border: "1px solid #292524",
                    borderRadius: "8px",
                    padding: "0.75rem 1rem",
                    marginTop: "0.75rem",
                    fontSize: "0.75rem",
                    fontFamily: "monospace",
                    color: "#22d3ee",
                    overflowX: "auto",
                  }}
                >
                  VITE_ANTHROPIC_API_KEY=sk-ant-your-key-here
                </pre>
              </div>
            )}

            {headlinesError && (
              <div style={{ background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: "12px", padding: "1rem", marginBottom: "1rem", fontSize: "0.82rem", color: "#fca5a5" }}>
                {headlinesError}
              </div>
            )}

            {headlines &&
              headlines.items &&
              headlines.items.map((hl, i) => (
                <div
                  key={i}
                  style={{
                    background: "#1c1917",
                    border: "1px solid #292524",
                    borderRadius: "12px",
                    padding: "1.25rem",
                    marginBottom: "0.75rem",
                    position: "relative",
                    overflow: "hidden",
                    transition: "border-color 0.3s",
                  }}
                  onMouseOver={(e) =>
                    (e.currentTarget.style.borderColor = "#57534e")
                  }
                  onMouseOut={(e) =>
                    (e.currentTarget.style.borderColor = "#292524")
                  }
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "3px",
                      height: "100%",
                      background:
                        relevanceColors[hl.relevance] || "#f59e0b",
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginBottom: "0.5rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.58rem",
                        fontFamily: "monospace",
                        padding: "0.15rem 0.5rem",
                        borderRadius: "100px",
                        background: `${relevanceColors[hl.relevance] || "#f59e0b"}18`,
                        color: relevanceColors[hl.relevance] || "#f59e0b",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}
                    >
                      {hl.relevance}
                    </span>
                    <span
                      style={{
                        fontSize: "0.68rem",
                        color: "#57534e",
                        fontFamily: "monospace",
                      }}
                    >
                      {hl.source} · {hl.date}
                    </span>
                  </div>
                  <h3
                    style={{
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      marginBottom: "0.4rem",
                      lineHeight: 1.3,
                    }}
                  >
                    {hl.title}
                  </h3>
                  <p style={{ fontSize: "0.8rem", color: "#a8a29e", lineHeight: 1.5 }}>
                    {hl.summary}
                  </p>
                </div>
              ))}

            {!headlines && !headlinesLoading && hasApiKey && (
              <div
                style={{
                  textAlign: "center",
                  padding: "3rem 1rem",
                  color: "#57534e",
                }}
              >
                <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>
                  📡
                </div>
                <p style={{ fontSize: "0.85rem" }}>
                  Hit "Hunt for Headlines" to search for the latest EBM news.
                </p>
              </div>
            )}

            {headlines?.fetchedAt && (
              <p
                style={{
                  fontSize: "0.65rem",
                  color: "#57534e",
                  textAlign: "center",
                  marginTop: "1rem",
                  fontFamily: "monospace",
                }}
              >
                Last fetched: {new Date(headlines.fetchedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* ── WEEKLY PAPER ── */}
        {activeView === "weekly" && (
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "0.5rem",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <h2 style={{ fontSize: "1.4rem", fontWeight: 700 }}>
                📄 Weekly Paper Spotlight
              </h2>
              <button
                onClick={fetchWeeklySummary}
                disabled={weeklyLoading || !hasApiKey}
                style={{
                  background: weeklyLoading ? "#292524" : hasApiKey ? "#a78bfa" : "#292524",
                  border: "none",
                  borderRadius: "8px",
                  color: weeklyLoading ? "#78716c" : hasApiKey ? "#0a0908" : "#78716c",
                  padding: "0.5rem 1.2rem",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: weeklyLoading || !hasApiKey ? "default" : "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                {weeklyLoading ? (
                  <>
                    <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span> Researching...
                  </>
                ) : (
                  "🔬 Find This Week's Paper"
                )}
              </button>
            </div>
            <p
              style={{
                fontSize: "0.82rem",
                color: "#78716c",
                marginBottom: "1.5rem",
              }}
            >
              An AI-curated paper digest personalized to your learning progress.
            </p>

            {!hasApiKey && (
              <div
                style={{
                  background: "#1c1917",
                  border: "1px solid #292524",
                  borderRadius: "12px",
                  padding: "1.25rem",
                  marginBottom: "1rem",
                }}
              >
                <div
                  style={{
                    fontSize: "0.65rem",
                    fontFamily: "monospace",
                    color: "#a78bfa",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    marginBottom: "0.5rem",
                  }}
                >
                  ⚙️ Setup Required
                </div>
                <p style={{ fontSize: "0.82rem", color: "#a8a29e" }}>
                  Add your Anthropic API key in a{" "}
                  <code
                    style={{
                      background: "#292524",
                      padding: "0.1rem 0.4rem",
                      borderRadius: "4px",
                      fontFamily: "monospace",
                    }}
                  >
                    .env
                  </code>{" "}
                  file to enable this feature.
                </p>
              </div>
            )}

            {weeklyError && (
              <div style={{ background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: "12px", padding: "1rem", marginBottom: "1rem", fontSize: "0.82rem", color: "#fca5a5" }}>
                {weeklyError}
              </div>
            )}

            {weeklySummary && (
              <div
                style={{
                  background: "#1c1917",
                  border: "1px solid #292524",
                  borderRadius: "12px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "1.5rem",
                    borderBottom: "1px solid #292524",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.6rem",
                      fontFamily: "monospace",
                      color: "#a78bfa",
                      letterSpacing: "0.15em",
                      textTransform: "uppercase",
                      marginBottom: "0.75rem",
                    }}
                  >
                    Paper of the Week
                  </div>
                  <h3
                    style={{
                      fontSize: "1.15rem",
                      fontWeight: 700,
                      lineHeight: 1.3,
                      marginBottom: "0.5rem",
                    }}
                  >
                    {weeklySummary.paperTitle}
                  </h3>
                  {weeklySummary.authors && (
                    <p style={{ fontSize: "0.78rem", color: "#78716c" }}>
                      {weeklySummary.authors}
                    </p>
                  )}
                  {weeklySummary.venue && (
                    <p
                      style={{
                        fontSize: "0.68rem",
                        fontFamily: "monospace",
                        color: "#57534e",
                        marginTop: "0.2rem",
                      }}
                    >
                      {weeklySummary.venue}
                    </p>
                  )}
                </div>

                {weeklySummary.tldr && (
                  <div
                    style={{
                      padding: "1.25rem 1.5rem",
                      borderBottom: "1px solid #292524",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.6rem",
                        fontFamily: "monospace",
                        color: "#22d3ee",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        marginBottom: "0.5rem",
                      }}
                    >
                      TL;DR
                    </div>
                    <p
                      style={{
                        fontSize: "0.9rem",
                        color: "#d6d3d1",
                        lineHeight: 1.7,
                      }}
                    >
                      {weeklySummary.tldr}
                    </p>
                  </div>
                )}

                {weeklySummary.whyItMatters && (
                  <div
                    style={{
                      padding: "1.25rem 1.5rem",
                      borderBottom: "1px solid #292524",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.6rem",
                        fontFamily: "monospace",
                        color: "#f59e0b",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        marginBottom: "0.5rem",
                      }}
                    >
                      Why It Matters
                    </div>
                    <p
                      style={{
                        fontSize: "0.88rem",
                        color: "#a8a29e",
                        lineHeight: 1.7,
                      }}
                    >
                      {weeklySummary.whyItMatters}
                    </p>
                  </div>
                )}

                {weeklySummary.keyInsight && (
                  <div
                    style={{ padding: "1.25rem 1.5rem", background: "#f59e0b08" }}
                  >
                    <div
                      style={{
                        fontSize: "0.6rem",
                        fontFamily: "monospace",
                        color: "#f43f5e",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        marginBottom: "0.5rem",
                      }}
                    >
                      💡 Key Insight
                    </div>
                    <p
                      style={{
                        fontSize: "0.95rem",
                        color: "#fafaf9",
                        fontWeight: 500,
                        lineHeight: 1.6,
                        fontStyle: "italic",
                      }}
                    >
                      {weeklySummary.keyInsight}
                    </p>
                  </div>
                )}
              </div>
            )}

            {!weeklySummary && !weeklyLoading && hasApiKey && (
              <div
                style={{
                  textAlign: "center",
                  padding: "3rem 1rem",
                  color: "#57534e",
                }}
              >
                <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>
                  📄
                </div>
                <p style={{ fontSize: "0.85rem" }}>
                  Hit "Find This Week's Paper" for a personalized paper summary.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
