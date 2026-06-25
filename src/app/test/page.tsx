import { PublicHeader, PublicFooter } from "@/components/Brand";
import { TestFlow } from "@/components/test/TestFlow";

export const metadata = { title: "Take the Test — Sodiq School" };

export default function TestPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="flex-1 px-4 py-8">
        <TestFlow />
      </main>
      <PublicFooter />
    </div>
  );
}
