# Deploying Global Burn Log

The site is fully static (`app/dist`), so it needs no server. It is deployed to Firebase Hosting (Google Cloud free tier).

## One-time setup
1. Create a Firebase project at https://console.firebase.google.com (free Spark plan is enough) and note the **project ID**.
2. `npm install -g firebase-tools && firebase login`
3. Put the project ID in `.firebaserc`: `{ "projects": { "default": "<project-id>" } }`

## Every deploy
```bash
npm --prefix app install            # first time only
npm --prefix app run build          # writes app/dist
firebase deploy --only hosting
```

The custom-area tiles (`app/public/data/tiles/`, ~110 MB) are gitignored, so deploy from a machine that has run
`pipeline/build_global_maps.py`. They are only downloaded when a visitor draws a custom area.

## Custom domain
Firebase console > Hosting > Add custom domain. It shows a TXT record (ownership) and two A records for the apex; add them
at the DNS provider (GoDaddy: My Products > DNS). Add the same for `www` if wanted. HTTPS is provisioned automatically
once DNS resolves (minutes to a few hours).

## Free-tier note
Firebase's free Spark plan allows about 360 MB of transfer per day. A typical visit is roughly 1.2 MB (2.6 MB if the whole page
is scrolled), so that is a few hundred visitors a day. If the site ever hits the cap, upgrade the project to Blaze (pay as you
go; the Space Apps Google Cloud credits apply).
