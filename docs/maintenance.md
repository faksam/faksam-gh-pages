# Maintenance

## Pages

- `/` social links and a carousel of Medium articles
- `/links/` link-in-bio page, edited in [links.json](../links.json)

## Build

Requires Node.js 18 or newer. There are no dependencies to install.

```bash
node scripts/build-static.mjs
```

The script fetches the public Medium RSS feed (no API key needed) and writes the site to `dist/`.

## Run locally

From the repo root:

```bash
node scripts/build-static.mjs                      # build into dist/
python3 -m http.server 8080 --directory dist       # serve it
```

Then open <http://localhost:8080/> (home) and <http://localhost:8080/links/> (links page).
`npx serve dist` also works if you prefer Node.

After any change to `links.json` or `scripts/build-static.mjs`, run the build again and refresh the browser.
The preview needs an internet connection, because Bootstrap and the article images load from CDNs.
Stop the server with `Ctrl+C`.
