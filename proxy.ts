import {
  paymentProxyFromHTTPServer,
  x402ResourceServer,
  x402HTTPResourceServer,
} from "@x402/next";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import {
  declareSIWxExtension,
  siwxResourceServerExtension,
  parseSIWxHeader,
  validateSIWxMessage,
  verifySIWxSignature,
} from "@x402/extensions/sign-in-with-x";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

const payTo = "0xF7C645b7600Fb6AaE07Fd0Cf31112A7788BE8F85";

// NFT ownership checker via Base mainnet public RPC
// NOTE: This client talks to Base MAINNET to check NFT ownership
// x402 payment happens on Base Sepolia (testnet) — separate concern
const nftClient = createPublicClient({
  chain: base,
  transport: http(process.env.MEMBERSHIP_RPC_URL || "https://mainnet.base.org"),
});

const NFT_ADDRESS = (process.env.MEMBERSHIP_NFT_ADDRESS ||
  "0xE7D4DE14e1e5bBC50BE8b0905a056beC56BE7B66") as `0x${string}`;

if (!process.env.MEMBERSHIP_NFT_ADDRESS) {
  console.warn(
    "⚠️  MEMBERSHIP_NFT_ADDRESS not set in env, using default Nyan Dot Cat contract"
  );
}

// Nyan Dot Cat is an ERC-1155 contract — balanceOf requires (address, tokenId)
const MEMBERSHIP_TOKEN_ID = BigInt(process.env.MEMBERSHIP_TOKEN_ID || "1");

const ERC1155_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "id", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

async function checkMembership(
  address: string
): Promise<{ isMember: boolean; balance: number }> {
  const balance = await nftClient.readContract({
    address: NFT_ADDRESS,
    abi: ERC1155_ABI,
    functionName: "balanceOf",
    args: [address as `0x${string}`, MEMBERSHIP_TOKEN_ID],
  });

  return {
    isMember: balance > BigInt(0),
    balance: Number(balance),
  };
}

// x402 resource server setup
const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://x402.org/facilitator",
});

const resourceServer = new x402ResourceServer(facilitatorClient)
  .register("eip155:84532", new ExactEvmScheme())
  .registerExtension(siwxResourceServerExtension);

const routes = {
  "/api/random": {
    accepts: [
      {
        scheme: "exact" as const,
        price: "$0.02",
        network: "eip155:84532" as const,
        payTo,
      },
    ],
    description: "Get a random number 1-9",
    mimeType: "application/json",
    extensions: {
      ...declareSIWxExtension({
        statement:
          "Sign in to verify membership NFT ownership for free access",
        expirationSeconds: 300,
      }),
      "membership-pass": {
        description:
          "Hold a Nyan Dot Cat NFT on Base mainnet for free access",
        network: "eip155:8453",
        nftContract: "0xE7D4DE14e1e5bBC50BE8b0905a056beC56BE7B66",
        nftName: "Nyan Dot Cat",
        standard: "ERC-1155",
        rule: "balanceOf >= 1",
      },
    },
  },
};

/**
 * Membership gate hook — wallets holding a Nyan Dot Cat NFT get free access, others pay.
 *
 * Flow:
 * - No SIWX, no payment      → fall through → 402 with extensions
 * - Payment without SIWX     → ABORT 403
 * - SIWX valid + holds NFT   → GRANT ACCESS (free, bypass payment)
 * - SIWX valid + no NFT      → fall through to payment
 * - SIWX invalid             → ABORT
 */
function createMembershipGateHook() {
  return async (context: {
    adapter: { getHeader(name: string): string | undefined; getUrl(): string };
    path: string;
  }) => {
    const siwxHeader = context.adapter.getHeader("sign-in-with-x");
    const hasPayment = !!context.adapter.getHeader("payment-signature");

    // No SIWX, no payment → 402 with extensions (tells client what to do)
    if (!siwxHeader && !hasPayment) {
      return;
    }

    // Trying to pay without SIWX → block
    if (!siwxHeader && hasPayment) {
      return {
        abort: true as const,
        reason: "Sign in with your wallet first.",
      };
    }

    // SIWX header present — validate it
    try {
      const payload = parseSIWxHeader(siwxHeader!);
      const resourceUri = context.adapter.getUrl();

      const validation = await validateSIWxMessage(payload, resourceUri);
      if (!validation.valid) {
        return {
          abort: true as const,
          reason: `Invalid signature: ${validation.error}`,
        };
      }

      const verification = await verifySIWxSignature(payload);
      if (!verification.valid) {
        return {
          abort: true as const,
          reason: `Signature verification failed: ${verification.error}`,
        };
      }

      const address = verification.address!;

      // Check NFT ownership on Base mainnet
      const { isMember, balance } = await checkMembership(address);

      if (isMember) {
        console.log(
          `✅ Membership verified: ${address} holds ${balance} Nyan Dot Cat NFT(s)`
        );
        // Free access bypass — skip payment, serve the endpoint directly
        return { grantAccess: true as const };
      }

      console.log(
        `❌ No membership: ${address} holds 0 Nyan Dot Cat NFTs, payment required`
      );
      // No NFT → fall through to payment verification
      return;
    } catch (err) {
      return {
        abort: true as const,
        reason: `Membership gate error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  };
}

const httpServer = new x402HTTPResourceServer(
  resourceServer,
  routes
).onProtectedRequest(createMembershipGateHook());

export const proxy = paymentProxyFromHTTPServer(httpServer);

export const config = {
  matcher: ["/api/:path*"],
};

