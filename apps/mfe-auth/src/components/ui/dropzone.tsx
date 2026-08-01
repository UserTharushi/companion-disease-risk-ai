import { type DragEvent, type ChangeEvent, useRef, useState, useCallback } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Upload, X, Image as ImageIcon, Pencil } from "lucide-react";
import { cn } from "../../lib/utils";
import { t, useLanguageStore } from "../../lib/language";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./dialog";

interface DropzoneProps {
  value?: string;
  onChange: (dataUrl: string) => void;
  onClear?: () => void;
  className?: string;
  label?: string;
  hint?: string;
  accept?: string;
  compact?: boolean;
  disabled?: boolean;
  avatar?: boolean;
  cropShape?: "rect" | "round";
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.src = url;
  });
}

// Cap the exported avatar so the base64 data URL stays small (a few hundred KB),
// which keeps profile/pet-photo saves fast and well under the upload limit.
const MAX_OUTPUT_PX = 512;

async function getCroppedImage(imageSrc: string, pixelCrop: Area, shape: "rect" | "round"): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");

  const cropW = Math.max(1, Math.round(pixelCrop.width));
  const cropH = Math.max(1, Math.round(pixelCrop.height));
  const scale = Math.min(1, MAX_OUTPUT_PX / Math.max(cropW, cropH));
  canvas.width = Math.max(1, Math.round(cropW * scale));
  canvas.height = Math.max(1, Math.round(cropH * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to create crop context");

  if (shape === "round") {
    const radius = Math.min(canvas.width, canvas.height) / 2;
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, radius, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.clip();
  }

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return shape === "round"
    ? canvas.toDataURL("image/png")
    : canvas.toDataURL("image/jpeg", 0.9);
}

export function Dropzone({
  value,
  onChange,
  onClear,
  className,
  // Defaults come from the dictionary below, not from a literal here, so a
  // caller that passes nothing still gets copy in the reader's language.
  label,
  hint,
  accept = "image/*",
  compact = false,
  disabled = false,
  avatar = false,
  cropShape,
}: DropzoneProps) {
  const language = useLanguageStore((state) => state.language);
  const tr = (key: string) => t(language, key);
  const resolvedLabel = label ?? tr("dzLabel");
  const resolvedHint = hint ?? tr("dzHint");
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [cropApplying, setCropApplying] = useState(false);

  const effectiveCropShape = cropShape ?? (avatar ? "round" : "rect");

  const openCropper = useCallback((source: string) => {
    setCropSource(source);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setCropOpen(true);
  }, []);

  const readFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        openCropper(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }, [openCropper]);

  function closeCropper() {
    setCropSource(null);
    setCroppedAreaPixels(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCropOpen(false);
  }

  async function applyCrop() {
    if (!cropSource || !croppedAreaPixels) return;

    try {
      setCropApplying(true);
      const cropped = await getCroppedImage(cropSource, croppedAreaPixels, effectiveCropShape);
      onChange(cropped);
      closeCropper();
    } finally {
      setCropApplying(false);
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    if (disabled) return;
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (disabled) return;
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    if (disabled) return;
    setIsDragging(false);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    if (disabled) return;
    const file = e.target.files?.[0];
    if (file) readFile(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  // ── Preview state ──
  if (value) {
    const previewContainerClass = avatar
      ? "inline-block h-36 w-36 rounded-full"
      : compact
        ? "inline-block h-16 w-16"
        : "w-full";

    const previewFrameClass = avatar
      ? "h-full w-full rounded-full"
      : compact
        ? "h-full w-full rounded-lg"
        : "min-h-[200px] h-52 w-full rounded-xl sm:h-56";

    return (
      <div className={cn("relative group", compact ? "inline-flex flex-col items-center gap-1" : "w-full", className)}>
        <div className={cn("relative", previewContainerClass)}>
          <div className={cn("overflow-hidden", previewFrameClass)}>
            <img src={value} alt={tr("uploadPreview")} className="relative z-0 h-full w-full object-cover" />
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={() => openCropper(value)}
              className={cn(
                "absolute left-3 top-3 z-20 rounded-full bg-surface/90 px-3 py-1 text-[11px] font-semibold text-accent shadow ring-1 ring-border transition hover:bg-surface",
                "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
              )}
            >
              <span className="inline-flex items-center gap-1"><Pencil className="h-3 w-3" />{tr("cropAction")}</span>
            </button>
          )}
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              disabled={disabled}
              className={cn(
                "absolute z-20 flex items-center justify-center rounded-full bg-primary-700 text-white shadow-md ring-2 ring-white transition hover:bg-primary",
                "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400",
                avatar ? "right-2 top-2 h-7 w-7" : compact ? "right-1 top-1 h-6 w-6" : "right-3 top-3 h-8 w-8",
              )}
              aria-label={tr("removeImage")}
            >
              <X className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
            </button>
          )}
        </div>
        <p className={cn("text-center text-accent-faint", compact || avatar ? "text-[10px]" : "mt-2 text-xs text-accent-subtle")}>
          {avatar ? tr("dzAvatarHint") : compact ? tr("dzDropReplace") : tr("dzDropReplaceLong")}
        </p>
      </div>
    );
  }

  // ── Empty / upload state ──
  return (
    <div className={cn(compact ? "inline-flex flex-col items-center gap-1" : "w-full", className)}>
      <button
        type="button"
        onClick={() => {
          if (!disabled) inputRef.current?.click();
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        disabled={disabled}
        className={cn(
          "flex flex-col items-center justify-center border-2 border-dashed transition-all duration-150 cursor-pointer",
          disabled && "cursor-not-allowed opacity-70",
          isDragging
            ? "border-neutral-900 bg-surface-tertiary scale-[1.01]"
            : "border-border bg-surface-secondary/80 hover:border-border-strong hover:bg-surface-secondary",
          avatar
            ? "h-36 w-36 gap-2 rounded-full"
            : compact
              ? "h-16 w-16 gap-1 rounded-lg"
              : "min-h-[200px] w-full gap-3 rounded-xl px-6 py-10 sm:min-h-[220px]",
        )}
      >
        {isDragging ? (
          <>
            <Upload className={cn("text-accent", compact ? "h-4 w-4" : "h-8 w-8")} />
            {!compact && <p className="text-sm font-semibold text-accent">{tr("dropToUpload")}</p>}
          </>
        ) : compact ? (
          <ImageIcon className="h-5 w-5 text-accent-faint" />
        ) : (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-surface-tertiary ring-1 ring-neutral-200/80 sm:h-16 sm:w-16">
              <Upload className="h-7 w-7 text-accent-subtle sm:h-8 sm:w-8" />
            </div>
            <p className="max-w-md text-center text-sm font-medium text-neutral-800">{resolvedLabel}</p>
            <p className="text-center text-xs text-accent-subtle">{resolvedHint}</p>
          </>
        )}
      </button>
      {compact || avatar ? (
        <p className="text-center text-[9px] text-accent-faint max-w-[80px]">{tr("dragDropOrClick")}</p>
      ) : (
        <p className="mt-2 text-center text-xs text-accent-faint">{tr("dzClickBrowse")}</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        disabled={disabled}
        className="hidden"
      />

      <Dialog open={cropOpen} onOpenChange={(open) => { if (!open) closeCropper(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{tr("cropPhoto")}</DialogTitle>
            <DialogDescription>
              {tr("cropPhotoDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="relative mt-2 h-[360px] w-full overflow-hidden rounded-xl bg-black">
            {cropSource ? (
              <Cropper
                image={cropSource}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape={effectiveCropShape === "round" ? "round" : "rect"}
                showGrid
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, croppedPixels) => setCroppedAreaPixels(croppedPixels)}
              />
            ) : null}
          </div>

          <div className="mt-4 space-y-2">
            <label className="block text-xs text-accent-subtle">
              {tr("zoomLabel")}
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="mt-1 w-full"
              />
            </label>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={closeCropper} className="rounded-md border border-border px-3 py-1.5 text-sm text-accent">
              {tr("cancel")}
            </button>
            <button type="button" disabled={!croppedAreaPixels || cropApplying} onClick={applyCrop} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg disabled:opacity-60">
              {cropApplying ? tr("applyingAction") : tr("applyCrop")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
