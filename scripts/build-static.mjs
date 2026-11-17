// Builds a static site (dist/index.html) with a Bootstrap carousel of Medium articles.
// The Medium RSS feed is public (no API key or token) and is fetched here at build time,
// so the generated page is plain HTML and nothing secret is involved.
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";

const HANDLE = process.env.MEDIUM_HANDLE || "faksam";
const FEED_URL = `https://medium.com/feed/@${HANDLE}`;
const NAME = "Sam";
const GREETING = "Hi, I'm Sam 👋🏾";
const TAGLINE_LINES = ["Software engineer.", "A curious mind building, learning and having fun.", "No hoopla"];
const TAGLINE = TAGLINE_LINES.join(" ");

const LINKS = [
    { icon: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/in/faksam/" },
    { icon: "github", label: "GitHub", href: "https://github.com/faksam" },
    { icon: "medium", label: "Medium", href: `https://medium.com/@${HANDLE}` },
    { icon: "instagram", label: "Instagram", href: "https://instagram.com/faksam" },
    { icon: "twitter-x", label: "X", href: "https://x.com/faksam" },
    { icon: "youtube", label: "YouTube", href: "https://youtube.com/@faksam" },
];

// Pinned public CDN assets with Subresource Integrity hashes.
const CDN = "https://cdn.jsdelivr.net/npm";
const BOOTSTRAP_CSS = {
    href: `${CDN}/bootstrap@5.3.3/dist/css/bootstrap.min.css`,
    integrity: "sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH",
};
const BOOTSTRAP_JS = {
    src: `${CDN}/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js`,
    integrity: "sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz",
};
const ICONS_CSS = {
    href: `${CDN}/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css`,
    integrity: "sha384-XGjxtQfXaH2tnPFa9x+ruJTuLE3Aa6LhHSWRr1XeTyhezb4abCG4ccI5AkVDxqC+",
};

const escapeHtml = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const decodeEntities = (s) =>
    s
        .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
        .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");

const unwrap = (s) => {
    const cdata = s.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
    return (cdata ? cdata[1] : decodeEntities(s)).trim();
};

const tag = (xml, name) => {
    const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
    return m ? unwrap(m[1]) : "";
};

// First article image hosted on Medium's CDN (skips the 1x1 tracking pixel).
const firstImage = (html) => html.match(/<img[^>]+src="(https:\/\/cdn-images-1\.medium\.com\/[^"]+)"/)?.[1] || "";

const parseItems = (xml) =>
    [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => ({
        title: tag(item, "title"),
        // Drop Medium's tracking query string.
        link: tag(item, "link").split("?")[0],
        date: new Date(tag(item, "pubDate")),
        // Newer posts only carry a snippet in <description>, so fall back to it.
        image: firstImage(tag(item, "content:encoded") || tag(item, "description")),
    }));

const res = await fetch(FEED_URL, { headers: { "user-agent": "faksam-static-build" } });
if (!res.ok) throw new Error(`Failed to fetch ${FEED_URL}: ${res.status}`);
const posts = parseItems(await res.text()).filter((p) => p.title && p.link);
// Fail the build rather than deploy an empty site.
if (posts.length === 0) throw new Error("No articles found in the Medium feed");

const fmt = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric" });

const slides = posts
    .map(
        (p, i) => `        <div class="carousel-item${i === 0 ? " active" : ""}">
          <a class="card text-decoration-none" href="${escapeHtml(p.link)}" rel="noopener">
            <div class="ratio ratio-16x9 bg-body-secondary">
              ${p.image ? `<img src="${escapeHtml(p.image)}" class="object-fit-cover rounded-top" alt="" loading="${i === 0 ? "eager" : "lazy"}">` : ""}
            </div>
            <div class="card-body">
              <h3 class="card-title h5">${escapeHtml(p.title)}</h3>
              ${isNaN(p.date) ? "" : `<p class="card-text text-body-secondary small mb-0">${fmt.format(p.date)}</p>`}
            </div>
          </a>
        </div>`
    )
    .join("\n");

const socials = `<nav class="fs-5" aria-label="Social links">
${LINKS.map((l) => `      <a class="text-body mx-2" href="${escapeHtml(l.href)}" rel="me noopener" aria-label="${escapeHtml(l.label)}" title="${escapeHtml(l.label)}"><i class="bi bi-${l.icon}"></i></a>`).join("\n")}
    </nav>`;

const page = ({ title, description, body, scripts = "" }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<link rel="icon" type="image/png" href="/programmer.png" media="(prefers-color-scheme: light)">
<link rel="icon" type="image/png" href="/programmer-white.png" media="(prefers-color-scheme: dark)">
<script>
  // Follow the OS/browser light or dark preference, including live changes.
  (function () {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    function apply() { document.documentElement.setAttribute("data-bs-theme", mq.matches ? "dark" : "light"); }
    apply();
    mq.addEventListener("change", apply);
  })();
</script>
<link rel="stylesheet" href="${BOOTSTRAP_CSS.href}" integrity="${BOOTSTRAP_CSS.integrity}" crossorigin="anonymous">
<link rel="stylesheet" href="${ICONS_CSS.href}" integrity="${ICONS_CSS.integrity}" crossorigin="anonymous">
</head>
<body class="d-flex flex-column min-vh-100">
<div class="container text-center py-5 flex-grow-1" style="max-width: 40rem;">
${body}
</div>
<footer class="text-center small text-body-secondary py-3">&copy; ${new Date().getFullYear()} ${escapeHtml(NAME)}</footer>
${scripts}
</body>
</html>
`;

const home = page({
    title: GREETING,
    description: TAGLINE,
    scripts: `<script src="${BOOTSTRAP_JS.src}" integrity="${BOOTSTRAP_JS.integrity}" crossorigin="anonymous"></script>`,
    body: `  <header class="mb-5">
    <h1 class="h2 fw-semibold">${escapeHtml(GREETING)}</h1>
    <p class="lead text-body-secondary">${TAGLINE_LINES.map(escapeHtml).join("<br>\n      ")} <i class="bi bi-headphones" aria-hidden="true"></i></p>
    ${socials}
  </header>
  <main>
    <h2 class="h6 text-uppercase text-body-secondary mb-3">Fun reads</h2>
    <div id="articles" class="carousel slide text-start" aria-label="Medium articles">
      <div class="carousel-inner">
${slides}
      </div>
      <button class="carousel-control-prev" type="button" data-bs-target="#articles" data-bs-slide="prev">
        <span class="carousel-control-prev-icon rounded-circle bg-dark bg-opacity-50 p-3" aria-hidden="true"></span>
        <span class="visually-hidden">Previous</span>
      </button>
      <button class="carousel-control-next" type="button" data-bs-target="#articles" data-bs-slide="next">
        <span class="carousel-control-next-icon rounded-circle bg-dark bg-opacity-50 p-3" aria-hidden="true"></span>
        <span class="visually-hidden">Next</span>
      </button>
    </div>
  </main>`,
});

// /links/ is driven by links.json so it can be edited by hand without touching code.
const linksData = JSON.parse(await readFile("links.json", "utf8"));
const quickLinks = (linksData.links || []).filter((l) => l.label && l.url);

const linksPage = page({
    title: `${linksData.title || "Links"} | ${NAME}`,
    description: TAGLINE,
    body: `  <main>
    <h1 class="h3 fw-bold mb-4">${escapeHtml(linksData.title || "Links")}</h1>
    <div class="d-grid gap-3">
${quickLinks.map((l) => `      <a class="btn btn-outline-secondary btn-lg" href="${escapeHtml(l.url)}" rel="noopener">${escapeHtml(l.label)}</a>`).join("\n")}
    </div>
    <div class="mt-5">
    ${socials}
    </div>
  </main>`,
});

await mkdir("dist/links", { recursive: true });
await cp("assets", "dist", { recursive: true });
await writeFile("dist/index.html", home);
await writeFile("dist/links/index.html", linksPage);
console.log(`Wrote dist/index.html (${posts.length} articles) and dist/links/index.html (${quickLinks.length} links)`);
