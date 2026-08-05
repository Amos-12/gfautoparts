// Stripe product and price mappings for subscription plans
export const STRIPE_PLANS = {
  basic: {
    product_id: 'prod_U70o75L2Udqzx3',
    price_id: 'price_1T8mnKAOoIXoYDc8xUbIfLlU',
    name: 'Basic',
    price: 19,
  },
  pro: {
    product_id: 'prod_U70pcM3cVvX4y4',
    price_id: 'price_1T8mnuAOoIXoYDc8iRjrdyIC',
    name: 'Pro',
    price: 39,
  },
  premium: {
    product_id: 'prod_U70rau26HqWTvN',
    price_id: 'price_1T8mq4AOoIXoYDc8SRmqM10l',
    name: 'Premium',
    price: 59,
  },
} as const;

export type StripePlanId = keyof typeof STRIPE_PLANS;
