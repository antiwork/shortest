import { ClerkProvider, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Star } from "lucide-react";
import Link from "next/link";
import { Logo as LogoIcon } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { getGitHubStarCount } from "@/lib/github-stars";

const GitHubIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

const Logo = () => (
  <span className="ml-2 font-semibold text-gray-900 flex items-center">
    <LogoIcon className="text-orange-500 mr-2 h-8" />
    <span className="text-2xl transform scale-y-75">S</span>
    <span className="text-xl">hortest</span>
  </span>
);

const GitHubButton = async () => {
  const starCount = await getGitHubStarCount();

  return (
    <a
      href="https://github.com/antiwork/shortest"
      target="_blank"
      rel="noopener noreferrer"
    >
      <Button className="bg-white hover:bg-gray-100 text-black border border-gray-200 rounded-full text-xl px-12 py-6 inline-flex items-center justify-center">
        <GitHubIcon className="w-6 h-6 mr-2" />
        <span>{starCount}</span>
        <Star size={24} className="ml-2 text-yellow-400" />
      </Button>
    </a>
  );
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <SignedIn>
            <Link href="/dashboard" className="flex items-center">
              <Logo />
            </Link>
          </SignedIn>
          <SignedOut>
            <Link href="/" className="flex items-center">
              <Logo />
            </Link>
          </SignedOut>
          <div className="flex items-center space-x-4">
            <GitHubButton />
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </div>
      </header>
      {children}
      <Toaster />
    </ClerkProvider>
  );
}
