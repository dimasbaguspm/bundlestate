FROM node:24-bookworm

# corepack ships with Node; ensure pnpm shims exist for the node user.
RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /workspace

USER node
