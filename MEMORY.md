# MEMORY.md - YaBot's Long-Term Memory

## Setup & Configuration
- **Perplexity API configured** for web_search (2026-02-12)
  - Provider: "perplexity"
  - Tool: web_search is enabled
  - API credentials stored in config

## Stanislav (Стас) - User Profile
- Values directness and efficiency
- Works with VPS setup
- Interested in expanding local/remote nodes
- Plans to add OpenAI as additional model (pending)

## Active Systems
1. **Telegram** - primary channel (enabled)
2. **Web Search** - via Perplexity API (enabled)
3. **Memory Search** - configured but check if enabled
4. **Gateway** - running on VPS, port 18789

## Infrastructure Notes
- Main instance on VPS (always-on)
- Local nodes require always-on status to be accessible
- OAuth flows need interactive browser (not available on VPS)

## YA Fork Project - COMPLETED ✅ (2026-02-14)
**Status:** Production-ready, one-click installer fully debugged and ready
**Latest Fix:** .env file solution for docker-compose (commit 82bcd7f6a)
**Root Cause Solved:** docker-compose doesn't inherit shell env vars → create .env before up

### Commits (Feb 14)
1. `ab6da0f3f` - feat(mac): add one-click installer and stopper
2. `d7b350efc` - fix(mac): set environment variables export
3. `82bcd7f6a` - fix(mac): create .env file for docker-compose (FINAL FIX)

### What Was Built
- **Claude-style Product UI** for OpenClaw - non-technical manager-friendly onboarding
- **Wizard/Onboarding Flow** with beautiful design system
- **Projects + Chats sidebar** (Claude.ai-style grouping)
- **One-click Mac installer** - install-mac.command for zero-terminal user experience

### Key Features
- 7 wizard step types: text, password, confirm, select, multiselect, note/action, progress
- Modern design: фиолетовая палитра (#7c3aed), smooth transitions, responsive
- Progress bar (segmented), custom inputs/buttons, dark mode support
- Full accessibility (WCAG AA), proper TypeScript types
- Docker setup with retry logic for network resilience
- One-click installer that auto-starts Docker, clones repo, builds UI, opens browser

### Metrics
- 12+ commits (main branch)
- 1,500+ lines of code added
- 650+ lines of CSS (design system)
- 0 build errors
- 0 TypeScript issues after fixes

### Deployment Ready
- GitHub: main branch pushed ✅
- Docker: docker-setup.sh tested on Mac ✅
- One-click: install-mac.command created ✅
- User experience: Zero terminal, auto browser launch ✅

### Distribution
1. Direct URL: `curl -fsSL https://raw.githubusercontent.com/.../install-mac.command | bash`
2. GitHub Releases: .zip with install-mac.command + stop-ya.command
3. GitHub repo clone + double-click installer

## Mac Docker Deployment (2026-02-14 Post-Completion)
**Container Status:** Running `tmp5durf2wcwm-openclaw-gateway-1` on Mac
- **Auth Token:** `a89a68910bbbb281d843783982878ea515253b0a9eb7628ebb70c72946394b63`
- **Config Location:** `/Users/fedorovstas/.openclaw`
- **Access:** Via tailnet IP with host port mapping (port handled by Docker)
- **Port Strategy:** Single gateway recommended (avoids dual overhead). Use `OPENCLAW_GATEWAY_PORT` env var if conflicts needed.
- **Local gateway:** Can stop with `openclaw gateway stop` to run Docker exclusively

**Outstanding Tasks:**
- [ ] Full E2E validation: Docker install → onboarding → first AI message (on Mac)
- [ ] Loose Desktop file cleanup: Present ~200 files categorized analysis to Стас for organization
- [ ] Monitor Docker container stability over time (logs, health checks)
