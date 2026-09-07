# Ya Ke floating-window check

Verified 2026-09-06 with Chromium/Playwright and software WebGL.

- Shared Share Tech Mono body/labels and Orbitron headings; annotations use shared Acid Burn type-scale variables.
- Window fits beneath the shared header with a 12–24px bottom gap, including expanded mode. Short screens have an expandable star summary.
- UX workflow passed at 320×568, 390×844, 430×932, 568×320, 640×360, 844×390, 768×1024, 1024×768, 1366×768, 1920×1080, and 2560×1440. All 25 world cards fit in normal and expanded views.
- `tests/yake-floating-window.py --webfonts` passed at 1366×768, 1920×1080, 390×844, 320×568, 568×320, and 844×390 with actual Google webfonts loaded. Checks cover dynamic resizing, margin, typography, summary expansion, cards, and action visibility.
- Larger labels avoid projected planet markers so they do not intercept direct planet clicks.
- `tests/yake-atlas-browser.py` passed navigation, direct sphere selection, local moon views, geometry, shared black-hole lifecycle, and no-WebGL fallback.
- `tests/yake-card-interactions.py` passed mouse/touch focus and card interactions at its four viewport sizes.
- `node --check` passed for both changed JavaScript files; `git diff --check` passed.

Tests use desktop Chromium viewport/touch emulation; physical iOS/Android browser chrome and safe-area behavior were not device-tested.
