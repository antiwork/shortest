import { SignedIn, SignedOut } from "@clerk/nextjs";
import { Code } from "bright";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import AntiworkFooter from "@/components/ui/antiwork-footer";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main>
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 tracking-tight sm:text-5xl md:text-6xl">
              QA via natural language
              <span className="block text-orange-500">AI tests</span>
            </h1>
            <p className="mt-3 text-base text-gray-500 sm:mt-5 sm:text-xl lg:text-lg xl:text-xl max-w-2xl mx-auto">
              Write tests in plain English and let AI handle the execution.
              Built on Playwright with seamless GitHub integration.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div>
            <h3 className="text-2xl font-semibold text-gray-900 mb-4">
              Write tests in plain English
            </h3>
            <pre className="overflow-x-auto">
              <Code lang="js">{`import { shortest } from '@antiwork/shortest'

shortest('Login to the app using email and password', {
  username: process.env.GITHUB_USERNAME,
  password: process.env.GITHUB_PASSWORD
})`}</Code>
            </pre>
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:gap-8 lg:items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
                Ready to get started?
              </h2>
              <p className="mt-3 max-w-3xl text-lg text-gray-500">
                Start writing natural language tests today and let AI handle the
                implementation. Focus on describing your test scenarios while
                Shortest takes care of the rest.
              </p>
            </div>
            <div className="mt-8 lg:mt-0 flex justify-center lg:justify-end">
              <SignedOut>
                <a
                  href="https://github.com/antiwork/shortest"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button className="bg-white hover:bg-gray-100 text-black border border-gray-200 rounded-full text-xl px-12 py-6 inline-flex items-center justify-center">
                    View on GitHub
                    <ArrowRight className="ml-3 h-6 w-6" />
                  </Button>
                </a>
              </SignedOut>
              <SignedIn>
                <Link href="/dashboard">
                  <Button className="bg-white hover:bg-gray-100 text-black border border-gray-200 rounded-full text-xl px-12 py-6 inline-flex items-center justify-center">
                    View Dashboard
                    <ArrowRight className="ml-3 h-6 w-6" />
                  </Button>
                </Link>
              </SignedIn>
            </div>
          </div>
        </div>
      </section>
      <AntiworkFooter />
    </main>
  );
}
