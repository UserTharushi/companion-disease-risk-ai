import { Info } from "lucide-react";
import { useLanguageStore } from "../lib/language";

export function Disclaimer({ className = "" }: { className?: string }) {
  const language = useLanguageStore((state) => state.language);

  const text =
    language === "si"
      ? "මෙය තීරණ සහාය මෙවලමකි — වෛද්‍ය රෝග විනිශ්චයක් නොවේ. වෘත්තීය උපදෙස් සඳහා සැමවිටම බලපත්‍රලාභී පශු වෛද්‍යවරයෙකු හමුවන්න."
      : language === "ta"
        ? "இது ஒரு முடிவு ஆதரவு கருவி — மருத்துவ நோயறிதல் அல்ல. தொழில்முறை ஆலோசனைக்கு எப்போதும் உரிமம் பெற்ற கால்நடை மருத்துவரை அணுகவும்."
        : "This is a decision support tool, not a medical diagnosis. Always consult a licensed veterinarian for professional advice.";

  return (
    <div
      className={`flex items-start gap-2 rounded-xl border border-info/40 bg-info-light px-3 py-2 text-xs text-accent-muted dark:border-info/30 dark:bg-primary/10 dark:text-neutral-300 ${className}`}
      role="note"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
      <span>{text}</span>
    </div>
  );
}
