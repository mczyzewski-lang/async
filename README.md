# STAIR STUDIO — konfigurator schodów stalowych 3D

Przeglądarkowy, parametryczny konfigurator schodów stalowych z drewnianymi stopnicami
i stalowymi balustradami. Łączy wizualizację architektoniczną, pełną konfigurację projektu
oraz rzeczywiste obliczenia geometryczne i sprawdzenie, czy schody mieszczą się w dostępnej przestrzeni.

> Narzędzie koncepcyjne. Wyniki (m.in. wzór Blondela, prześwit, dopasowanie) mają charakter
> orientacyjny i **nie** zastępują obliczeń konstruktora ani dokumentacji wykonawczej.

## Uruchomienie

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # testy silnika obliczeń i geometrii (Vitest)
npm run build      # typecheck + build produkcyjny do dist/
```

Wymagania: Node 20+. Brak zewnętrznych zasobów (tekstury drewna, perforacji, siatki i oświetlenie
środowiskowe są generowane proceduralnie). Opcjonalnie ładowany jest font Inter z Google Fonts.

## Funkcje

- **Kształty I / L / U** — każdy generowany od zera (biegi, spocznik, ciągłość z podestem i stropem),
  skręt w lewo/prawo, podział stopni, wymiary spocznika, odstęp między biegami (U).
- **Silnik obliczeń** — liczba i wysokość stopni, krok, wzór Blondela, kąt, długości biegów,
  wysokość spocznika, rzut, odstępy od ścian, prześwit nad stopniami, otwór w stropie (auto/ręczny),
  ostrzeżenia z przyczyną i sugestiami, przycisk **„Dopasuj automatycznie”** (lub jasna informacja,
  że rozwiązanie nie istnieje + propozycja innego kształtu).
- **5 konstrukcji stalowych** z odrębną geometrią: belka centralna, dwa policzki, policzki zygzakowe,
  gięta blacha (z ukrytymi żebrami), spawana rama (ze słupami pośrednimi). Spocznik zawsze
  na realnej ramie: 4 słupy / rama zintegrowana + 2 słupy / kotwienie do ściany.
- **Stopnice** — 7 gatunków drewna (proceduralne usłojenie, klejonka), grubość, nosek, krawędź,
  podstopnice otwarte/zamknięte (wg konstrukcji), LED pod stopnicami.
- **6 balustrad** — pręty pionowe, płaskowniki, pręty poziome, blacha perforowana, siatka
  cięto-ciągniona, pełne panele; wysokość, profil, rozstaw, strony (balustrada / pochwyt przyścienny / brak),
  balustrada spocznika i otworu w stropie, styl i materiał pochwytu, ostrzeżenia bezpieczeństwa.
- **Kolory** — 7 presetów stali (RAL) + własny kolor, wykończenia mat/satyna/metalik/szczotkowana,
  niezależny kolor balustrady.
- **Pomieszczenie** — szerokość, głębokość, wysokość kondygnacji, strop, grubość ścian,
  obecność ścian (przestrzeń otwarta), położenie i kierunek wejścia; ściany: auto-przekrój od strony kamery,
  wszystkie, półprzezroczyste, wybrane, przekrój 3D; ukrywanie stropu; obrys zajmowanej przestrzeni;
  kolizje z bryłą pomieszczenia i brak prześwitu zaznaczane na czerwono w 3D.
- **Kamery** — perspektywa, rzut z góry (ortogonalny), widok z boku (ortogonalny), przekrój,
  poziom oczu (od wejścia / z piętra), płynne przejścia, reset, dopasowanie do schodów, wymiary.
- **Kolekcje** — Minimal Black Oak, Japandi Natural, Architectural Zigzag, Industrial Loft,
  Modern White Oak, Dark Luxury.
- **Zapis / eksport** — localStorage, przywracanie, reset, eksport/import JSON (z obliczeniami
  i zestawieniem ilościowym bez cen), zrzut PNG.

## Architektura

Wszystkie wymiary wewnętrzne w **metrach**; UI przelicza na centymetry.

```
src/engine/         czysta logika (bez React/three)
  types.ts          konfiguracja i typy wyników
  calc.ts           liczba stopni, podział biegów, Blondel, rozmiar analityczny
  layout.ts         generacja kształtów I/L/U w układzie lokalnym i rozmieszczenie w pomieszczeniu
  opening.ts        otwór w stropie, prześwit, strefa wyjścia
  railingLayout.ts  ścieżki balustrad (biegi, spocznik, narożniki), pochwyty przyścienne, balustrada otworu
  validate.ts       walidacja dopasowania, ergonomii i bezpieczeństwa, sugestie
  autofit.ts        „Dopasuj automatycznie”
  dimensions.ts     specyfikacje linii wymiarowych dla widoków
  quantities.ts     zestawienie ilościowe (baza pod BOM/kosztorys, bez cen)
  presets.ts, catalog.ts, defaults.ts
src/three/          renderowanie (React Three Fiber)
  geom/stair.ts     geometria stali, stopnic i spocznika (5 konstrukcji)
  geom/railing.ts   geometria 6 balustrad + pochwyt przyścienny
  geom/primitives.ts scalanie geometrii per materiał
  materials.ts      współdzielone materiały aktualizowane w miejscu (bez przebudowy sceny)
  Room.tsx, Staircase.tsx, Lighting.tsx, CameraRig.tsx, Dimensions.tsx, Overlays.tsx, Labels.tsx
src/store/          Zustand (konfiguracja + stan widoku), selektory z memoizacją
src/ui/             panel konfiguracji, paski, miniatury, eksport
```

Wydajność: geometria budowana tylko przy zmianie wymiarów/konstrukcji i scalana do jednej siatki
na materiał; zmiana drewna/koloru aktualizuje istniejący materiał; canvas nie jest przemontowywany.

## Testy akceptacyjne

`npm test` uruchamia m.in.:

| Test | Sprawdzenie |
| --- | --- |
| A | U → I: zmiana liczby biegów, spocznika i rzutu |
| B | 300 → 350 cm: przeliczenie liczby/wysokości stopni, górny stopień na poziomie stropu |
| C | zmniejszanie głębokości → konflikt `Schody nie mieszczą się…`, status „Nie mieści się”, sugestie |
| D | belka centralna vs dwa policzki: różna liczba elementów i geometria stali |
| E | pręty pionowe vs blacha perforowana: inna geometria, ciągłość bieg → spocznik → bieg |
| F | zmiana drewna aktualizuje wyłącznie materiał stopnic (`setWood`), bez przebudowy geometrii |
| G | widok z góry: kamera ortogonalna + wymiary rzutu (`computeDimensions('top')`) |
| H | spocznik U na słupach sięgających posadzki dla każdej konstrukcji |

Dodatkowo: ciągłość biegów i spocznika (L/U), prześwit przy ręcznym otworze, auto-dopasowanie
(rozwiązanie / brak rozwiązania / sugestia innego kształtu), presety.

Hook testowy: `window.__stairStudio` udostępnia store (np. do automatyzacji przeglądarki).
