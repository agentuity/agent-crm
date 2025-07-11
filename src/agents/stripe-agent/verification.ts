import Stripe from "stripe";

const STRIPE_SIGNING_SECRET = process.env.STRIPE_SIGNING_SECRET;
const STRIPE_API_KEY = process.env.STRIPE_API_KEY;

if (!STRIPE_SIGNING_SECRET)
  throw new Error(
    "STRIPE_SIGNING_SECRET env var missing – cannot verify webhooks"
  );
if (!STRIPE_API_KEY)
  throw new Error("STRIPE_API_KEY env var missing – cannot init Stripe SDK");

const stripe = new Stripe(STRIPE_API_KEY, {
  apiVersion: "2025-06-30.basil", // pick whatever you’re locked to
});

export function verifyStripeSignature(rawBody: string, sigHeader: string) {
  try {
    const event = stripe.webhooks.constructEvent(
      rawBody,
      sigHeader,
      STRIPE_SIGNING_SECRET!
    );
    return {
      ok: true,
      type: event.type,
      parsedEvent: event, // returned so downstream steps can re-use it
    };
  } catch (err: any) {
    // Bubble up the exact reason so you can see it in the executionLog
    throw new Error(`Stripe signature verification failed: ${err.message}`);
  }
}