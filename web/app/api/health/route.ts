/**
 * Liveness and readiness probe for the container and the load balancer. It answers 200 as long as the server process can
 * respond; it touches no database and returns no data, so it is safe to leave public and to call often.
 */
export function GET() {
  return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
