# Nexus Gaming

Nexus Gaming is a static game-discovery page for browsing a curated library of 50 PC games, viewing game details, and keeping a personal collection in the current browser.

## Features

- Featured game carousel, genre browser, curated picks from the static catalog, and full library.
- Search across title, genre, description, and release year.
- Genre, year, minimum-rating, and favorites-only filters; combined with sorting.
- Grid and compact-list views.
- Game details dialog, favorites, wishlist, recently viewed, and up-to-three-game comparison.
- A purchase-options section in game details, with verified retailer or explicitly approved affiliate offers when configured.
- Responsive layout, keyboard controls, reduced-motion support, artwork fallbacks, and accessible status messages.
- A single 50-game catalog with unique numeric IDs; added games do not display unverified ratings.

## Technology and files

This is plain HTML, CSS, and vanilla JavaScript. It requires no build step, backend, account, API key, or JavaScript package installation.

```text
NexusGaming/
├── index.html
├── script.js
├── styles.css
├── README.md
└── .gitignore
```

## Run and test locally

1. Open this folder in VS Code.
2. Install or enable the **Live Server** extension if needed.
3. Right-click `index.html` and choose **Open with Live Server**.
4. Check search, genres, year and rating filters, sorting, and clear filters.
5. Save a favourite and wishlist entry, refresh, and check the My Games sections.
6. Open game details from a card, use the close button and Escape, and click outside the dialog.
7. Add two or three games to comparison; try adding a fourth.
8. Switch between grid and list views and test the mobile menu.
9. Test at phone, tablet, and desktop widths. Ensure images either load or fall back gracefully.

The app uses the browser's `localStorage`. The existing `favorites` key remains a JSON array of numeric game IDs. Wishlist, recently viewed games, and view preference use `nexus.wishlist.v1`, `nexus.recent.v1`, and `nexus.view.v1`. Stored lists are checked against the catalog IDs. Clearing browser site data removes these local lists. They do not sync between browsers or devices.

The app handles blocked or full local storage by reporting that a change could not be saved. Existing favorites are not rewritten just by loading the page; they are normalized when a user makes a favorite change.

## Purchase offers

The details dialog supports zero or multiple offers on a game record using an optional `purchaseOffers` array. No purchase offers are currently configured, so games show “Purchase links coming soon.” An offer is shown only when its record has a non-empty retailer name, an absolute HTTPS URL without credentials, `verified: true`, and `type: 'retailer'` or `type: 'affiliate'`. The UI labels ordinary retailer links separately from affiliate links and opens destinations in a new tab with `noopener noreferrer`.

Only add an offer after verifying the destination and applicable edition/region. For an affiliate offer, set `approved: true` only after approval by the affiliate program and paste the exact tracking URL the program supplied. Do not append or alter tracking parameters. The disclosure appears beside each approved affiliate action. No offers are currently configured, and the website does not claim that Steam purchases earn commission.

## Publish on GitHub Pages

1. Create a GitHub repository in your own account. Do not add a generated template that overwrites the existing files.
2. Add `index.html`, `styles.css`, `script.js`, `README.md`, and `.gitignore` to the repository's default branch.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**, select the default branch and `/ (root)`, then save.
5. Wait for GitHub Pages to publish and use the URL shown in repository settings.
6. Open the published URL over HTTPS and run the smoke checks above, including artwork, favorites after refresh, search, dialog, and mobile layout.

The CSS and JavaScript references are relative (`styles.css` and `script.js`) so the site can be served from a repository subpath. No canonical URL, sitemap, `robots.txt`, Open Graph URL, or public hostname is configured because the deployment URL is not known yet. Once a permanent domain is chosen, review the page title and description and then configure canonical/share metadata and any sitemap URLs to match that real public URL.

Other static hosts can publish the project root directly. Use the host's static-site instructions; no build command or output directory is required. Do not configure a rewrite to an application server.

## Artwork, ratings, and rights

Game artwork is requested from Steam's `shared.akamai.steamstatic.com` host. Artwork is external and may be unavailable, changed, or subject to the rights and terms of its owner; a CSS fallback is used when an image fails. The site operator must verify permission and licensing before production use. For stronger availability and rights control, replace the hotlinked artwork with locally hosted assets only when authorized to do so.

The original eight catalog entries retain their numeric ratings, but their source and methodology are not recorded. The 42 added entries have no rating values. The featured and top-rated sections continue to use the original rated entries; they do not reflect live popularity. The page labels these as legacy catalog values with unverified sources. Verify and document the score values before presenting them as third-party or aggregate ratings in a public release. No live popularity, review, or rating service is connected.

The added games were checked against their Steam store app records for Windows availability and current title listings. Release years identify the game or named edition's PC release where verified; for example, an edition released after its original game uses the edition's year. Artwork uses the corresponding Steam app ID's header image when available and falls back to the existing CSS artwork background if the image cannot be loaded.

## Security and hosting headers

The site has no login, backend, analytics, or secrets. Game metadata is rendered using DOM text APIs, artwork URLs are built against a fixed HTTPS Steam asset origin, and persisted IDs are validated against the catalog. These frontend checks do not substitute for host security, rights review, or complete application security testing.

Security headers are **not configured in these files**; they must be set in the hosting platform if required. Review the chosen host's support for HTTPS, HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and a restrictive `Permissions-Policy`. If enforcing Content Security Policy, test it with this page's resources: the current font import uses `fonts.googleapis.com` and `fonts.gstatic.com`, and game images use `shared.akamai.steamstatic.com`. Do not copy a policy without testing it against the deployed page.

## Release checklist

- [ ] Verify game metadata, particularly the legacy rating values and their source, before public release.
- [ ] Confirm rights to use every artwork asset.
- [ ] Choose a real public URL before setting canonical, social-share, or sitemap metadata.
- [ ] Publish the project root on the selected static host and enable HTTPS.
- [ ] Test the actual deployed URL, CSS/JS requests, images and fallback, navigation, filtering, dialog, local persistence, and responsive widths.
- [ ] Review host headers and browser console after deployment.

No repository, public URL, hosting account, or live deployment is configured by this project.
