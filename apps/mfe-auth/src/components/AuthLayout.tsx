import type { ReactNode } from "react";

type AuthLayoutProps = {
  children: ReactNode;
  tone?: "default" | "brand";
  title?: string;
  subtitle?: string;
};

export function AuthLayout({
  children,
  tone = "default",
  title: _title = "PetCare AI",
  subtitle: _subtitle = "AI-powered companion health support across mobile and desktop.",
}: AuthLayoutProps) {
  const appBackground = tone === "brand"
    ? "bg-gradient-to-b from-[#0F4BD8] via-[#1E63E9] to-[#3C8BFF]"
    : "bg-[#F2F5FA]";

  const screenStyle = tone === "brand"
    ? "bg-transparent text-white"
    : "bg-[#F2F5FA] text-slate-900";

  return (
    <div className={`min-h-dvh ${appBackground}`}>
      <div className="flex min-h-dvh w-full flex-col items-center justify-center sm:px-6 sm:py-8">
        <main
          className={[
            "relative flex min-h-dvh w-full flex-col px-5 pt-5",
            "pb-[max(20px,env(safe-area-inset-bottom))]",
            screenStyle,
            "sm:min-h-[860px] sm:max-w-[430px] sm:rounded-[34px] sm:px-6 sm:pt-6",
            tone === "brand"
              ? "sm:bg-gradient-to-b sm:from-[#0F4BD8] sm:via-[#1E63E9] sm:to-[#3C8BFF] sm:shadow-[0_32px_100px_rgba(30,99,233,0.36)]"
              : "sm:bg-[#F2F5FA] sm:shadow-[0_24px_80px_rgba(15,23,42,0.16)]",
          ].join(" ")}
        >
          <div className="flex w-full flex-1 flex-col">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
