# Deployment / Betrieb

## Domains
- SPA (User & Admin): https://securitycheck.vonbusch.app
- Service-API (Service Token / Automation): https://securitycheck-api.vonbusch.app

## Cloudflare Access (GENAU 2 Applications)
### 1) securitycheck-admin
- URL: securitycheck.vonbusch.app/admin*
- Login: Human IdP (Google/Azure/GitHub)
- Kein Service Token
- Hinweis: Admin-Seite ruft API über /api/* auf derselben Domain auf, damit Browser-Session sauber ist.

### 2) securitycheck-api
- URL: securitycheck-api.vonbusch.app/api/*
- Zugriff: Service Token (Client ID/Secret)
- Zweck: curl / Automationen / Integrationen

## Pages
- Build: npm run build
- Output: dist
- Functions: /functions/*

## D1
- Binding: DB
- Tabellen: leads, lead_answers
