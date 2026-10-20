"""Capture the primary screen to a BMP file using only ctypes (no PIL)."""
import ctypes
from ctypes import wintypes
import struct
import sys

user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32

SM_CXSCREEN = 0
SM_CYSCREEN = 1

width = user32.GetSystemMetrics(SM_CXSCREEN)
height = user32.GetSystemMetrics(SM_CYSCREEN)

src_dc = user32.GetDC(0)
mem_dc = gdi32.CreateCompatibleDC(src_dc)
bmp = gdi32.CreateCompatibleBitmap(src_dc, width, height)
gdi32.SelectObject(mem_dc, bmp)
gdi32.BitBlt(mem_dc, 0, 0, width, height, src_dc, 0, 0, 0x00CC0020)  # SRCCOPY

class BITMAPINFOHEADER(ctypes.Structure):
    _fields_ = [
        ("biSize", wintypes.DWORD),
        ("biWidth", wintypes.LONG),
        ("biHeight", wintypes.LONG),
        ("biPlanes", wintypes.WORD),
        ("biBitCount", wintypes.WORD),
        ("biCompression", wintypes.DWORD),
        ("biSizeImage", wintypes.DWORD),
        ("biXPelsPerMeter", wintypes.LONG),
        ("biYPelsPerMeter", wintypes.LONG),
        ("biClrUsed", wintypes.DWORD),
        ("biClrImportant", wintypes.DWORD),
    ]

bi = BITMAPINFOHEADER()
bi.biSize = ctypes.sizeof(BITMAPINFOHEADER)
bi.biWidth = width
bi.biHeight = -height  # top-down
bi.biPlanes = 1
bi.biBitCount = 32
bi.biCompression = 0  # BI_RGB

buffer = ctypes.create_string_buffer(width * height * 4)
gdi32.GetDIBits(mem_dc, bmp, 0, height, buffer, ctypes.byref(bi), 0)

# BMP: 32bpp BI_RGB stored as BGRX
row_size = width * 4
file_header_size = 14
info_size = ctypes.sizeof(BITMAPINFOHEADER)
pixel_data_size = row_size * height
file_size = file_header_size + info_size + pixel_data_size

out = sys.argv[1] if len(sys.argv) > 1 else "screenshot.bmp"
with open(out, "wb") as f:
    f.write(b"BM")
    f.write(struct.pack("<IHHI", file_size, 0, 0, file_header_size + info_size))
    f.write(bytes(bi))
    f.write(buffer.raw[:pixel_data_size])

gdi32.DeleteObject(bmp)
gdi32.DeleteDC(mem_dc)
user32.ReleaseDC(0, src_dc)
print(f"saved {out} {width}x{height}")
