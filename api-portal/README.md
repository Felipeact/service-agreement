# API & MCP portal

A site of its own for owners and admins on a plan that includes the API or MCP (Team and Business): the API reference (Swagger UI
with Try it out), the guide to connect an AI client over MCP, and the activity log of every API and MCP call.

- **Not the API itself.** `/api/v1` and `/api/mcp` stay in `../web`; the portal documents and watches them. It allows Try it out
  because the web API answers CORS for this one origin (`API_PORTAL_URL`).
- **Same sign-in as the app.** It reads the app's Supabase session cookie (localhost shares cookies across ports; in production set
  `AUTH_COOKIE_DOMAIN` to the parent domain in both apps). Signed out goes to the app's `/login`. There is no service-role key:
  everything is read as the member, so row-level security decides.
- **Shared code.** Pure domain code is imported from `../web/domain` (plan access, the tool catalogue, the API route table and the
  OpenAPI generator), so the documentation cannot drift from what the API enforces. Nothing else crosses over.

Run: `npm install`, set `.env.local` (see `.env.example`), `npm run dev` (port 3001). The web app runs on 3000.
Build the image from the repository root: `docker build -f api-portal/Dockerfile .` (see the Dockerfile header).
