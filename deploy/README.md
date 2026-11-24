# Deploy: Docker and Kubernetes

The app runs today on Railway. These files let the same app run in any Kubernetes cluster (EKS, GKE, AKS, DigitalOcean, k3s). n8n and Supabase are not part of this: n8n stays on Railway and the database stays on Supabase.

None of this has been built or applied yet: the machine that wrote it has no Docker or kubectl. Build the image and run a dry run first (`kubectl apply -k deploy/k8s --dry-run=server`).

## Build the image

From `web/`:

```
docker build -t ghcr.io/OWNER/service-pacts-web:<git sha> \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key> .
docker run --rm -p 3000:3000 --env-file .env.local ghcr.io/OWNER/service-pacts-web:<git sha>
```

Only the two public values go into the image. Secrets are read at run time, never baked in.

## Load balancer

Traffic path: internet, the cloud **load balancer** (a Kubernetes Service of type `LoadBalancer`, created by ingress-nginx), the Ingress (TLS, rate limit), the `web` Service, then 2 to 6 pods.

```
helm upgrade --install ingress-nginx ingress-nginx --repo https://kubernetes.github.io/ingress-nginx \
  --namespace ingress-nginx --create-namespace
helm upgrade --install cert-manager cert-manager --repo https://charts.jetstack.io \
  --namespace cert-manager --create-namespace --set crds.enabled=true
kubectl -n ingress-nginx get svc ingress-nginx-controller    # EXTERNAL-IP: point your DNS record at it
```

Create a `letsencrypt-prod` ClusterIssuer for cert-manager (see its docs), and set the real host in `ingress.yaml` and `configmap.yaml`.

## Deploy

```
kubectl apply -f deploy/k8s/namespace.yaml
kubectl -n service-pacts create secret generic web-secrets --from-literal=ANTHROPIC_API_KEY=...   # all keys in secret.example.yaml
kubectl apply -k deploy/k8s
kubectl -n service-pacts rollout status deploy/web
```

## What is set

- **Probes:** `/api/health` for startup, readiness and liveness. It touches no database.
- **Zero-downtime rollout:** `maxUnavailable: 0`, a `preStop` pause, a disruption budget of 1, and spread across nodes.
- **Hardening:** non-root user 10001, read-only root filesystem, all capabilities dropped, no service-account token, a restricted pod-security namespace, and a network policy that only admits the ingress controller.
- **Scaling:** autoscaler on CPU at 70%, 2 to 6 replicas.
- **Rate limits:** the app limits sign-in and secret-link pages per client address in memory (per pod); the ingress adds the cluster-wide ceiling.
- **Webhooks:** Stripe and n8n call `https://<host>/api/webhooks/stripe` and `/api/automation/notify`. Keep the host stable when moving from Railway.
