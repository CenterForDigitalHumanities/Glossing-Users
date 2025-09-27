# Glossing Users

## Overview

Glossing Users exposes an Express-based management API and static admin UI for working with Auth0-managed roles used by the Glossing suite of applications. The service proxies Auth0 Management API calls so that administrators can review users, assign roles, and handle authentication flows tailored to the project.

## Prerequisites

- Node.js 18 or newer (native `fetch` support)
- npm (bundled with Node.js)
- An Auth0 tenant configured with the Glossing applications and roles referenced below

## Environment variables

Create a `.env` file in the project root containing the following values supplied by your Auth0 tenant:

```ini
DOMAIN=example.auth0.com
CLIENTID=abc123
CLIENT_SECRET=your_client_secret
ROLE_MANAGER_ID=rol_manager
ROLE_CONTRIBUTOR_ID=rol_contributor
ROLE_PUBLIC_ID=rol_public
GLOSSING_ROLES_CLAIM=https://your-namespace/roles
GLOSSING_APP_CLAIM=https://your-namespace/app
AUDIENCE=https://example.auth0.com/api/v2/
```

> Update the namespace-style URLs above to match the custom claims configured for your Auth0 rules/actions.

## Install and run

```powershell
npm install
npm run devstart
```

The service listens on `http://localhost:3000` by default. Visit `/` for the admin UI or `/glossing-users` for the proxied static assets.

## Testing

Automated tests are not currently configured. Run manual smoke checks after changes, or add your preferred test framework before reintroducing `npm test`.

## Linting & formatting

```powershell
npm run lint
npm run lint:fix
npm run format
```

The lint configuration enforces ES module syntax, consistent `const`/`let` usage, and Prettier-powered formatting.

## Modernization backlog

- [x] Replace deprecated `auth0` v3 SDK usage with the current `auth0` Management and Authentication SDKs and migrate route handlers to async/await.
- [ ] Implement cursor-based pagination when requesting Auth0 users so more than 50 users are returned per role.
- [x] Convert server modules to ES modules, adopt consistent `const`/`let`, and enable linting (ESLint + Prettier) to enforce modern syntax and catch dead code such as the unused `verifyAccess` helper in `auth/index.js`.
- [ ] Update the frontend auth widget to use `@auth0/auth0-spa-js` instead of the legacy CDN bundle and remove Node-specific shebangs in browser scripts.
