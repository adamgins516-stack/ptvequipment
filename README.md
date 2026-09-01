# ptvequipment

QR-code equipment check-in / check-out for Patriots TV. Static site, no
build step, no login required to scan and use — just an admin backend for
adding gear and printing labels.

- **Scan page** (`index.html`) — scanning an item's QR code opens
  `?id=<itemId>` and shows exactly one button: **Check Out** if it's
  available, **Check In** if it's already out. Checking out asks you to
  tap your name from the crew roster; checking in is a single tap.
- **Crew Admin** (`admin.html`) — password-gated. Add/edit/archive items,
  see a live dashboard of what's checked out, browse the full history log,
  manage the crew roster, and download or print QR codes.
- **Print Labels** (`print.html`) — a printable sheet of QR codes + item
  names/categories, opened from Crew Admin → Inventory.

Data lives in the same Firebase Realtime Database as the rest of the PTV
sites (`ptv-rundown` project), under its own `equipment` path — it never
touches the rundown board or submissions data.

## One-time setup

### 1. Add the Firebase database rule

Go to [console.firebase.google.com](https://console.firebase.google.com) →
the `ptv-rundown` project → **Realtime Database → Rules**, and add an
`equipment` entry alongside whatever's already there:

```json
{
  "rules": {
    "board": { ".read": true, ".write": true },
    "submissions": { ".read": true, ".write": true },
    "equipment": { ".read": true, ".write": true }
  }
}
```

(Keep your existing `board`/`submissions` rules as they are — just add the
`equipment` line.) This is the same "no login needed" trust model the rest
of PTV's tools use — anyone with the database URL can read/write it. That's
fine for an internal crew tool; don't put anything sensitive in it.

### 2. Deploy to Netlify

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. In [Netlify](https://app.netlify.com), **Add new site → Import an
   existing project**, connect this repo. No build command needed — leave
   the build command blank and publish directory as `/` (repo root).
3. Once deployed, go to **Site configuration → Domain management → Add a
   custom domain** and add something like `equipment.ahspatriotstv.com`.
   Netlify will give you a DNS target.
4. In your DNS provider for `ahspatriotstv.com`, add the CNAME (or A/ALIAS
   record, whatever Netlify's instructions say) it gives you.

That's it — Netlify auto-redeploys on every push to this branch.

### 3. Set the admin password

Open `auth.js` and change `SITE_PASSWORD` (currently `ptvgear1`) to
whatever you want the crew admin password to be, then redeploy. Same
"keep honest people out" gate as the other PTV tools — not real security,
so don't rely on it for anything sensitive.

### 4. Add your crew roster and first items

Open `admin.html`, go to the **Roster** tab and add crew names, then go to
**Inventory** and add your first pieces of gear. Each item gets a QR code —
download individual PNGs or select items and hit **Print Selected/All** for
a printable label sheet (3 per row on standard letter paper).

## Local development

No build tools needed — it's plain HTML/CSS/JS. Just serve the folder:

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`. To test the scan flow, add an item in
`admin.html` first, grab its QR code's URL from the QR modal (or just note
the item's id), and visit `http://localhost:4173/?id=<itemId>`.

## Data model

```
equipment/
  items/{itemId}     { name, category, notes, status: "in"|"out",
                        holder, since, addedAt, archived }
  history/{pushId}    { itemId, itemName, action: "checkout"|"checkin",
                         person, at }
  roster/{pushId}     "Crew Member Name"
```
