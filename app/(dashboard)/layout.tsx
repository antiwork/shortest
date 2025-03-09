"use client";

import {
  ClerkProvider,
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo as LogoIcon } from "@/components/logo";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

const Logo = () => (
  <span className="ml-2 font-semibold text-gray-900 flex items-center">
    <LogoIcon className="text-orange-500 mr-2 h-8" />
    <span className="text-2xl transform scale-y-75">S</span>
    <span className="text-xl">hortest</span>
  </span>
);

const NavLink = ({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) => {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={cn(
        "px-3 py-2 text-sm font-medium rounded-md",
        isActive
          ? "bg-gray-100 text-gray-900"
          : "text-gray-500 hover:text-gray-900 hover:bg-gray-50",
      )}
    >
      {children}
    </Link>
  );
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-8">
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

              <SignedIn>
                <nav className="flex items-center space-x-4">
                  <NavLink href="/dashboard">Dashboard</NavLink>
                  <NavLink href="/dashboard/setup">Setup</NavLink>
                </nav>
              </SignedIn>
            </div>

            <div className="flex items-center space-x-4">
              <SignedOut>
                <SignInButton />
              </SignedOut>
              <SignedIn>
                <UserButton />
              </SignedIn>
            </div>
          </div>
        </div>
      </header>
      {children}
      <Toaster />
    </ClerkProvider>
  );
}
