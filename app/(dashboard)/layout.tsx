import { ClerkProvider, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Github, Star } from "lucide-react";
import Link from "next/link";
import { Logo as LogoIcon } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { getGitHubStarCount } from "@/lib/github-stars";

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
        <Github size={24} className="mr-2" />
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
