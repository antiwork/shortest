import {
  ClerkProvider,
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import Link from "next/link";
import { Logo as LogoIcon } from "@/components/logo";
import { Toaster } from "@/components/ui/toaster";

const Logo = () => (
  <span className="ml-2 font-semibold text-gray-900 flex items-center">
    <LogoIcon className="text-orange-500 mr-2 h-8" />
    <span className="text-2xl transform scale-y-75">S</span>
    <span className="text-xl">hortest</span>
  </span>
);

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
            <SignedOut>
              <SignInButton />
            </SignedOut>
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
