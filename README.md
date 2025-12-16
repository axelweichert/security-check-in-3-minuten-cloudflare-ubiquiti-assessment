# Security Check in 3 Minuten - Cloudflare & Ubiquiti Assessment

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/axelweichert/security-check-in-3-minuten-cloudflare-ubiquiti-assessment)

A professional, multilingual (DE/EN/FR) multi-step security assessment application designed to evaluate corporate resilience against cyber threats. Features a sophisticated funnel (Levels 1-3, Tech Stack, Consents), deterministic risk scoring, Cloudflare D1-like persistence via Durable Objects, PDF report generation, Microsoft Bookings integration, and a protected admin dashboard for lead management.

## ✨ Key Features

- **Multilingual Support**: German (default), English, French with i18n dictionaries
- **Multi-Step Funnel**: 3 levels of security questions + tech stack + contact/consents
- **Deterministic Scoring**: Firewall/VPN/Zero Trust evaluation with risk levels (Low/Medium/High)
- **PDF Generation**: Server-side PDF reports with summaries, scores, and branding
- **Admin Dashboard**: Lead listing, filtering (date/status/risk/discount), CSV export, detail views (protected by Cloudflare Access)
- **Themes**: Light/Dark/System modes with persistence
- **Responsive Design**: Mobile-first with shadcn/ui and Tailwind
- **Production-Ready**: Zero Trust security, SEO-optimized, accessible UI

## 🛠 Tech Stack

- **Frontend**: React 18, TypeScript, Vite, React Router, Zustand, shadcn/ui, Tailwind CSS, Lucide React, Framer Motion, react-hook-form, react-i18next
- **Backend**: Cloudflare Workers, Hono, Durable Objects (simulating D1 schema)
- **Data**: IndexedEntity pattern for leads, answers, scores
- **UI/UX**: Responsive, accessible, dark/light themes, micro-interactions
- **Utils**: Zod validation, date-fns, recharts, pdf-lib, sonner toasts
- **Deployment**: Cloudflare Pages (frontend) + Workers (API) + Durable Objects (storage)

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd security-check-runner
   ```

2. **Install dependencies** (using Bun)
   ```bash
   bun install
   ```

3. **Run development server**
   ```bash
   bun dev
   ```
   Open [http://localhost:3000](http://localhost:3000) (proxies API to Workers).

## 💻 Development

### Local Development
- **Frontend**: `bun dev` (Vite dev server on port 3000)
- **Workers API**: Automatically proxied; simulates full Cloudflare environment
- **Theme/Language**: Toggle in UI; persists via localStorage/URL
- **Hot Reload**: Full HMR for React + Tailwind
- **Linting**: `bun lint`
- **Type Check**: `bun tsc --noEmit`

### Environment Variables
No env vars required (Cloudflare bindings handled automatically).

### Project Structure
```
├── src/              # React app (pages, components, hooks)
├── worker/           # Hono API routes + entities
├── shared/           # Shared types
└── public/           # Static assets
```

### Adding Routes
- **Frontend**: Edit `src/main.tsx` (React Router)
- **API**: Add to `worker/user-routes.ts` using IndexedEntity helpers
- **Entities**: Extend in `worker/entities.ts`

## 🔧 Customization

- **I18n**: Edit JSON dicts in `src/locales/` (auto-loaded)
- **Scoring Logic**: Update `worker/lead-scoring.ts`
- **UI Polish**: shadcn/ui + Tailwind (Tailwind config in `tailwind.config.js`)
- **Branding**: Colors in `tailwind.config.js`, logos in components

## 🌐 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/leads` | Submit assessment |
| `GET`  | `/api/leads` | List leads (filters: `from`, `to`, `status`, `risk`, `discount`) |
| `GET`  | `/api/leads/:id` | Lead details |
| `POST` | `/api/leads/:id/status` | Update status |
| `GET`  | `/api/leads/export.csv` | CSV export (with filters) |
| `GET`  | `/api/leads/:id/pdf` | Download PDF |

All responses: `{ success: boolean, data?: T, error?: string }`

## 🚀 Deployment

Deploy to Cloudflare Pages + Workers in one command:

```bash
bun deploy
```

This:
1. Builds frontend (`vite build`)
2. Deploys via Wrangler (Pages + Workers + DO)

**Manual Steps** (if needed):
1. `bun build`
2. `wrangler deploy`

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/axelweichert/security-check-in-3-minuten-cloudflare-ubiquiti-assessment)

**Post-Deploy**:
- Protect `/admin` with [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/)
- Custom domain via Cloudflare Pages dashboard
- D1 migration not needed (Durable Objects auto-migrate)

## 📊 Database Schema (Durable Objects)

- **leads**: id, created_at, language, company_name, etc.
- **lead_answers**: lead_id, question_key, answer_value, score_value
- **lead_scores**: lead_id, score_vpn, score_web, etc., risk_level

Managed via IndexedEntity (atomic, indexed lists).

## 🤝 Contributing

1. Fork & clone
2. `bun install`
3. Create feature branch
4. `bun dev` & test
5. PR with clear description

Follow TypeScript, ESLint, and Tailwind conventions.

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.

## 🙌 Support

Built with ❤️ by Cloudflare Build. Questions? [Cloudflare Developers](https://developers.cloudflare.com/)// deploy trigger Di. 16 Dez. 2025 09:19:02 CET
