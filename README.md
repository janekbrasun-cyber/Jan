# Fiszki

Aplikacja do nauki z fiszek: wpisujesz temat, a AI (Claude) generuje talię fiszek.

- generowanie 3–30 fiszek na dowolny temat, na trzech poziomach trudności
- tryb nauki: odwracanie fiszek, oznaczanie „umiem / jeszcze nie”, powtórka nieopanowanych
- talie zapisują się w przeglądarce (localStorage)
- eksport do CSV (np. do Anki)

## Uruchomienie

Wymagany Node.js 20.12+ i klucz API z [console.anthropic.com](https://console.anthropic.com/).

```bash
npm install
cp .env.example .env   # wpisz swój ANTHROPIC_API_KEY
npm start
```

Otwórz http://localhost:3000.

## Budowa

- `server.js` — serwer Express; `POST /api/flashcards` (`{ topic, count, level }`) wywołuje Claude API i zwraca `{ title, cards: [{ question, answer }] }`
- `public/` — interfejs (czysty HTML/CSS/JS, bez kroku budowania)
