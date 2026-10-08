#!/usr/bin/env python3
"""Generate and verify branded OpenSwitch NSIS installer bitmaps."""

from __future__ import annotations

import argparse
import struct
from pathlib import Path
from typing import Iterable

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError as exc:
    raise SystemExit("Pillow is required: python -m pip install Pillow") from exc


ROOT = Path(__file__).resolve().parents[1]
BUILD_DIR = ROOT / "build"
SIDEBAR_PATH = BUILD_DIR / "installer-sidebar.bmp"
HEADER_PATH = BUILD_DIR / "installer-header.bmp"

NAVY = "#192033"
WHITE = "#FFFFFF"
COOL_GRAY = "#DCE1E7"
ORANGE = "#D94F2B"
BRAND_COLORS = {NAVY, WHITE, COOL_GRAY, ORANGE}
SCALE = 4
LANCZOS = Image.Resampling.LANCZOS


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    names = (
        ("arialbd.ttf", "Arial Bold.ttf", "DejaVuSans-Bold.ttf")
        if bold
        else ("arial.ttf", "Arial.ttf", "DejaVuSans.ttf")
    )
    for name in names:
        try:
            return ImageFont.truetype(name, size * SCALE)
        except OSError:
            continue
    return ImageFont.load_default(size=SCALE * size)


def cubic_points(
    start: tuple[float, float],
    control_a: tuple[float, float],
    control_b: tuple[float, float],
    end: tuple[float, float],
    steps: int = 24,
) -> list[tuple[float, float]]:
    points = []
    for index in range(steps + 1):
        t = index / steps
        inverse = 1 - t
        points.append(
            (
                inverse**3 * start[0] + 3 * inverse**2 * t * control_a[0] + 3 * inverse * t**2 * control_b[0] + t**3 * end[0],
                inverse**3 * start[1] + 3 * inverse**2 * t * control_a[1] + 3 * inverse * t**2 * control_b[1] + t**3 * end[1],
            )
        )
    return points


def scaled_points(points: Iterable[tuple[float, float]]) -> list[tuple[int, int]]:
    return [(round(x * SCALE), round(y * SCALE)) for x, y in points]


def rounded_line(
    draw: ImageDraw.ImageDraw,
    points: Iterable[tuple[float, float]],
    fill: str,
    width: float,
) -> None:
    points_px = scaled_points(points)
    width_px = round(width * SCALE)
    radius = width_px // 2
    draw.line(points_px, fill=fill, width=width_px, joint="curve")
    for x, y in (points_px[0], points_px[-1]):
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=fill)


def draw_mark(
    draw: ImageDraw.ImageDraw,
    left: float,
    top: float,
    size: float,
    route_color: str,
    switch_color: str,
) -> None:
    """Draw the same open-switch/current-loop geometry used by app.ico."""
    factor = size / 256

    def point(x: float, y: float) -> tuple[float, float]:
        return left + x * factor, top + y * factor

    route = [point(64, 80), point(158, 80)]
    route.extend(
        cubic_points(point(158, 80), point(184, 80), point(200, 98), point(200, 127))[1:]
    )
    route.extend(
        cubic_points(point(200, 127), point(200, 156), point(184, 174), point(158, 174))[1:]
    )
    route.append(point(111, 174))
    rounded_line(draw, route, route_color, 22 * factor)

    x, y = point(74, 174)
    radius = 22 * factor
    draw.ellipse(
        ((x - radius) * SCALE, (y - radius) * SCALE, (x + radius) * SCALE, (y + radius) * SCALE),
        fill=switch_color,
    )
    rounded_line(draw, (point(88, 160), point(127, 121)), switch_color, 16 * factor)
    x, y = point(145, 103)
    radius = 9 * factor
    draw.ellipse(
        ((x - radius) * SCALE, (y - radius) * SCALE, (x + radius) * SCALE, (y + radius) * SCALE),
        fill=route_color,
    )


def canvas(width: int, height: int, color: str) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("RGB", (width * SCALE, height * SCALE), color)
    return image, ImageDraw.Draw(image)


def finish(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    return image.resize(size, LANCZOS).convert("RGB")


def sidebar_art() -> Image.Image:
    image, draw = canvas(164, 314, NAVY)
    draw.rectangle((0, 0, 5 * SCALE, 314 * SCALE), fill=ORANGE)
    draw.rectangle((18 * SCALE, 25 * SCALE, 146 * SCALE, 27 * SCALE), fill=COOL_GRAY)
    draw.rectangle((18 * SCALE, 27 * SCALE, 72 * SCALE, 30 * SCALE), fill=ORANGE)

    draw_mark(draw, 18, 39, 128, ORANGE, WHITE)
    draw.text((18 * SCALE, 177 * SCALE), "OPEN", font=font(25, bold=True), fill=WHITE)
    draw.text((18 * SCALE, 203 * SCALE), "SWITCH", font=font(25, bold=True), fill=WHITE)
    draw.rectangle((18 * SCALE, 244 * SCALE, 54 * SCALE, 247 * SCALE), fill=ORANGE)
    draw.text(
        (18 * SCALE, 259 * SCALE),
        "SECURE CONNECTIONS",
        font=font(8, bold=True),
        fill=COOL_GRAY,
    )
    draw.text((18 * SCALE, 273 * SCALE), "SIMPLIFIED.", font=font(8, bold=True), fill=COOL_GRAY)
    return finish(image, (164, 314))


def header_art() -> Image.Image:
    image, draw = canvas(150, 57, WHITE)
    draw.rectangle((0, 0, 3 * SCALE, 57 * SCALE), fill=ORANGE)
    draw.rectangle((3 * SCALE, 54 * SCALE, 150 * SCALE, 57 * SCALE), fill=COOL_GRAY)
    draw.text((13 * SCALE, 11 * SCALE), "OPEN", font=font(14, bold=True), fill=NAVY)
    draw.text((13 * SCALE, 27 * SCALE), "SWITCH", font=font(14, bold=True), fill=NAVY)
    draw.rectangle((91 * SCALE, 0, 150 * SCALE, 54 * SCALE), fill=NAVY)
    draw_mark(draw, 96, 1, 51, ORANGE, WHITE)
    return finish(image, (150, 57))


def save_bmp(path: Path, image: Image.Image) -> None:
    image.save(path, format="BMP", bitmap_format="bmp")


def verify_bmp(path: Path, expected_size: tuple[int, int]) -> None:
    data = path.read_bytes()
    if len(data) < 54 or data[:2] != b"BM":
        raise ValueError(f"{path.name}: invalid BMP signature")

    file_size, pixel_offset = struct.unpack_from("<IxxxxI", data, 2)
    dib_size = struct.unpack_from("<I", data, 14)[0]
    width, height, planes, bits = struct.unpack_from("<iiHH", data, 18)
    compression = struct.unpack_from("<I", data, 30)[0]
    row_size = ((width * 3 + 3) // 4) * 4
    expected_file_size = pixel_offset + row_size * abs(height)

    errors = []
    if (width, abs(height)) != expected_size:
        errors.append(f"expected {expected_size[0]}x{expected_size[1]}, got {width}x{abs(height)}")
    if planes != 1 or bits != 24:
        errors.append(f"expected one-plane 24-bit RGB, got planes={planes}, bits={bits}")
    if compression != 0:
        errors.append(f"expected uncompressed BI_RGB, got compression={compression}")
    if dib_size != 40 or pixel_offset != 54:
        errors.append(f"expected BITMAPINFOHEADER/pixel offset 54, got DIB={dib_size}, offset={pixel_offset}")
    if file_size != len(data) or len(data) != expected_file_size:
        errors.append(f"inconsistent file size: header={file_size}, actual={len(data)}, expected={expected_file_size}")

    with Image.open(path) as image:
        image.load()
        if image.mode != "RGB" or "A" in image.getbands():
            errors.append(f"expected RGB without alpha, got mode={image.mode}")
        color_counts = image.getcolors(maxcolors=image.width * image.height) or []
        colors = {
            f"#{red:02X}{green:02X}{blue:02X}"
            for _, (red, green, blue) in color_counts
        }
        missing_colors = BRAND_COLORS - colors
        if missing_colors:
            errors.append(f"missing exact brand colors: {', '.join(sorted(missing_colors))}")

    if errors:
        raise ValueError(f"{path.name}: " + "; ".join(errors))


def generate() -> None:
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    save_bmp(SIDEBAR_PATH, sidebar_art())
    save_bmp(HEADER_PATH, header_art())


def verify() -> None:
    failures = []
    for path, size in ((SIDEBAR_PATH, (164, 314)), (HEADER_PATH, (150, 57))):
        try:
            verify_bmp(path, size)
        except (OSError, ValueError, struct.error) as exc:
            failures.append(str(exc))
    if failures:
        raise SystemExit("Installer artwork verification failed:\n- " + "\n- ".join(failures))
    print("Verified NSIS installer artwork:")
    print("- installer-sidebar.bmp: 164x314, 24-bit BI_RGB, no alpha")
    print("- installer-header.bmp: 150x57, 24-bit BI_RGB, no alpha")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--verify-only", action="store_true", help="verify existing assets without regenerating them"
    )
    args = parser.parse_args()
    if not args.verify_only:
        generate()
    verify()


if __name__ == "__main__":
    main()
