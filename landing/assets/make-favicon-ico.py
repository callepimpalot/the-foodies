#!/usr/bin/env python3
"""Generate landing/assets/favicon.ico (16/32/48) from the same geometry as favicon.svg.

Why this exists: the repo has no SVG rasteriser available to the build (no
rsvg-convert, no cairosvg, no ImageMagick) and adding one would add a build step,
which the overnight brief forbids. Pillow is already present, so the .ico is drawn
directly from the same coordinates as the SVG instead.

The geometry below is a hand-kept twin of landing/assets/favicon.svg — if you edit
one, edit the other. Run:  python3 landing/assets/make-favicon-ico.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

# DESIGN_SYSTEM.md v3.0 §2 tokens
BOARD = (0x14, 0x21, 0x1B)
CHALK_DIM = (0x93, 0xA3, 0x95)
TICKET = (0xF1, 0xE7, 0xCC)
STAMP = (0xC1, 0x44, 0x2C)

SIZE = 512  # master render, downsampled per icon size
S = SIZE / 64.0  # the SVG viewBox is 64x64
SS = 4  # supersample factor on top of that


def pts(pairs):
    return [(x * S * SS, y * S * SS) for x, y in pairs]


def box(x0, y0, x1, y1):
    """Scaled [x0, y0, x1, y1] box."""
    return [x0 * S * SS, y0 * S * SS, x1 * S * SS, y1 * S * SS]


def build(size=SIZE):
    img = Image.new("RGBA", (SIZE * SS, SIZE * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # board tile
    d.rounded_rectangle(box(0, 0, 64, 64), radius=10 * S * SS, fill=BOARD)
    # rail
    d.rounded_rectangle(box(6, 11, 58, 14), radius=1.5 * S * SS, fill=CHALK_DIM)
    # ticket with torn bottom edge
    ticket = [
        (12, 17), (52, 17), (52, 45), (48.5, 41.5), (45, 45), (41.5, 41.5), (38, 45),
        (34.5, 41.5), (31, 45), (27.5, 41.5), (24, 45), (20.5, 41.5), (17, 45),
        (13.5, 41.5), (12, 47),
    ]
    d.polygon(pts(ticket), fill=TICKET)
    # punch hole
    cx, cy, r = 32 * S * SS, 23 * S * SS, 2.6 * S * SS
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=BOARD)
    # the stamp
    cx, cy, r = 44 * S * SS, 40 * S * SS, 9.5 * S * SS
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=STAMP)
    # tick inside the stamp
    d.line(pts([(40.2, 40), (42.9, 42.7), (47.8, 37.2)]), fill=TICKET,
           width=int(2.6 * S * SS), joint="curve")
    for p in pts([(40.2, 40), (47.8, 37.2)]):  # round the end caps
        d.ellipse([p[0] - 1.3 * S * SS, p[1] - 1.3 * S * SS,
                   p[0] + 1.3 * S * SS, p[1] + 1.3 * S * SS], fill=TICKET)

    return img.resize((size, size), Image.Resampling.LANCZOS)


def build_simple(size_px, tick_units=6.0):
    """A purpose-drawn small-size cut, NOT a downscale of build().

    At 16px the rail, the fold line, the grease tick and the torn edge all collapse
    into noise, so the small sizes keep only what survives: the board tile, a plain
    kraft ticket, and the stamp disc with a deliberately fat tick. Coordinates are in
    the same 64-unit space as build() so the two stay comparable.
    """
    ss = 8
    scale = (size_px * ss) / 64.0
    img = Image.new("RGBA", (size_px * ss, size_px * ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def b(x0, y0, x1, y1):
        return [x0 * scale, y0 * scale, x1 * scale, y1 * scale]

    def p(x, y):
        return (x * scale, y * scale)

    d.rounded_rectangle(b(0, 0, 64, 64), radius=11 * scale, fill=BOARD)
    d.rectangle(b(11, 15, 53, 47), fill=TICKET)
    cx, cy, r = p(45, 43)[0], p(45, 43)[1], 12 * scale
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=STAMP)
    tw = int(tick_units * scale)
    tick = [p(39.5, 43), p(43.5, 47.5), p(51, 38)]
    d.line(tick, fill=TICKET, width=tw, joint="curve")
    for q in (tick[0], tick[-1]):
        d.ellipse([q[0] - tw / 2, q[1] - tw / 2, q[0] + tw / 2, q[1] + tw / 2], fill=TICKET)
    return img.resize((size_px, size_px), Image.Resampling.LANCZOS)


def write_ico(path, images):
    """Write a multi-size .ico by hand.

    Pillow's ICO writer only emitted the first frame for this input (verified: a
    620-byte file containing 16x16 alone), so the container is written directly —
    the ICO format is a 6-byte header plus one 16-byte directory entry per frame,
    followed by the PNG payloads (PNG-in-ICO, supported everywhere that matters).
    """
    import struct
    from io import BytesIO

    payloads = []
    for img in images:
        buf = BytesIO()
        img.save(buf, format="PNG")
        payloads.append((img.size, buf.getvalue()))

    header = struct.pack("<HHH", 0, 1, len(payloads))
    offset = len(header) + 16 * len(payloads)
    entries, blobs = b"", b""
    for (w, h), data in payloads:
        entries += struct.pack(
            "<BBBBHHII",
            w if w < 256 else 0,
            h if h < 256 else 0,
            0, 0, 1, 32, len(data), offset,
        )
        blobs += data
        offset += len(data)
    path.write_bytes(header + entries + blobs)


def main():
    out = Path(__file__).with_name("favicon.ico")
    # 48 keeps the full mark; 32 and 16 get their own simplified drawings rather than
    # a downscale, because a downscaled 16 was illegible (verified by rendering both).
    write_ico(out, [build_simple(16, tick_units=9.0), build_simple(32, tick_units=6.5), build(48)])
    print(f"wrote {out} ({out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
