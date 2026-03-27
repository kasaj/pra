<p align="center">
  <img src="public/logo.png" alt="PRA" width="120" />
</p>

# PRA

Vědomý prostor pro každodenní praxi.

Česky | **[English](README.md)**

**[Spustit aplikaci](https://kasaj.github.io/app/)**

## O aplikaci

PRA je aplikace pro vědomou praxi postavená na jednoduché myšlence: kvalita života se odvíjí od bdělosti — jak jemně vnímáme skutečnost i sebe sama a jak vědomě jednáme.

Řídí se přirozenou mechanikou změny: **myšlenka → slovo → čin → zvyk → charakter → osud.**

Aplikace neučí. Poskytuje strukturu pro každodenní praxi a tichý prostor pro zastavení, reflexi a návrat k sobě. Vše běží lokálně na vašem zařízení — žádné účty, servery ani sledování.

## Filozofie

Aplikace je organizována kolem tří otázek:

- **Proč** — bez zakořenění ve smyslu žádná praxe nevydrží. Proč je kořen, ze kterého vše ostatní vyrůstá.
- **Jak** — disciplína je forma lásky k tomu, čím se chceme stát. Most mezi záměrem a skutečností.
- **Co** — metoda a konkrétní praxe. Obsah bez směru je hluk, metoda bez formy chaos.

Každý uživatel si může zapsat vlastní odpovědi na tyto otázky přímo v aplikaci (stránka Info).

## Aktivity

PRA obsahuje šest výchozích aktivit, každá s volitelnými variantami, které se automaticky zapisují do poznámek:

| Aktivita | Typ | Popis |
|----------|-----|-------|
| 🧍‍♂️ **Vyrovnání - Pauza** | Časová (1 min) | Vědomě se zastavit, dýchat, vnímat, být přítomný |
| 🏃‍♂️ **Pohyb - Aktivita** | Časová (30 min) | Rozproudit energii — sport, protažení, jóga, rovnováha |
| 🧎‍♂️ **Usebrání - Výživa** | Časová (15 min) | Meditace, vědomé jídlo, imaginace, pozorování myšlenek |
| 📜 **Komentář - Informace** | Okamžik | Sebereflexe, záměr, ukotvení myšlenky nebo pocitu |
| 👫 **Vztahy - Interakce** | Okamžik | Vědomý kontakt — sdílení, rodina, pochopení, komunita |
| 🔥 **Výzvy - Integrace** | Okamžik | Čelení tomu, čemu se vyhýbám — strach, bolest, nové návyky |

Všechny aktivity jsou plně přizpůsobitelné — název, emoji, popis, doba trvání a varianty. Změny se ukládají automaticky.

## Funkce

- **Časová praxe** — odpočítávání s gongem po dokončení, pauza/pokračování, předčasné dokončení nebo zpětný záznam tlačítkem „Hotovo"
- **Okamžiky** — rychlé záznamy bez časovače
- **Varianty** — klikatelné štítky, které se automaticky vyplní do poznámky
- **Sledování stavu** — hodnocení stavu před a po aktivitě (1-5 hvězd)
- **Statistiky** — týdenní/měsíční trend (počet aktivit + průměrný stav), doba běhu od prvního použití, procento praxe z bdělého stavu
- **Stránka Info** — filozofický kontext (Proč/Jak/Co/Já) s osobními poznámkami, inspirativní citáty, vědecké základy
- **Chytrá synchronizace** — aplikace detekuje změny konfigurace na serveru, automaticky přidá nové aktivity a zachová uživatelské úpravy
- **Konfigurace** — JSON soubor řídí aktivity, obsah info, citáty, jazyk a téma
- **Export/Import** — export konfigurace v jednom jazyce jako JSON; export historie jako Markdown
- **Témata** — Auto (sleduje systém light/dark), Klasické (teplé zemité tóny), Tmavé
- **Automatické ukládání** — všechna nastavení a úpravy aktivit se ukládají okamžitě
- **Dvojjazyčné** — čeština a angličtina s oddělenými poznámkami
- **Offline** — funguje bez internetu jako PWA
- **CI/CD** — push na main automaticky nasadí přes GitHub Actions

## Instalace na mobil

1. Otevřete [aplikaci](https://kasaj.github.io/app/) v prohlížeči
2. **iOS Safari**: Sdílet → Přidat na plochu
3. **Android Chrome**: Menu → Přidat na plochu

Funguje offline. Všechna data zůstávají na vašem zařízení.

## Konfigurace

Aplikaci řídí soubor `public/default-config.json`:

```json
{
  "version": 1,
  "name": "default",
  "language": "cs",
  "theme": "modern",
  "activities": [...],
  "info": {
    "cs": { "intro": "...", "quotes": [...], "why": "...", "how": "...", "what": "..." },
    "en": { ... }
  }
}
```

Úprava configu → push na main → automatické nasazení. Nové aktivity se uživatelům objeví automaticky. Uživatelem upravené aktivity se nikdy nepřepisují.

## Soukromí

- Všechna data zůstávají na vašem zařízení (localStorage)
- Žádná analytika, sledování ani cookies
- Žádný server — čistě klientská aplikace
- Zálohování je ve vaší odpovědnosti

## Technologie

React + TypeScript, Vite, Tailwind CSS, Recharts, PWA, GitHub Actions, GitHub Pages

## Vývoj

```bash
npm install        # Instalace závislostí
npm run dev        # Vývojový server (localhost:3000)
npm run build      # Build pro produkci
```

Push na `main` automaticky nasadí přes GitHub Actions.

## Licence

MIT
