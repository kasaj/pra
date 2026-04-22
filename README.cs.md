<p align="center">
  <img src="public/logo.png" alt="PRA" width="120" />
</p>

<h1 align="center">PRA</h1>

Vědomý prostor pro každodenní praxi.

Česky | **[English](README.md)**

**[Spustit aplikaci](https://kasaj.github.io/app/)**

<p align="center">
  <img src="https://raw.githubusercontent.com/kasaj/app/main/public/screenshot.png" alt="PRA – ukázka aplikace" width="100%" />
</p>

**[kasaj.github.io/app](https://kasaj.github.io/app/)**

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

PRA obsahuje výchozí sadu aktivit, které lze libovolně upravit nebo doplnit vlastními:

| Aktivita | Typ | Popis |
|----------|-----|-------|
| 🌌 **Prostor** | Základní (core) | Základ stránky Dnes — hodnocení nálady, vlastnosti a komentář. Ostatní aktivity se zapisují do jeho komentáře |
| 📋 **Log** | Okamžik | Rychlý záznam aktuální aktivity — vyber vlastnost (co právě děláš) a ta se vloží do komentáře Prostoru |
| 🧍‍♂️ **Usebrání** | Časová (5 min) | Vědomá pauza, sken těla, dech, kontakt se zemí |

Všechny aktivity jsou plně přizpůsobitelné — název, emoji, popis, délka trvání a vlastnosti. Změny se ukládají automaticky. Aktivity lze přidávat, skrývat a mazat přímo ze stránky Dnes (režim úprav).

## Funkce

### Stránka Dnes
- **Bubliny aktivit** — klepnutím zahájíš záznam. Časové aktivity otevřou odpočítávání; okamžikové zobrazí inline výběr vlastností
- **Inline výběr vlastností** — klepnutím na okamžikovou aktivitu se rozbalí její vlastnosti; vybrané se vloží do komentáře Prostoru spolu s názvem aktivity (např. `📋 Log - 💻 Práce`)
- **Podržení** na libovolné bublině aktivity otevře editor aktivity
- **Režim úprav** — tlačítko tužky na každé bublině pro editaci, × pro smazání; skrývání aktivit a vlastností
- **Speciální aktivita** — zobrazuje osobní *proč* ze stránky Info. Klepnutím ji přidáš/odeberáš jako kotvu relace; zvýrazní se, pokud je v aktuální relaci použita
- **Hodnocení + komentář** — ohodnoť stav hvězdičkami 1–7 a přidej volný text ke Prostoru
- **Vlastnosti** — klikatelné štítky pod polem komentáře. Použité v relaci mají accent rámeček; aktuálně vybrané jsou vyplněné
- **Přehled relace** — seznam všech aktivit od posledního resetování relace, včetně speciální aktivity

### Stránka Čas
- Chronologický přehled záznamů s fulltextovým vyhledáváním (včetně víceřádkových komentářů)
- Denní / týdenní / měsíční trend nálady
- Barevně kódovaný kalendář
- Statistiky na aktivitu (počet, celkový čas, průměrná nálada)

### Stránka Info
- Filozofický kontext (Proč / Jak / Co) s osobními poznámkami a citáty
- **Speciální aktivita** — zapiš své osobní *proč* (emoji + název + poznámka). Zobrazí se jako bublina na stránce Dnes a je součástí každé zálohy

### Nastavení
- Správa aktivit (přidat, upravit, smazat)
- Jazyk (čeština / angličtina), téma (Auto / Klasické / Tmavé)
- **Záloha** — kompletní export dat jako JSON (záznamy + aktivity + speciální aktivita); import vždy merguje
- **Import jen záznamů** — přidá historii ze zálohy bez změny aktivit, tématu nebo jazyka
- **Synchronizace** — volitelný Azure sync mezi zařízeními (merge-based: lokální záznamy se při stažení nikdy neztratí)
- **Sync konfigurace** — stáhne aktuální definice aktivit z výchozího configu bez přepsání uživatelských úprav

### Ostatní
- **Dvojjazyčné** — čeština a angličtina s oddělenými vlastnostmi, poznámkami a config soubory
- **Offline / PWA** — funguje bez internetu, instalovatelná na plochu telefonu
- **CI/CD** — push na main automaticky nasadí přes GitHub Actions

## Příklad použití: Sledování zlozvyků a jejich nahrazování

> **Záměr:** Systematicky zaznamenávat momenty, kdy dochází k zlozvyku nebo impulzu, vědomě je pojmenovávat a sledovat, jak se vzorec v čase mění.

**Nastavení (jednorázové):**

1. V Nastavení → Aktivity přidej aktivity odpovídající situacím, které chceš sledovat — např.:
   - `📱 Obrazovka` — sáhl jsem po telefonu bez záměru
   - `🍬 Impulz` — přišla chuť nebo nutkání
   - `🔁 Náhrada` — zlozvyk jsem vědomě nahradil jinou akcí
2. Jako vlastnosti nastav kontexty: `Stres`, `Nuda`, `Únava`, `Automatismus`
3. Délku trvání core aktivity (Prostor) nastav dle potřeby — třeba 1–2 min

**Každodenní praxe:**

- Ráno: ohodnoť náladu hvězdičkami a zapiš záměr dne jako komentář
- Během dne: při každém výskytu situace — otevřeš aplikaci, klepneš na aktivitu, vybereš vlastnost (co to spustilo) a uložíš
- Opakovaný výskyt v rámci relace se automaticky propojí a zobrazí jako série
- Večer nebo kdykoliv: na stránce Čas prohlédni vzorce — kdy, za jakých podmínek, jak často

**Co aplikace ukáže:**

- Frekvenci jednotlivých situací v čase (stránka Čas, kalendář)
- Korelaci mezi náladou a výskytem (hodnocení hvězdičkami)
- Vývoj poměru „zlozvyk vs. náhrada" session po session
- Celkový čas strávený vědomou praxí

Aplikace nehodnotí ani neupomíná. Je to tiché zrcadlo — záznamy mluví samy.

## Instalace na mobil

1. Otevřete [aplikaci](https://kasaj.github.io/app/) v prohlížeči
2. **iOS Safari**: Sdílet → Přidat na plochu
3. **Android Chrome**: Menu → Přidat na plochu

Funguje offline. Všechna data zůstávají na vašem zařízení.

## Konfigurace

Aplikaci řídí oddělené soubory `public/default-config-cs.json` a `public/default-config-en.json`. Formát je plochý (flat) — jeden jazyk na soubor:

```json
{
  "version": 1,
  "language": "cs",
  "theme": "modern",
  "infoActivity": {
    "emoji": "🌱",
    "name": "Moje proč",
    "comment": "Osobní poznámka zobrazená na stránce Info a jako kotva relace na stránce Dnes"
  },
  "activities": [
    {
      "type": "log",
      "emoji": "📋",
      "durationMinutes": null,
      "name": "Log",
      "description": "Rychlý záznam aktivity",
      "properties": ["💻 Práce", "🍲 Jídlo", "📝 Poznámka"],
      "core": false
    },
    {
      "type": "prostor",
      "emoji": "🌌",
      "durationMinutes": null,
      "name": "Prostor",
      "description": "Zaznamenej svůj aktuální stav",
      "properties": ["🎯 Co řeším?", "🧭 Jak teď?"],
      "core": true
    }
  ],
  "moodScale": [
    { "value": 1, "emoji": "😡", "labelCs": "Vztek" }
  ],
  "info": {
    "cs": {
      "title": "Info",
      "quotes": [{ "text": "...", "author": "..." }],
      "why": "...",
      "noteWhy": "Výchozí text zobrazený v editoru speciální aktivity",
      "body": "...",
      "featuredQuote": { "text": "...", "author": "..." }
    }
  }
}
```

Úprava configu → push na main → automatické nasazení. Nové aktivity se uživatelům přidají automaticky. Uživatelem upravené aktivity ani speciální aktivita se nikdy nepřepíší aktualizací configu.

## Soukromí

- Všechna data zůstávají na vašem zařízení (localStorage)
- Žádná analytika, sledování ani cookies
- Žádný server — čistě klientská aplikace
- Synchronizace je volitelná a vlastní; zálohování je ve vaší odpovědnosti

## Technologie

React + TypeScript, Vite, Tailwind CSS, Recharts, PWA, GitHub Actions, GitHub Pages

## Vývoj

```bash
npm install        # Instalace závislostí
npm run dev        # Vývojový server (localhost:3000)
npm run build      # Build pro produkci
```

Push na `main` automaticky nasadí přes GitHub Actions.

## Synchronizace (volitelné)

PRA umí synchronizovat data mezi zařízeními přes Azure Function. Stahování je **merge-based** — záznamy vytvořené lokálně od posledního uploadu se při stažení ze serveru nikdy neztratí.

### Nasazení vlastního sync backendu

**Předpoklady:** [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli), [Azure Functions Core Tools](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local), Node.js

```powershell
cd azure-function/infra

.\deploy.ps1 `
  -ResourceGroup "MojeResourceGroup" `
  -StorageAccountName "mojeunikatniuloziste" `
  -SyncSecret "zvol-silny-secret"
```

Skript vytvoří všechny Azure prostředky (Storage Account, Function App, Application Insights) přes Bicep a nasadí kód funkce. Po dokončení vypíše **Sync URL** a **Secret** pro zadání v PRA Nastavení → Synchronizace.

**Cena:** Azure consumption plan — pro osobní použití prakticky zdarma (1M požadavků/měsíc zdarma).

### Co je na serveru

```bash
az storage blob list \
  --account-name <storage-account> \
  --container-name pra-sync \
  --auth-mode login \
  --query "[].{name:name, size:properties.contentLength, modified:properties.lastModified}" \
  -o table
```

## Licence

MIT
