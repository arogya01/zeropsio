# Zerops Challenge — Fun / Differentiated Ideas (Prize-Ready)

**Event:** [The Zerops Challenge](https://www.wemakedevs.org/hackathons/zerops) · Aug 8–9, 2026 · solo  
**Lens:** Delight + multi-service depth (not toys, not dry infra tools)  
**Companion:** [Heavy/platform tools brief](./zerops-hackathon-ideas-2026-08-06.md) · [HTML brief](./zerops-hackathon-ideas.html)  
**Researched:** 2026-08-08 · ~224 sources across 4 streams  

---

## Thesis

Fun wins the **MacBook** when it is a **delivery mechanism for unfakeable technical proof** — not a substitute for it.

> Playful one-line identity → unfakeable live multiplayer or multi-integration moment → multi-service architecture on Zerops → one steel thread → honest limits.

When AI makes “working prototype” cheap, judges reward **narrative, wow, and non-obvious framing**. Safe tools (uptime, migration, RAG, dashboards) collapse into a gray pile. You still need FE + API + DB (+ workers/WS) and a live URL.

**Rule of thumb:** If removing the joke leaves nothing to judge as a product, you have a skit. If removing the joke still leaves a multi-service system with a sharp golden path, you have a winner in a costume.

---

## Principles (ranked)

| # | Principle | Practice |
|---|-----------|----------|
| 1 | Demo *is* the product | Unfakeable moment in ~90s (2nd browser joins, job completes, pet reacts) |
| 2 | Trojan horse | Delight surface · serious systems underneath |
| 3 | One steel thread | One complete loop > five half-features |
| 4 | Realtime / multiplayer / visual narrative | Join room and play beats static CRUD |
| 5 | Platform use is *shown* | Hostnames, workers, S3 keys appear in the demo story |
| 6 | One-line identity | Survives “which one was that?” after 40 demos |
| 7 | Real frustration under the joke | Pain → playful metaphor |
| 8 | Integrate early | Playtest + pitch buffer last ~12h |
| 9 | Constraints as comedy | Timers, short codes, limited rounds force architecture |
| 10 | Enthusiasm + honesty | Name what breaks first |

---

## Differentiated lenses (pick one)

| Lens | What you build | Why judges remember |
|------|----------------|---------------------|
| **Character arc** | User is a protagonist under pressure | Journey > feature tour |
| **Infrastructure as stage** | Queues/topology/backlog *are* the UI | You staged multi-service, didn’t claim it |
| **Anthropomorphized ops** | Pet/monster bound to real health/jobs | Empathy + humor; ops becomes care |
| **Game rules as product spec** | Mechanics *require* workers/WS/S3 | Platform use non-negotiable |
| **Joke with depth** | One absurd line + real backend | Cognitive dissonance sticks |
| **Audience co-op** | Room becomes load generators | Judges *feel* the platform |
| **Single magic contrast** | One “oh this works” beat | 90s clarity beats scope |

---

## Ranked fun ideas (prize-ready)

Scoring: **fun hook × demo wow × Zerops multi-service fit × 48h safety × social virality**.

### Tier F — Build these (fun + depth)

#### F1. Room Code Roast (Jackbox-style prompt battles) — **best overall fun pick**
- **One-liner:** Host TV + phones; absurd prompts; vote; score; optional AI “Quicklash.”
- **Unfakeable moment:** Second phone joins with a code; live votes move a shared scoreboard.
- **Services:** `web` · `api`(+WS) · `postgres` · `valkey` (rooms/TTL) · optional worker for AI fill.
- **Zerops story:** Long-lived WS container + private DB/cache — not serverless party glue.
- **MVP:** 3 rounds · 4-char codes · host/play · timers · scoreboard · 1 AI fill.
- **Cut:** accounts, custom prompt CMS, voice.
- **Risk if shallow:** Static prompts, no multi-client authority, no persistence.

#### F2. Queue Circus (audience-driven worker theater) — **best “this is Zerops” fun**
- **One-liner:** Audience submits dares/names → real jobs on private-net workers → live backlog + trophies in object storage.
- **Unfakeable moment:** 20 submits → backlog goes red → worker finishes → S3 trophy appears.
- **Services:** `web` · `api` · `worker` · `postgres` · `valkey|nats` · `s3`.
- **Zerops story:** Infrastructure *is* the show (Temporal-style presenter demos).
- **MVP:** Submit form · job states · live ring UI · prize cabinet from S3.
- **Cut:** multi-region, complex scoring, auth.
- **Risk if shallow:** Fake progress bars with no real queue/worker.

#### F3. PetOps (Tamagotchi of a real project) — **best ops-anthropomorphy**
- **One-liner:** Pet hunger/happiness maps to worker lag, job backlog, deploy health; care actions hit private APIs; care logs/sprites in S3.
- **Unfakeable moment:** Starve worker → pet sickens live → scale/heal → evolution.
- **Services:** `web` · `api` · `worker` · `postgres` · `valkey` · optional `s3`.
- **Zerops story:** Every joke mechanic binds to a real service metric/event.
- **MVP:** One pet · 3 vitals · feed/heal · history · seed demo project state.
- **Cut:** multi-pet breeding, full APM.
- **Risk if shallow:** CSS pet with random numbers, not real job/queue state.

#### F4. Doodle Anthem (collab draw → song) — **best creative pipeline**
- **One-liner:** Lobby draws together; “Compose” kicks workers that turn drawings into lyrics/audio; group reveal.
- **Unfakeable moment:** Snapshot → processing → track plays for the room.
- **Services:** `web` · WS · `api` · `worker` · `postgres` · `s3` · queue.
- **Zerops story:** Official showcase shape (async pipeline + storage) with party energy.
- **MVP:** 1 lobby · collab canvas snapshot · 1 gen path · listen + download.
- **Cut:** multi-track, stems, accounts.
- **Risk if shallow:** Caption-only “AI” with no async job/S3.

#### F5. AI Portrait / Gallery Party — **best media multiplayer**
- **One-liner:** Shared room; each player submits a prompt; gallery fills as jobs complete.
- **Unfakeable moment:** Two browsers submit → wall fills out of order as workers finish.
- **Services:** `web` · `api` · `worker` · `postgres` · queue · `s3`.
- **Zerops story:** Classic API→queue→worker→S3, multiplayer wrapper.
- **MVP:** Room code · job progress · public wall · seed few completed jobs.
- **Cut:** credits, multi-model market.
- **Risk if shallow:** Sync single OpenAI call, no gallery/jobs.

#### F6. Meme Court — **best comedy + pipeline**
- **One-liner:** Upload/generate meme; AI prosecutor writes charges; room votes guilty/innocent; hall of fame.
- **Unfakeable moment:** Live vote + verdict SFX + case persisted.
- **Services:** `web` · `api`(+WS) · `worker` · `postgres` · `s3` · `valkey`.
- **MVP:** 1 room · upload or generate · vote · top-10 gallery.
- **Risk if shallow:** Single-player meme generator only.

#### F7. PawPress (pet magazine covers) — **best cozy shareable**
- **One-liner:** Pet photo → worker produces dated magazine cover → private archive + share link.
- **Unfakeable moment:** Upload → job spinner → cover issue #1 lands.
- **Services:** `api` · `worker` · `postgres` · `s3` · `valkey` rate limit · `web`.
- **MVP:** Upload · status · cover page · archive grid · share URL.
- **Risk if shallow:** Sync one-shot gen, no archive/storage story.
- **Note:** Slightly less multiplayer wow; strong social screenshots.

#### F8. Boss-Fight To-Do / Raid Board — **best productivity joke**
- **One-liner:** Tasks are dungeon monsters; complete work to DPS them; friends raid your backlog live.
- **Unfakeable moment:** Second user joins raid room; shared HP drops on complete.
- **Services:** `web` · `api`(+WS) · `postgres` · `valkey` · optional NATS XP events.
- **MVP:** CRUD tasks as HP · complete = damage · 1 raid room · leaderboard.
- **Risk if shallow:** Todo list with CSS swords, no multiplayer state machine.

### Strong / situational

| Idea | When to pick | Main risk |
|------|--------------|-----------|
| **Blob Radio** (avatar hangout + shared queue) | You want pure presence vibe | Media sync complexity |
| **Impostor Agents** | Strong LLM orchestration skills | Bots feel dumb; scope |
| **Prompt Island** (AI reality show seasons) | Worker-heavy sim | Easy to under-build state |
| **Photo Booth Chaos** | Event/QR demo energy | Image pipeline polish time |
| **Dungeon Deploy** | You love games + ops | Scope explosion into game design |
| **Decision Swarm** (5 agent advisors) | Parallel workers story | Feels like multi-chat without multiplayer |

### Avoid this weekend (fun but sinks 48h)

- FPS / twitch multiplayer / WebRTC P2P  
- Full CRDT collab editor from scratch  
- Self-hosted GPU models  
- “Add multiplayer last”  
- Pure joke with no DB/worker/WS authority  
- Mean/cruel humor products  

---

## Safe 48h tech patterns

| Safe | Sink |
|------|------|
| WebSocket rooms 2–8 players, server authority | FPS prediction / reconciliation |
| Join codes, not full auth | Friends/MMR/economy platforms |
| HTTP action log for turn-based | WebRTC as first choice |
| API → queue → worker → S3 for gen | Sync “wait 15s” HTTP gen |
| Colyseus or Socket.IO you know | New engine + networking same weekend |
| Seeded demo room that always works | Needs 8 friends online |

**Canonical Zerops fun graph:**

```
browser → web → api (+WS)
              ├→ postgres
              ├→ valkey
              ├→ nats/queue → worker → external AI
              └→ s3
```

---

## Fun vs heavy: when to choose which

| Choose **fun lens** if… | Choose **heavy tools** if… |
|-------------------------|----------------------------|
| You want social track + memory stickiness | You want pure “this is Zerops” platform-native tool |
| You’re strong at product/UI/realtime | You’re strongest at DX/YAML/infra UX |
| Demo involves people joining/playing | Demo is generate artifact judges import |
| Energy/video is a strength | Calm technical walkthrough is a strength |

**Hybrid (often best of both worlds):**  
**Queue Circus** or **PetOps** — fun surface, infrastructure theater, maximum platform score without being “yet another architecture studio.”

---

## Prize-ready fun checklist

- [ ] One sentence: *X for Y, multiplayer/live on Zerops as FE+API+DB(+worker)*
- [ ] Unfakeable moment in first 90s of video
- [ ] Multi-service actually running (private hostnames)
- [ ] DB stores something demo writes and reads back
- [ ] Second browser / phone in the demo
- [ ] At least one async job or WS room (visible)
- [ ] Seeded room code / seed data for cold judges
- [ ] `/architecture` page or 15s service map in video
- [ ] Honest “what breaks first”
- [ ] Social post with motion clip + Zerops-specific sentence + tags

---

## Suggested defaults (this weekend)

| Goal | Build |
|------|--------|
| **Best fun that can still take main prize** | **F1 Room Code Roast** |
| **Best fun + maximum Zerops score** | **F2 Queue Circus** or **F3 PetOps** |
| **Best creative showcase stack** | **F4 Doodle Anthem** or **F5 Gallery Party** |
| **Best cozy social screenshots** | **F7 PawPress** |
| **Heavy lane (previous brief)** | Architecture Studio / Migration Assistant |

---

## Key references

- [PromptGolf (Jackbox-style multiplayer win)](https://www.akinibitoye.com/blog/promptgolf-jackbox-style-ai-prompt-game-hackathon)
- [JetBrains: how to win a hackathon (judging table)](https://blog.jetbrains.com/ai/2026/06/how-to-win-a-hackathon-notes-from-the-judging-table/)
- [swyx: how to do hackathons good](https://dx.tips/hackathons)
- [Zerops Challenge](https://www.wemakedevs.org/hackathons/zerops)
- [ZCP quickstart](https://docs.zerops.io/zcp/quickstart)

---

*Pair with the heavy brief. Differentiated lens does not lower the bar — it raises memorability while keeping multi-service proof.*
