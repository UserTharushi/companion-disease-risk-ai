import { type DragEvent, type ChangeEvent, useRef, useState, useCallback } from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { cn } from "../../lib/utils";

interface DropzoneProps {
  value?: string;
  onChange: (dataUrl: string) => void;
  onClear?: () => void;
  className?: string;
  label?: string;
  hint?: string;
  accept?: string;
  compact?: boolean;
}

export function Dropzone({
  value,
  onChange,
  onClear,
  className,
  label = "Drag & drop an image here, or click to browse",
  hint = "Supports PNG, JPG, WEBP — max 5 MB",
  accept = "image/*",
  compact = false,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const readFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onChange(reader.result);
    };
    reader.readAsDataURL(file);
  }, [onChange]);

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) readFile(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  // ── Preview state ──
  if (value) {
    return (
      <div className={cn("relative group", compact ? "inline-flex flex-col items-center gap-1" : "w-full", className)}>
        {/* Clear control sits outside overflow-hidden so it is not clipped; z-index keeps it above the image. */}
        <div className={cn("relative", compact ? "inline-block h-16 w-16" : "w-full")}>
          <div className={cn("overflow-hidden", compact ? "h-full w-full rounded-lg" : "min-h-[200px] h-52 w-full rounded-xl sm:h-56")}>
            <img src={value} alt="Upload preview" className="relative z-0 h-full w-full object-cover" />
          </div>
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className={cn(
                "absolute z-20 flex items-center justify-center rounded-full bg-primary-700 text-white shadow-md ring-2 ring-white transition hover:bg-primary",
                "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400",
                compact ? "right-1 top-1 h-6 w-6" : "right-3 top-3 h-8 w-8",
              )}
              aria-label="Remove image"
            >
              <X className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
            </button>
          )}
        </div>
        <p className={cn("text-center text-accent-faint", compact ? "text-[9px]" : "mt-2 text-xs text-accent-subtle")}>
          {compact ? "Drop to replace" : "Drop a new image to replace, or hover to remove"}
        </p>
      </div>
    );
  }

  // ── Empty / upload state ──
  return (
    <div className={cn(compact ? "inline-flex flex-col items-center gap-1" : "w-full", className)}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "flex flex-col items-center justify-center border-2 border-dashed transition-all duration-150 cursor-pointer",
          isDragging
            ? "border-neutral-900 bg-surface-tertiary scale-[1.01]"
            : "border-border bg-surface-secondary/80 hover:border-border-strong hover:bg-surface-secondary",
          compact ? "h-16 w-16 gap-1 rounded-lg" : "min-h-[200px] w-full gap-3 rounded-xl px-6 py-10 sm:min-h-[220px]",
        )}
      >
        {isDragging ? (
          <>
            <Upload className={cn("text-accent", compact ? "h-4 w-4" : "h-8 w-8")} />
            {!compact && <p className="text-sm font-semibold text-accent">Drop to upload</p>}
          </>
        ) : compact ? (
          <ImageIcon className="h-5 w-5 text-accent-faint" />
        ) : (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-surface-tertiary ring-1 ring-neutral-200/80 sm:h-16 sm:w-16">
              <Upload className="h-7 w-7 text-accent-subtle sm:h-8 sm:w-8" />
            </div>
            <p className="max-w-md text-center text-sm font-medium text-neutral-800">{label}</p>
            <p className="text-center text-xs text-accent-subtle">{hint}</p>
          </>
        )}
      </button>
      {compact ? (
        <p className="text-center text-[9px] text-accent-faint max-w-[80px]">Drag & drop or click</p>
      ) : (
        <p className="mt-2 text-center text-xs text-accent-faint">or click anywhere in this area to browse files</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
