# Deepgram Flux TTS — Voice Agent Demo Bench

A real-time voice agent demo platform built with Next.js, React, and Deepgram's Flux TTS API. Connect a Deepgram agent, load product knowledge from JSON, and run live AI-powered product demos through your browser microphone.

## Features

- **Live voice agent** — connect to Deepgram's Flux voice agent via WebSocket, speak through your mic, hear the agent respond in real time
- **Product knowledge from JSON** — drop a `.json` file in `products/` and it auto-appears in the product dropdown. The agent uses it as its knowledge base
- **Demo and discovery modes** — the agent can deliver a full structured product walkthrough or answer targeted questions depending on what the prospect asks
- **Multi-product dropdown** — switch between products on the fly; the system prompt and greeting update automatically
- **Live prompt editing** — edit the behavior prompt, product knowledge JSON, and greeting while the agent is running; apply changes live mid-session
- **Voice model picker** — choose from 9 Deepgram Flux voices (Kit, Haley, Heather, Priya, Jack, Bruce, Rufus, Drew, Alexis)
- **Transcript tape** — see the full conversation as it happens, with agent and user turns clearly separated
- **Event log** — raw WebSocket events for debugging and understanding the agent protocol
- **VU meter** — real-time audio level visualization for microphone input
- **Text injection** — send text messages to the agent as if you spoke them (useful for testing without a mic)

## Tech Stack

- [Next.js 16](https://nextjs.org/) with App Router and Turbopack
- [React 19](https://react.dev/)
- [TypeScript 6](https://www.typescriptlang.org/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Deepgram Flux TTS](https://deepgram.com/) — voice agent API

## Quick Start

```bash
# Clone the repo
git clone https://github.com/mujeeb-enfin/deepgram-flux-tts-with-voice-agent.git
cd deepgram-flux-tts-with-voice-agent

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local and add your Deepgram API key

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

For HTTPS (required for microphone access on some browsers):

```bash
npm run dev:https
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DEEPGRAM_API_KEY` | Yes | — | Your Deepgram API key |
| `DEEPGRAM_VOICE_MODEL` | No | `flux-kit-en` | Default Flux voice model |
| `DEEPGRAM_THINK_MODEL` | No | `gpt-4o-mini` | LLM model for the agent's thinking |
| `DEEPGRAM_SPEED` | No | `1.0` | Speech speed multiplier |
| `DEEPGRAM_EOT_THRESHOLD` | No | `0.7` | End-of-turn detection sensitivity (0.0–1.0) |

Get a Deepgram API key at [console.deepgram.com](https://console.deepgram.com/).

## Adding a Product

Drop a JSON file in the `products/` directory matching this shape:

```json
{
  "productName": "Your Product",
  "description": "One or two sentence overview.",
  "targetUsers": "Who the product is for.",
  "problems": ["Problem 1", "Problem 2"],
  "capabilities": ["Capability 1", "Capability 2"],
  "integrations": ["Integration 1", "Integration 2"],
  "pricing": "Pricing details.",
  "limits": "Known limitations.",
  "facts": ["Fact 1", "Fact 2"]
}
```

The product appears in the "Load product" dropdown on the next page load. See `products/hotelstack.json` for a full example.

## Project Structure

```
app/
  page.tsx              Server component — loads products from disk, renders FluxAgentBench
  layout.tsx            Root layout
  globals.css           Tailwind base styles

components/
  FluxAgentBench.tsx    Main bench UI — state management, prompt builder, agent lifecycle
  ConnectionPanel.tsx   API key, voice/model pickers, connect/disconnect controls
  SystemPromptPanel.tsx Behavior prompt, product JSON, greeting editors
  LivePanel.tsx         Live status display during a session
  TurnTape.tsx          Scrolling transcript of agent and user turns
  EventLog.tsx          Raw WebSocket event viewer
  TextInjectPanel.tsx   Send text to the agent without speaking
  VuMeter.tsx           Real-time microphone audio level bar
  StatusDot.tsx         Connection state indicator

hooks/
  useDeepgramAgent.ts   WebSocket connection and Deepgram agent protocol
  useMicrophone.ts      Browser microphone capture and streaming
  useAudioPlayback.ts   Agent audio playback via Web Audio API
  useVuMeter.ts         Audio level metering from mic stream

products/
  hotelstack.json       Example product config (HotelStack hotel management platform)
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with Turbopack (http) |
| `npm run dev:https` | Start dev server with self-signed HTTPS cert |
| `npm run build` | Production build |
| `npm start` | Start production server |

## Maintainer

This project is published and maintained by **Mujeeb Rahman** — project manager by trade, software engineer at heart, builds algorithmic trading systems for investment, and founder of **[MR INNOVATIONS](https://mr-innovations.com)**.

Security issues: security@mr-innovations.com

### Other products from MR INNOVATIONS

#### Developer tools
- [**MR CODER**](https://marketplace.visualstudio.com/items?itemName=mr-coder) — VS Code extension.
- [**mr-coder.io**](https://mr-coder.io) — AI model router for coding agents.
- [**codeshare.site**](https://codeshare.site) — share code snippets with a permalink.

#### Hosting
- [**cybrohosting.com**](https://cybrohosting.com) — managed hosting.

#### Webhooks
- [**paymenthooks.com**](https://paymenthooks.com) — payment webhook routing.
- [**evethooks.io**](https://evethooks.io) — event-driven webhook orchestration.
- [**emailhooks.io**](https://emailhooks.io) — email-event webhooks (delivered, opened, bounced).

#### APIs & data
- [**worldpostallocations.com**](https://worldpostallocations.com) — worldwide postal-code / address-allocation API.

#### Classifieds & marketplaces
- [**360classifieds.in**](https://360classifieds.in) — India classifieds platform.

#### Travel & hospitality
- [**hotelstack.io**](https://hotelstack.io) — hotel-tech stack for boutique properties.
- [**bookmyroom.io**](https://bookmyroom.io) — direct hotel-room booking engine.

#### Trading
- [**MR Gold Trader**](https://www.mql5.com/en/market/product/125423) — automated Expert Advisor for XAUUSD (Gold) on MetaTrader 5.
- [**MrGoldTrend**](https://www.mql5.com/en/users/mujeeb.6727/seller) — free trend-following indicator for Gold on MT5.
- [**MR Score**](https://www.mql5.com/en/users/mujeeb.6727/seller) — free probability-based price deviation indicator for MT5.
- [MQL5 Marketplace Profile](https://www.mql5.com/en/users/mujeeb.6727/seller)

## License

[MIT](LICENSE) — Copyright (c) 2026 Mujeeb Rahman / MR INNOVATIONS
