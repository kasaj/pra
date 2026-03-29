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

PRA obsahuje šest výchozích aktivit a jednu základní pro sledování nálady:

| Aktivita | Typ | Popis |
|----------|-----|-------|
| 📊 **Nálada** | Základní | Rychlé hodnocení nálady emoji škálou a komentářem — vždy nahoře na stránce Dnes |
| 🧍‍♂️ **Vyrovnání - Pauza** | Časová (1 min) | Vědomě se zastavit, dýchat, vnímat, být přítomný |
| 🏃‍♂️ **Pohyb - Aktivita** | Časová (30 min) | Rozproudit energii — sport, protažení, jóga, rovnováha |
| 🧎‍♂️ **Usebrání - Výživa** | Časová (15 min) | Meditace, vědomé jídlo, imaginace, pozorování myšlenek |
| 📜 **Komentář - Informace** | Okamžik | Sebereflexe, záměr, ukotvení myšlenky nebo pocitu |
| 👫 **Vztahy - Interakce** | Okamžik | Vědomý kontakt — sdílení, rodina, pochopení, komunita |
| 🔥 **Výzvy - Integrace** | Okamžik | Čelení tomu, čemu se vyhýbám — strach, bolest, nové návyky |

Všechny aktivity jsou plně přizpůsobitelné — název, emoji, popis, doba trvání a vlastnosti. Změny se ukládají automaticky. Základní aktivity (jako Nálada) se nezobrazují v běžném seznamu a mají vlastní UI.

## Funkce

- **Rychlé sledování nálady** — emoji škála + komentář přímo na stránce Dnes, automatické uložení při výběru
- **Správa relací** — tlačítko "Dokončeno" spustí novou relaci, resetuje označení dokončení. Opakování aktivity v rámci relace automaticky propojí záznamy
- **Časová praxe** — odpočítávání s gongem, pauza/pokračování, předčasné dokončení, "Hotovo" pro zpětný záznam
- **Okamžiky** — rychlé záznamy bez časovače
- **Jednotný systém komentářů** — veškerá interakce s aktivitami jsou komentáře s časovým razítkem a hodnocením nálady
- **Vlastnosti** — klikatelné štítky u aktivit, editovatelné přímo při záznamu (přidání/odebrání). Centrální registr vlastností v Nastavení
- **Škála nálady** — přizpůsobitelná 7úrovňová emoji škála pro sledování stavu
- **Propojování aktivit** — automatické propojení v rámci relace, manuální propojení tlačítkem +, navigace šipkami
- **Pohledy záznamů** — podle data (posledních 10 záznamů) nebo podle relace (řazeno dle počtu propojení)
- **Denní emoji nálady** — průměrná nálada zobrazena vedle data každého dne
- **Statistiky** — denní/týdenní/měsíční trend (gradientová plocha pro náladu + sloupce pro počet), série dní, průměr za den, top 2 aktivity, statistiky vybraného dne v kalendáři
- **Měsíční kalendář** — barevně zvýrazněné dny podle počtu aktivit, kliknutím filtruje záznamy a aktualizuje statistiky
- **Stránka Info** — filozofický kontext (Proč/Jak/Co) s osobními poznámkami, citáty, vědecké základy
- **Chytrá synchronizace** — detekuje změny konfigurace, automaticky přidá nové aktivity a zachová uživatelské úpravy
- **Konfigurace** — JSON soubor řídí aktivity, vlastnosti, škálu nálady, obsah info, jazyk a téma
- **Záloha** — kompletní záloha s historií, hodnocením, komentáři, vlastnostmi, škálou nálady. Export konfigurace zarovnán s formátem konfiguračního souboru. Import vždy merguje
- **Témata** — Auto (sleduje systém light/dark), Klasické (teplé zemité tóny), Tmavé
- **Automatické ukládání** — všechna nastavení, hodnocení a komentáře se ukládají okamžitě
- **Dvojjazyčné** — čeština a angličtina s oddělenými vlastnostmi a poznámkami dle jazyka
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
  "activities": [
    {
      "type": "sobe",
      "emoji": "🧍‍♂️",
      "durationMinutes": 1,
      "cs": { "name": "...", "properties": [...] },
      "en": { "name": "...", "properties": [...] }
    }
  ],
  "properties": {
    "cs": ["Meditace", "Dech nosem", ...],
    "en": ["Meditation", "Nose breathing", ...]
  },
  "moodScale": [
    { "value": 1, "emoji": "😡", "labelCs": "Vztek", "labelEn": "Anger" }
  ],
  "info": {
    "cs": { "intro": "...", "quotes": [...], "why": "...", "how": "...", "what": "..." },
    "en": { ... }
  }
}
```

Úprava configu → push na main → automatické nasazení. Nové aktivity a vlastnosti se uživatelům objeví automaticky. Uživatelem upravené aktivity se nikdy nepřepisují.

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
