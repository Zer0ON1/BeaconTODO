"""Generate the BeaconTODO app icon (no third-party deps, pure zlib PNG).

Design: deep-blue rounded square + amber beacon circle with white core.
Rendered at 2x and box-downsampled for basic anti-aliasing.
Output: src-tauri/icons/icon.png (1024x1024)
"""

import os
import struct
import zlib

S = 2048
OUT = 1024

BLUE = (12, 68, 124, 255)
AMBER = (239, 159, 39, 255)
WHITE = (255, 255, 255, 255)
CLEAR = (0, 0, 0, 0)


def in_rounded_rect(x, y, x0, y0, x1, y1, r):
    if not (x0 <= x <= x1 and y0 <= y <= y1):
        return False
    dx = max(x0 + r - x, 0, x - (x1 - r))
    dy = max(y0 + r - y, 0, y - (y1 - r))
    return dx * dx + dy * dy <= r * r


def render():
    w = h = S
    px = bytearray(w * h * 4)
    pad = int(S * 0.10)
    x0, y0, x1, y1 = pad, pad, S - pad, S - pad
    r = int(S * 0.20)
    cx, cy = S // 2, int(S * 0.44)
    big_r = int(S * 0.30)
    core_r = int(S * 0.11)
    big_r2 = big_r * big_r
    core_r2 = core_r * core_r
    for y in range(h):
        row = y * w
        for x in range(w):
            i = (row + x) * 4
            if not in_rounded_rect(x, y, x0, y0, x1, y1, r):
                px[i:i + 4] = bytes(CLEAR)
                continue
            d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy)
            if d2 <= core_r2:
                px[i:i + 4] = bytes(WHITE)
            elif d2 <= big_r2:
                px[i:i + 4] = bytes(AMBER)
            else:
                px[i:i + 4] = bytes(BLUE)
    return px


def downsample(px, factor):
    src = S
    out = bytearray(OUT * OUT * 4)
    inv = factor * factor
    for y in range(OUT):
        for x in range(OUT):
            acc = [0, 0, 0, 0]
            base_x = x * factor
            base_y = y * factor
            for dy in range(factor):
                row = (base_y + dy) * src
                for dx in range(factor):
                    i = (row + base_x + dx) * 4
                    acc[0] += px[i]
                    acc[1] += px[i + 1]
                    acc[2] += px[i + 2]
                    acc[3] += px[i + 3]
            j = (y * OUT + x) * 4
            out[j] = acc[0] // inv
            out[j + 1] = acc[1] // inv
            out[j + 2] = acc[2] // inv
            out[j + 3] = acc[3] // inv
    return out


def write_png(path, w, h, px):
    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    raw = bytearray()
    stride = w * 4
    for y in range(h):
        raw.append(0)
        raw.extend(px[y * stride:(y + 1) * stride])
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    icons_dir = os.path.join(here, "..", "src-tauri", "icons")
    os.makedirs(icons_dir, exist_ok=True)
    px = render()
    small = downsample(px, 2)
    target = os.path.join(icons_dir, "icon.png")
    write_png(target, OUT, OUT, small)
    print(f"icon.png written: {target} ({os.path.getsize(target)} bytes)")
