#!/usr/bin/env python3
"""Generate PWA icons (no external deps). Draws the "Chronographe" mark:
a rounded steel tile, an electric-blue sweeping ring, a bold barbell bar."""
import struct, zlib, math, os

def px(r, g, b, a=255): return (r, g, b, a)

STEEL = (0x2B, 0x3A, 0x67)
DEEP  = (0x1B, 0x24, 0x42)
SIGNAL= (0x3D, 0x5A, 0xFE)
VOLT  = (0xC6, 0xF1, 0x35)
WHITE = (0xFF, 0xFF, 0xFF)

def lerp(a, b, t): return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))

def render(size, sup=4):
    S = size * sup
    buf = [[(0, 0, 0, 0)] * S for _ in range(S)]
    cx = cy = S / 2
    radius_bg = S * 0.5
    corner = S * 0.235  # rounded-square (superellipse-ish)

    def in_rounded(x, y):
        # rounded rect covering full tile with rounded corners
        half = S / 2
        dx = abs(x - cx); dy = abs(y - cy)
        rx = half; ry = half
        if dx <= rx - corner or dy <= ry - corner:
            return dx <= rx and dy <= ry
        ddx = dx - (rx - corner); ddy = dy - (ry - corner)
        return (ddx * ddx + ddy * ddy) <= corner * corner

    ring_r = S * 0.335
    ring_w = S * 0.085
    bar_w  = S * 0.30
    bar_h  = S * 0.072
    plate_w= S * 0.052
    plate_h= S * 0.20

    for y in range(S):
        for x in range(S):
            if not in_rounded(x + 0.5, y + 0.5):
                continue
            # background vertical gradient steel -> deep
            t = y / S
            col = lerp(STEEL, DEEP, t)
            fx = x + 0.5; fy = y + 0.5
            dx = fx - cx; dy = fy - cy
            dist = math.hypot(dx, dy)
            ang = math.atan2(dy, dx)  # -pi..pi
            # sweeping ring: signal, fading near top-right into volt tip
            if abs(dist - ring_r) <= ring_w / 2:
                # sweep from -90deg going clockwise ~300deg
                a = (math.degrees(ang) + 90) % 360
                if a <= 300:
                    frac = a / 300
                    col = SIGNAL if frac < 0.86 else lerp(SIGNAL, VOLT, (frac - 0.86) / 0.14)
                else:
                    col = lerp(DEEP, STEEL, 0.4)  # faint remainder track
            # barbell bar (mono/utility motif) centered
            if abs(dx) <= bar_w / 2 and abs(dy) <= bar_h / 2:
                col = WHITE
            # plates at both ends of bar
            for sgn in (-1, 1):
                px_c = sgn * (bar_w / 2 + plate_w / 2)
                if abs(dx - px_c) <= plate_w / 2 and abs(dy) <= plate_h / 2:
                    col = WHITE
            buf[y][x] = (col[0], col[1], col[2], 255)

    # box downsample sup -> 1
    out = bytearray()
    for oy in range(size):
        out.append(0)  # filter byte
        for ox in range(size):
            r = g = b = a = 0
            for sy in range(sup):
                for sx in range(sup):
                    p = buf[oy * sup + sy][ox * sup + sx]
                    r += p[0]; g += p[1]; b += p[2]; a += p[3]
            n = sup * sup
            out += bytes((r // n, g // n, b // n, a // n))
    return bytes(out)

def write_png(path, size):
    raw = render(size)
    def chunk(typ, data):
        c = typ + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    idat = zlib.compress(raw, 9)
    with open(path, "wb") as f:
        f.write(sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b""))
    print("wrote", path, size)

if __name__ == "__main__":
    d = os.path.join(os.path.dirname(__file__), "..", "icons")
    os.makedirs(d, exist_ok=True)
    for s in (192, 512, 180):
        write_png(os.path.join(d, f"icon-{s}.png"), s)
