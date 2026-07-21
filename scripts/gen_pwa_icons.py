"""Generate PWA icon assets for mfe-auth (green paw on brand background).

Run once (Pillow required):
    docker run --rm -v "<repo>:/repo" python:3.11-slim \
        bash -c "pip install -q pillow && python /repo/scripts/gen_pwa_icons.py"
Writes: apps/mfe-auth/public/{pwa-192.png,pwa-512.png,apple-touch-icon.png,favicon.ico}
"""
from pathlib import Path
from PIL import Image, ImageDraw

GREEN = (34, 197, 94, 255)   # #22c55e (app theme_color)
WHITE = (255, 255, 255, 255)
OUT = Path(__file__).resolve().parents[1] / "apps" / "mfe-auth" / "public"
OUT.mkdir(parents=True, exist_ok=True)


def draw_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), GREEN)  # solid bg = maskable-safe
    d = ImageDraw.Draw(img)
    s = size

    def ell(cx, cy, rx, ry):
        d.ellipse([s * (cx - rx), s * (cy - ry), s * (cx + rx), s * (cy + ry)], fill=WHITE)

    # main pad
    ell(0.50, 0.66, 0.20, 0.16)
    # four toes across the top of the pad
    ell(0.30, 0.44, 0.075, 0.10)
    ell(0.43, 0.36, 0.078, 0.105)
    ell(0.57, 0.36, 0.078, 0.105)
    ell(0.70, 0.44, 0.075, 0.10)
    return img


def main() -> None:
    icon512 = draw_icon(512)
    icon512.save(OUT / "pwa-512.png")
    draw_icon(192).save(OUT / "pwa-192.png")
    draw_icon(180).save(OUT / "apple-touch-icon.png")
    # favicon.ico with a couple of sizes
    draw_icon(64).save(OUT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("Wrote icons to", OUT)
    for f in sorted(OUT.iterdir()):
        print("  ", f.name, f.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
