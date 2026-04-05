FROM node:24-slim

# Claude CLI + git
RUN npm install -g @anthropic-ai/claude-code && \
    apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

EXPOSE 3460

CMD ["node", "server.js"]
