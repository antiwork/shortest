import { SignUp } from "@clerk/nextjs";
import React from "react";

export default function SignUpPage() {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex justify-center">
        <SignUp
          appearance={{
            elements: {
              headerTitle: "sm:text-xl lg:text-lg xl:text-xl font-bold",
              headerSubtitle: "text-base text-gray-600",
              footerActionText: "text-sm",
              footerActionLink:
                "text-orange-500 hover:text-orange-600 font-medium",
              socialButtonsBlockButtonText: "text-sm",
              socialButtonsBlockButton:
                "whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 shadow h-9 bg-white hover:bg-gray-100 border border-gray-200 rounded-full px-12 py-6 inline-flex items-center justify-center",
              footer: "bg-gray-950",
            },
          }}
        />
      </div>
    </main>
  );
}
