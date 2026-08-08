# ZeroOps Engine — Hackathon Submission & Demo Storyboard Guide

> **Event**: [The Zerops Challenge (WeMakeDevs)](https://www.wemakedevs.org/hackathons/zerops)  
> **Project Name**: ZeroOps Studio (`zeroops-engine`)  
> **Tracks Targeted**: Main Track (Apple MacBook) & Social Track (Logitech MX Master 3)

---

## 🎬 2-Minute Demo Video Storyboard (Step-by-Step Script)

### Scene 1: The Hook (0:00 - 0:20)
* **Visual**: Screen recording opens on **ZeroOps Studio** (Dark mode glassmorphism UI with "ZCP MCP Agent Connected" glowing dot).
* **Voiceover**: *"Building a full-stack SaaS used to take hours of manual DevOps—writing Dockerfiles, configuring reverse proxies, wiring internal databases, and setting up env variables. Existing AI tools only give you single-container React code. Today, we're introducing ZeroOps: an autonomous Cloud Factory powered by Zerops Control Plane (ZCP)."*

### Scene 2: The One-Prompt Magic Trick (0:20 - 0:50)
* **Visual**: Click the preset button: *"AI Video Clipper SaaS with Next.js, Go API, Python Whisper worker, PostgreSQL, and Valkey"*. Hit **Synthesize & Deploy on Zerops via ZCP**.
* **Voiceover**: *"With one click, ZeroOps synthesizes full-stack code for 5 separate microservices AND communicates directly with ZCP to provision real cloud infrastructure on Zerops."*

### Scene 3: Live ZCP Provisioning & Topology Animation (0:50 - 1:20)
* **Visual**: Switch tabs to **Live ZCP Build Terminal**. Real-time stdout logs stream in blue text as LXD containers spin up. On the left panel, the 5 node cards (`web-frontend`, `api-gateway`, `ai-worker`, `db-postgres`, `cache-valkey`) pulse orange (`BUILDING`) and turn green (`HEALTHY`).
* **Voiceover**: *"Watch as ZCP allocates a private 10.160.0.0 internal subnet, binds internal private IPs for Postgres and Valkey, compiles Go and Python containers, and executes health checks over the Zerops private network."*

### Scene 4: Verification & Live URL (1:20 - 1:45)
* **Visual**: All 4 automated health audits pass (`100% SUCCESS`). The glowing **Success Card** pops up with a live Zerops URL: `https://zeroops-demo.zerops.app`. Click the live link to demonstrate the working multi-service SaaS.
* **Voiceover**: *"In under 120 seconds, we went from a natural language prompt to a 5-container live production stack on Zerops."*

### Scene 5: Outro & Social Post (1:45 - 2:00)
* **Visual**: Show GitHub repository code + Zerops dashboard.
* **Voiceover**: *"ZeroOps proves that the future of cloud computing isn't writing YAML by hand—it's letting AI agents orchestrate real infrastructure on Zerops."*

---

## 📲 Social Track Winning Post Template (Logitech MX Master 3)

**Headline**: Over the weekend, I built **ZeroOps Studio** for @WeMakeDevs @Zeropsio hackathon! 🚀  

**Copy**:
> Most AI web generators only give you basic React code.  
> ZeroOps is a full-stack **Prompt-to-Cloud Factory** that uses Zerops Control Plane (ZCP) to provision, build, and deploy 5-container production stacks (Next.js + Go + Python + Postgres + Valkey) live on Zerops in 120s!
> 
> 🔹 5 Polyglot Containers  
> 🔹 Internal Private Subnet (10.160.0.0/16)  
> 🔹 100% Automated Health Audits  
> 
> 🔗 Live Demo: https://zeroops-demo.zerops.app  
> 💻 Code: [GitHub Repo Link]  
> 🎥 2-Min Demo Video: [YouTube/Loom Link]  

---

## 🛠️ Local Verification & Testing Command

```bash
# 1. Install dependencies & launch ZeroOps Studio
cd /Users/arogyabichpuria/Documents/side-quests/zerops-hack/zeroops-engine
npm install
npm start

# Open http://localhost:3000 in your browser!
```
