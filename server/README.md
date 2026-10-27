# SolScope MCP server

This is a TypeScript MCP server using the official MCP TypeScript SDK and stdio transport.

## Get started

```sh
cp -n ../.env.example ../.env
pnpm install
pnpm dev
```

Set `SOLANA_RPC_URL` in the project root `.env` file to a Solana HTTP(S) RPC endpoint. The example uses Solana mainnet-beta's public RPC URL; a provider endpoint can be used instead.

The server exposes `greet` and `get_wallet_snapshot` tools. The wallet snapshot validates the supplied Solana address and returns its SOL balance and combined SPL Token/Token-2022 account count. Results are cached in memory for 15 seconds.

To build the server and launch it in the MCP Inspector:

```sh
pnpm inspect
```

## Commands

- `pnpm dev` — run the TypeScript server directly during development
- `pnpm typecheck` — type-check without emitting files
- `pnpm build` — compile the server to `dist/`
- `pnpm start` — run the compiled server

When connecting an MCP client over stdio, configure it to launch `node` with the absolute path to `server/dist/index.js` after building. Keep standard output reserved for MCP messages; write logs to standard error.
