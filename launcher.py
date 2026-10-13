"""Native launcher: opens the emulator in its own WebView2 window.

The page is served from a local http server (pywebview's built-in one) because
AudioWorklet modules cannot be loaded from file:// URLs.
"""
import os
import sys

import webview

BASE = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))


def main():
    webview.create_window(
        'MegaMike',
        os.path.join(BASE, 'index.html'),
        width=1460,
        height=900,
        min_size=(900, 560),
        background_color='#1d1d20',
    )
    webview.start(http_server=True)


if __name__ == '__main__':
    main()
