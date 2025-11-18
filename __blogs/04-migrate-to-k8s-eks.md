---
title: Building Microservices with Node.js: Part 4 - Kubernetes, EKS, and Beyond
description: Migrate microservices to Kubernetes and AWS EKS with Helm, scaling, and service mesh
tags: kubernetes, eks, helm, istio, microservices, devops
reading_time: 13 min
---

# Building Microservices with Node.js: Part 4 - Kubernetes, EKS, and Beyond

## Short Summary

In Parts 1-3, we built and deployed our microservices to ECS. Now we'll take the next step by migrating to Kubernetes for more sophisticated orchestration, auto-scaling, and operational flexibility.

This post covers:
- Creating Kubernetes manifests for all services
- Setting up Amazon EKS cluster
- Using Helm for templating and package management
- Implementing auto-scaling (horizontal and vertical)
- Advanced monitoring with Prometheus and Grafana
- Service mesh with Istio for traffic management
- Blue-green and canary deployments

---

## Prerequisites

- Completed Parts 1-3 of this series
- Understanding of Docker and containers
- Basic Kubernetes knowledge (pods, deployments, services)
- kubectl installed locally
- AWS account with EKS access
- Helm 3 installed

## Estimated Reading Time: 13 minutes
## Estimated Coding Time: 90-120 minutes (highly environment-dependent)

---

## Section 1: Kubernetes Manifests

### Step 1: Create Kubernetes Deployment for Users Service

[INSERT: deploy/k8s/manifests/users-deployment.yaml]

Example deployment:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: users
  labels:
    app: users
    version: v1
spec:
  replicas: 3
  selector:
    matchLabels:
      app: users
  template:
    metadata:
      labels:
        app: users
        version: v1
    spec:
      containers:
      - name: users
        image: ECR_REGISTRY/ecomm-users:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: host
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: password
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3001
          initialDelaySeconds: 10
          periodSeconds: 5
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
```

### Step 2: Create Service for Users

```yaml
apiVersion: v1
kind: Service
metadata:
  name: users-service
  labels:
    app: users
spec:
  type: ClusterIP
  selector:
    app: users
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3001
```

### Step 3: Create ConfigMap for Configuration

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  SERVICE_PORT: "3001"
```

### Step 4: Create Secrets

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-secret
type: Opaque
stringData:
  host: "ecomm-postgres.XXXX.rds.amazonaws.com"
  username: "postgres"
  password: "secure-password"
```

Create secrets from CLI:
```bash
kubectl create secret generic db-secret \
  --from-literal=host=postgres.example.com \
  --from-literal=password=$(aws secretsmanager get-secret-value --secret-id ecomm/db-password --query SecretString --output text)
```

---

## Section 2: Helm Charts

### Step 5: Create Helm Chart Structure

```bash
helm create ecomm-services
```

Directory structure:
```
ecomm-services/
├── Chart.yaml              # Chart metadata
├── values.yaml              # Default values
├── values-dev.yaml          # Dev overrides
├── values-prod.yaml         # Prod overrides
├── templates/
│   ├── deployment.yaml      # Service deployment template
│   ├── service.yaml         # Service template
│   ├── configmap.yaml       # ConfigMap template
│   ├── secret.yaml          # Secret template (placeholder)
│   └── hpa.yaml             # Horizontal Pod Autoscaler
└── charts/                  # Dependencies (if any)
```

### Step 6: Helm Chart.yaml

[INSERT: deploy/k8s/helm/ecomm-services/Chart.yaml]

```yaml
apiVersion: v2
name: ecomm-services
description: Helm chart for Ecomm microservices
type: application
version: 1.0.0
appVersion: "1.0.0"
maintainers:
  - name: Your Name
    email: your@email.com
```

### Step 7: Helm values.yaml

[INSERT: deploy/k8s/helm/ecomm-services/values.yaml]

```yaml
global:
  environment: production
  registry: ECR_REGISTRY
  imagePullPolicy: IfNotPresent

services:
  users:
    image: ecomm-users
    tag: latest
    port: 3001
    replicas: 3
    resources:
      requests:
        cpu: 100m
        memory: 128Mi
      limits:
        cpu: 500m
        memory: 512Mi
  
  products:
    image: ecomm-products
    tag: latest
    port: 3002
    replicas: 2
    resources:
      requests:
        cpu: 100m
        memory: 128Mi
      limits:
        cpu: 500m
        memory: 512Mi

database:
  host: "{{ env 'RDS_ENDPOINT' }}"
  port: 5432
  name: ecomm

redis:
  host: elasticache-endpoint
  port: 6379

kafka:
  brokers: "kafka-1:9092,kafka-2:9092"
```

### Step 8: Deploy with Helm

```bash
# Install
helm install ecomm ./ecomm-services \
  -f values.yaml \
  -f values-prod.yaml \
  --namespace ecomm \
  --create-namespace

# Upgrade
helm upgrade ecomm ./ecomm-services \
  -f values.yaml \
  -f values-prod.yaml

# Rollback
helm rollback ecomm 1
```

---

## Section 3: Amazon EKS Setup

### Step 9: Create EKS Cluster

Via AWS Console or CLI:
```bash
aws eks create-cluster \
  --name ecomm-cluster \
  --version 1.28 \
  --role-arn arn:aws:iam::ACCOUNT:role/eks-service-role \
  --resources-vpc-config subnetIds=subnet-XXXX,subnet-YYYY

# Wait for cluster (5-10 minutes)
aws eks describe-cluster \
  --name ecomm-cluster \
  --query 'cluster.status'
```

### Step 10: Configure kubectl

```bash
aws eks update-kubeconfig \
  --name ecomm-cluster \
  --region us-east-1

# Verify connection
kubectl cluster-info
kubectl get nodes
```

### Step 11: Create Node Group

```bash
aws eks create-nodegroup \
  --cluster-name ecomm-cluster \
  --nodegroup-name ecomm-nodes \
  --scaling-config minSize=2,maxSize=10,desiredSize=3 \
  --subnets subnet-XXXX subnet-YYYY \
  --node-role arn:aws:iam::ACCOUNT:role/NodeInstanceRole
```

### Step 12: Deploy Application

```bash
# Create namespace
kubectl create namespace ecomm

# Deploy with Helm
helm install ecomm ./ecomm-services \
  --namespace ecomm \
  -f deploy/k8s/helm/values-prod.yaml

# Verify deployment
kubectl get deployments -n ecomm
kubectl get pods -n ecomm
kubectl logs -n ecomm deployment/users
```

---

## Section 4: Auto-Scaling

### Step 13: Horizontal Pod Autoscaler (HPA)

[INSERT: deploy/k8s/manifests/hpa.yaml]

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: users-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: users
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 15
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
```

Apply HPA:
```bash
kubectl apply -f deploy/k8s/manifests/hpa.yaml -n ecomm

# Monitor scaling
kubectl get hpa -n ecomm --watch
```

### Step 14: Cluster Autoscaler

Install on EKS:
```bash
# Create service account
kubectl create serviceaccount cluster-autoscaler -n kube-system

# Apply cluster autoscaler
kubectl apply -f https://raw.githubusercontent.com/kubernetes/autoscaler/master/cluster-autoscaler/cloudprovider/aws/examples/cluster-autoscaler-autodiscovery.yaml
```

---

## Section 5: Advanced Monitoring

### Step 15: Install Prometheus & Grafana

```bash
# Add Helm repository
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install Prometheus Stack
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace

# Port forward to Grafana
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80

# Access: http://localhost:3000
# Default: admin / prom-operator
```

### Step 16: Create Custom Grafana Dashboard

[INSERT: deploy/k8s/monitoring/grafana-dashboard.json]

Key metrics to monitor:
- Pod CPU usage
- Pod memory usage
- Request rate (requests/sec)
- Error rate (5xx responses)
- Latency (p50, p95, p99)
- Database connection pool usage
- Kafka lag (messages behind)

### Step 17: Setup Alerts

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: ecomm-alerts
spec:
  groups:
  - name: ecomm
    interval: 30s
    rules:
    - alert: HighErrorRate
      expr: |
        (sum(rate(http_requests_total{status=~"5.."}[5m])) by (service) /
         sum(rate(http_requests_total[5m])) by (service)) > 0.05
      for: 5m
      annotations:
        summary: "High error rate on {{ $labels.service }}"
    
    - alert: PodNotReady
      expr: |
        kube_pod_status_ready{condition="false"} == 1
      for: 10m
      annotations:
        summary: "Pod {{ $labels.pod }} not ready for 10 minutes"
```

---

## Section 6: Service Mesh with Istio

### Step 18: Install Istio

```bash
# Download Istio
curl -L https://istio.io/downloadIstio | sh
cd istio-*

# Install
./bin/istioctl install --set profile=demo -y

# Enable sidecar injection
kubectl label namespace ecomm istio-injection=enabled
```

### Step 19: Configure Virtual Service

```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: users
spec:
  hosts:
  - users
  http:
  - match:
    - uri:
        prefix: "/auth/signup"
    route:
    - destination:
        host: users
        port:
          number: 3001
    timeout: 10s
    retries:
      attempts: 3
      perTryTimeout: 3s
```

### Step 20: Traffic Management - Canary Deployment

```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: users
spec:
  hosts:
  - users
  http:
  - match:
    - sourceLabels:
        version: canary
    route:
    - destination:
        host: users
        subset: v2
      weight: 100
  - route:
    - destination:
        host: users
        subset: v1
      weight: 90
    - destination:
        host: users
        subset: v2
      weight: 10
---
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: users
spec:
  host: users
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 50
        http2MaxRequests: 100
    loadBalancer:
      simple: LEAST_REQUEST
  subsets:
  - name: v1
    labels:
      version: v1
  - name: v2
    labels:
      version: v2
```

Deploy canary:
```bash
# Deploy v2 alongside v1
kubectl set image deployment/users-v2 \
  users=ECR_REGISTRY/ecomm-users:v2 \
  -n ecomm

# Gradually shift traffic (10% -> 50% -> 100%)
kubectl patch virtualservice users -n ecomm --type merge \
  -p '{"spec":{"http":[{"route":[{"destination":{"host":"users","subset":"v1"},"weight":90},{"destination":{"host":"users","subset":"v2"},"weight":10}]}]}}'
```

---

## Section 7: Ingress and External Access

### Step 21: Setup Ingress Controller

```bash
# Install nginx ingress
helm install nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace
```

### Step 22: Create Ingress Resource

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ecomm-ingress
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - api.ecomm.example.com
    secretName: ecomm-tls
  rules:
  - host: api.ecomm.example.com
    http:
      paths:
      - path: /users
        pathType: Prefix
        backend:
          service:
            name: users-service
            port:
              number: 80
      - path: /products
        pathType: Prefix
        backend:
          service:
            name: products-service
            port:
              number: 80
```

Get external IP:
```bash
kubectl get ingress -n ecomm
# Update DNS to point to external IP
```

---

## Section 8: Persistence and Stateful Services

### Step 23: PostgreSQL Operator

For production, use RDS or PostgreSQL Operator:

```bash
helm install postgresql bitnami/postgresql \
  --set auth.postgresPassword=secure-password \
  --set persistence.size=20Gi
```

### Step 24: Kafka on Kubernetes

```bash
helm install kafka bitnami/kafka \
  --set replicaCount=3 \
  --set persistence.size=10Gi
```

---

## Section 9: Blue-Green Deployments

### Step 25: Implement Blue-Green Strategy

```bash
#!/bin/bash
# deploy-bluegreen.sh

SERVICE=$1
NEW_VERSION=$2

# Deploy new version (green)
kubectl set image deployment/${SERVICE}-green \
  ${SERVICE}=ECR_REGISTRY/${SERVICE}:${NEW_VERSION} \
  -n ecomm

# Wait for ready
kubectl rollout status deployment/${SERVICE}-green -n ecomm

# Switch traffic to green
kubectl patch service ${SERVICE} -n ecomm \
  -p '{"spec":{"selector":{"version":"green"}}}'

# Keep blue for quick rollback
# kubectl patch service ${SERVICE} -n ecomm \
#   -p '{"spec":{"selector":{"version":"blue"}}}'
```

---

## Section 10: Disaster Recovery

### Step 26: Backup Strategy

```bash
# Backup database
pg_dump -h RDS_ENDPOINT -U postgres ecomm_dev > backup.sql

# Store in S3
aws s3 cp backup.sql s3://ecomm-backups/$(date +%Y%m%d).sql

# Backup EKS cluster configuration
kubectl get all --all-namespaces -o yaml > cluster-backup.yaml

# Store Helm releases
helm list --all-namespaces --output json > helm-releases.json
```

### Step 27: Disaster Recovery Procedure

```bash
# 1. Restore from backup
createdb -h new-rds-endpoint -U postgres ecomm_dev
psql -h new-rds-endpoint -U postgres ecomm_dev < backup.sql

# 2. Recreate EKS cluster
aws eks create-cluster ... # Same as before

# 3. Reapply Helm charts
helm install ecomm ./ecomm-services \
  --namespace ecomm \
  -f values-prod.yaml
```

---

## What's After Part 4?

Future enhancements:
- Multi-region deployment
- Service mesh (Istio) advanced features
- Policy enforcement with OPA/Gatekeeper
- Cost optimization with spot instances
- GitOps with ArgoCD
- Advanced security with network policies
- Database sharding strategies
- Cache warming and pre-warming strategies

---

## Production Kubernetes Checklist

- [ ] EKS cluster created and nodes healthy
- [ ] All deployments replicated and healthy
- [ ] Resource requests/limits configured
- [ ] HPA configured for all services
- [ ] Cluster Autoscaler installed
- [ ] PersistentVolumes for stateful services
- [ ] Prometheus and Grafana monitoring active
- [ ] Alerts configured and tested
- [ ] Ingress controller installed
- [ ] TLS certificates configured
- [ ] RBAC policies configured
- [ ] Network policies implemented
- [ ] Backup strategy tested
- [ ] Disaster recovery tested

---

## Key Takeaways

✓ Created comprehensive Kubernetes manifests
✓ Built reusable Helm charts
✓ Deployed and scaled on Amazon EKS
✓ Implemented auto-scaling (pods and nodes)
✓ Set up monitoring with Prometheus and Grafana
✓ Implemented service mesh with Istio
✓ Configured advanced deployment strategies
✓ Planned for disaster recovery

---

## Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [AWS EKS Best Practices](https://aws.github.io/aws-eks-best-practices/)
- [Helm Charts](https://helm.sh/)
- [Istio Service Mesh](https://istio.io/)
- [Prometheus Monitoring](https://prometheus.io/)

---

**Previous Article**: [Part 3 - Dockerization, CI/CD, and AWS Deployment](03-deploy-ci-cd-aws.md)

---

## Series Summary

| Part | Focus | Outcome |
|------|-------|---------|
| 1 | Local Development Setup | Working monorepo with docker-compose |
| 2 | Service Implementation | 5 fully-functional microservices |
| 3 | Dockerization & CI/CD | Production Docker images + GitHub Actions |
| 4 | Kubernetes & EKS | Scalable cloud-native deployment |

Congratulations! You've built a production-ready microservices platform from scratch.
