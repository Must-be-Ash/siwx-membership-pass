# Membership Pass

An x402-protected API that grants **free access** to wallets holding a membership pass NFT on Base mainnet. Wallets without the NFT can still access the endpoint by paying $0.02 USDC via x402.

## How it works

```
GET /api/random  (no headers)
  → 402 Payment Required
  → Response includes: x402 payment info + SIWX challenge + membership-pass extension

GET /api/random  +  SIGN-IN-WITH-X header
  → Server verifies SIWX signature, extracts wallet address
  → Checks balanceOf(address, tokenId) on the membership pass ERC-1155 contract (Base mainnet)
  → If balance >= 1 → 200 OK (free access, no payment needed)
  → If balance == 0 → 402 (still needs payment)

GET /api/random  +  SIGN-IN-WITH-X  +  PAYMENT-SIGNATURE
  → SIWX verified, NFT check fails → falls through to x402 payment
  → Payment verified via facilitator → 200 OK
```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `MEMBERSHIP_NFT_ADDRESS` | ERC-1155 contract address | `0xE7D4DE14e1e5bBC50BE8b0905a056beC56BE7B66` |
| `MEMBERSHIP_RPC_URL` | RPC endpoint for NFT check (Base mainnet) | `https://mainnet.base.org` |
| `MEMBERSHIP_TOKEN_ID` | ERC-1155 token ID to check | `1` |
| `X402_WALLET_ADDRESS` | Test wallet address (holds NFT) | — |
| `X402_WALLET_PRIVATE_KEY` | Test wallet private key | — |

Create a `.env.local` file:

```env
X402_WALLET_ADDRESS=0x...
X402_WALLET_PRIVATE_KEY=0x...

MEMBERSHIP_NFT_ADDRESS=0xE7D4DE14e1e5bBC50BE8b0905a056beC56BE7B66
MEMBERSHIP_RPC_URL=https://mainnet.base.org
```

## Setup

```bash
npm install
```

## Run

```bash
npm run dev
```

Server starts at `http://localhost:3000`. Hit `GET /api/random` to see the 402 flow in action.

## Tests

Full test suite (5 tests covering all access scenarios):

```bash
npm test
```

Quick single-wallet membership check:

```bash
npm run test:quick
```

### What the tests cover

| Test | Scenario | Expected |
|------|----------|----------|
| 1 | Bare request, no headers | 402 with `membership-pass` extension |
| 2 | Payment without SIWX | 403 blocked |
| 3 | Membership pass holder + SIWX, no payment | 200 free access |
| 4 | No NFT + SIWX, no payment | 402 needs payment |
| 5 | No NFT + SIWX + payment | 200 paid access |

## Architecture

```
middleware.ts          x402 + SIWX + NFT membership gate
app/api/random/route.ts   Returns { number: 1-9 }
test-endpoint.ts       Full test suite
test-membership.ts     Quick membership check
```

**Two networks are involved:**

- **Base mainnet** (`eip155:8453`) — NFT ownership check via `readContract`
- **Base Sepolia** (`eip155:84532`) — x402 payment processing (testnet)

The NFT check reads the ERC-1155 `balanceOf(address, tokenId)` on the membership pass contract. If the wallet holds at least 1 token, the x402 payment is bypassed entirely.

## NFT Details

| Property | Value |
|----------|-------|
| Standard | ERC-1155 |
| Network | Base mainnet |
| Contract | [`0xE7D4DE14e1e5bBC50BE8b0905a056beC56BE7B66`](https://basescan.org/address/0xE7D4DE14e1e5bBC50BE8b0905a056beC56BE7B66) |
| Token ID | 1 |
| Gate rule | `balanceOf >= 1` |

## Stack

- [Next.js](https://nextjs.org) 16
- [x402](https://x402.org) — HTTP 402 payment protocol
- [SIWX](https://github.com/nicktomlin/siwx) — Sign-In-With-X wallet authentication
- [viem](https://viem.sh) — EVM client for on-chain reads
