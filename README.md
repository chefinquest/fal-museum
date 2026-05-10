# FAL Museum

An interactive browser museum that uses **fal.ai generative media models** as the art pipeline and **React Three Fiber / Three.js** as the delivery surface. The goal is to show how quickly a growth engineer can turn a model ecosystem into a polished, shareable demo with documentation.

## Why this exists

fal's Growth Engineer role asks for someone who can sit between engineering, product, and GTM: ship prototypes quickly, write persuasive technical content, debug customer touchpoints, and turn experiments into qualified activation. This project is a concrete demo of that operating style.

## What it demonstrates

- **Fast prototype shipping:** a Vite + React + TypeScript app with a walkable 3D environment.
- **Generative media fluency:** six distinct artworks generated through different fal model families.
- **Developer-tool mindset:** the project records prompts, models, outputs, and docs instead of treating generation as a black box.
- **Content + demo thinking:** includes an in-app `/docs` route so the demo can double as a technical teardown.
- **Customer empathy:** first-person controls, labels, plaques, and a simple gallery narrative make the technology approachable.

## Model inventory

- `fal-ai/fast-sdxl` — Stable Diffusion XL — *Nocturne of Glass Orchards*
- `fal-ai/flux/schnell` — FLUX.1 schnell — *Brutalist Sun Garden*
- `fal-ai/recraft/v3/text-to-image` — Recraft V3 — *The Velvet Machine*
- `fal-ai/imagen3/fast` — Imagen3 Fast — *Rain Room Sonata*
- `fal-ai/ideogram/v2a/turbo` — Ideogram V2A Turbo — *A Map of Quiet Thunder*
- `fal-ai/flux-2/flash` — Flux 2 Flash — *Porcelain Aurora*

The complete metadata lives in `src/artworks.json`.

## Tech stack

- React 19
- TypeScript
- Vite
- Three.js
- React Three Fiber
- Drei
- Marked for docs rendering

## Running locally

```bash
npm install
npm run dev
```

Open:

- Museum: `http://localhost:5173/`
- Docs: `http://localhost:5173/docs`

## Build

```bash
npm run build
```

Current production build passes. Vite reports a large Three.js bundle warning, which is expected for the prototype and is a clear next optimization target.

## Recruiter / interview talking points

If discussing this project with fal:

1. **Start with the role fit:** "I built this because the role is not just backend engineering; it is engineering plus distribution. I wanted something that shows prototype speed, model fluency, and storytelling."
2. **Show the model list:** emphasize that the artworks use six different fal endpoints and that the app preserves model/prompt provenance.
3. **Explain the growth angle:** the next step would be instrumentation: activation funnel, time-to-first-interaction, click-through from docs to signup, and cohort comparison across demos.
4. **Be honest about gaps:** this is a polished prototype, not a production product. The next work would be deployment, analytics, performance/code-splitting, mobile controls, and a stronger share loop.

## Next improvements

- Deploy publicly on `chefin.quest` or a dedicated project URL.
- Add analytics events for docs visits, first pointer-lock, artwork focus, and outbound fal CTA clicks.
- Add a short technical blog post: "Building a generative AI museum with six fal models."
- Code-split the 3D scene to reduce initial bundle weight.
- Add a gallery mode for mobile users.
