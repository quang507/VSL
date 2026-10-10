"""Tạo icon và màn khởi động VSLV cho iOS, Android và PWA từ tài sản thương hiệu:
  public/img/hand_yellow.png (bàn tay vàng) và public/img/logo.png (chữ VSLV).

Icon: nền xanh thương hiệu, bàn tay vàng ở giữa. Màn khởi động: nền #f4f8ff, logo ở giữa.
Ghi đè mọi file PNG sẵn có ở đúng kích thước của nó, nên không cần sửa cấu hình native.

Chạy: python scripts/make_icons.py
"""
import glob, os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
P = lambda *a: os.path.join(ROOT, *a)
BLUE_TOP, BLUE_BOT = (86, 150, 247), (58, 122, 236)   # quanh #4a8cf5
CANVAS = (244, 248, 255)                               # #f4f8ff
YELLOW = (252, 207, 72)                                # #fccf48


def crisp_hand(height):
    """Phóng bàn tay lên mà mép vẫn nét: phóng kênh alpha rồi làm dốc lại, tô một màu phẳng."""
    src = Image.open(P("public", "img", "hand_yellow.png")).convert("RGBA")
    w = round(src.width * height / src.height)
    a = src.getchannel("A").resize((w * 2, height * 2), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.2))
    a = a.point(lambda v: 0 if v < 96 else 255 if v > 160 else int((v - 96) * 255 / 64)).resize((w, height), Image.LANCZOS)
    hand = Image.new("RGBA", (w, height), YELLOW + (0,))
    hand.putalpha(a)
    return hand


def gradient(size):
    g = Image.new("RGB", (1, size))
    for y in range(size):
        t = y / max(1, size - 1)
        g.putpixel((0, y), tuple(round(BLUE_TOP[i] + (BLUE_BOT[i] - BLUE_TOP[i]) * t) for i in range(3)))
    return g.resize((size, size))


def master(size=1024, hand_frac=0.66):
    im = gradient(size).convert("RGBA")
    hand = crisp_hand(round(size * hand_frac))
    im.alpha_composite(hand, ((size - hand.width) // 2, (size - hand.height) // 2 + round(size * 0.01)))
    return im


def foreground(size):
    """Lớp trước của icon thích ứng Android: nền trong suốt, bàn tay nằm trong vùng an toàn 66%."""
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    hand = crisp_hand(round(size * 0.40))
    im.alpha_composite(hand, ((size - hand.width) // 2, (size - hand.height) // 2))
    return im


def masked(im, radius_frac):
    m = Image.new("L", im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, im.width - 1, im.height - 1], radius=round(im.width * radius_frac), fill=255)
    out = im.copy(); out.putalpha(m)
    return out


def splash(w, h):
    im = Image.new("RGB", (w, h), CANVAS)
    logo = Image.open(P("public", "img", "logo.png")).convert("RGBA")
    lw = round(min(w, h) * 0.36)
    logo = logo.resize((lw, round(logo.height * lw / logo.width)), Image.LANCZOS)
    im.paste(logo, ((w - logo.width) // 2, (h - logo.height) // 2), logo)
    return im


def main():
    M = master()
    n = 0
    # iOS
    M.convert("RGB").save(P("ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset", "AppIcon-512@2x.png")); n += 1
    for f in glob.glob(P("ios", "App", "App", "Assets.xcassets", "Splash.imageset", "*.png")):
        w, h = Image.open(f).size; splash(w, h).save(f); n += 1
    # Android
    res = P("android", "app", "src", "main", "res")
    for f in glob.glob(os.path.join(res, "**", "*.png"), recursive=True):
        w, h = Image.open(f).size
        name = os.path.basename(f)
        if name == "ic_launcher_foreground.png": foreground(w).save(f)
        elif name == "ic_launcher_round.png": masked(M.resize((w, h), Image.LANCZOS), 0.5).save(f)
        elif name == "ic_launcher.png": masked(M.resize((w, h), Image.LANCZOS), 0.2).save(f)
        elif name == "splash.png": splash(w, h).save(f)
        else: continue
        n += 1
    bg = os.path.join(res, "values", "ic_launcher_background.xml")
    open(bg, "w", encoding="utf-8").write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#4A8CF5</color>\n</resources>\n')
    # PWA / web
    for name, size in [("icon-192.png", 192), ("icon-512.png", 512), ("maskable-512.png", 512), ("apple-touch-icon.png", 180)]:
        M.resize((size, size), Image.LANCZOS).convert("RGB").save(P("public", "icons", name)); n += 1
    fav = P("public", "favicon.png")
    fs = Image.open(fav).size[0] if os.path.exists(fav) else 64
    masked(M.resize((fs, fs), Image.LANCZOS), 0.22).save(fav); n += 1
    # bản 1024 cho App Store Connect / Google Play
    os.makedirs(P("docs", "store"), exist_ok=True)
    M.convert("RGB").save(P("docs", "store", "icon-1024.png"))
    print("Đã tạo", n, "file icon/splash")


if __name__ == "__main__":
    main()
