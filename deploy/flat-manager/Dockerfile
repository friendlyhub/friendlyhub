# FriendlyHub flat-manager wrapper
# Extends the upstream flat-manager image with an entrypoint that
# generates config.json from environment variables at startup.

FROM ghcr.io/flatpak/flat-manager:latest

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /
ENTRYPOINT ["/usr/local/bin/catatonit", "--"]
CMD ["/entrypoint.sh"]
