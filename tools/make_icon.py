"""Generate assets/megamike.ico: a black panel with a cream knob and pointer.

Pure Python: writes PNG-compressed ICO entries at 16, 32, 48 and 256 pixels.
"""
import math
import os
import struct
import zlib

PANEL = (0x1C, 0x1C, 0x1E)
WOOD = (0x7A, 0x4A, 0x24)
CREAM = (0xE8, 0xDC, 0xBF)
KNOB = (0x0B, 0x0B, 0x0B)
WHITE = (0xF2, 0xF2, 0xF2)


def render(size):
    px = [[PANEL] * size for _ in range(size)]
    wood = max(1, size // 8)
    for y in range(size):
        for x in range(wood):
            px[y][x] = WOOD
            px[y][size - 1 - x] = WOOD
    cx = cy = (size - 1) / 2
    r_scale = size * 0.44
    r_knob = size * 0.3
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - cx, y - cy)
            if d <= r_knob:
                px[y][x] = KNOB
            elif r_scale - max(1, size / 24) <= d <= r_scale:
                ang = math.degrees(math.atan2(x - cx, cy - y))
                if -150 <= ang <= 150:
                    px[y][x] = CREAM
    # pointer line at about "7 o'clock past noon" (value 7 of 10)
    ang = math.radians(-150 + 300 * 0.7)
    for t in range(int(r_knob)):
        x = int(round(cx + t * math.sin(ang)))
        y = int(round(cy - t * math.cos(ang)))
        for dx in (-1, 0, 1) if size >= 32 else (0,):
            if 0 <= x + dx < size and 0 <= y < size:
                px[y][x + dx] = WHITE
    return px


def png_bytes(px):
    size = len(px)
    raw = b''.join(b'\x00' + b''.join(bytes(p) + b'\xff' for p in row) for row in px)

    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)

    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw, 9))
            + chunk(b'IEND', b''))


def main():
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'megamike.ico')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    sizes = [16, 32, 48, 256]
    images = [png_bytes(render(s)) for s in sizes]
    header = struct.pack('<HHH', 0, 1, len(sizes))
    offset = 6 + 16 * len(sizes)
    entries = b''
    for s, img in zip(sizes, images):
        entries += struct.pack('<BBBBHHII', s % 256, s % 256, 0, 0, 1, 32, len(img), offset)
        offset += len(img)
    with open(out, 'wb') as f:
        f.write(header + entries + b''.join(images))
    print('wrote', out)


if __name__ == '__main__':
    main()
