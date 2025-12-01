# Thompson Shop

Full-stack narudžbe za limitiranu kolekciju majica. Frontend je statički (HTML/CSS/JS), a backend je Express API koji sprema narudžbe u MongoDB i šalje Brevo email obavijesti.

## Pokretanje lokalno

```powershell
cd C:\Users\David\Documents\stranice\thompson_stranica\thompson-shop
npm install
npm start
```

Server sluša na `http://localhost:3000`, a frontend se servisira iz `public/`.

## Environment varijable

Postavi `.env` (ili Vercel Environment Variables) prema uzorku:

```
MONGODB_URI=mongodb+srv://USER:PASS@cluster.mongodb.net/thompson
ADMIN_PASSWORD=super-tajna-lozinka
BREVO_API_KEY=***
MAIL_SENDER=noreply@domena.hr
MAIL_SENDER_NAME=Thompson Shop
ADMIN_EMAIL=info@domena.hr
ALLOW_MEMORY_STORE=false
```

> `ALLOW_MEMORY_STORE=true` koristi memorijski spremnik umjesto MongoDB-a (samo za debug, podaci se brišu restartom). U produkciji obavezno koristi stvarni `MONGODB_URI` i ostavi vrijednost `false`.

## Sigurnosni slojevi
- `helmet` postavlja zaštitne HTTP headere.
- `compression` radi gzip za bržu isporuku.
- `express-rate-limit` štiti `/api/naruci` i sve admin rute od spam/slamming pokušaja.
- Admin rute provjeravaju `x-admin-pass` header; čuvaj lozinku u `.env` i koristi jaku vrijednost.

## Brevo email konfiguracija
1. Kreiraj transakcijski API ključ na Brevo (Sendinblue).
2. Upiši ga u `BREVO_API_KEY` i dodaj odobrene email adrese u `MAIL_SENDER` i `ADMIN_EMAIL`.
3. Ako Brevo nije konfiguriran, server će automatski preskočiti slanje emailova.

## Deploy na Vercel
1. `vercel.json` već usmjerava sve rute na `server.js` (Express handler). Vercel će sloj pokretati kao serverless funkciju.
2. Na Vercel projektu postavi sve varijable iz `.env` (Settings → Environment Variables).
3. Deploy putem Git repozitorija ili `vercel` CLI.
4. Nakon deploya, testiraj:
   - `POST https://<domena>/api/naruci`
   - `GET https://<domena>/api/admin/narudbe` s headerom `x-admin-pass`.

## Admin panel
- Dostupan na `/admin.html`.
- Nakon prijave (lozinka = `ADMIN_PASSWORD`), možeš filtrirati narudžbe, označiti plaćeno/poslano, upisati napomene i brisati zapise.
- Gumb "Odjavi se" briše stanje iz preglednika.

## Struktura projekta
```
public/        // statički frontend + admin panel
models/        // Mongoose sheme
server.js      // Express API + email logika
vercel.json    // konfiguracija za deployment
```

## Dodatni savjeti
- Obavezno koristi dvofaktorsku autentifikaciju za Brevo/Mongo naloge.
- Povremeno mijenjaj `ADMIN_PASSWORD` i prati pristupne logove (Vercel Analytics logovi).
- Ako želiš dodatne uloge / višekorisnički admin, preporuka je prebaciti se na zaseban auth provider (Auth0, Clerk, Supabase) i zabraniti otvaranje admin panela bez JWT-a.
