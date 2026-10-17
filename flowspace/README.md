# FLOWSPACE 3D

Mobilna, interaktywna aplikacja do nauki jogi i codziennej praktyki z instruktorem 3D — w całości po polsku.
Działa w przeglądarce (WebGL), instaluje się jako PWA i przechowuje wszystkie dane lokalnie. Nie wymaga backendu
ani kluczy API.

> Flowspace ma charakter edukacyjny. Nie zastępuje porady lekarza, fizjoterapeuty ani nauczyciela jogi
> i **nie analizuje postawy użytkownika**. Treści i animacje czekają na weryfikację eksperta (patrz niżej).

## Uruchomienie

```bash
cd flowspace
npm install
npm run dev               # http://localhost:5173
npm run build             # siatka postaci + typecheck + build produkcyjny + service worker (dist/)
npm run avatar:build      # odbudowa modelu instruktora z źródeł CC0 → public/models/instructor.glb
npm run music:generate    # muzyka w tle z ElevenLabs (wymaga ELEVENLABS_API_KEY, patrz „Muzyka”)
npm run preview           # serwuje dist/ na http://localhost:4173

npm run typecheck
npm run lint
npm test                  # Vitest: silnik sesji, odtwarzacz, rig, walidacja treści
npm run validate:content  # pełna walidacja biblioteki pozycji (także kontakty z matą)
npm run e2e               # Playwright (buduje i serwuje aplikację automatycznie)
```

Wymagania: Node 20+. Testy e2e używają Chromium (`/opt/pw-browsers/chromium` lub zmienna `PW_CHROMIUM`).

### Trasy

| Ścieżka | Opis |
| --- | --- |
| `/` | Ekran główny: żywa scena 3D, pierwsze uruchomienie, nastrój → propozycje, kontynuacja, ulubione, tydzień |
| `/onboarding` | Lekka personalizacja (poziom, cel, czas, akcesoria, ruchy do unikania, bezpieczeństwo) |
| `/explore` | Encyklopedia: wyszukiwanie PL/EN/sanskryt, filtry (poziom, cel, obszar, rodzaj, pozycja, czas, akcesoria, 3D, ulubione, ostatnie) |
| `/pose/:slug` | Nauka pozycji: etapy, odtwarzanie, tempo, widoki kamery, obrót 360°, tryb techniczny, błędy z porównaniem |
| `/practice` | Kreator praktyki (czas 10–50 min lub własny, cel, poziom, preferencje) |
| `/practice/preview` | Podgląd: fazy, czasy, zamiana/usuwanie/kolejność, zmiana długości, zapis |
| `/practice/play` | Prowadzona praktyka 3D z głosem, pauzą, pominięciem, wznowieniem, ekranem zakończenia |
| `/breathe` | Ćwiczenia oddechowe (2, 5, 10 min; rytmy bez wstrzymywania oddechu) |
| `/routines` | Zapisane praktyki |
| `/progress` | Postępy: statystyki, tydzień, kalendarz, kamienie milowe, preferencje, notatki, historia |
| `/settings` | Głos, dźwięk, przestrzeń (4 otoczenia), grafika, dane |
| `/dev/pose-lab` | Narzędzie deweloperskie do pozycji (szkielet, osie, kontakty, parametry, interpolacja, kamery, błędy) |
| `/dev/pose-grid?grid=S_a,S_b` | Arkusz kontrolny stanów szkieletu (przód + bok) |
| `/dev/motion?from=a&to=b` | Sekwencja klatek przejścia między pozycjami (kontrola uziemienia) |

## Architektura

```
src/
  content/            # dane niezależne od renderera
    types.ts          # YogaPose, PoseState (parametry anatomiczne), SessionStep, YogaSession…
    poseState.ts      # neutral, merge, lustrzane odbicie L↔P, interpolacja parametrów
    validate.ts       # walidacja treści (używana przez testy i skrypt)
    poses/
      states.ts       # autorskie konfiguracje szkieletu (stany kluczowe i błędy)
      fitted.json     # wartości dopasowane solverem (kontakty z matą, wyrównania)
      define.ts       # definePose(), standardowe presety kamer
      standing.ts, floor.ts, seatedSupine.ts   # 53 pozycje z demonstracją 3D
      catalog.ts      # 66 pozycji katalogowych (bez 3D, status: draft)
  engine/
    session.ts        # generator sesji (seed, fazy, bilans stron, bezpieczeństwo, dopasowanie czasu)
    player.ts         # maszyna stanów praktyki (idle/preparing/playing/paused/transitioning/completed)
    labels.ts         # polskie etykiety, odmiana
  three/
    rig/skeleton.ts        # definicja kości + konwersja parametrów anatomicznych → kwaterniony
    rig/avatar.ts          # realistyczny awatar sterowany szkieletem FLOWSPACE (retargeting, kalibracja, próbki kontaktu)
    rig/characterAsset.ts  # wczytanie public/models/instructor.glb (GLTFLoader + meshopt)
    rig/avatarNode.ts      # wczytanie awatara w Node (testy, walidacja, dopasowanie pozycji)
    rig/InstructorRig.ts   # interpolacja (slerp, opóźnienia dystalne), uziemienie, IK, oddech, podświetlenia
    director.ts            # sekwencje wejścia/wyjścia, planowanie przejść między pozycjami bazowymi
    CameraRig.tsx          # orbitowanie, pinch, presety, kadrowanie pod telefon
    TechOverlay.tsx        # tryb techniczny: stawy, linie, orientacja, kontakty, środek ciężkości
    Stage.tsx              # Canvas, adaptacyjna jakość, widok porównawczy (dwa widoki zsynchronizowane)
    thumbnails.ts          # prawdziwe rendery 3D instruktora do kart pozycji
    world/                 # 4 proceduralne otoczenia (Pawilon Zen, Ocean, Góry, Las)
  audio/
    voice.ts          # adapter TTS (Web Speech + interfejs dla usług premium), kolejka
    ambient.ts        # proceduralne dźwięki otoczenia i misa przejść (WebAudio)
    music.ts          # kojąca muzyka: pętle z plików (ElevenLabs) z płynnym przenikaniem lub generowana na żywo
  store/stores.ts     # Zustand + localStorage: ustawienia, postępy, praktyki, szkic
  routes/, components/, dev/
```

Kluczowe decyzje:

- **Treść niezależna od renderera.** Jedna struktura `YogaPose` zasila encyklopedię, animację 3D, głos,
  generator sesji, demonstracje błędów i rekomendacje.
- **Pozy jako parametry anatomiczne, nie surowe rotacje.** `PoseState` opisuje zgięcia, odwiedzenia
  (współrzędne „globu” dla barku i biodra: elewacja / płaszczyzna / rotacja), skłony i skręty segmentów
  kręgosłupa. Renderer przelicza je na kwaterniony. Strona prawa = lustrzane odbicie strony lewej.
- **Brak ponownego użycia ogólnej animacji.** Walidator odrzuca dwie pozycje z identycznym stanem utrzymania.
- **Przejścia z planowaniem.** Między różnymi „bazami” (stanie, czworaki, klęk, siad, leżenie tyłem/przodem,
  podpór) reżyser przechodzi przez anatomicznie sensowne stany pośrednie, zamiast jednej interpolacji
  (np. z leżenia do stania ciało nie „przelatuje” przez siebie).
- **Kontakt z matą.** Każda klatka jest uziemiana na podstawie wierzchołków skórowanej siatki;
  zaznaczone kończyny (`plant`) są doprowadzane do maty dwuczłonowym IK.
- **Brak re-renderów Reacta w pętli animacji.** Rig i odtwarzacz działają w `useFrame` / `requestAnimationFrame`;
  UI odświeża się ~4×/s.
- **Deterministyczne sesje.** `generateSession(request)` z ziarnem `seed` daje zawsze ten sam wynik — sesje
  można zapisać i odtworzyć.

### Generator sesji

Wejście: czas, cel, poziom, intensywność, akcesoria, wykluczone ruchy, poziom prowadzenia, znane pozycje, ziarno.
Algorytm:

1. Filtrowanie bezpieczeństwa (poziom → trudność i maks. intensywność; nadzór tylko dla zaawansowanych;
   wykluczone ruchy nigdy nie trafiają do sesji; pozycje szczytowe tylko po przygotowaniu `needsPrep`).
2. Budżet faz: przybycie i oddech → rozgrzewka → część główna (krzywa intensywności ze szczytem w środku)
   → wyciszenie → relaks końcowy.
3. Wybór pozycji punktowany: dopasowanie do celu, rola w fazie, koszt przejścia między bazami,
   kara za powtórzenia, preferencja znanych/nowych pozycji, kontrolowany szum (seed).
4. Pozycje jednostronne zawsze w parach L/P o równym czasie.
5. Czas wejścia = animacja wejścia + planowany most z poprzedniej pozycji.
6. Dopasowanie czasu: skalowanie utrzymań w granicach każdej pozycji, reszta w relaksie końcowym i oddechu
   na początku; w razie potrzeby dodanie/usunięcie pozycji. Wynik mieści się w **±30 s** (testowane dla
   wszystkich celów, poziomów i intensywności przy 10/20/30/40/50 min).

### Odtwarzacz

`SessionPlayer` jest czystą maszyną stanów sterowaną `tick(dt)` — nie czyta zegara, więc timer, głos
i animacja pozostają zsynchronizowane przy pauzie, wznowieniu, pominięciu i zakończeniu. Po przejściu
aplikacji w tło praktyka pauzuje się automatycznie; miejsce zapisuje się co 2 s (kontynuacja z ekranu głównego).
Wake Lock utrzymuje ekran podczas praktyki.

## Struktura biblioteki pozycji

Każda pozycja (`YogaPose`) zawiera: id/slug, nazwy PL/EN/sanskryt, kategorię, trudność, obszary ciała,
efekty (ostrożnie sformułowane), przeciwwskazania i ostrzeżenia, akcesoria, czas nauki, typowy czas,
warianty dla początkujących, instrukcje krok po kroku (3–6 etapów: opis, czas, segment animacji, preset kamery,
podświetlone stawy, narracja), częste błędy (stan błędny, stan poprawiony, kamera, stawy), stronę L/P,
animację (klatki kluczowe, wejście/utrzymanie/wyjście, rodzaj oddechu), przewodniki trybu technicznego,
odniesienia przejść, skrypt głosowy, metadane sesji oraz statusy przeglądu treści i animacji.

## Jak dodać nową pozycję

1. Dodaj stany szkieletu w `src/content/poses/states.ts` (pochodne od istniejących, np. `pose(S_tabletop, {...})`),
   opakowane w `F('S_nazwa', ...)`.
2. Sprawdź je wizualnie: `/dev/pose-grid?grid=S_nazwa` lub `/dev/pose-lab`.
3. Jeśli kontakt z matą lub wyrównanie wymaga korekty, dopisz specyfikację w `scripts/pose-fit-specs.ts`
   i uruchom `WRITE=1 npx vite-node scripts/pose-fit.ts <spec>` (albo `auto:S_nazwa` dla kończyn `plant`).
   Raport: `npx vite-node scripts/pose-report.ts S_nazwa`.
4. Dodaj wpis `definePose({...})` w odpowiednim pliku (klatki `kf()`, etapy `step()`, błędy `mistake()`,
   warianty `mod()`, przewodniki `guide()`, metadane `session`).
5. Uruchom `npm run validate:content` i `npm test`.
6. Pozostaw `contentReviewStatus: 'internal-review'` do czasu weryfikacji eksperta.

## Instruktor (awatar)

Widoczny instruktor to realistyczna postać z MakeHuman/MPFB (licencja CC0, szczegóły w `public/models/README.md`).
Pozycje nadal są opisane parametrami anatomicznymi na własnym 23-kościowym szkielecie FLOWSPACE („driver”):
interpolacja, uziemienie, IK, kontakty i tryb techniczny działają na nim, a `AvatarDriver` co klatkę przenosi
pozę na kości awatara (obroty z kalibracją pozy spoczynkowej + pozycje stawów). Proporcje szkieletu
(`DIM` w `skeleton.ts`) są zmierzone z awatara, więc stawy się pokrywają; kontakt z matą liczony jest na
prawdziwej siatce awatara (także w testach i walidacji — `avatarNode.ts`).

`npm run avatar:build` (scripts/avatar/) odtwarza model od zera: pobiera źródła CC0 do `.avatar-cache/`,
rekonstruuje pełne ciało ukryte pod oryginalnym ubraniem (dopasowanie targetów MakeHuman + interpolacja
harmoniczna, wagi z riga MPFB), maluje strój do jogi w teksturze skóry, usuwa ubranie, mimikę, zęby i rzęsy,
po czym kompresuje (WebP, meshopt) do ~0,8 MB.

### Kontakt z matą i równowaga

- `src/content/poses/contacts.ts` — dla każdej pozycji na podłodze lista części ciała, które leżą na macie
  (miednica, łopatki, głowa, pośladki, piszczele…). `npm run validate:content` sprawdza je na prawdziwej siatce;
  `npx vite-node scripts/contact-fit.ts [Stan…]` dopasowuje kąty stawów (minimalna zmiana) i zapisuje `fitted.json`.
- W ruchu rig utrzymuje na macie części, które leżą na niej w tym samym miejscu na początku i końcu ruchu
  (przechył/pochylenie ciała), dłonie i stopy przesuwają się po macie (IK), a gdy przy podłodze środek ciężkości
  wyjdzie poza obszar podparcia, ciało przechyla się, aż oprze się kolejną częścią (dłońmi, kolanami, plecami).
- `npx vite-node scripts/motion-report.ts` odtwarza wygenerowane sesje i raportuje zawisy i brak podparcia;
  `/dev/motion?from=half-forward-fold&to=bridge` pokazuje przejście jako sekwencję klatek.

Inny model GLB można podłączyć, uzupełniając mapę kości `AVATAR_MAP` w `avatar.ts` i dopasowując `DIM`.

## Wymagania dotyczące zasobów 3D

Postać instruktora pochodzi z zasobów CC0 (MakeHuman/MPFB, ~33 tys. trójkątów, tekstury WebP, ~0,8 MB).
Pozostałe zasoby są proceduralne: tekstury drewna, maty, żwiru i trawy (canvas), drzewa (instancjonowane),
góry, niebo, woda (shadery), dźwięki (WebAudio). Elementy oczekujące na wymianę na produkcyjne zasoby:

- roślinność i architektura pawilonu (docelowo zoptymalizowane modele GLB z LOD),
- dźwięki otoczenia (docelowo licencjonowane nagrania terenowe).

## Głos

- Domyślnie Web Speech API (`pl-PL`), bez klucza API. Wybór głosu (kobiecy/męski — jeśli dostępny w systemie),
  tempo, głośność, włącz/wyłącz, poziom instrukcji (minimum / standard / „Prowadź mnie dokładnie”).
- Pierwsza wypowiedź jest „odblokowywana” gestem użytkownika (wymóg Safari na iOS).
- Usługa premium: zaimplementuj interfejs `VoiceProvider` (`speak`, `cancel`, `unlock`, `listVoices`)
  i zarejestruj ją `registerVoiceProvider()`; wybierz ją w `getVoiceProvider(id)`.
- Brak polskiego głosu w systemie → instrukcje są wyświetlane jako napisy.

## Muzyka

Podczas praktyki gra spokojna, zapętlona muzyka (Ustawienia → „Kojąca muzyka w tle”: włącz/wyłącz, utwór,
głośność, podgląd). Cichnie, gdy instruktor mówi, przycisza się na pauzie i wygasa po zakończeniu.

- **Bez plików** działa muzyka generowana na żywo (WebAudio): wolne akordy D-dur pentatoniki, miękkie dzwonki,
  pogłos — zawsze dostępna offline.
- **ElevenLabs:** `ELEVENLABS_API_KEY=… npm run music:generate` tworzy 4 instrumentalne utwory z naturą
  (las, ocean, górski strumień, deszcz) przez Music API (`POST /v1/music`) i dopisuje je do
  `public/audio/music/manifest.json`. Własny prompt: `npm run music:generate -- custom "opis" 120`.
  Aplikacja zapętla pliki bez przerwy (przenikanie końca z początkiem); tryb „Automatycznie” wybiera pierwszy
  utwór z manifestu, a gdy go brak — muzykę generowaną. Sprawdź warunki licencyjne swojego planu ElevenLabs.

## Znane ograniczenia

- Instruktor używa linear blend skinning (bez kości pomocniczych i korekt), więc przy skrajnych zgięciach
  (bark przy rękach nad głową, głęboki przysiad) widać niewielką utratę objętości. Strój jest namalowany na
  ciele (obcisły), kucyk opada uproszczoną grawitacją, twarz nie ma mimiki.
- Konfiguracje pozycji są wiarygodnymi demonstracjami przygotowanymi z myślą o poprawności, ale **nie zostały
  zweryfikowane przez nauczyciela jogi ani fizjoterapeutę** (status `internal-review`). Pozycje katalogowe mają
  status `draft`.
- Część błędów jest opisana tylko słownie (nie demonstrujemy ruchów, które mogłyby utrwalać niebezpieczny wzorzec).
- Testy e2e działają w Chromium (emulacja wymiarów iPhone/Pixel); zachowanie Safari na iOS (głos, Wake Lock,
  autoodtwarzanie audio) wymaga sprawdzenia na fizycznym urządzeniu.
- Jakość głosu zależy od syntezatorów zainstalowanych w systemie.
- Po zminimalizowaniu aplikacji praktyka się pauzuje (świadomy wybór — dźwięk i animacja w tle są niewiarygodne).
