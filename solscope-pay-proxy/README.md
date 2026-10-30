# solscope-pay-proxy

A local stdio MCP server that lets agents use paid SolScope tools. It holds a Solana wallet, forwards every tool call to `solscope-server`, and signs the USDC payment when the server answers "payment required". The agent sees one ordinary MCP server and pays nothing itself.

```
Agent  --stdio-->  pay-proxy (your wallet)  --HTTP + x402-->  solscope-server
```

The proxy is a transparent passthrough: it lists whatever tools the server has and relays calls as they are, so adding or repricing a tool on the server needs no change here. Free tools pass through without any payment.

## Setup

```sh
pnpm install
pnpm build
```

Create a payer wallet and fund it with **devnet USDC** from <https://faucet.circle.com> (Solana, Devnet). It needs no SOL, because the facilitator pays the network fee.

```sh
solana-keygen new --outfile payer.json
solana address -k payer.json
```

## Configuration

| Variable        | Required | Description                                                  |
| --------------- | -------- | ------------------------------------------------------------ |
| `SERVER_URL`    | Yes      | MCP endpoint of the server, e.g. `http://localhost:3000/mcp` |
| `PAYER_KEYPAIR` | No       | Path to the payer keypair JSON. Defaults to `./payer.json`.  |

## Use with Claude Desktop

Add to `claude_desktop_config.json` using **absolute paths**, then fully quit and reopen Desktop. Start the server first.

```json
{
  "mcpServers": {
    "solscope": {
      "command": "node",
      "args": ["/absolute/path/to/solscope-pay-proxy/dist/index.js"],
      "env": {
        "PAYER_KEYPAIR": "/absolute/path/to/solscope-pay-proxy/payer.json",
        "SERVER_URL": "http://localhost:3000/mcp"
      }
    }
  }
}
```

Claude Code:

```sh
claude mcp add solscope \
  -e PAYER_KEYPAIR=/absolute/path/to/payer.json \
  -e SERVER_URL=http://localhost:3000/mcp \
  -- node /absolute/path/to/solscope-pay-proxy/dist/index.js
```

## Test

```sh
npx @modelcontextprotocol/inspector \
  -e PAYER_KEYPAIR=./payer.json \
  -e SERVER_URL=http://localhost:3000/mcp \
  node dist/index.js
```

Call a paid tool. On success the payer's USDC balance drops by the tool price:

```sh
spl-token balance 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \
  --owner <payer-address> --url devnet
```

## Notes

- **`payer.json` is a private key.** It is git-ignored. Keep it out of version control and hold only devnet funds in it.
- The proxy pays automatically once the client approves a tool call. **Spend limits are not enforced yet**, so don't use a funded mainnet wallet.
- Logs go to standard error only (standard output carries the MCP protocol). In Claude Desktop on macOS they are in `~/Library/Logs/Claude/mcp-server-solscope.log`.
- If the log shows `paymentMade: true` but the call still fails, the server or facilitator rejected the payment. Check the server's terminal.
