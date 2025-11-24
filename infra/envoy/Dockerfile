# Use the official Envoy binary image as base
FROM envoyproxy/envoy:v1.31.1

# Create config dir and copy your bootstrap config
RUN mkdir -p /etc/envoy

# Copy your envoy.yaml (placed in repo at infra/envoy/envoy.yaml)
COPY infra/envoy/envoy.example.yaml /etc/envoy/envoy.yaml

# Expose the port Envoy will listen on (match your ALB target group)
EXPOSE 8000 9901

# Run envoy with the config (use --log-level info for now)
ENTRYPOINT ["/usr/local/bin/envoy", "-c", "/etc/envoy/envoy.yaml", "--service-cluster", "envoy", "--log-level", "info"]
