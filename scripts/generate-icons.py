#!/usr/bin/env python3
"""Generate and verify OpenSwitch application and Windows tray icons."""

from __future__ import annotations

import argparse
import io
import struct
from pathlib import Path
from typing import Callable, Iterable

try:
    from PIL import Image, ImageDraw
except ImportError as exc:
    raise SystemExit("Pillow is required: python -m pip install Pillow") from exc


ROOT = Path(__file__).resolve().parents[1]
ICON_DIR = ROOT / "resources" / "icons"
APP_SIZES = (16, 20, 24, 32, 48, 64, 128, 256, 512)
ICO_SIZES = APP_SIZES[:-1]
TRAY_STATES = ("disconnected", "connecting", "connected", "error")

CARBON = "#111417"
CURRENT = "#35C987"
SIGNAL = "#F2F5F7"
LINE = "#30373E"
TRAY_INK = "#FFFFFF"
TRAY_HALO = "#111417"

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
LANCZOS = Image.Resampling.LANCZOS


APP_SVG = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-labelledby="title desc">
  <title id="title">OpenSwitch application icon</title>
  <desc id="desc">An open electrical switch within a current loop on a carbon field</desc>
  <rect width="256" height="256" rx="56" fill="{CARBON}"/>
  <rect x="5" y="5" width="246" height="246" rx="51" fill="none" stroke="{LINE}" stroke-width="2"/>
  <path d="M64 80h94c26 0 42 18 42 47s-16 47-42 47h-47" fill="none" stroke="{CURRENT}" stroke-width="22" stroke-linecap="round"/>
  <circle cx="74" cy="174" r="22" fill="{SIGNAL}"/>
  <path d="m88 160 39-39" fill="none" stroke="{SIGNAL}" stroke-width="16" stroke-linecap="round"/>
  <circle cx="145" cy="103" r="9" fill="{CURRENT}"/>
</svg>
'''


def tray_svg(state: str) -> str:
    common = '''  <path d="M3 5h7.25A2.75 2.75 0 0 1 13 7.75 2.75 2.75 0 0 1 10.25 10.5H9.5" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round"/>
  <circle cx="5" cy="10.5" r="{radius}" fill="{color}"/>'''
    layers: list[str] = []
    for color, width, radius in ((TRAY_HALO, "3.25", "2.35"), (TRAY_INK, "1.65", "1.35")):
        layers.append(common.format(color=color, width=width, radius=radius))
        if state == "connected":
            layers.append(
                f'  <path d="m5.8 9.8 4.35-4.15" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round"/>'
            )
        elif state == "disconnected":
            layers.append(
                f'  <path d="m5.8 9.8 1.35-1.3" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round"/>'
            )
        elif state == "connecting":
            for x, y in ((6.2, 9.4), (8.0, 7.7), (9.8, 6.0)):
                r = "1.45" if color == TRAY_HALO else "0.72"
                layers.append(f'  <circle cx="{x}" cy="{y}" r="{r}" fill="{color}"/>')
    if state == "error":
        layers.extend(
            (
                f'  <circle cx="12" cy="12.5" r="3.5" fill="{TRAY_HALO}"/>',
                f'  <circle cx="12" cy="12.5" r="2.7" fill="{TRAY_INK}"/>',
                f'  <circle cx="12" cy="12.5" r="1.95" fill="{TRAY_HALO}"/>',
                f'  <path d="m10.8 11.3 2.4 2.4m0-2.4-2.4 2.4" fill="none" stroke="{TRAY_INK}" stroke-width="1.05" stroke-linecap="round"/>',
            )
        )

    title = state.capitalize()
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" role="img" aria-labelledby="title desc">
  <title id="title">OpenSwitch {state}</title>
  <desc id="desc">High-contrast Windows tray icon: {title}</desc>
{chr(10).join(layers)}
</svg>
'''


def supersampled(size: int, draw_fn: Callable[[ImageDraw.ImageDraw, float], None]) -> Image.Image:
    factor = 8 if size <= 64 else 4
    canvas_size = size * factor
    image = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(image), canvas_size / 256)
    return image.resize((size, size), LANCZOS)


def rounded_line(
    draw: ImageDraw.ImageDraw,
    points: Iterable[tuple[float, float]],
    fill: str,
    width: float,
    scale: float,
) -> None:
    scaled = [(round(x * scale), round(y * scale)) for x, y in points]
    pixel_width = max(1, round(width * scale))
    radius = pixel_width // 2
    draw.line(scaled, fill=fill, width=pixel_width, joint="curve")
    for x, y in (scaled[0], scaled[-1]):
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=fill)


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
        x = inverse**3 * start[0] + 3 * inverse**2 * t * control_a[0] + 3 * inverse * t**2 * control_b[0] + t**3 * end[0]
        y = inverse**3 * start[1] + 3 * inverse**2 * t * control_a[1] + 3 * inverse * t**2 * control_b[1] + t**3 * end[1]
        points.append((x, y))
    return points


def draw_app(draw: ImageDraw.ImageDraw, scale: float) -> None:
    radius = round(56 * scale)
    edge = round(256 * scale)
    draw.rounded_rectangle((0, 0, edge, edge), radius=radius, fill=CARBON)
    inset = round(5 * scale)
    draw.rounded_rectangle(
        (inset, inset, edge - inset, edge - inset),
        radius=round(51 * scale),
        outline=LINE,
        width=max(1, round(2 * scale)),
    )

    route = [(64, 80), (158, 80)]
    route.extend(cubic_points((158, 80), (184, 80), (200, 98), (200, 127))[1:])
    route.extend(cubic_points((200, 127), (200, 156), (184, 174), (158, 174))[1:])
    route.append((111, 174))
    rounded_line(draw, route, CURRENT, 22, scale)

    x, y, r = (74 * scale, 174 * scale, 22 * scale)
    draw.ellipse((x - r, y - r, x + r, y + r), fill=SIGNAL)
    rounded_line(draw, ((88, 160), (127, 121)), SIGNAL, 16, scale)
    x, y, r = (145 * scale, 103 * scale, 9 * scale)
    draw.ellipse((x - r, y - r, x + r, y + r), fill=CURRENT)


def tray_canvas(size: int, state: str) -> Image.Image:
    factor = 12 if size == 16 else 8
    image = Image.new("RGBA", (size * factor, size * factor), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    scale = size * factor / 16

    route = [(3, 5), (10.25, 5)]
    route.extend(cubic_points((10.25, 5), (11.9, 5), (13, 6.1), (13, 7.75), 12)[1:])
    route.extend(cubic_points((13, 7.75), (13, 9.4), (11.9, 10.5), (10.25, 10.5), 12)[1:])
    route.append((9.5, 10.5))

    def stroke(points: Iterable[tuple[float, float]], outer: float = 3.25, inner: float = 1.65) -> None:
        rounded_line(draw, points, TRAY_HALO, outer, scale)
        rounded_line(draw, points, TRAY_INK, inner, scale)

    stroke(route)
    for color, radius in ((TRAY_HALO, 2.35), (TRAY_INK, 1.35)):
        x, y, r = (5 * scale, 10.5 * scale, radius * scale)
        draw.ellipse((x - r, y - r, x + r, y + r), fill=color)

    if state == "connected":
        stroke(((5.8, 9.8), (10.15, 5.65)))
    elif state == "disconnected":
        stroke(((5.8, 9.8), (7.15, 8.5)))
    elif state == "connecting":
        for x, y in ((6.2, 9.4), (8.0, 7.7), (9.8, 6.0)):
            for color, radius in ((TRAY_HALO, 1.45), (TRAY_INK, 0.72)):
                cx, cy, r = x * scale, y * scale, radius * scale
                draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=color)
    else:
        for color, radius in (
            (TRAY_HALO, 3.5),
            (TRAY_INK, 2.7),
            (TRAY_HALO, 1.95),
        ):
            x, y, r = 12 * scale, 12.5 * scale, radius * scale
            draw.ellipse((x - r, y - r, x + r, y + r), fill=color)
        rounded_line(draw, ((10.8, 11.3), (13.2, 13.7)), TRAY_INK, 1.05, scale)
        rounded_line(draw, ((13.2, 11.3), (10.8, 13.7)), TRAY_INK, 1.05, scale)

    return image.resize((size, size), LANCZOS)


def write_png(path: Path, image: Image.Image) -> None:
    image.save(path, format="PNG", optimize=True)


def write_ico(path: Path, images: dict[int, Image.Image]) -> None:
    payloads: list[bytes] = []
    for size in ICO_SIZES:
        buffer = io.BytesIO()
        images[size].save(buffer, format="PNG", optimize=True)
        payloads.append(buffer.getvalue())

    directory_size = 6 + 16 * len(payloads)
    offset = directory_size
    with path.open("wb") as icon_file:
        icon_file.write(struct.pack("<HHH", 0, 1, len(payloads)))
        for size, payload in zip(ICO_SIZES, payloads):
            dimension = 0 if size == 256 else size
            icon_file.write(
                struct.pack("<BBBBHHII", dimension, dimension, 0, 0, 1, 32, len(payload), offset)
            )
            offset += len(payload)
        for payload in payloads:
            icon_file.write(payload)


def png_dimensions(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    if data[:8] != PNG_SIGNATURE or data[12:16] != b"IHDR":
        raise ValueError(f"Invalid PNG signature or IHDR: {path}")
    return struct.unpack(">II", data[16:24])


def ico_dimensions(path: Path) -> tuple[int, ...]:
    data = path.read_bytes()
    reserved, image_type, count = struct.unpack("<HHH", data[:6])
    if (reserved, image_type) != (0, 1):
        raise ValueError(f"Invalid ICO signature: {path}")
    dimensions = []
    for index in range(count):
        width, height = struct.unpack("<BB", data[6 + index * 16 : 8 + index * 16])
        width = width or 256
        height = height or 256
        if width != height:
            raise ValueError(f"Non-square ICO entry: {width}x{height}")
        dimensions.append(width)
    return tuple(dimensions)


def generate() -> None:
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    (ICON_DIR / "app.svg").write_text(APP_SVG, encoding="utf-8", newline="\n")
    for state in TRAY_STATES:
        (ICON_DIR / f"tray-{state}.svg").write_text(
            tray_svg(state), encoding="utf-8", newline="\n"
        )

    app_images = {size: supersampled(size, draw_app) for size in APP_SIZES}
    for size, image in app_images.items():
        write_png(ICON_DIR / f"app-{size}.png", image)
    write_ico(ICON_DIR / "app.ico", app_images)

    for state in TRAY_STATES:
        write_png(ICON_DIR / f"tray-{state}.png", tray_canvas(16, state))
        write_png(ICON_DIR / f"tray-{state}@2x.png", tray_canvas(32, state))


def verify() -> None:
    errors: list[str] = []
    for size in APP_SIZES:
        path = ICON_DIR / f"app-{size}.png"
        try:
            actual = png_dimensions(path)
            if actual != (size, size):
                errors.append(f"{path.name}: expected {size}x{size}, got {actual[0]}x{actual[1]}")
        except (OSError, ValueError) as exc:
            errors.append(str(exc))

    for state in TRAY_STATES:
        for suffix, expected in (("", 16), ("@2x", 32)):
            path = ICON_DIR / f"tray-{state}{suffix}.png"
            try:
                actual = png_dimensions(path)
                if actual != (expected, expected):
                    errors.append(
                        f"{path.name}: expected {expected}x{expected}, got {actual[0]}x{actual[1]}"
                    )
            except (OSError, ValueError) as exc:
                errors.append(str(exc))

    try:
        actual_ico_sizes = ico_dimensions(ICON_DIR / "app.ico")
        if actual_ico_sizes != ICO_SIZES:
            errors.append(f"app.ico: expected entries {ICO_SIZES}, got {actual_ico_sizes}")
    except (OSError, ValueError, struct.error) as exc:
        errors.append(str(exc))

    if errors:
        raise SystemExit("Icon verification failed:\n- " + "\n- ".join(errors))

    print(f"Verified {len(APP_SIZES) + len(TRAY_STATES) * 2} PNG files and app.ico")
    print(f"PNG dimensions: app={APP_SIZES}, tray=(16, 32)")
    print(f"ICO entries: {ICO_SIZES}")


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
