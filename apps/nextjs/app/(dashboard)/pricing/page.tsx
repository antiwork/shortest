import { Check } from "lucide-react";
import Link from "next/link";
import { SubmitButton } from "./submit-button";
import { checkoutAction } from "@/lib/payments/actions";
import { getStripePrices, getStripeProducts } from "@/lib/payments/stripe";

// Prices are fresh for one hour max
export const revalidate = 3600;

export default async function PricingPage() {
  const [prices, products] = await Promise.all([
    getStripePrices(),
    getStripeProducts(),
  ]);

  const standardPlan = products.find((product) => product.name === "Standard");

  const standardPrice = prices.find(
    (price) => price.productId === standardPlan?.id,
  );

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-center mb-8">Shortest Pricing</h1>
      <p className="text-center mb-12 text-gray-600">
        Streamline your pull request workflow with intelligent test assistance
      </p>
      <div className="max-w-3xl mx-auto">
        <PricingCard
          name={standardPlan?.name || "Standard"}
          price={1000} // $10 per user per month
          interval="month"
          trialDays={standardPrice?.trialPeriodDays || 14}
          features={[
            "Automated test writing for new features",
            "Intelligent test fixing for broken tests",
            "Seamless GitHub integration",
            "Unlimited pull requests",
            "Priority support",
          ]}
          priceId={standardPrice?.id}
        />
      </div>
      <div className="mt-12 text-center">
        <h2 className="text-2xl font-semibold mb-4">Enterprise</h2>
        <p className="mb-4">
          Need a custom solution? Our enterprise plan offers tailored features
          and support.
        </p>
        <Link
          href="mailto:sales@shortest.com"
          className="text-orange-500 hover:text-orange-600 font-medium"
        >
          Contact our sales team
        </Link>
      </div>
    </main>
  );
}

function PricingCard({
  name,
  price,
  interval,
  trialDays,
  features,
  priceId,
}: {
  name: string;
  price: number;
  interval: string;
  trialDays?: number;
  features: string[];
  priceId?: string;
}) {
  return (
    <div className="border rounded-lg p-6 shadow-sm">
      <h2 className="text-2xl font-medium text-gray-900 mb-2">{name}</h2>
      {trialDays && (
        <p className="text-sm text-gray-600 mb-4">
          with {trialDays} day free trial
        </p>
      )}
      <p className="text-4xl font-medium text-gray-900 mb-6">
        ${price / 100}{" "}
        <span className="text-xl font-normal text-gray-600">
          /user/{interval}
        </span>
      </p>
      <ul className="space-y-4 mb-8">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start">
            <Check className="h-5 w-5 text-orange-500 mr-2 mt-0.5 flex-shrink-0" />
            <span className="text-gray-700">{feature}</span>
          </li>
        ))}
      </ul>
      {priceId ? (
        <form action={checkoutAction}>
          <input type="hidden" name="priceId" value={priceId} />
          <SubmitButton />
        </form>
      ) : (
        <button className="w-full bg-orange-500 text-white py-2 px-4 rounded-md hover:bg-orange-600 transition-colors">
          Get Started
        </button>
      )}
    </div>
  );
}
