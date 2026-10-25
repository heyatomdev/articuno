# Articuno — logo e uso

## 1. Il logo

- **Idea**: un **pennino** con la punta in alto, e il pennino è una **A**. Il taglio e il foro di
  sfiato sono la controforma della A, i piedi aperti sono le sue gambe. Articuno è dove si scrive:
  articoli, traduzioni, commenti.
- **Versioni**: lockup orizzontale (simbolo + wordmark) · simbolo · simbolo *small* (≤ 48 px:
  taglio più largo, controforma e piedi più grandi, riempie il canvas).
- **Costruzione**: canvas 256. Punta a y 32, fianchi a 60° fino alle spalle (y 156, larghezza
  143), poi la vita rientra a 15° fino alla base (y 216, larghezza 111). Controforma: triangolo a
  60° (punta y 100, base y 146), lati paralleli ai fianchi, quindi le gambe hanno spessore
  costante. Taglio largo 8, dalla punta fino alla controforma, senza gradino. Piedi: tetto a 30°
  (come le pieghe di Herald), largo 36, fianchi interni a 15°, paralleli alla vita. Il simbolo è
  centrato sul canvas e alzato di 2 (centro ottico).
- **Wordmark**: Inter Bold (SIL OFL), tracciato in path, cap height 120, tracking −3, a 48 dal
  simbolo e centrato in altezza su di esso, come Herald. Non ribattere il nome con un font.
- **Scartati**: il vecchio logo con le righe nella A (Barlow Condensed) e gli altri concept
  esplorati: pilcrow-uccello, pergamena, A ad ala, A a righe, piuma.

## 2. File

| File | Uso |
|---|---|
| `articuno-lockup.svg` · `-black` · `-white` · `-orange` · `-orange-dark` | README, documentazione, intestazioni |
| `articuno-symbol.svg` · `-black` · `-white` · `-orange` · `-orange-dark` | simbolo ≥ 48 px |
| `articuno-symbol-small.svg` · `-white` · `-orange` | simbolo 16–48 px (favicon, tab, box Meridian) |
| `articuno-symbol-square.svg` | avatar/social: simbolo all'80 % su 256 |
| `articuno-symbol-app-icon.svg` | tile 22 % di raggio, arancio, simbolo inchiostro |
| `articuno-symbol-favicon.svg` | favicon vettoriale (taglio small): nero su chiaro, bianco su scuro (`prefers-color-scheme`) |
| `articuno-stream-deck-orange.svg` · `-dark` · `stream-deck/` | tasto Stream Deck: full bleed 288, simbolo al 60 %; PNG 288 e 144 in `stream-deck/` |
| `png/` | lockup nero e arancio a 1000 px, simboli a 512 px, trasparenti |
| `web/` | `favicon.ico` (16/32/48) e `favicon-*.png` dal tile con il taglio small, `apple-touch-icon.png` (full bleed), `icon-192/512.png` |
| `../../app_logo.png` | lockup bianco su trasparente per il README |
| `generate.py` | rigenera tutto: `uv run --no-project --with fonttools --with skia-pathops --with resvg-py python generate.py <Inter.ttf> .` (font da `google/fonts`, `ofl/inter`; serve `magick` per il `.ico`) |

Si modifica `generate.py`, non gli SVG a mano: pennino, controforma e piedi sono definiti una volta
sola lì.

Gli SVG attuali sono generati con Inter 3.018 (variabile `wght`, senza asse `opsz`). Con l'Inter 4
di `google/fonts` lo script istanzia `opsz 32` come Herald: rigenerare con quello per avere lo
stesso disegno delle lettere.

`<head>` per le icone web:

```html
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/articuno-symbol-favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
```

## 3. Spazio e dimensioni minime

- **Spazio libero**: tutt'intorno almeno l'altezza della controforma (46 su 256, ≈ 18 % del
  simbolo). Scala con il logo.
- **Minimi**: lockup 200 px di larghezza (il simbolo resta ≥ 48 px) · simbolo 48 px (sotto, il
  taglio da 8 si chiude) · sotto 48 px il taglio *small* (16 px è il minimo: si leggono la A e il
  pennino, il taglio diventa una riga di un pixel).

## 4. Colore

| Nome | HEX | RGB | Uso |
|---|---|---|---|
| Arancio | `#E27A43` | 226 122 67 | accento Articuno in Meridian (`[data-svc="articuno"]`), marchio su scuro, tile app e Stream Deck |
| Arancio scuro | `#BE551D` | 190 85 29 | marchio su fondi chiari (4,66:1 su bianco, AA) |
| Inchiostro | `#111111` | 17 17 17 | nero, e il marchio sul tile arancio |
| Bianco | `#FFFFFF` | | su scuro |

Abbinamenti approvati: nero su bianco · arancio scuro su chiaro · inchiostro su arancio (6,4:1) ·
arancio su scuro (`#272B33` 4,8:1, `#0d1117` 6,4:1). Un solo colore per volta: mai gradienti,
ombre, contorni. L'arancio `#E27A43` su bianco (2,96:1) non va: su chiaro si usa l'arancio scuro.
Il bianco sull'arancio (2,96:1) non va: sul tile il pennino è in inchiostro, come scrive.

**Box servizio in Meridian** (`ShellServiceCard`, 44 px): resta il box `.svc-logo--articuno`
(`rgba(226,122,67,0.18)`, bordo `rgba(226,122,67,0.34)`, colore `#E27A43`), simbolo *small* a
22 px come Herald (`meridian/app/components/shell/ArticunoGlyph.vue`, path copiato da
`articuno-symbol-small.svg`).

## 5. Non fare

Non deformare · non ruotare · non chiudere il taglio o staccarlo dalla controforma · non chiudere i
piedi (senza gambe il pennino diventa una casetta) · non rimettere le righe nella A · non
ridisporre simbolo e wordmark · non usare il simbolo *small* sopra 48 px · non ricolorare fuori
palette · non mettere su sfondi mossi senza il tile.

## 6. Verifiche fatte

Scala 16–512 px, favicon 16/32/48, nero su bianco, arancio su `#272B33`, arancio scuro su bianco,
tile app e Stream Deck, glyph a 22 px nel box Meridian accanto a quello di Herald, `svg_audit` (un
colore, niente testo vivo, margini simmetrici). Concept confrontati: pilcrow-uccello, pergamena
con la A, A ad ala, A a righe (gamba o intera), piuma. Nessuna ricerca di marchio: prima di un uso
pubblico fuori HeyAtom, verificare.
