# Literature Census — GitHub Pages compressed upload build

This is the full publication search/filter browser from the supplied localhost:8766 page, NOT the memory device application graph.

## Upload to the repository root

Unzip the outer download once. Upload these files and the entire data folder:

```
index.html
app.js
.nojekyll
README.md
data/
  publication-manifest.json
  publications-001.<hash>.json.gz
  ...
  publications-010.<hash>.json.gz
```

**Do not decompress the `.json.gz` files.** Upload them unchanged. The browser unpacks them automatically. Do not upload the ZIP itself, an extra parent directory, old uncompressed JSON parts, or the original publication-index.json.
Replace index.html and app.js from the earlier package. Keep Pages set to main / root. On upload failure, use smaller batches rather than adding all old and new files together.

Suggested commit message: `Publish compressed literature census browser`

## Preserved dataset and UI

- All Publications: 156,040
- Provisional Candidates: 4,531
- Venue controls: 20
- Target interval: 2023-10-01–2026-09-30
- Actual source collection cutoff: 2026-09-24 (unchanged)
- Raw JSON bytes inside each compressed file are identical to the earlier public package.
- Full titles, scientific markup, authors, dates, DOI/URLs, candidate flags, and topic/technology metadata are preserved. No reclassification or filtering-out was performed during packaging.
- Venue/Year/Topic multi-select, within-group OR/across-group AND, search, current ordering, and compact rows are unchanged.
- At most 500 matches display together; larger sets append batches of 300.
- Article PDFs, full texts, abstracts, source evidence sentences, workspace paths, and private raw archives are not included.

## Loading

Use the deployed Pages address or a local HTTP server, not file://.
The compressed data are approximately 20.8 MiB in total, instead of 78.4 MiB of JSON. Each file is at most approximately 2.2 MiB. Modern browsers decompress the data with their built-in DecompressionStream API; no external CDN, runtime API or server-side code is used. Unsupported browsers show an explicit error.

Compressed and decompressed SHA-256 hashes (when Web Crypto is available), lengths, per-file row counts, complete ID uniqueness and final candidate counts are verified before search is enabled. Partial/failed downloads are never shown as a full result.

Compression reduces uploaded/downloaded size, not the uncompressed dataset or browser memory requirement. The entire index is still loaded before filtering.

Build: `8498b4069c37821a`
Source public build: `86a5de479180f4d9`
