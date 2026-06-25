import { PublicHeader, PublicFooter } from "@/components/Brand";
import { ThankYouResult } from "@/components/test/ThankYouResult";

export const metadata = { title: "Thank You — Sodiq School" };

export default function ThankYouPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="flex flex-1 items-center px-4 py-10">
        <ThankYouResult />
      </main>
      <PublicFooter />
    </div>
  );
}
