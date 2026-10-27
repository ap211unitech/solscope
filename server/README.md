# SolScope MCP server

This is a TypeScript MCP server using the official MCP TypeScript SDK and stdio transport.

## Get started

```sh
pnpm install
pnpm dev
```

The starter server exposes a `greet` tool from `src/index.ts`. Edit that file to add tools, resources, or prompts.

To build the server and launch it in the MCP Inspector:

```sh
pnpm inspect
```

## Commands

- `pnpm dev` — run the TypeScript server directly during development
- `pnpm typecheck` — type-check without emitting files
- `pnpm build` — bundle the server to `dist/`
- `pnpm start` — run the compiled server

When connecting an MCP client over stdio, configure it to launch `node` with the absolute path to `server/dist/index.js` after building. Keep standard output reserved for MCP messages; write logs to standard error.
