# Vendored libraries

These are inlined into `index.html` by `build.py`, so the page works offline.

| File | Library | Version | License |
|---|---|---|---|
| `xlsx.full.min.js` | SheetJS Community Edition | 0.18.5 | Apache-2.0 |
| `jszip.min.js` | JSZip | 3.10.1 | MIT (or GPLv3) |

Copied from `node_modules` after `npm install`:

```bash
cp node_modules/xlsx/dist/xlsx.full.min.js vendor/
cp node_modules/jszip/dist/jszip.min.js vendor/
```
