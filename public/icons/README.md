# PWA Icons

Place the following icon files in this directory:

- `icon-192.png` — 192x192 px, standard app icon
- `icon-512.png` — 512x512 px, standard app icon
- `icon-maskable-512.png` — 512x512 px, maskable icon (with safe zone padding)

## Generating icons

You can generate these from a source SVG or high-res PNG using tools like:
- https://maskable.app/ (for maskable icon)
- https://realfavicongenerator.net/
- Sharp CLI: `npx sharp-cli resize 512 512 -i source.png -o icon-512.png`
