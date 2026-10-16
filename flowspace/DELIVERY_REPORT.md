# FLOWSPACE 3D — raport z realizacji

## Co działa (zaimplementowane i sprawdzone)

| Obszar | Stan |
| --- | --- |
| Prawdziwe otoczenie 3D (WebGL) | ✅ 4 proceduralne światy: Pawilon Zen (domyślny), Taras nad oceanem, Górskie sanktuarium, Leśne studio — niebo, mgła, góry, roślinność z wiatrem, woda, cienie, cząsteczki |
| Interaktywny instruktor 3D z rigiem | ✅ Realistyczna postać CC0 (MakeHuman/MPFB) w stroju do jogi, sterowana 23-kościowym szkieletem pozycji (retargeting z kalibracją); pełne ciało odtworzone spod ubrania, kontakt z matą liczony na prawdziwej siatce |
| Animacje specyficzne dla pozycji | ✅ 116 klatek kluczowych w 53 pozycjach; każda pozycja ma własny stan utrzymania (walidator blokuje ponowne użycie) |
| Płynne przejścia | ✅ Slerp kwaternionów z opóźnieniem dystalnym, smootherstep, planowanie przejść między bazami, uziemienie, IK dłoni/stóp, oddech w utrzymaniu |
| Sterowanie kamerą na telefonie | ✅ Obrót 360° palcem, pinch-zoom, presety (przód, 3/4, bok, tył, z góry, fokus na miednicę/kręgosłup/barki/głowę/kolana/stopy/dłonie), reset, auto-obrót, kadrowanie pod portret/pejzaż |
| Katalog pozycji | ✅ 119 wpisów (PL/EN/sanskryt, kategorie, trudność, obszary, efekty, ostrzeżenia, warianty, instrukcje, błędy, skrypt głosowy, metadane) |
| Strony pozycji | ✅ Etapy 3–6, odtwarzanie, pauza, od początku, wolniej (1×/0,5×/0,25×), następny etap/pozycja, strona L/P, panel zwijany, opis i bezpieczeństwo |
| Instrukcje krok po kroku | ✅ Każdy etap zmienia stan animacji, kamerę, podświetlenie i (opcjonalnie) narrację |
| Demonstracje błędów | ✅ 83 konfiguracje błędów (każda z 53 pozycji 3D ma co najmniej jedną), koralowe podświetlenie, fokus kamery, „Pokaż poprawnie” |
| Porównanie błąd/poprawnie | ✅ Dwa zsynchronizowane widoki (jedna kamera, wspólny obrót) |
| Tryb techniczny | ✅ Stawy, linie wyrównania, orientacja miednicy/barków, kierunki, punkty kontaktu, rzut środka ciężkości — kontekstowo dla pozycji |
| Sesje 10/20/30/40/50 min | ✅ Generowane i testowane dla wszystkich 12 celów × 4 poziomów × 3 intensywności, zawsze w ±30 s |
| Planowanie uwzględniające czas | ✅ Fazy, krzywa intensywności, czasy wejścia z mostami przejść, pary L/P, przygotowanie przed szczytem, wykluczenia ruchów |
| Odtwarzacz praktyki | ✅ Stany idle/preparing/playing/paused/transitioning/completed, pauza/wznów/poprzednia/następna/wyjście, zapis miejsca, auto-pauza w tle, Wake Lock |
| Polski głos | ✅ Web Speech `pl-PL`, adapter dla usług premium, płeć/tempo/głośność/wyłączenie, poziom instrukcji, odblokowanie gestem (iOS) |
| Dźwięki otoczenia | ✅ Proceduralne (wiatr, fale, ptaki) + delikatna misa przy przejściach |
| Muzyka w tle | ✅ Kojąca pętla podczas praktyki (generowana na żywo lub pliki z ElevenLabs Music API przez `npm run music:generate`), wyciszanie pod głos, ustawienia utworu i głośności |
| Oddech | ✅ Wizualizacja w praktyce (przybycie/relaks), trasa `/breathe` 2/5/10 min, rytmy bez wstrzymywania |
| Zapisane praktyki | ✅ Zapis, ulubione, zmiana nazwy, usuwanie, pojawiają się na ekranie głównym |
| Postępy lokalnie | ✅ Historia, minuty, dni, poznane pozycje, tydzień, kalendarz, kamienie milowe, preferencje, notatki, refleksja po praktyce |
| Personalizacja i bezpieczeństwo | ✅ Onboarding (pomijalny), zastrzeżenia, warianty z klockiem/krzesłem/kocem, oznaczenia nadzoru |
| Mobile-first, PWA | ✅ Instalowalna PWA (manifest, ikony, service worker, cache offline), safe-area, duże cele dotyku, portret i pejzaż |
| Pose Lab `/dev/pose-lab` | ✅ Szkielet, osie stawów, kontakty, inspektor stanu i kamery, suwaki parametrów, eksport JSON, interpolacja, warianty L/P, błędy |
| Build produkcyjny | ✅ `npm run build` |
| Testy automatyczne | ✅ 34 testy jednostkowe + walidacja treści + 63 testy Playwright (wszystkie przechodzą) |

## Liczby

- **Pozycje w katalogu:** 119
- **Pozycje z prawdziwą demonstracją 3D:** 53 (33 początkujące, 17 średnie, 3 zaawansowane)
- **Pozycje z animacją błędu:** 53 (łącznie 83 konfiguracje błędów; wszystkich opisanych błędów: 241)
- **Pozycje wyłącznie katalogowe:** 66 (oznaczone w UI jako „bez demonstracji 3D”, nieużywane w sesjach)

## Co zostało przetestowane

- `npm test` (Vitest): generator sesji (długości, determinizm, fazy, symetria L/P, wykluczenia, poziomy, przygotowanie,
  edycja), odtwarzacz (stany, pauza, pominięcia, wznowienie, wskazówki głosowe), rig (skórowanie, uziemienie wszystkich
  pozycji, lustrzane odbicie, brak skoków przy interpolacji), treść (walidacja, kompletność, język bezpieczeństwa).
- `npm run validate:content`: brakujące pola, odniesienia do szkieletu i kamer, polskie teksty, zakresy kątów,
  odniesienia przejść, czasy sesji, kontakt kończyn z matą, ścieżki zasobów → 0 błędów.
- Playwright (Chromium, viewporty 390×844, 412×915, 360×740, 844×390): 13 krytycznych scenariuszy (otwarcie, pozycja,
  render 3D, obrót kamery, odtwarzanie, wybór błędu, konfiguracja błędna, powrót do poprawnej, sesja 10 min,
  pauza, wznowienie i pominięcie, ukończenie, postęp po przeładowaniu) + wszystkie trasy bez poziomego przewijania
  i błędów, nawigacja, wyszukiwanie po sanskrycie, filtr 3D.
- Ręczny przegląd zrzutów ekranu wszystkich tras w portrecie i pejzażu.

## Brakujące zasoby

- Kości pomocnicze/korekty kształtu dla skrajnych zgięć (obecnie czysty linear blend skinning).
- Utwory muzyczne z ElevenLabs — do wygenerowania z kluczem API (`npm run music:generate`); do tego czasu gra muzyka generowana na żywo.
- Modele roślinności/architektury i nagrania dźwięków otoczenia (obecnie proceduralne zamienniki).
- Brak zewnętrznych assetów oznacza brak kwestii licencyjnych — wszystko powstało w kodzie.

## Co wymaga przeglądu eksperta (nauczyciel jogi + fizjoterapeuta)

- Wszystkie 53 konfiguracje 3D i 83 konfiguracje błędów (status `internal-review`): ustawienie kolan, miednicy,
  barków, zakresy ruchu.
- Treści 66 pozycji katalogowych (status `draft`).
- Sformułowania efektów, ostrzeżeń i przeciwwskazań oraz progi „wymaga nadzoru”.
- Reguły generatora sesji (dobór pozycji do celów, czasy utrzymań, kolejność).
- Do sprawdzenia na fizycznych urządzeniach: Safari iOS (głos, Wake Lock, audio), wydajność na starszych Androidach.
