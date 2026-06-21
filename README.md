# A-Listing

Generate Amazon A+ Content from a single product photo — copy and correctly-sized images for every module, ready to paste into Seller Central.

---

## What it does

Upload one product photo, pick a content type, optionally paste keywords → get back:

- AI-generated module copy (headline, subheadline, body, alt text) for every module
- AI-generated lifestyle/feature images, conditioned on your real product photo so the product stays recognisable
- Every image resized to exact Amazon pixel specs and file-size limits
- Automatic compliance scan that flags any Amazon-banned language (prices, promotions, reviews, URLs, guarantees) before you upload
- One-click ZIP download of all images + a `copy.txt` file

---

## Content modes

| Mode | Canvas | Modules | File limit |
|------|--------|---------|------------|
| **Standard A+** | 970 px | Header (970×600), Section Banner (970×300), Square Inset (300×300), Grid Large (220×220), Grid Small (135×135) | 2 MB |
| **Premium A+** | 1464 px | Hero (1464×600), Feature Large (1464×900), Carousel (1464×600), Hotspot (1464×900) | 5 MB |
| **Brand Story** | 970 px | Brand Hero (970×600), Logo Card (300×200), Story Card (220×280) | 2 MB |

---

## Tech stack

- **Backend** — Node.js + Express, multer (uploads), sharp (image resizing), archiver (ZIP)
- **Frontend** — React + Vite
- **Vision / Copywriting** — `qwen/qwen3.5-397b-a17b` via NVIDIA NIM (`integrate.api.nvidia.com`)
- **Image editing** — `qwen/qwen-image-edit` via NVIDIA NIM (conditions on the uploaded product photo)

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/Rishabh4691/a-listing.git
cd a-listing

cd backend && npm install
cd ../frontend && npm install
```

### 2. Add API keys

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```
NVIDIA_API_KEY=nvapi-...        # vision + copywriting
NVIDIA_IMAGE_API_KEY=nvapi-...  # image editing
PORT=3001
```

Get keys from [NVIDIA NIM](https://integrate.api.nvidia.com).

### 3. Run

```bash
# Terminal 1 — backend (port 3001)
cd backend && node src/index.js

# Terminal 2 — frontend (port 5173)
cd frontend && npm run dev
```

Open **http://localhost:5173**

---

## Verify your keys

Hit **Test API Connection** in the footer, or:

```bash
curl http://localhost:3001/api/test-connection
# → {"ok":true,"textModel":"ready","imageKeyLoaded":true}
```

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/generate` | Main generation — multipart form: `productImage`, `mode`, `keywords`, `productName` |
| `GET` | `/api/usage` | Token usage and estimated cost log |
| `POST` | `/api/download` | Returns ZIP of all images + copy text |
| `GET` | `/api/test-connection` | Smoke-test both API keys |

---

## Amazon compliance rules enforced

Every copywriting prompt hard-codes these rules and the output is re-scanned before display:

- No prices, currency symbols, or discount percentages
- No promotional language (sale, limited time, coupon, deal)
- No customer reviews, star ratings, or testimonials
- No competitor names or comparison claims
- No contact info, URLs, or off-Amazon links
- No unverifiable claims — only facts visible in the product photo
- No guarantee language or shipping claims

Flagged copy is highlighted in the results for manual review rather than silently passed through.

---

## Usage log

Every API call is appended to `backend/logs/usage.jsonl` with model, token counts, and estimated USD cost. View the summary at `http://localhost:3001/api/usage`.

---

## Keyword integration

1. If you paste keywords (from Helium 10, SellerSprite, etc.) they are used directly
2. If left blank, the app queries DuckDuckGo for `"[product name]" amazon.in` and extracts the top recurring terms from search snippets — no Amazon scraping
3. Top 5–8 keywords are woven naturally into copy across modules (1–2 per module max)

---

## Project structure

```
a-listing/
├── backend/
│   ├── src/
│   │   ├── index.js                  # Express server
│   │   ├── routes/generate.js        # /api/* route handlers
│   │   ├── services/
│   │   │   ├── nvidia.js             # NVIDIA NIM API calls
│   │   │   ├── imageProcessor.js     # sharp resize to spec
│   │   │   ├── compliance.js         # banned-content scanner
│   │   │   ├── keywords.js           # keyword extraction
│   │   │   └── costLogger.js         # usage/cost logging
│   │   └── config/modules.js         # pixel specs for all modes
│   └── .env.example
└── frontend/
    └── src/
        ├── App.jsx
        └── components/
            ├── ModeSelector.jsx
            ├── UploadForm.jsx
            └── ResultsGallery.jsx
```
