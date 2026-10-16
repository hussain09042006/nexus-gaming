# Nexus Gaming

Nexus Gaming is a static multi-page game-discovery website for browsing a curated library of 50 PC games, viewing game details, and keeping a personal collection in the current browser.

## Features

- Automatically rotating six-second Editor's Pick carousel using five existing games, with accessible manual controls, pause/resume, hover/focus and tab-visibility pauses, and reduced-motion support.
- Separate home, library, genre, game-detail, My Games, Store, Compare, About, and Privacy pages.
- One shared catalog used by every page, with genre exploration and a query-driven library.
- Search across title, genre, description, and release year.
- Genre, minimum-rating, and sorting filters; search query and filter selections are represented in the library URL.
- Favourites and recently viewed games on a dedicated page, using the existing browser-storage keys and numeric-ID format.
- Side-by-side comparison of up to three games, persisted as catalog IDs in a separate browser-storage key.
- Game detail pages at `game.html?id=<catalog-id>`, including related games and available purchase options.
- A Store page and game-detail purchase section that accept verified retailer or explicitly approved affiliate offers.
- Responsive layout, keyboard controls, reduced-motion support, artwork fallbacks, and accessible status messages.
- One shared 50-game catalog with unique numeric IDs; unrated games do not display or receive invented scores.

## Technology and files

This is plain HTML, CSS, and vanilla JavaScript. It requires no build step, backend, account, API key, or JavaScript package installation.

```text
NexusGaming/
├── index.html
├── games.html
├── genres.html
├── game.html
├── my-games.html
├── store.html
├── compare.html
├── about.html
├── privacy.html
├── catalog.js
├── pages.js
├── script.js
├── styles.css
├── favicon.svg
├── README.md
└── .gitignore
```

## Run and test locally

1. Open this folder in VS Code.
2. Install or enable the **Live Server** extension if needed.
3. Right-click `index.html` and choose **Open with Live Server**.
4. Use the shared navigation to review Home, Library, Genres, My Games, Store, Compare, About, and Privacy.
5. On the Library page, try a URL such as `games.html?q=cyberpunk&genre=RPG`; test filters, sorting, ratings, and clearing.
6. Save a favourite, open My Games, remove it, then reload to check persistence.
7. Open a details page such as `game.html?id=1`; test an invalid ID with `game.html?id=999`.
8. Watch the Editor's Pick hero for an automatic change after six seconds; test pause, arrows, indicators, focus/hover pause, and reduced-motion behavior.
9. Check the Store's empty state. No verified retailer or affiliate offer is configured by default.
10. Add games to comparison from the Library or a game page, open Compare, and test removal, clearing, and reload persistence.
11. Test keyboard navigation and mobile layouts; ensure artwork either loads or falls back gracefully.

The app uses the browser's `localStorage`. The existing `favorites` key remains a JSON array of numeric game IDs. The existing wishlist, recently viewed games, and view preference use `nexus.wishlist.v1`, `nexus.recent.v1`, and `nexus.view.v1`; game comparison uses `nexus.compare.v1`, a separate JSON array of up to three numeric catalog IDs. Stored lists are checked against catalog IDs. Clearing browser site data removes these local lists. They do not sync between browsers or devices. Favourites and recently viewed games are available on the My Games page.

The app handles blocked or full local storage by reporting that a change could not be saved. Existing favorites are not rewritten just by loading the page; they are normalized when a user makes a favorite change.

## Purchase offers

Game-detail pages and the Store page support zero or multiple offers on a game record using an optional `purchaseOffers` array. No purchase offers are currently configured, so the Store displays an honest empty state and game pages show “Offers coming soon.” An offer is shown only when its record has a non-empty retailer name, an absolute HTTPS URL without credentials, `verified: true`, and `type: 'retailer'` or `type: 'affiliate'`. Affiliate offers also require `approved: true`. Optional `price` and `availability` values must be supplied as non-empty display strings on a verified offer; the page displays them verbatim and does not infer a currency, calculate a discount, or fetch availability. The UI labels ordinary retailer links separately from affiliate links and opens destinations in a new tab with `noopener noreferrer`.

Only add an offer after verifying the destination and applicable edition/region. For an affiliate offer, set `approved: true` only after approval by the affiliate program and paste the exact tracking URL the program supplied. Do not append or alter tracking parameters. The disclosure appears beside each approved affiliate action. Green Man Gaming approval for the Nexus Gaming ad space is pending; no Green Man Gaming offers are configured. The Privacy page describes browser storage and the affiliate disclosure.

## Green Man Gaming catalog audit

**Confirmed Green Man Gaming product matches: none.** No product is represented as available on Green Man Gaming, and no retailer URLs or offers have been added. The audit below is a manual-check queue based on the existing catalog titles; each match, edition, PC platform, and sales region still needs confirmation from an authoritative Green Man Gaming product listing. No retailer scraping or access-control circumvention was performed.

Every row below needs verification. The product-page, affiliate URL, price, and date fields are intentionally blank/not configured; do not infer availability from the game's presence in this catalog.

| Catalog ID | Game title | GMG status | Verified product-page URL | Approved affiliate tracking URL | Verified price / currency | Checked date |
|---:|---|---|---|---|---|---|
| 1 | Cyberpunk 2077 | Needs verification | — | Not configured | Not checked | — |
| 2 | The Witcher 3: Wild Hunt | Needs verification | — | Not configured | Not checked | — |
| 3 | Red Dead Redemption 2 | Needs verification | — | Not configured | Not checked | — |
| 4 | Elden Ring | Needs verification | — | Not configured | Not checked | — |
| 5 | God of War Ragnarök | Needs verification | — | Not configured | Not checked | — |
| 6 | Horizon Forbidden West | Needs verification | — | Not configured | Not checked | — |
| 7 | Baldur's Gate 3 | Needs verification | — | Not configured | Not checked | — |
| 8 | EA SPORTS FC 26 | Needs verification | — | Not configured | Not checked | — |
| 9 | Grand Theft Auto V Enhanced | Needs verification | — | Not configured | Not checked | — |
| 10 | Forza Horizon 5 | Needs verification | — | Not configured | Not checked | — |
| 11 | Hogwarts Legacy | Needs verification | — | Not configured | Not checked | — |
| 12 | Marvel's Spider-Man Remastered | Needs verification | — | Not configured | Not checked | — |
| 13 | Ghost of Tsushima Director's Cut | Needs verification | — | Not configured | Not checked | — |
| 14 | Black Myth: Wukong | Needs verification | — | Not configured | Not checked | — |
| 15 | Hades II | Needs verification | — | Not configured | Not checked | — |
| 16 | Resident Evil 4 | Needs verification | — | Not configured | Not checked | — |
| 17 | Clair Obscur: Expedition 33 | Needs verification | — | Not configured | Not checked | — |
| 18 | HELLDIVERS 2 | Needs verification | — | Not configured | Not checked | — |
| 19 | Hollow Knight: Silksong | Needs verification | — | Not configured | Not checked | — |
| 20 | Stardew Valley | Needs verification | — | Not configured | Not checked | — |
| 21 | No Man's Sky | Needs verification | — | Not configured | Not checked | — |
| 22 | Palworld | Needs verification | — | Not configured | Not checked | — |
| 23 | Sea of Thieves | Needs verification | — | Not configured | Not checked | — |
| 24 | Microsoft Flight Simulator 2024 | Needs verification | — | Not configured | Not checked | — |
| 25 | Lies of P | Needs verification | — | Not configured | Not checked | — |
| 26 | Control Ultimate Edition | Needs verification | — | Not configured | Not checked | — |
| 27 | Sekiro: Shadows Die Twice - GOTY Edition | Needs verification | — | Not configured | Not checked | — |
| 28 | Dark Souls III | Needs verification | — | Not configured | Not checked | — |
| 29 | Monster Hunter Wilds | Needs verification | — | Not configured | Not checked | — |
| 30 | FINAL FANTASY VII REMAKE INTERGRADE | Needs verification | — | Not configured | Not checked | — |
| 31 | FINAL FANTASY XVI | Needs verification | — | Not configured | Not checked | — |
| 32 | Assassin's Creed Shadows | Needs verification | — | Not configured | Not checked | — |
| 33 | Assassin's Creed Valhalla | Needs verification | — | Not configured | Not checked | — |
| 34 | Far Cry 6 | Needs verification | — | Not configured | Not checked | — |
| 35 | Dying Light 2 Stay Human: Reloaded Edition | Needs verification | — | Not configured | Not checked | — |
| 36 | Resident Evil Village | Needs verification | — | Not configured | Not checked | — |
| 37 | Resident Evil 2 | Needs verification | — | Not configured | Not checked | — |
| 38 | DOOM Eternal | Needs verification | — | Not configured | Not checked | — |
| 39 | Forza Motorsport | Needs verification | — | Not configured | Not checked | — |
| 40 | The Elder Scrolls V: Skyrim Special Edition | Needs verification | — | Not configured | Not checked | — |
| 41 | Fallout 4 | Needs verification | — | Not configured | Not checked | — |
| 42 | Divinity: Original Sin 2 - Definitive Edition | Needs verification | — | Not configured | Not checked | — |
| 43 | Disco Elysium - The Final Cut | Needs verification | — | Not configured | Not checked | — |
| 44 | Sid Meier’s Civilization VI | Needs verification | — | Not configured | Not checked | — |
| 45 | Age of Empires IV: Anniversary Edition | Needs verification | — | Not configured | Not checked | — |
| 46 | Terraria | Needs verification | — | Not configured | Not checked | — |
| 47 | Cuphead | Needs verification | — | Not configured | Not checked | — |
| 48 | Celeste | Needs verification | — | Not configured | Not checked | — |
| 49 | It Takes Two | Needs verification | — | Not configured | Not checked | — |
| 50 | Subnautica | Needs verification | — | Not configured | Not checked | — |

After approval, configure an offer only after recording the exact product/edition, platform and region, authoritative product URL, verification date, and any currency/price that has been checked for that region. For affiliate offers, also obtain the program's approval for the ad space and use the exact supplied tracking URL and approved retailer name; never generate or modify tracking parameters. Confirm the required disclosure wording and refresh offer details when availability or price may have changed.

## Publish on GitHub Pages

1. Create a GitHub repository in your own account. Do not add a generated template that overwrites the existing files.
2. Publish the complete project root, including all nine HTML pages, `catalog.js`, `pages.js`, `script.js`, `styles.css`, `favicon.svg`, and `README.md`. Keep the shared scripts and pages together; do not publish only the original homepage files.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**, select the default branch and `/ (root)`, then save.
5. Wait for GitHub Pages to publish and use the URL shown in repository settings.
6. Open the published URL over HTTPS and run the smoke checks above, including artwork, favorites after refresh, search, dialog, and mobile layout.

The CSS and JavaScript references are relative (`styles.css` and `script.js`) so the site can be served from a repository subpath. The page's canonical and Open Graph URL metadata currently use the published GitHub Pages URL. Update those values if the site moves to a different permanent URL. There is no sitemap or `robots.txt`.

Other static hosts can publish the project root directly. Use the host's static-site instructions; no build command or output directory is required. Do not configure a rewrite to an application server.

## Artwork, ratings, and rights

Game artwork is requested from Steam's `shared.akamai.steamstatic.com` host. Artwork is external and may be unavailable, changed, or subject to the rights and terms of its owner; a CSS fallback is used when an image fails. The site operator must verify permission and licensing before production use. For stronger availability and rights control, replace the hotlinked artwork with locally hosted assets only when authorized to do so.

The original eight catalog entries retain their numeric ratings, but their source and methodology are not recorded. The 42 added entries have no rating values. The featured and top-rated sections continue to use the original rated entries; they do not reflect live popularity. The page labels these as legacy catalog values with unverified sources. Verify and document the score values before presenting them as third-party or aggregate ratings in a public release. No live popularity, review, or rating service is connected.

The added games were checked against their Steam store app records for Windows availability and current title listings. Release years identify the game or named edition's PC release where verified; for example, an edition released after its original game uses the edition's year. Artwork uses the corresponding Steam app ID's header image when available and falls back to the existing CSS artwork background if the image cannot be loaded.

## Security and hosting headers

The site has no login, backend, analytics, or secrets. Game metadata is rendered using DOM text APIs, artwork URLs are built against a fixed HTTPS Steam asset origin, and persisted IDs are validated against the catalog. These frontend checks do not substitute for host security, rights review, or complete application security testing.

Security headers are **not configured in these files**; they must be set in the hosting platform if required. Review the chosen host's support for HTTPS, HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and a restrictive `Permissions-Policy`. If enforcing Content Security Policy, test it with this page's resources, including game images from `shared.akamai.steamstatic.com`; the interface uses system fonts and does not request a third-party font service. Do not copy a policy without testing it against the deployed page.

## Release checklist

- [ ] Verify game metadata, particularly the legacy rating values and their source, before public release.
- [ ] Confirm rights to use every artwork asset.
- [ ] Confirm canonical and social-share URL metadata still match the published site URL.
- [ ] Publish the project root on the selected static host and enable HTTPS.
- [ ] Test the actual deployed URL, CSS/JS requests, images and fallback, navigation, filtering, dialog, local persistence, and responsive widths.
- [ ] Review host headers and browser console after deployment.

No repository, public URL, hosting account, or live deployment is configured by this project.
