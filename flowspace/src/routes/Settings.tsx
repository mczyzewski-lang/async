import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { GuidanceLevel } from '@/content/types';
import { ENVIRONMENT_LIST } from '@/three/world/environments';
import { getVoiceProvider } from '@/audio/voice';
import { ambient } from '@/audio/ambient';
import { GENERATIVE_ID, loadMusicManifest, music, type MusicTrack } from '@/audio/music';
import { Chip, Disclaimer, PageHeader, Section, Toggle } from '@/components/ui';
import { LEVEL_LABELS, GOAL_LABELS } from '@/engine/labels';
import { useProgress, useRoutines, useSettings } from '@/store/stores';
import type { QualitySetting } from '@/three/Stage';

export default function Settings() {
  const s = useSettings();
  const clearProgress = useProgress((p) => p.clear);
  const [voices, setVoices] = useState(() => getVoiceProvider().listVoices());
  const [confirmReset, setConfirmReset] = useState(false);
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [previewing, setPreviewing] = useState(false);
  useEffect(() => {
    void loadMusicManifest().then(setTracks);
    return () => music.stop(0.6);
  }, []);
  const togglePreview = async () => {
    if (previewing) {
      music.stop(1);
      setPreviewing(false);
      return;
    }
    await ambient.unlock();
    void music.start(s.musicTrack, s.musicVolume);
    setPreviewing(true);
  };
  const pickTrack = (id: string) => {
    s.set({ musicTrack: id });
    if (previewing) void music.start(id, s.musicVolume);
  };

  useEffect(() => {
    const update = () => setVoices(getVoiceProvider().listVoices());
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.addEventListener?.('voiceschanged', update);
    update();
    return () => {
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.removeEventListener?.('voiceschanged', update);
    };
  }, []);

  const testVoice = () => {
    const p = getVoiceProvider();
    p.unlock();
    p.speak('Weź spokojny wdech. Z wydechem pozwól barkom opaść.', { ...s.voice, enabled: true });
  };

  return (
    <div>
      <PageHeader title="Ustawienia" back />
      <div className="safe-x">
        <Section title="Profil">
          <div className="card p-4">
            <p className="text-sm text-ink-soft">
              {LEVEL_LABELS[s.profile.level]} · {GOAL_LABELS[s.profile.goal]} · {s.profile.durationMin} min
            </p>
            <Link to="/onboarding" className="btn-secondary mt-3 h-11 min-h-0">Zmień preferencje</Link>
          </div>
        </Section>

        <Section title="Głos prowadzący">
          <div className="card divide-y divide-ink/6 px-4">
            <Toggle checked={s.voice.enabled} onChange={(v) => s.setVoice({ enabled: v })} label="Instrukcje głosowe" description="Polska synteza mowy w przeglądarce." testId="toggle-voice" />
            <div className="py-3">
              <div className="mb-2 font-medium">Głos</div>
              <div className="flex flex-wrap gap-2">
                {(['female', 'male', 'any'] as const).map((g) => (
                  <Chip key={g} active={s.voice.gender === g && !s.voice.voiceURI} onClick={() => s.setVoice({ gender: g, voiceURI: undefined })}>
                    {g === 'female' ? 'Kobiecy' : g === 'male' ? 'Męski' : 'Dowolny'}
                  </Chip>
                ))}
              </div>
              {voices.length > 0 ? (
                <select
                  className="mt-3 h-11 w-full rounded-xl border border-ink/10 bg-paper px-3"
                  value={s.voice.voiceURI ?? ''}
                  onChange={(e) => s.setVoice({ voiceURI: e.target.value || undefined })}
                  aria-label="Wybór głosu"
                >
                  <option value="">Automatycznie</option>
                  {voices.map((v) => <option key={v.uri} value={v.uri}>{v.name}</option>)}
                </select>
              ) : (
                <p className="mt-2 text-sm text-ink-soft">Nie znaleziono polskiego głosu w systemie — instrukcje będą wyświetlane jako napisy. Możesz doinstalować polski głos w ustawieniach systemu.</p>
              )}
              <p className="mt-2 text-xs text-ink-soft">Dostępność głosu męskiego/kobiecego zależy od urządzenia.</p>
            </div>
            <label className="block py-3">
              <span className="flex justify-between font-medium">Tempo mowy <span className="text-ink-soft">{s.voice.rate.toFixed(2)}×</span></span>
              <input type="range" min={0.7} max={1.3} step={0.05} value={s.voice.rate} onChange={(e) => s.setVoice({ rate: Number(e.target.value) })} className="mt-2 w-full" />
            </label>
            <label className="block py-3">
              <span className="flex justify-between font-medium">Głośność głosu <span className="text-ink-soft">{Math.round(s.voice.volume * 100)}%</span></span>
              <input type="range" min={0.1} max={1} step={0.05} value={s.voice.volume} onChange={(e) => s.setVoice({ volume: Number(e.target.value) })} className="mt-2 w-full" />
            </label>
            <div className="py-3">
              <div className="mb-2 font-medium">Ilość instrukcji</div>
              <div className="flex flex-wrap gap-2">
                {([['minimal', 'Minimum instrukcji'], ['standard', 'Standardowo'], ['detailed', 'Prowadź mnie dokładnie']] as Array<[GuidanceLevel, string]>).map(([g, l]) => (
                  <Chip key={g} active={s.guidance === g} onClick={() => s.set({ guidance: g })}>{l}</Chip>
                ))}
              </div>
            </div>
            <div className="py-3">
              <button className="btn-secondary h-11 min-h-0" onClick={testVoice}>Odsłuchaj</button>
            </div>
          </div>
        </Section>

        <Section title="Dźwięk i prowadzenie">
          <div className="card divide-y divide-ink/6 px-4">
            <Toggle checked={s.ambientOn} onChange={(v) => s.set({ ambientOn: v })} label="Dźwięki otoczenia" description="Wiatr, fale lub ptaki — generowane na żywo." />
            <label className="block py-3">
              <span className="flex justify-between font-medium">Głośność otoczenia <span className="text-ink-soft">{Math.round(s.ambientVolume * 100)}%</span></span>
              <input type="range" min={0} max={1} step={0.05} value={s.ambientVolume} onChange={(e) => { s.set({ ambientVolume: Number(e.target.value) }); ambient.setVolume(Number(e.target.value)); }} className="mt-2 w-full" />
            </label>
            <Toggle checked={s.musicOn} onChange={(v) => s.set({ musicOn: v })} label="Kojąca muzyka w tle" description="Spokojna, zapętlona muzyka podczas praktyki; cichnie, gdy mówi instruktor." />
            <div className="py-3">
              <span className="font-medium">Utwór</span>
              <div className="mt-2 flex flex-wrap gap-2">
                <Chip active={s.musicTrack === 'auto'} onClick={() => pickTrack('auto')}>Automatycznie</Chip>
                {tracks.map((t) => (
                  <Chip key={t.id} active={s.musicTrack === t.id} onClick={() => pickTrack(t.id)}>{t.title}</Chip>
                ))}
                <Chip active={s.musicTrack === GENERATIVE_ID} onClick={() => pickTrack(GENERATIVE_ID)}>Generowana na żywo</Chip>
              </div>
            </div>
            <label className="block py-3">
              <span className="flex justify-between font-medium">Głośność muzyki <span className="text-ink-soft">{Math.round(s.musicVolume * 100)}%</span></span>
              <input type="range" min={0} max={1} step={0.05} value={s.musicVolume} onChange={(e) => { s.set({ musicVolume: Number(e.target.value) }); music.setVolume(Number(e.target.value)); }} className="mt-2 w-full" />
            </label>
            <div className="py-3">
              <button className="btn-secondary h-11 min-h-0" onClick={() => void togglePreview()}>{previewing ? 'Zatrzymaj podgląd' : 'Posłuchaj muzyki'}</button>
            </div>
            <Toggle checked={s.chimes} onChange={(v) => s.set({ chimes: v })} label="Delikatny dźwięk przejścia" description="Cicha misa przy zmianie pozycji." />
            <Toggle checked={s.breathingGuide} onChange={(v) => s.set({ breathingGuide: v })} label="Wizualizacja oddechu" description="Podczas powitania i relaksu." />
            <Toggle checked={s.keepAwake} onChange={(v) => s.set({ keepAwake: v })} label="Nie wygaszaj ekranu podczas praktyki" />
          </div>
        </Section>

        <Section title="Przestrzeń">
          <div className="grid grid-cols-2 gap-3">
            {ENVIRONMENT_LIST.map((e) => (
              <button
                key={e.id}
                onClick={() => s.set({ environment: e.id })}
                className={`card overflow-hidden text-left ring-2 transition ${s.environment === e.id ? 'ring-ink' : 'ring-transparent'}`}
                data-testid={`env-${e.id}`}
                aria-pressed={s.environment === e.id}
              >
                <div className="h-16" style={{ background: `linear-gradient(180deg, ${e.skyTop}, ${e.skyHorizon} 60%, ${e.groundColor})` }} />
                <div className="p-3">
                  <div className="font-semibold">{e.namePL}</div>
                  <div className="text-xs text-ink-soft">{e.descriptionPL}</div>
                </div>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Grafika">
          <div className="flex flex-wrap gap-2">
            {([['auto', 'Automatycznie'], ['high', 'Wysoka'], ['medium', 'Średnia'], ['low', 'Oszczędna']] as Array<[QualitySetting, string]>).map(([q, l]) => (
              <Chip key={q} active={s.quality === q} onClick={() => s.set({ quality: q })}>{l}</Chip>
            ))}
          </div>
          <p className="mt-2 text-sm text-ink-soft">Tryb automatyczny obniża jakość, jeśli urządzenie nie utrzymuje płynnej animacji.</p>
        </Section>

        <Section title="Dane">
          <div className="card p-4">
            <p className="text-sm text-ink-soft">Wszystkie dane (profil, postępy, zapisane praktyki) są przechowywane wyłącznie na tym urządzeniu.</p>
            {!confirmReset ? (
              <button className="btn-secondary mt-3 h-11 min-h-0" onClick={() => setConfirmReset(true)}>Wyczyść dane</button>
            ) : (
              <div className="mt-3 flex gap-2">
                <button
                  className="btn-primary h-11 min-h-0 bg-coral"
                  onClick={() => {
                    clearProgress();
                    useRoutines.setState({ routines: [], active: null });
                    s.reset();
                    setConfirmReset(false);
                  }}
                >
                  Tak, usuń wszystko
                </button>
                <button className="btn-secondary h-11 min-h-0" onClick={() => setConfirmReset(false)}>Anuluj</button>
              </div>
            )}
          </div>
        </Section>

        <Section title="O aplikacji">
          <div className="card space-y-3 p-4 text-sm">
            <Disclaimer />
            <p className="text-ink-soft">
              Instruktor 3D i otoczenie są generowane proceduralnie w przeglądarce (bez zewnętrznych modeli). Układy ciała przygotowano z myślą o wiernym
              przedstawieniu pozycji; treści oczekują na weryfikację doświadczonego nauczyciela jogi i fizjoterapeuty.
            </p>
            <Link to="/dev/pose-lab" className="text-xs text-ink-soft underline">Narzędzia deweloperskie: Pose Lab</Link>
          </div>
        </Section>
      </div>
    </div>
  );
}
