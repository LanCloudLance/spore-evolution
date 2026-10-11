'use client';
import { BiologicalReview } from './BiologicalReview';
import { ControlsHelp } from './ControlsHelp';
import { AudioVolumes } from './AudioVolumes';
import type { BiologicalRecord } from './biological-finale';
import Link from 'next/link';
import { createFrameMetrics } from './frame-metrics';
import { recoverLife } from './life-recovery';
import { tidalObstacles } from './tidal/habitat';
import {
  oceanPracticeStorage,
  createOceanPracticeSession,
} from './ocean-practice';
import { LifeEvolution } from './LifeEvolution';
import {
  nextGenerationCandidates,
  commitBiologicalEvolution,
} from './biological-evolution';
import { beginGuidedAction, restorePanelMode } from './evolution-navigation';
import {
  guideOceanActor,
  targetOceanPrey,
  OCEAN_DNA_BODIES,
} from './ocean-dna';
import { MICROBE_BODIES, DNA_SOURCES } from './dna-evolution';
import { TidalHUD } from './TidalHUD';
import { TidalJournal } from './TidalJournal';
import { createTidalControls } from './tidal/input';
import { tidalSoundScene } from './tidal/audio-scene';
import type { Input } from './simulation';
import { drawBodyGeometry, worldBodyPose, trunkCircles } from './body-geometry';
import { targetPondPrey, guidePondHunt, guidePondVisit } from './pond-life';
import {
  biologicalSourceGuide,
  refreshLandSource,
  preciseTidalFood,
  journeyDestination,
  landJourneyObstacles,
} from './life-guidance';
import { chooseMigration } from './ocean-migration';
import { EvolutionExperience } from './EvolutionExperience';
import { drawJourneyFocus } from './world-guidance';
import {
  consumeDash,
  pressDash,
  takeActionInput,
  takeLearnedSkillInput,
  gameKey,
  keyHints,
  blocksGameInput,
} from './dash-input';
import { revealing, skipEvolution } from './evolution-experience';
import { familyTimeline } from './lineage';
import { readCampaignSave, writeCampaignSave } from './campaign-save';
import { createCampaignSession } from './campaign-session';
import { ColonyGame } from './ColonyGame';
import { TribeGame } from './TribeGame';
import { SpaceGame } from './SpaceGame';
import { ExpeditionReview } from './ExpeditionReview';
import type { SpaceState, ExpeditionRecord } from './space';
import { CivilizationGame } from './CivilizationGame';
import type { CivilizationState } from './civilization';
import type { TribeState } from './tribe';
import { createColonyWorld, colonyFromLand } from './colony';
import type { ColonyState } from './colony';
import { huntingStats } from './land-hunt';
import {
  createLandWorld,
  enterLand,
  landZone,
  applyLandSeed,
  chooseLandFocus,
  continueLandLife,
  revisitLandSettlement,
  LAND_WAY_NAMES,
  LAND_ROCKS,
} from './land';
import type { LandFocus } from './land';
import { evolveLand } from './land';
import { evolveOcean } from './ocean';
import { OceanEvolution } from './OceanUI';
import { LandHUD, LandEvolution } from './LandUI';
import {
  startLandDrought,
  chooseDroughtStrategy,
  trackDrought,
} from './land-drought';
import type { DroughtCommand } from './LandDroughtUI';
import { DROUGHT_NAMES } from './land-drought';
import { createShoreWorld, enterShore, shoreZone } from './shore';
import { ShoreHUD } from './ShoreUI';
import { BodyEditor } from './BodyEditor';
import { setTidalSlots } from './tidal/abilities';
import { bodyEditGate, commitBody } from './body-design';
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useCallback,
} from 'react';
import {
  Volume2,
  VolumeX,
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  Dna,
  GitBranch,
  Leaf,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Sparkles,
  Save,
  Target,
  X,
  Zap,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  stepWorld,
  getStats,
  getZone,
  reviseMicrobe,
  reproductionGate,
  announce,
  TRAITS,
  NURSERY,
  HAVEN,
  MAP,
  distance,
} from './simulation';
import Image from 'next/image';
import { StageLifeControls } from './StageLifeControls';
import { continueStageLife, reviewStageLife } from './stage-life';
import { LearningMenu } from './LearningMenu';
import { selectLearnedSkill, learnedSkillGate } from './lineage-learning';
import { MicrobeEvolution } from './MicrobeEvolution';
import { adaptationsOf } from './life-adaptations';
import { createGameStore } from './store';
import { renderWorld, pointerVector, drawOrganism } from './render';

import { createOceanWorld, enterOcean, oceanZone } from './ocean';
import { FORMS } from './forms';
import { OceanHUD, EvolutionTree, BodyPortrait } from './OceanUI';

import { GameAudio } from './audio';
import { updateCamera, getView } from './camera';
import {
  guideNavigation,
  captureNavigationTap,
  releaseNavigationTap,
} from './navigation';
import type { Navigation, NavigationTap } from './navigation';

type Panel = 'body' | 'journal' | 'family' | 'evolution' | null;
function clock(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0')}`;
}

export default function Game({
  oceanPractice = false,
}: {
  oceanPractice?: boolean;
}) {
  const [session] = useState(() =>
    oceanPractice ? createOceanPracticeSession() : createCampaignSession(),
  );
  const [colony, setColony] =
    useState<ReturnType<typeof session.getColony>>(null);
  const [tribe, setTribe] = useState<ReturnType<typeof session.getTribe>>(null);
  const [city, setCity] = useState<ReturnType<typeof session.getCity>>(null);
  const [space, setSpace] = useState<ReturnType<typeof session.getSpace>>(null);
  const active = useRef<'journey' | 'colony' | 'tribe' | 'city' | 'space'>(
    'journey',
  );
  const canSave = useRef(false);
  const restoredOnce = useRef(false);
  const [saveStatus, setSaveStatus] = useState('本机存档');
  const persist = useCallback(() => {
    if (!canSave.current) return;
    const snapshot = session.snapshot(active.current);
    if (
      snapshot.active === 'journey' &&
      snapshot.journey.mode === 'ready' &&
      !snapshot.colony &&
      !snapshot.records?.length
    )
      return;
    try {
      setSaveStatus(
        writeCampaignSave(
          oceanPractice
            ? oceanPracticeStorage(window.localStorage)
            : window.localStorage,
          snapshot,
        )
          ? '已保存到本机'
          : '保存失败，请保留页面',
      );
    } catch {
      setSaveStatus('本机存档不可用');
    }
  }, [session, oceanPractice]);
  const syncColony = useCallback(
    (current: ColonyState) => session.updateColony(current),
    [session],
  );
  const syncTribe = useCallback(
    (current: TribeState) => session.updateTribe(current),
    [session],
  );
  const syncSpace = useCallback(
    (current: SpaceState) => session.updateSpace(current),
    [session],
  );
  const syncCity = useCallback(
    (current: CivilizationState) => session.updateCity(current),
    [session],
  );
  useEffect(() => {
    let disposed = false;
    void Promise.resolve().then(() => {
      if (disposed || restoredOnce.current) return;
      restoredOnce.current = true;
      try {
        const result = readCampaignSave(
          oceanPractice
            ? oceanPracticeStorage(window.localStorage)
            : window.localStorage,
        );
        if (result.kind === 'ok' || result.kind === 'recovered') {
          active.current = session.restore(result.save.campaign);
          if (
            active.current === 'colony' ||
            active.current === 'tribe' ||
            active.current === 'city' ||
            active.current === 'space'
          )
            setColony(session.getColony());
          if (['tribe', 'city', 'space'].includes(active.current))
            setTribe(session.getTribe());
          if (['city', 'space'].includes(active.current))
            setCity(session.getCity());
          if (active.current === 'space') setSpace(session.getSpace());
          canSave.current = true;
          setSaveStatus(
            result.kind === 'recovered' ? '已恢复上一份存档' : '已恢复本机进度',
          );
        } else if (result.kind === 'empty') canSave.current = true;
        else
          setSaveStatus(
            result.kind === 'unsupported'
              ? '存档版本不兼容，已保留'
              : result.kind === 'invalid'
                ? '存档损坏，原档已保留'
                : '本机存档不可用',
          );
      } catch {
        setSaveStatus('本机存档不可用');
      }
    });
    const timer = window.setInterval(persist, 5000);
    const hidden = () => {
      if (document.hidden) persist();
    };
    window.addEventListener('pagehide', persist);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener('pagehide', persist);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [session, persist, oceanPractice]);
  const resume = session.getColony();
  return space ? (
    <SpaceGame
      checkpoint={space.checkpoint}
      current={space.current}
      onProgress={syncSpace}
      readCurrent={() => session.getSpace()?.current}
      onSave={persist}
      saveStatus={saveStatus}
      onExit={(current) => {
        session.leaveSpace(current);
        active.current = 'city';
        setSpace(null);
        setCity(session.getCity());
        persist();
      }}
      onReplay={(current, trait) => {
        session.updateSpace(current);
        if (!session.newJourney(trait)) return;
        active.current = 'journey';
        setSpace(null);
        setCity(null);
        setTribe(null);
        setColony(null);
        persist();
      }}
    />
  ) : city ? (
    <CivilizationGame
      hasSpace={!!session.getSpace()}
      onSpace={(current) => {
        session.updateCity(current);
        if (!session.startSpace()) return;
        active.current = 'space';
        setSpace(session.getSpace());
        persist();
      }}
      checkpoint={city.checkpoint}
      current={city.current}
      onProgress={syncCity}
      readCurrent={() => session.getCity()?.current}
      onSave={persist}
      saveStatus={saveStatus}
      onExit={(current) => {
        session.leaveCity(current);
        active.current = 'tribe';
        persist();
        setCity(null);
        setTribe(session.getTribe());
      }}
    />
  ) : tribe ? (
    <TribeGame
      checkpoint={tribe.checkpoint}
      current={tribe.current}
      onProgress={syncTribe}
      readCurrent={() => session.getTribe()?.current}
      onSave={persist}
      saveStatus={saveStatus}
      hasCity={!!session.getCity()}
      onCity={(current) => {
        session.updateTribe(current);
        if (!session.startCity()) return;
        active.current = 'city';
        setCity(session.getCity());
        persist();
      }}
      onExit={(current) => {
        session.leaveTribe(current);
        active.current = 'colony';
        persist();
        setTribe(null);
        setColony(session.getColony());
      }}
    />
  ) : colony ? (
    <ColonyGame
      checkpoint={colony.checkpoint}
      current={colony.current}
      saveStatus={saveStatus}
      onSave={persist}
      onProgress={syncColony}
      readCurrent={() => session.getColony()?.current}
      hasTribe={!!session.getTribe()}
      onFinishBiological={(current) => {
        session.updateColony(current);
        session.finishBiological();
        persist();
        return (
          session
            .getBiologicalRecords()
            .find((r) => r.id === session.getColony()?.current.archiveId) ??
          null
        );
      }}
      onBranch={(id, generation) => {
        if (session.branchBiological(id, generation)) {
          active.current = 'journey';
          setColony(null);
          setTribe(null);
          setCity(null);
          setSpace(null);
          persist();
        }
      }}
      onTribe={(current) => {
        session.updateColony(current);
        if (!session.startTribe()) return;
        active.current = 'tribe';
        setTribe(session.getTribe());
        persist();
      }}
      onExit={(current) => {
        session.leaveColony(current);
        active.current = 'journey';
        persist();
        setColony(null);
      }}
    />
  ) : (
    <Journey
      oceanPractice={oceanPractice}
      records={session.getRecords()}
      biologicalRecords={session.getBiologicalRecords()}
      onBranch={(id, generation) => {
        if (session.branchBiological(id, generation)) {
          active.current = 'journey';
          persist();
        }
      }}
      store={session.journey}
      saveStatus={saveStatus}
      onSave={persist}
      onColony={(checkpoint) => {
        session.startColony(checkpoint);
        active.current = 'colony';
        persist();
        setColony(session.getColony());
      }}
      onResumeColony={
        resume
          ? () => {
              active.current = 'colony';
              setColony(session.getColony());
              persist();
            }
          : undefined
      }
    />
  );
}
function Journey({
  oceanPractice,
  records,
  biologicalRecords,
  onBranch,
  onColony,
  store,
  onResumeColony,
  saveStatus,
  onSave,
}: {
  oceanPractice: boolean;
  records: ExpeditionRecord[];
  biologicalRecords: BiologicalRecord[];
  onBranch: (id: number, generation: number) => void;
  onColony: (state: ColonyState) => void;
  store: ReturnType<typeof createGameStore>;
  onResumeColony?: () => void;
  saveStatus: string;
  onSave: () => void;
}) {
  const world = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  const sound = useRef<GameAudio | null>(null);
  const [muted, setMuted] = useState(true);
  const [audioStarted, setAudioStarted] = useState(false);
  function enableAudio(optIn = false) {
    // Starting or resuming play respects silence until the player opts in.
    if (muted && !optIn) return;
    if (!sound.current) sound.current = new GameAudio();
    const live = store.getWorld();
    sound.current.setHabitat(
      live.land ? 'land' : live.shore ? 'shore' : live.ocean ? 'ocean' : 'pond',
    );
    sound.current.setMuted(optIn ? false : muted);
    sound.current.setPlaying(live.mode === 'running');
    void sound.current.unlock().then((ok) => {
      setAudioStarted(ok);
    });
  }
  function toggleAudio() {
    if (!audioStarted) {
      setMuted(false);
      enableAudio(true);
      return;
    }
    const next = !muted;
    setMuted(next);
    sound.current?.setMuted(next);
  }
  useEffect(
    () => () => {
      sound.current?.dispose();
      sound.current = null;
    },
    [],
  );
  const [panel, setPanel] = useState<Panel>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const specimen = useRef<HTMLCanvasElement>(null);
  const keys = useRef(new Set<string>());
  const tidalControls = useRef(createTidalControls());
  const dashInput = useRef({ remaining: 0 });
  const pointer = useRef({ active: false, x: 0, y: 0, dash: false });
  const navigation = useRef<Navigation | null>(null);
  const pointerStart = useRef<NavigationTap | null>(null);
  const locateUntil = useRef(0);
  const inputStamp = useRef<number | null>(null);
  const locate = () => {
    inputStamp.current = performance.now();
    const live = store.getWorld();
    const next = beginGuidedAction(live, journeyDestination(live));
    if (next) {
      navigation.current = next;
      keys.current.clear();
      tidalControls.current.clear();
      pointer.current.active = false;
      store.publish();
    }
    locateUntil.current = performance.now() + 5000;
    canvas.current?.focus({ preventScroll: true });
  };
  const actions = useRef({ pause: () => {}, evolve: () => {} });
  const previousMode = useRef(world.mode);
  const ocean = world.habitat === 'ocean';
  const shore = world.habitat === 'shore';
  const land = world.habitat === 'land';
  const stats = getStats(world.traits, world.form),
    ready = world.mode === 'ready';
  const update = () => store.publish();
  const focusGame = () => canvas.current?.focus({ preventScroll: true });
  function goOcean(direct = false) {
    const live = store.getWorld();
    if (direct) Object.assign(live, createOceanWorld(Date.now() % 100000));
    else if (!enterOcean(live)) return;
    keys.current.clear();
    tidalControls.current.clear();
    dashInput.current.remaining = 0;
    pointer.current.active = false;
    pointer.current.dash = false;
    setPanel(null);
    update();
    focusGame();
    enableAudio();
  }
  function goShore(direct = false) {
    const live = store.getWorld();
    if (direct) Object.assign(live, createShoreWorld(Date.now() % 100000));
    else if (!enterShore(live)) return;
    keys.current.clear();
    tidalControls.current.clear();
    dashInput.current.remaining = 0;
    pointer.current.active = false;
    pointer.current.dash = false;
    setPanel(null);
    update();
    focusGame();
    enableAudio();
  }
  function goLand(direct = false) {
    const live = store.getWorld();
    if (direct) Object.assign(live, createLandWorld(Date.now() % 100000));
    else if (!enterLand(live)) return;
    keys.current.clear();
    tidalControls.current.clear();
    dashInput.current.remaining = 0;
    pointer.current.active = false;
    pointer.current.dash = false;
    setPanel(null);
    update();
    focusGame();
    enableAudio();
  }
  function seedAction(action: 'eat' | 'plant' | 'water') {
    applyLandSeed(store.getWorld(), action);
    update();
    focusGame();
  }
  function droughtAction(action: DroughtCommand) {
    const live = store.getWorld();
    if (action === 'start') startLandDrought(live);
    else if (action === 'track' || action === 'untrack')
      trackDrought(live, action === 'track');
    else chooseDroughtStrategy(live, action);
    update();
    focusGame();
  }
  function focusLand(focus: LandFocus, destination?: number) {
    if (chooseLandFocus(store.getWorld(), focus, destination)) {
      update();
      focusGame();
    }
  }
  function showLandSettlement() {
    if (revisitLandSettlement(store.getWorld())) {
      update();
      focusGame();
    }
  }
  function command() {
    if (store.getWorld().mode === 'running') {
      if (store.getWorld().ocean?.tidal?.compat.mode === 'active')
        tidalControls.current.tap(store.getWorld(), 'slot1');
      else keys.current.add('r');
      focusGame();
    }
  }
  function interact() {
    if (store.getWorld().mode === 'running') {
      if (store.getWorld().ocean?.tidal?.compat.mode === 'active')
        tidalControls.current.tap(store.getWorld(), 'interact');
      else keys.current.add('f');
      focusGame();
    }
  }
  function skill() {
    if (store.getWorld().mode === 'running') {
      if (store.getWorld().ocean?.tidal?.compat.mode === 'active')
        tidalControls.current.tap(store.getWorld(), 'slot0');
      else keys.current.add('q');
      focusGame();
    }
  }
  function start() {
    const world = store.getWorld();
    world.mode = 'running';
    enableAudio();
    update();
    focusGame();
  }
  function restart(resetChapter = false) {
    const world = store.getWorld();
    Object.assign(world, recoverLife(world, oceanPractice, resetChapter), {
      freeLife: false,
    });
    world.mode = 'running';
    enableAudio();
    keys.current.clear();
    tidalControls.current.clear();
    dashInput.current.remaining = 0;
    pointer.current.active = false;
    pointer.current.dash = false;
    setPanel(null);
    update();
    focusGame();
  }
  function pause() {
    const world = store.getWorld();
    if (panel) return;
    if (world.mode === 'running') {
      world.mode = 'paused';
      keys.current.clear();
      tidalControls.current.clear();
      dashInput.current.remaining = 0;
      pointer.current.active = false;
      navigation.current = null;
      pointer.current.dash = false;
    } else if (world.mode === 'paused') {
      world.mode = 'running';
      enableAudio();
      focusGame();
    }
    update();
  }
  function openPanel(next: Panel) {
    const world = store.getWorld();
    previousMode.current = world.mode;
    if (world.mode === 'running') world.mode = 'paused';
    keys.current.clear();
    tidalControls.current.clear();
    dashInput.current.remaining = 0;
    pointer.current.active = false;
    pointer.current.dash = false;
    setPanel(next === 'body' ? 'evolution' : next);
    update();
  }
  function pauseForSettings() {
    if (store.getWorld().mode === 'running') pause();
    sound.current?.setPlaying(false);
  }
  function closePanel() {
    const world = store.getWorld();
    restorePanelMode(world, previousMode.current);
    setPanel(null);
    update();
    focusGame();
  }
  function evolve() {
    if (panel || !['running', 'paused'].includes(store.getWorld().mode)) return;
    openPanel('evolution');
  }
  function guideFromEvolution(id?: string, intent: 'hunt' | 'visit' = 'visit') {
    const live = store.getWorld();
    const guide = biologicalSourceGuide(live, id, intent);
    if (!guide) {
      announce(live, '这一来源暂未出现，先探索其他栖地。');
      update();
      return;
    }
    const guided = beginGuidedAction(live, guide.destination);
    if (!guided) return;
    announce(live, guide.hint);
    keys.current.clear();
    tidalControls.current.clear();
    dashInput.current.remaining = 0;
    pointer.current.active = false;
    pointer.current.dash = false;
    navigation.current = guided;
    setPanel(null);
    update();
    focusGame();
  }
  useEffect(() => {
    actions.current = { pause, evolve };
  });
  useEffect(() => {
    const world = store.getWorld();
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    const collectMetrics = createFrameMetrics(el);
    let width = el.clientWidth,
      height = el.clientHeight,
      dpr = Math.min(window.devicePixelRatio || 1, 2),
      frame = 0,
      last = 0,
      lastHud = 0,
      accumulator = 0,
      priorFood = world.totalFood,
      priorHealth = world.player.health,
      priorGen = world.generation,
      priorDash = false,
      priorSkill = 0,
      priorEaten = 0,
      priorGrowth = 0,
      priorMode = world.mode,
      debugGeometry = false,
      priorMigration = `${world.ocean?.migration?.route}:${world.ocean?.migration?.station}`,
      priorReveal = world.evolution
        ? world.evolution.elapsed / world.evolution.duration
        : 1;
    const resize = () => {
      width = el.clientWidth;
      height = el.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      el.width = Math.round(width * dpr);
      el.height = Math.round(height * dpr);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    const keyDown = (event: KeyboardEvent) => {
      const key = gameKey(event);
      if (!key) return;
      if (
        event.target instanceof HTMLElement &&
        (!!event.target.closest('dialog,[role="dialog"]') ||
          (key !== 'escape' && blocksGameInput(event.target, key)))
      )
        return;
      if (
        process.env.NODE_ENV === 'development' &&
        key === 'f2' &&
        !event.repeat
      ) {
        event.preventDefault();
        debugGeometry = !debugGeometry;
        return;
      }
      if (event.repeat && ['q', 'f', 'r', 'c', 'g'].includes(key)) return;
      if (
        world.ocean?.tidal?.compat.mode === 'active' &&
        ['q', 'r', 'f'].includes(key)
      ) {
        event.preventDefault();
        tidalControls.current.press(
          world,
          key === 'q' ? 'slot0' : key === 'r' ? 'slot1' : 'interact',
        );
        return;
      }
      if (key === 'escape' && !event.repeat) {
        actions.current.pause();
        return;
      }
      if (key === 'e' && !event.repeat) {
        actions.current.evolve();
        return;
      }
      if (
        [
          'w',
          'a',
          's',
          'd',
          'arrowup',
          'arrowdown',
          'arrowleft',
          'arrowright',
          ' ',
          'q',
          'f',
          'r',
          'shift',
          'c',
          'g',
        ].includes(key) &&
        world.mode === 'running'
      ) {
        event.preventDefault();
        inputStamp.current = performance.now();
        keys.current.add(key);
        if (key === ' ' && !event.repeat && !revealing(world))
          pressDash(dashInput.current);
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      const key = gameKey({ key: event.key, code: event.code });
      if (!key) return;
      if (
        world.ocean?.tidal?.compat.mode === 'active' &&
        ['q', 'r', 'f'].includes(key)
      )
        tidalControls.current.release(
          key === 'q' ? 'slot0' : key === 'r' ? 'slot1' : 'interact',
        );
      if (!['q', 'f', 'r', 'c', 'g'].includes(key)) keys.current.delete(key);
    };
    const blur = () => {
      keys.current.clear();
      tidalControls.current.clear();
      dashInput.current.remaining = 0;
      pointer.current.active = false;
      navigation.current = null;
      pointer.current.dash = false;
      sound.current?.setPlaying(false);
      if (world.mode === 'running') {
        world.mode = 'paused';
        store.publish();
      }
    };
    const visibility = () => {
      if (document.hidden) blur();
    };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    function loop(now: number) {
      const frameStarted = performance.now();
      const observedMode = world.mode;
      const frameInterval = last ? now - last : 0;
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      const held = keys.current;
      let x =
          Number(held.has('d') || held.has('arrowright')) -
          Number(held.has('a') || held.has('arrowleft')),
        y =
          Number(held.has('s') || held.has('arrowdown')) -
          Number(held.has('w') || held.has('arrowup'));
      if (x !== 0 || y !== 0 || world.mode !== 'running' || revealing(world))
        navigation.current = null;
      if (
        navigation.current?.landCreatureId !== undefined &&
        !refreshLandSource(world, navigation.current)
      )
        navigation.current = null;
      if (navigation.current?.foodId) {
        const food = preciseTidalFood(
          world,
          navigation.current.foodId,
          navigation.current.foodHeading,
        );
        if (food) {
          navigation.current.target = food.target;
        } else navigation.current = null;
      }
      if (navigation.current && !pointer.current.active) {
        if (navigation.current.preyId !== undefined) {
          const chase =
            navigation.current.pondIntent === 'visit'
              ? guidePondVisit(world, navigation.current.preyId)
              : guidePondHunt(world, navigation.current.preyId);
          if (chase) {
            navigation.current.target = chase.target;
            x = chase.input.x;
            y = chase.input.y;
          } else navigation.current = null;
        } else if (navigation.current.oceanActorId) {
          const chase = guideOceanActor(
            world,
            navigation.current.oceanActorId,
            navigation.current.oceanIntent ?? 'hunt',
          );
          if (chase) {
            navigation.current.target = chase.target;
            x = chase.input.x;
            y = chase.input.y;
          } else navigation.current = null;
        } else {
          const terrain = world.land
            ? {
                obstacles: navigation.current.avoidDanger
                  ? landJourneyObstacles(world)
                  : LAND_ROCKS,
                clearance: Math.max(
                  ...trunkCircles(worldBodyPose(world)).map(
                    (c) => distance(c, world.player) + c.radius,
                  ),
                ),
              }
            : world.ocean?.tidal?.compat.mode === 'active'
              ? {
                  obstacles: tidalObstacles(0),
                  clearance: Math.max(
                    ...trunkCircles(worldBodyPose(world)).map(
                      (c) => distance(c, world.player) + c.radius,
                    ),
                  ),
                }
              : undefined;
          const v = guideNavigation(
            navigation.current,
            world.player,
            dt,
            terrain,
          );
          if (v) {
            x = v.x;
            y = v.y;
          } else if (
            navigation.current.foodId &&
            navigation.current.foodHeading !== undefined
          ) {
            x = Math.cos(navigation.current.foodHeading) * 0.06;
            y = Math.sin(navigation.current.foodHeading) * 0.06;
          } else navigation.current = null;
        }
      }
      if (pointer.current.active && x === 0 && y === 0) {
        const vector = pointerVector(
          world,
          width,
          height,
          pointer.current.x,
          pointer.current.y,
        );
        x = vector.x;
        y = vector.y;
      }
      const before = world.mode;
      const input: Input = {
        x,
        y,
        dash: false,
        skill: held.has('q'),
        sneak: held.has('shift'),
        interact: held.has('f'),
        command: held.has('r'),
      };
      if (world.mode === 'running') {
        accumulator += dt;
        while (accumulator >= 1 / 120) {
          Object.assign(input, takeActionInput(held, true));
          input.learnedSkill = takeLearnedSkillInput(held, true);
          input.dash = consumeDash(
            dashInput.current,
            1 / 120,
            held.has(' ') || pointer.current.dash,
            !revealing(world),
          );
          if (world.ocean?.tidal?.compat.mode === 'active')
            input.tidalCommand = tidalControls.current.take(world);
          stepWorld(world, input, 1 / 120);
          accumulator -= 1 / 120;
          input.skill = false;
          input.interact = false;
          input.command = false;
        }
      } else {
        accumulator = 0;
        dashInput.current.remaining = 0;
      }
      const simulationMs = performance.now() - frameStarted;
      const renderStarted = performance.now();
      updateCamera(world, width, height, dt);
      const audio = sound.current;
      audio?.setHabitat(
        world.land
          ? 'land'
          : world.shore
            ? 'shore'
            : world.ocean
              ? 'ocean'
              : 'pond',
      );
      audio?.setScene(
        world.ocean?.tidal?.compat.mode === 'active'
          ? tidalSoundScene(world)
          : null,
      );
      audio?.setPlaying(world.mode === 'running');
      const eaten = world.land?.nutrition ?? world.ocean?.eaten ?? 0,
        growth = world.land
          ? huntingStats(world).level
          : Math.floor((world.ocean?.biomass ?? 0) / 25);
      if (eaten > priorEaten) audio?.cue('gulp');
      else if (world.totalFood > priorFood) audio?.cue('food');
      if (growth > priorGrowth) audio?.cue('grow');
      const migrationKey = `${world.ocean?.migration?.route}:${world.ocean?.migration?.station}`;
      if (world.ocean?.migration?.route && migrationKey !== priorMigration)
        audio?.cue('migration');
      priorMigration = migrationKey;
      priorEaten = eaten;
      priorGrowth = growth;
      if (world.player.health < priorHealth - 1) audio?.cue('hit');
      const revealProgress = world.evolution
        ? world.evolution.elapsed / world.evolution.duration
        : 1;
      if (world.generation > priorGen) priorReveal = 0;
      if (
        world.mode === 'running' &&
        revealProgress >= 0.78 &&
        priorReveal < 0.78
      )
        audio?.cue('birth');
      else if (
        world.mode === 'running' &&
        revealProgress >= 0.2 &&
        priorReveal < 0.2
      )
        audio?.cue('skill');
      priorReveal = revealProgress;
      if (world.player.dashing && !priorDash) audio?.cue('dash');
      if (
        (world.land?.skillCooldown ??
          world.shore?.skillCooldown ??
          world.ocean?.skillCooldown ??
          0) >
        priorSkill + 0.5
      )
        audio?.cue('skill');
      if (world.mode !== priorMode && world.mode === 'won') audio?.cue('win');
      if (world.mode !== priorMode && world.mode === 'dead')
        audio?.cue('death');
      priorFood = world.totalFood;
      priorHealth = world.player.health;
      priorGen = world.generation;
      priorDash = world.player.dashing;
      priorSkill =
        world.land?.skillCooldown ??
        world.shore?.skillCooldown ??
        world.ocean?.skillCooldown ??
        0;
      priorMode = world.mode;
      if (ctx) {
        renderWorld(ctx, world, width, height, now / 1000, dpr);
        if (!revealing(world))
          drawJourneyFocus(
            ctx,
            world,
            width,
            height,
            dpr,
            now < locateUntil.current,
          );
        if (debugGeometry) {
          const v = getView(world, width, height);
          ctx.save();
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.translate(width / 2, height / 2);
          ctx.scale(v.zoom, v.zoom);
          ctx.translate(-v.cx, -v.cy);
          drawBodyGeometry(ctx, worldBodyPose(world));
          ctx.restore();
        }
        if (navigation.current) {
          const view = getView(world, width, height),
            p = navigation.current.target,
            tx = (p.x - view.cx) * view.zoom + width / 2,
            ty = (p.y - view.cy) * view.zoom + height / 2;
          ctx.save();
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.strokeStyle = '#e1edb9a0';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 5]);
          ctx.beginPath();
          ctx.arc(tx, ty, 13, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(tx - 5, ty);
          ctx.lineTo(tx + 5, ty);
          ctx.moveTo(tx, ty - 5);
          ctx.lineTo(tx, ty + 5);
          ctx.stroke();
          if (
            navigation.current.preyId !== undefined ||
            navigation.current.oceanActorId
          ) {
            ctx.fillStyle = '#f0edc4';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(
              navigation.current.oceanIntent === 'visit' ||
                navigation.current.pondIntent === 'visit' ||
                navigation.current.landCreatureId !== undefined
                ? '观察 / 共生 · 靠近按K'
                : '追猎 · 方向键可接管',
              tx,
              ty + 33,
            );
          }
          ctx.restore();
        }
      }
      const renderMs = performance.now() - renderStarted;
      const publishStarted = performance.now();
      if (now - lastHud > 120 || world.mode !== before) {
        lastHud = now;
        store.publish();
      }
      if (observedMode === 'running') {
        collectMetrics(
          {
            frame: frameInterval,
            simulation: simulationMs,
            render: renderMs,
            publish: performance.now() - publishStarted,
            ...(inputStamp.current !== null
              ? { input: frameStarted - inputStamp.current }
              : {}),
          },
          now,
        );
        inputStamp.current = null;
      }
      frame = requestAnimationFrame(loop);
    }
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [store]);
  useEffect(() => {
    const el = specimen.current,
      ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    ctx.clearRect(0, 0, 220, 130);
    if (world.habitat === 'pond')
      drawOrganism(
        ctx,
        120,
        65,
        43,
        -0.2,
        world.time,
        world.traits,
        false,
        false,
        {},
        world.dnaLineage?.body,
      );
  }, [world, world.time, world.traits.length]);
  const nutrientReady = world.food >= 8,
    nearNursery = distance(world.player, NURSERY) <= NURSERY.radius;
  const ending = world.mode === 'won' || world.mode === 'dead';
  return (
    <main
      className={`game-shell ${world.ocean?.tidal?.compat.mode === 'active' ? 'tidal-shell' : ''} ${world.mode === 'paused' ? 'game-paused' : ''} ${ocean || shore || land ? 'ocean-shell' : ''} ${shore || land ? 'shore-shell' : ''} ${land ? 'land-shell' : ''} ${land && world.land?.morph ? 'land-birth' : ''}`}
    >
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Dna size={25} />
          </span>
          <div>
            <span className="brand-cn">孢子</span>
            <span className="brand-en">S P O R E</span>
          </div>
        </div>
        <div className="chapter">
          <span className="live-dot" />
          {land ? '第四章' : shore ? '第三章' : ocean ? '第二章' : '第一章'}
          <span className="chapter-slash">/</span>
          {land
            ? '古蕨林 · 陆地生物'
            : shore
              ? '潮间带 · 第一次登陆'
              : ocean
                ? '海洋 · 身体的诞生'
                : '一滴水的世界'}
        </div>
        <nav aria-label="游戏工具" className="toolbar">
          <ControlsHelp onOpen={pauseForSettings} />
          <AudioVolumes audio={sound} onOpen={pauseForSettings} />
          {oceanPractice && (
            <Link
              className="tool-button practice-link"
              href="/"
              title="练习与主线分别保存"
              onClick={(event) => {
                event.preventDefault();
                onSave();
                window.location.assign('/');
              }}
            >
              独立练习<span> · 返回主线</span>
            </Link>
          )}
          <button
            className="tool-button save-button"
            onClick={onSave}
            title="每 5 秒自动保存在这台设备；点击立即保存"
            aria-label={`${saveStatus}，点击保存`}
          >
            <Save size={17} />
            <span>{saveStatus}</span>
          </button>
          <button
            className="tool-button audio-toggle"
            onClick={toggleAudio}
            aria-pressed={audioStarted && !muted}
            aria-label={
              !audioStarted || muted ? '开启音乐和音效' : '关闭音乐和音效'
            }
            title={
              audioStarted ? (muted ? '开启声音' : '关闭声音') : '点击开启声音'
            }
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            <span>
              {!audioStarted ? '开启声音' : muted ? '已静音' : '声音已开'}
            </span>
          </button>
          <button
            onClick={() => openPanel('family')}
            className="tool-button"
            title="生命谱系"
          >
            <GitBranch size={18} />
            <span>生命谱系</span>
          </button>
          <button
            onClick={() => openPanel('journal')}
            className="tool-button"
            title="探索手记"
          >
            <BookOpen size={18} />
            <span>探索手记</span>
          </button>
          {!ready && !ending && (
            <button
              onClick={pause}
              className="icon-button"
              aria-label={world.mode === 'paused' ? '继续游戏' : '暂停游戏'}
            >
              {world.mode === 'paused' ? (
                <Play size={18} />
              ) : (
                <Pause size={18} />
              )}
            </button>
          )}
          {world.freeLife && !ending && (
            <StageLifeControls
              state={world}
              stayLabel="继续演变"
              onStay={() => {}}
              onReview={() => {
                if (reviewStageLife(store.getWorld())) {
                  update();
                  focusGame();
                }
              }}
            />
          )}
          <LearningMenu
            state={world}
            stage={world.habitat}
            actionGate={learnedSkillGate(world)}
            onSelect={(id) => {
              selectLearnedSkill(store.getWorld(), id, world.habitat);
              update();
            }}
            onMode={(mode) => {
              const live = store.getWorld();
              if (
                (mode === 'paused' && live.mode === 'running') ||
                (mode === 'running' && live.mode === 'paused')
              ) {
                live.mode = mode;
                keys.current.clear();
                tidalControls.current.clear();
                dashInput.current.remaining = 0;
                navigation.current = null;
                update();
              }
            }}
            onUse={() => {
              keys.current.add('c');
              focusGame();
            }}
          />
        </nav>
      </header>
      <section
        className="play-area"
        aria-label={
          land
            ? '古蕨林游戏区域'
            : shore
              ? '潮间带游戏区域'
              : ocean
                ? '海洋游戏区域'
                : '池塘游戏区域'
        }
      >
        <canvas
          ref={canvas}
          tabIndex={0}
          className="world-canvas"
          aria-label={`${land ? '陆地' : shore ? '潮间带' : ocean ? '海洋' : '池塘'}探索画面。WASD 或方向键移动，点击目的地前往；空格冲刺，O 下一代，Esc 暂停。完整操作见顶部键位。`}
          onPointerDown={(e) => {
            if (world.mode !== 'running' || revealing(store.getWorld())) return;
            navigation.current = null;
            e.currentTarget.setPointerCapture(e.pointerId);
            const r = e.currentTarget.getBoundingClientRect();
            pointerStart.current = captureNavigationTap(
              getView(store.getWorld(), r.width, r.height),
              { x: e.clientX - r.left, y: e.clientY - r.top },
              performance.now(),
            );
            pointer.current = {
              ...pointer.current,
              active: true,
              x: e.clientX - r.left,
              y: e.clientY - r.top,
            };
            focusGame();
          }}
          onPointerMove={(e) => {
            if (!pointer.current.active) return;
            const r = e.currentTarget.getBoundingClientRect();
            pointer.current.x = e.clientX - r.left;
            pointer.current.y = e.clientY - r.top;
          }}
          onPointerUp={(e) => {
            if (pointer.current.active && pointerStart.current) {
              const r = e.currentTarget.getBoundingClientRect();
              navigation.current = releaseNavigationTap(
                pointerStart.current,
                { x: e.clientX - r.left, y: e.clientY - r.top },
                performance.now(),
                store.getWorld().player,
              );
              if (navigation.current) {
                const id = targetPondPrey(
                  store.getWorld(),
                  navigation.current.target,
                );
                if (id !== null) navigation.current.preyId = id;
                else {
                  const actor = targetOceanPrey(
                    store.getWorld(),
                    navigation.current.target,
                  );
                  if (actor) {
                    navigation.current.oceanActorId = actor;
                    navigation.current.oceanIntent = 'hunt';
                  }
                }
              }
            }
            pointerStart.current = null;
            pointer.current.active = false;
            pointer.current.dash = false;
          }}
          onLostPointerCapture={() => {
            pointer.current.active = false;
          }}
          onPointerCancel={() => {
            tidalControls.current.clear();
            keys.current.clear();
            dashInput.current.remaining = 0;
            pointer.current.active = false;
            navigation.current = null;
            pointer.current.dash = false;
          }}
        />
        <div className="water-coordinate">
          {land
            ? 'LIFE ON LAND'
            : shore
              ? 'THE FIRST LANDFALL'
              : ocean
                ? 'MARINE ECOSYSTEM'
                : 'FRESHWATER ECOSYSTEM'}{' '}
          <span>
            CHAPTER {land ? '04' : shore ? '03' : ocean ? '02' : '01'}
          </span>
        </div>
        {ready ? (
          <>
            <div className="intro">
              <div className="eyebrow">
                <span />
                生命，从这里开始
              </div>
              <h1>
                一滴水，
                <br />
                <em>一个世界。</em>
              </h1>
              <p className="intro-copy">
                你是一个初生的微小生命。
                <br />
                寻找食物，适应环境，
                <br />
                让你的后代游向更远的地方。
              </p>
              <button className="primary-button begin-button" onClick={start}>
                开启生命之旅
                <ArrowUpRight size={21} />
              </button>
              <Link
                className="text-button"
                href="/ocean"
                onClick={(event) => {
                  event.preventDefault();
                  onSave();
                  window.location.assign('/ocean');
                }}
              >
                海洋单章练习 · 独立存档
              </Link>
              <button
                className="text-button ocean-direct"
                onClick={() => goOcean(true)}
              >
                直接体验海洋 · 吞食与进化 <ArrowUpRight size={16} />
              </button>
              <button
                className="text-button shore-direct"
                onClick={() => goShore(true)}
              >
                直接体验登陆 · 潮池与爬行 <ArrowUpRight size={16} />
              </button>
              <button
                className="text-button land-direct"
                onClick={() => goLand(true)}
              >
                直接体验陆地 · 巢穴与伙伴 <ArrowUpRight size={16} />
              </button>
              <button
                className="text-button land-direct"
                onClick={() => onColony(createColonyWorld())}
              >
                直接体验族群 · 育幼与分工 <ArrowUpRight size={16} />
              </button>
              {onResumeColony && (
                <button className="primary-button" onClick={onResumeColony}>
                  继续刚才的族群旅程 <ArrowUpRight size={16} />
                </button>
              )}
              {biologicalRecords.map((record) => (
                <BiologicalReview
                  key={record.id}
                  record={record}
                  onBranch={onBranch}
                />
              ))}
              {!!records.length && (
                <details className="journey-archive">
                  <summary>已完成的旅程 · {records.length} 次</summary>
                  {records.map((record) => (
                    <ExpeditionReview key={record.id} record={record} />
                  ))}
                </details>
              )}
              <div className="intro-controls">
                <span>
                  <kbd>W A S D</kbd> 游动
                </span>
                <span>
                  <kbd>空格</kbd> 点按 / 按住冲刺
                </span>
              </div>
            </div>
            <div className="specimen-label">
              <span className="specimen-index">SPECIMEN 001</span>
              <strong>初生微生物</strong>
              <span>你的第一代生命</span>
              <div className="scale-line" />
              <small>示意模型 · 比例经过简化</small>
            </div>
            <div className="intro-bottom">
              <span>
                <Leaf size={15} />
                每一种生命，都有自己的生存方式。
              </span>
              <button onClick={() => openPanel('journal')}>
                翻开探索手记 <ChevronRight size={15} />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="vitals glass-panel">
              <div className="vitals-title">
                <span className="live-dot" />第 {world.generation} 代
                <span className="vitals-clock">{clock(world.time)}</span>
              </div>
              <div className="meter-label">
                <span>
                  <Zap size={14} />
                  能量
                </span>
                <strong>
                  {Math.ceil(world.player.energy)}
                  <small> / {stats.maxEnergy}</small>
                </strong>
              </div>
              <Progress
                value={(world.player.energy / stats.maxEnergy) * 100}
                aria-label="能量"
                className={`energy-meter ${world.player.energy < 20 ? 'low' : ''}`}
              />
              <div className="meter-label health-label">
                <span>
                  <Shield size={14} />
                  生命
                </span>
                <strong>
                  {Math.ceil(world.player.health)}
                  <small> / 100</small>
                </strong>
              </div>
              <Progress
                value={world.player.health}
                aria-label="生命"
                className="health-meter"
              />
            </div>
            <div className="location">
              <span className="location-dot" />
              {land
                ? landZone(world)
                : shore
                  ? shoreZone(world)
                  : ocean
                    ? oceanZone(world.player)
                    : getZone(world.player)}
            </div>
            {land ? (
              <LandHUD
                onDrought={droughtAction}
                onFocus={focusLand}
                onSettlement={showLandSettlement}
                onLocate={locate}
                onFeature={() => {
                  keys.current.add('g');
                  focusGame();
                }}
                onSeed={seedAction}
                onCommand={command}
                world={world}
                onEvolve={evolve}
                onSkill={skill}
                onInteract={interact}
              />
            ) : shore ? (
              <ShoreHUD
                onLocate={locate}
                world={world}
                onEvolve={evolve}
                onSkill={skill}
                onInteract={interact}
              />
            ) : ocean && world.ocean?.tidal?.compat.mode === 'active' ? (
              <TidalHUD
                world={world}
                onSkill={skill}
                onCommand={command}
                onInteract={interact}
                onEvolve={evolve}
                onJournal={() => openPanel('journal')}
                onLocate={locate}
              />
            ) : ocean ? (
              <OceanHUD
                onInteract={interact}
                onMigration={(route) => {
                  chooseMigration(store.getWorld(), route);
                  update();
                  focusGame();
                }}
                onLocate={locate}
                world={world}
                onEdit={() => {
                  const blocked = bodyEditGate(store.getWorld());
                  if (blocked) {
                    announce(store.getWorld(), blocked);
                    update();
                  } else openPanel('body');
                }}
                onEvolve={evolve}
                onFamily={() => openPanel('family')}
                onSkill={skill}
              />
            ) : (
              <aside className="mission-panel glass-panel">
                <div className="panel-eyebrow">
                  这一代的旅程 <span>0{world.generation}</span>
                </div>
                <h2>{world.generation >= 3 ? '游向新的世界' : '让生命延续'}</h2>
                <p>
                  {world.generation >= 3
                    ? '可继续组合后代的结构，或抵达东北方的新栖息地进入海洋。'
                    : '观察、吞食或分享营养，留下祖源；再回育生水域孕育。'}
                </p>
                <div
                  className="generation-track"
                  aria-label={`已到第${world.generation}代`}
                >
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className={n <= world.generation ? 'reached' : ''}
                    >
                      <span>{n < world.generation ? '✓' : `0${n}`}</span>
                      <small>第{n}代</small>
                    </div>
                  ))}
                </div>
                <button className="locate-button" onClick={locate}>
                  ◎ 跟随当前目标 · WASD 接管
                </button>
                <button
                  className="companion-command"
                  onClick={interact}
                  disabled={world.food < 1}
                >
                  <kbd>K</kbd> 分享1营养
                </button>
                <div className="dna-journey-summary">
                  <strong>
                    {MICROBE_BODIES[world.dnaLineage?.body ?? 'ancestor'].name}
                  </strong>
                  <span>
                    {Object.entries(DNA_SOURCES)
                      .filter(([id]) =>
                        ['dart', 'shield', 'feather'].includes(id),
                      )
                      .map(
                        ([id, source]) =>
                          `${source.direction} ${world.dnaLineage?.sources[id as keyof typeof DNA_SOURCES]?.units ?? 0}`,
                      )
                      .join(' · ')}
                  </span>
                </div>
                {world.generation < 3 ? (
                  <div className="objectives">
                    <div className={nutrientReady ? 'done' : ''}>
                      <span className="check-dot">
                        {nutrientReady ? '✓' : ''}
                      </span>
                      <span>本代摄食</span>
                      <strong>{Math.min(world.food, 8)} / 8</strong>
                    </div>
                    <div className={world.player.energy >= 50 ? 'done' : ''}>
                      <span className="check-dot">
                        {world.player.energy >= 50 ? '✓' : ''}
                      </span>
                      <span>保留能量</span>
                      <strong>≥ 50</strong>
                    </div>
                    <div className={nearNursery ? 'done' : ''}>
                      <span className="check-dot">
                        {nearNursery ? '✓' : ''}
                      </span>
                      <span>返回育生水域</span>
                    </div>
                    <button
                      onClick={evolve}
                      className={`evolve-button ${!reproductionGate(world) ? 'available' : ''}`}
                    >
                      <Dna size={17} />
                      繁殖下一代<kbd>O</kbd>
                    </button>
                  </div>
                ) : (
                  <div className="destination-card">
                    <Target size={22} />
                    <div>
                      <strong>东北方 · 新栖息地</strong>
                      <span>跟随地图与方向标记</span>
                    </div>
                  </div>
                )}
                {world.generation >= 3 && (
                  <button onClick={evolve} className="evolve-button">
                    <Dna size={17} />
                    继续组合下一代<kbd>O</kbd>
                  </button>
                )}
                {world.freeLife && (
                  <p>
                    留下继续探索浅光藻场与回流水道，或回育生地改变身体组合。
                  </p>
                )}
                <div
                  className="mini-map"
                  aria-label="池塘地图，圆点标出你的位置"
                >
                  <div className="map-zone nursery-zone" />
                  <div className="map-zone light-zone" />
                  <div className="map-zone current-zone" />
                  <div
                    className={`haven-pin ${world.generation >= 3 ? 'unlocked' : ''}`}
                    style={{
                      left: `${(HAVEN.x / MAP.width) * 100}%`,
                      top: `${(HAVEN.y / MAP.height) * 100}%`,
                    }}
                  >
                    ◇
                  </div>
                  <span
                    className="map-player"
                    style={{
                      left: `${(world.player.x / MAP.width) * 100}%`,
                      top: `${(world.player.y / MAP.height) * 100}%`,
                    }}
                  />
                  <span className="map-north">N ↑</span>
                  <span className="map-caption">池塘全貌</span>
                </div>
                <div className="organism-heading">
                  <span>当前形态</span>
                  <button
                    onClick={() => openPanel('family')}
                    aria-label="查看生命谱系"
                  >
                    <GitBranch size={16} />
                  </button>
                </div>
                <canvas
                  ref={specimen}
                  width={220}
                  height={130}
                  className="specimen-canvas"
                  aria-label="当前微生物形态"
                />
                <div className="trait-tags">
                  {world.traits.length ? (
                    world.traits.map((id) => (
                      <span key={id}>
                        {TRAITS.find((t) => t.id === id)?.name}
                      </span>
                    ))
                  ) : (
                    <span>初生形态 · 无限可能</span>
                  )}
                </div>
              </aside>
            )}
            {!ending && (
              <div className="bottom-controls">
                <span>
                  <kbd>W A S D</kbd> / <kbd>↑ ↓ ← →</kbd>{' '}
                  {shore || land ? '移动' : '游动'}
                </span>
                <span>
                  <kbd>空格</kbd> 点按 / 按住冲刺
                </span>
                <span>
                  <kbd>O</kbd>{' '}
                  {land
                    ? '回巢孕育'
                    : shore
                      ? '适应岸上'
                      : ocean
                        ? '形态进化'
                        : '繁殖'}
                </span>
                {land && world.form === 'stalker' && (
                  <span>
                    <kbd>Shift</kbd> 潜行
                  </span>
                )}
                <span>
                  <kbd>Esc</kbd> 暂停
                </span>
              </div>
            )}
            {world.noticeUntil > world.time && !ending && (
              <output className="game-notice">
                <span className="live-dot" />
                {keyHints(world.notice)}
              </output>
            )}
            <EvolutionExperience
              world={world}
              live={store.getWorld}
              onResume={pause}
              onSkip={() => {
                if (skipEvolution(store.getWorld())) {
                  update();
                  focusGame();
                }
              }}
              onDismiss={() => {
                const e = store.getWorld().evolution;
                if (e) e.dismissed = true;
                update();
                focusGame();
              }}
            />
            <div className="touch-controls">
              {land && world.land?.creatures.some((c) => c.joined) && (
                <button onClick={command}>L 伙伴</button>
              )}
              {land && world.form === 'stalker' && (
                <button
                  aria-pressed={world.land?.sneaking}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    keys.current.add('shift');
                  }}
                  onPointerUp={() => keys.current.delete('shift')}
                  onLostPointerCapture={() => keys.current.delete('shift')}
                  onPointerCancel={() => keys.current.delete('shift')}
                >
                  按住潜行
                </button>
              )}
              {ocean &&
                world.ocean?.migration?.route === 'filter' &&
                world.ocean.migration.station < 2 && (
                  <button
                    onClick={interact}
                    disabled={world.mode !== 'running'}
                  >
                    K {world.ocean.migration.expanded ? '收拢' : '滤食'}
                  </button>
                )}
              {(shore || land) && (
                <button onClick={interact}>K {land ? '互动' : '结伴'}</button>
              )}
              <span>
                {shore || land ? '点击前往 · 长按引导' : '点击前往 · 长按游动'}
              </span>
              {(ocean || shore || land) &&
                world.ocean?.tidal?.compat.mode !== 'active' && (
                  <button
                    onClick={skill}
                    disabled={
                      world.mode !== 'running' ||
                      revealing(world) ||
                      !!world.land?.morph ||
                      !!world.land?.skillCooldown ||
                      !!world.shore?.morph ||
                      !!world.shore?.skillCooldown ||
                      !!world.ocean?.morph ||
                      !!world.ocean?.skillCooldown ||
                      world.player.energy < (shore || land ? 12 : 14)
                    }
                  >
                    J 技能
                  </button>
                )}
              <button
                aria-label="点按短冲刺，按住持续冲刺"
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  pointer.current.dash = true;
                  if (world.mode === 'running' && !revealing(world))
                    pressDash(dashInput.current);
                }}
                onPointerUp={() => {
                  pointer.current.dash = false;
                }}
                onLostPointerCapture={() => {
                  pointer.current.dash = false;
                }}
                onPointerCancel={() => {
                  pointer.current.dash = false;
                }}
              >
                <Zap size={22} />
                冲刺
              </button>
            </div>
          </>
        )}
        {world.mode === 'paused' && !panel && !revealing(world) && (
          <div className="ending-overlay">
            <div className="ending-card">
              <span className="ending-icon">
                <Pause size={26} />
              </span>
              <div className="eyebrow">旅程暂歇</div>
              <h2>
                {land
                  ? '蕨林安静下来了'
                  : shore
                    ? '潮间带安静下来了'
                    : '水面安静下来了'}
              </h2>
              <p>你的生命正在原地等待。</p>
              <button className="primary-button" onClick={pause}>
                <Play size={17} />
                继续探索
              </button>
              <Link
                className="text-button"
                href="/ocean"
                onClick={(event) => {
                  event.preventDefault();
                  onSave();
                  window.location.assign('/ocean');
                }}
              >
                海洋单章练习 · 独立存档
              </Link>
              <button className="text-button" onClick={() => restart(true)}>
                <RotateCcw size={15} />
                重新开始这一章
              </button>
            </div>
          </div>
        )}
        {ending && (
          <div className="ending-overlay">
            <div className="ending-card">
              <span className="ending-icon">
                {world.mode === 'won' ? (
                  <Sparkles size={28} />
                ) : (
                  <Leaf size={28} />
                )}
              </span>
              <div className="eyebrow">
                {world.mode === 'won'
                  ? land
                    ? '第四章 · 陆地生物已完成'
                    : shore
                      ? '第三章 · 登陆已完成'
                      : ocean
                        ? '第二章 · 海洋已完成'
                        : '第一章 · 已完成'
                  : '这一次探索结束了'}
              </div>
              <h2>
                {world.mode === 'won' ? '生命，抵达了远方。' : world.reason}
              </h2>
              <p>
                {world.mode === 'won'
                  ? land
                    ? `你的${FORMS[world.form].name}在林地找到了生存方式，带着${world.land?.creatures.filter((c) => c.joined).length ?? 0}位伙伴，建立了溪畔新家。巢中，下一代正在醒来。`
                    : shore
                      ? `从海洋身体到${FORMS[world.form].name}，你的族群穿过潮间沙洲，在蕨林水洼建立了新的家。`
                      : ocean
                        ? `${world.history.at(-1)?.milestone ?? '从细胞群体长成新的身体'}。这一支生命越过了深水。潮水之外，还有未曾踏过的世界。`
                        : '三代生命完成了池塘探索。接下来，走进海洋，让身体发生真正的变化。'
                  : world.reason === '身体失水'
                    ? '潮池是旅途中的补给站。下一次，试着沿水滴指引更早返回水边。'
                    : world.reason === '能量耗尽'
                      ? '冲刺很快，也更耗能。下一次，试着沿食物分布规划路线。'
                      : '留意捕食者周围的琥珀色警戒圈，提前绕行或冲刺脱离。'}
              </p>
              <div className="run-stats">
                <div>
                  <strong>{world.generation}</strong>
                  <span>生命世代</span>
                </div>
                <div>
                  <strong>{world.totalFood}</strong>
                  <span>摄食总数</span>
                </div>
                <div>
                  <strong>{clock(world.time)}</strong>
                  <span>探索时间</span>
                </div>
              </div>
              <StageLifeControls
                state={world}
                stayLabel={
                  land
                    ? '留在林地 · 继续生活'
                    : shore
                      ? '留在潮间带 · 继续演变'
                      : ocean
                        ? '留在海洋 · 继续演变'
                        : '留在池塘 · 继续演变'
                }
                onStay={() => {
                  if (
                    land
                      ? continueLandLife(store.getWorld())
                      : continueStageLife(store.getWorld())
                  ) {
                    update();
                    focusGame();
                  }
                }}
                onReview={() => {
                  if (reviewStageLife(store.getWorld())) update();
                }}
              />
              {world.mode === 'won' && land && (
                <button
                  className="primary-button"
                  onClick={() => {
                    if (onResumeColony) {
                      onResumeColony();
                      return;
                    }
                    const next = colonyFromLand(store.getWorld());
                    if (next) onColony(next);
                  }}
                >
                  {onResumeColony
                    ? '继续族群旅程'
                    : '迈向族群生活 · 育幼与分工'}{' '}
                  <ArrowUpRight size={18} />
                </button>
              )}
              {world.mode === 'won' && shore && (
                <button className="primary-button" onClick={() => goLand()}>
                  走进蕨林 · 巢穴与伙伴 <ArrowUpRight size={18} />
                </button>
              )}
              {world.mode === 'won' && ocean && (
                <button className="primary-button" onClick={() => goShore()}>
                  走上岸 · 第一次登陆
                  <ArrowUpRight size={18} />
                </button>
              )}
              {world.mode === 'won' && !ocean && !shore && !land && (
                <button className="primary-button" onClick={() => goOcean()}>
                  进入海洋 · 身体的诞生
                  <ArrowUpRight size={18} />
                </button>
              )}
              <button
                className={
                  world.mode === 'won' ? 'text-button' : 'primary-button'
                }
                onClick={() => restart()}
              >
                {ocean ? '回到最近育生点' : '保留身体，重新探索'}
                <ArrowUpRight size={18} />
              </button>
              <button
                className="text-button"
                onClick={() => openPanel('family')}
              >
                <GitBranch size={15} />
                回看生命谱系
              </button>
            </div>
          </div>
        )}
      </section>
      <Dialog
        open={panel !== null}
        onOpenChange={(open) => {
          if (!open) closePanel();
        }}
      >
        <DialogContent
          className={`game-dialog ${panel === 'evolution' || panel === 'body' ? 'evolution-dialog' : ''}`}
          showCloseButton={false}
        >
          <button
            className="dialog-close icon-button"
            onClick={closePanel}
            aria-label="关闭"
          >
            <X size={20} />
          </button>
          <DialogTitle className="dialog-heading">
            {panel === 'body'
              ? 'DNA分化与身体设计'
              : panel === 'evolution'
                ? '下一代，会怎样生活？'
                : panel === 'family'
                  ? '生命留下的轨迹'
                  : '探索手记'}
          </DialogTitle>
          <DialogDescription className="dialog-description">
            {panel === 'body'
              ? '猎物与共生伙伴留下祖源；选择分化，也可以自行设计器官。'
              : panel === 'evolution'
                ? '保留适合你的特征，尝试新的结构组合，继续这段旅程。'
                : panel === 'family'
                  ? '每一次繁衍，都带着上一代的痕迹。'
                  : '先观察，再猜想，亲自试一试。打开手记时，游戏暂停。'}
          </DialogDescription>
          {panel === 'family' &&
            biologicalRecords.map((record) => (
              <BiologicalReview
                key={record.id}
                record={record}
                onBranch={(id, generation) => {
                  onBranch(id, generation);
                  setPanel(null);
                }}
              />
            ))}
          {panel === 'evolution' &&
            ocean &&
            world.ocean?.tidal?.compat.mode !== 'active' && (
              <OceanEvolution
                world={{ ...world, mode: 'running' }}
                onChoose={(form, trait) => {
                  const next = structuredClone(store.getWorld());
                  next.mode = 'running';
                  if (evolveOcean(next, form, trait)) {
                    Object.assign(store.getWorld(), next);
                    setPanel(null);
                    update();
                    focusGame();
                  }
                }}
              />
            )}
          {panel === 'evolution' &&
            (!ocean || world.ocean?.tidal?.compat.mode === 'active') && (
              <LifeEvolution
                key={world.habitat}
                world={world}
                onCommit={(id) => {
                  if (commitBiologicalEvolution(store.getWorld(), id)) {
                    setPanel(null);
                    update();
                    focusGame();
                  }
                }}
                onFeature={(id) => {
                  const s = store.getWorld().land;
                  if (s?.features?.includes(id)) {
                    s.activeFeature = id;
                    update();
                  }
                }}
                onGuide={guideFromEvolution}
                onReturn={() => guideFromEvolution()}
                onLearn={(id) => {
                  selectLearnedSkill(store.getWorld(), id, world.habitat);
                  update();
                }}
              >
                {ocean ? (
                  <BodyEditor
                    world={world}
                    onSlots={(slots) => {
                      if (setTidalSlots(store.getWorld(), slots)) {
                        closePanel();
                        update();
                        focusGame();
                      }
                    }}
                    onCommit={(body, slots) => {
                      if (commitBody(store.getWorld(), body, slots)) {
                        setPanel(null);
                        update();
                        focusGame();
                      }
                    }}
                  />
                ) : !shore && !land ? (
                  <MicrobeEvolution
                    world={world}
                    onCommit={(traits, body) => {
                      const next = structuredClone(store.getWorld());
                      next.mode = 'running';
                      if (reviseMicrobe(next, traits, body)) {
                        Object.assign(store.getWorld(), next);
                        setPanel(null);
                        update();
                        focusGame();
                      }
                    }}
                  />
                ) : land ? (
                  <LandEvolution
                    world={{ ...world, mode: 'running' }}
                    onChoose={(choice, body) => {
                      const live = store.getWorld();
                      if (
                        nextGenerationCandidates(live).find(
                          (c) => c.id === `land:${choice}`,
                        )?.gate !== ''
                      )
                        return;
                      const next = structuredClone(live);
                      next.mode = 'running';
                      if (evolveLand(next, choice, body)) {
                        Object.assign(live, next);
                        setPanel(null);
                        update();
                        focusGame();
                      }
                    }}
                  />
                ) : null}
              </LifeEvolution>
            )}
          {panel === 'family' && (
            <div className="family-list">
              <EvolutionTree world={world} />
              {familyTimeline(world).map(
                ({ ancestor, status, previousHabitat }) => (
                  <div className="ancestor" key={ancestor.generation}>
                    <span className="ancestor-number">
                      0{ancestor.generation}
                    </span>
                    <div>
                      <h3>
                        第 {ancestor.generation} 代 ·{' '}
                        {FORMS[ancestor.form ?? 'microbe'].short}{' '}
                        <small>{status}</small>
                      </h3>
                      <p>
                        {ancestor.traits.length
                          ? ancestor.traits
                              .map(
                                (id) => TRAITS.find((t) => t.id === id)?.name,
                              )
                              .join(' ＋ ')
                          : '初生形态'}
                      </p>
                      <span>
                        {ancestor.landOrgan === 'crest'
                          ? '共鸣冠 · '
                          : ancestor.landOrgan === 'plates'
                            ? '护肩骨板 · '
                            : ''}
                        {adaptationsOf(ancestor)
                          .map((a) =>
                            a === 'reservoir' ? '储水囊' : '保湿皮膜',
                          )
                          .join(' + ')}
                        {adaptationsOf(ancestor).length ? ' · ' : ''}
                        摄食 {ancestor.food} 份 · 探索 {clock(ancestor.seconds)}
                      </span>
                      {(ancestor.milestone ?? previousHabitat?.milestone) && (
                        <p className="lineage-milestone">
                          ✦ {ancestor.milestone ?? previousHabitat?.milestone}
                        </p>
                      )}
                      {ancestor.dnaLineage && (
                        <p className="lineage-milestone">
                          DNA祖源 ·{' '}
                          {ancestor.dnaLineage.oceanBody
                            ? OCEAN_DNA_BODIES[ancestor.dnaLineage.oceanBody]
                                .name
                            : MICROBE_BODIES[ancestor.dnaLineage.body]
                                .name}{' '}
                          ·{' '}
                          {Object.entries(ancestor.dnaLineage.sources)
                            .map(
                              ([id, receipt]) =>
                                `${DNA_SOURCES[id as keyof typeof DNA_SOURCES].name} ${receipt!.units}`,
                            )
                            .join('、')}
                        </p>
                      )}
                      {ancestor.landWays?.length ? (
                        <small className="lineage-milestone">
                          ✦ 林地 ·{' '}
                          {ancestor.landWays
                            .map((way) => LAND_WAY_NAMES[way])
                            .join('、')}
                        </small>
                      ) : null}
                      {ancestor.landLegacy && (
                        <p className="lineage-milestone">
                          ✦ 旱季 · {DROUGHT_NAMES[ancestor.landLegacy.strategy]}
                        </p>
                      )}
                      {previousHabitat && (
                        <p>
                          同一代迁移前 ·{' '}
                          {
                            {
                              pond: '池塘',
                              ocean: '海洋',
                              shore: '潮间带',
                              land: '陆地',
                            }[previousHabitat.habitat!]
                          }
                          ：摄食 {previousHabitat.food}{' '}
                          份。当前摄食数从本章重新累计。
                        </p>
                      )}
                    </div>
                    <BodyPortrait
                      form={ancestor.form ?? 'microbe'}
                      microbeBody={ancestor.dnaLineage?.body}
                      traits={ancestor.traits}
                      body={ancestor.body}
                      landOrgan={ancestor.landOrgan}
                      adaptation={ancestor.adaptation}
                    />
                  </div>
                ),
              )}
              <p className="science-note">
                这是一棵不断分支的生命树。不同环境适合不同的特征，进化没有预设的“最高级”终点。
              </p>
            </div>
          )}
          {panel === 'journal' &&
            world.ocean?.tidal?.compat.mode === 'active' && (
              <TidalJournal world={world} />
            )}
          {panel === 'journal' &&
            world.ocean?.tidal?.compat.mode !== 'active' && (
              <div className="journal-body">
                {land && (
                  <div className="shore-journal">
                    <h3>在陆地生活：觅食、结伴与巢穴</h3>
                    <p>
                      带 6 份食物在树根处按 K 建巢。靠近温和生物观察 2 秒，带 10
                      份食物回已建巢穴按
                      O，孕育长足或扑猎身体。再观察另一种生物后，还能选择鸣冠或肩甲。
                    </p>
                    <p>
                      长足型按 J 呼唤增加信任；任何身体都能靠近邻居按 K
                      分享食物。信任达到 3，伙伴便会同行。扑猎型按住 Shift
                      潜行，蕨丛会降低被发现的距离。朝向猎物按 J
                      扑出，接触才命中。捕获后靠近食物停下 0.8
                      秒进食，吃下才能成长；猎手会过来抢食。伙伴不会被你的技能伤害。
                    </p>
                    <p>
                      探索蕨叶聚落与日光果甸，通过结伴、捕猎、照料果丛或水源迁移找到生存办法，再带
                      12 份食物到溪畔按 K
                      建立新家。定居后可以留下继续生活，随时开始族群旅程。停在巢穴能恢复，水洼帮助保湿。这里的身体为虚构设计，并非真实祖先链。
                    </p>
                    <p>
                      {world.land?.checkpoint.standalone
                        ? '本次从陆地独立开始，没有虚构的祖先。'
                        : '本章保留你在海洋与登陆阶段形成的身体和真实谱系。'}
                    </p>
                  </div>
                )}
                {shore && (
                  <div className="shore-journal">
                    <h3>第一次登陆：观察、适应、同行</h3>
                    <p>
                      离开潮池会消耗湿润度；水分耗尽后生命下降。蓝色水滴指向最近的潮池，金色箭头指向当前探索目标。站在水中恢复湿润度，停下来也能恢复能量。
                    </p>
                    <p>
                      靠近金色观察生物累计 2
                      秒，发现撑地或保湿结构。满足摄食与探索条件后，在潮池按 O
                      孕育下一代。J 用于挣脱护巢者；靠近同类按 K，分享 2
                      份食物邀请同行。
                    </p>
                    <p>
                      退潮会露出金色贝床，靠近按 K 获得 4
                      份食物，每处每轮潮汐只能采食一次。
                      获得撑地附肢后，也可连续离水探索 8
                      秒再安全回潮池，发现保湿线索。
                      线索帮助你选择后代已有的变异；一次练习不会让现实中的生物立刻长出遗传器官。
                    </p>
                    <p>
                      这里使用虚构生物表达身体与环境的关系，并非真实的物种祖先链。
                      {world.shore?.checkpoint.standalone
                        ? '这次从登陆章独立开始，没有虚构的海洋祖先。'
                        : '本章保留了你的海洋身体与真实谱系。'}
                    </p>
                  </div>
                )}

                <div className="journal-entry">
                  <span className="entry-number">海洋</span>
                  <div>
                    <h3>先长大，再改变身体</h3>
                    <p>
                      追上比自己小的鱼，靠近即可吞食并长大。青绿色标记表示可吞食，淡紫表示体型相近，橙色三角表示危险。大鱼也会捕食其他鱼；长大后，原来追你的鱼可能成为猎物。体型变化是个体成长，形态分支则是游戏对多代演化的简化，两者并不相同。
                    </p>
                    <p>
                      从细胞群体出发，你可以选择辐射展开的身体，或具有头尾的两侧身体。前者扩大摄食范围，后者更擅长定向游动。成熟后，会出现伞体与触腕，或流线身体与鱼鳍。
                    </p>
                    <div className="try-it">
                      试试看：让两条分支分别穿过洋流走廊，用 J
                      技能观察不同身体的优势。光合结构在海洋中被解释为共生藻的游戏化效果，并非鱼类本身能够光合作用。
                    </div>
                    <p className="science-note">
                      海洋形态是想象的生存方案，不是“微生物依次变成水母、再变成鱼”的真实演化史；游戏也没有把任何分支设为更高级。
                    </p>
                  </div>
                </div>
                <div className="journal-entry">
                  <span className="entry-number">01</span>
                  <div>
                    <h3>能量，决定你能走多远</h3>
                    <p>
                      在游戏中，游动和维持身体都会消耗能量。冲刺能摆脱危险，也需要更频繁地进食。
                    </p>
                    <div className="try-it">
                      试试看：走同一段路，全程冲刺和分段冲刺，哪次剩余能量更多？
                    </div>
                  </div>
                </div>
                <div className="journal-entry">
                  <span className="entry-number">02</span>
                  <div>
                    <h3>适合这里，也许不适合那里</h3>
                    <p>
                      厚外壳能承受攻击，却让游速变慢。光合结构可以在浅光区补充能量，但离开光照就失去这个优势。
                    </p>
                    <div className="try-it">
                      试试看：用两条不同的后代分支，走一次相同路线。
                    </div>
                  </div>
                </div>
                <div className="journal-entry">
                  <span className="entry-number">03</span>
                  <div>
                    <h3>微小生命，也有复杂的关系</h3>
                    <p>
                      自然界中的绿草履虫，体内可以生活着共生藻类。微生物之间除了捕食，也存在合作关系。
                    </p>
                    <figure className="micrograph">
                      <Image
                        src="/assets/paramecium.jpg"
                        width={800}
                        height={600}
                        unoptimized
                        alt="显微镜下的绿草履虫，体内可见绿色共生藻类"
                        loading="lazy"
                      />
                      <figcaption>
                        真实绿草履虫 · Cucumberkvp / Wikimedia Commons ·
                        公有领域 ·{' '}
                        <a
                          href="https://commons.wikimedia.org/wiki/File:Paramecium_Bursaria.jpg"
                          target="_blank"
                          rel="noreferrer"
                        >
                          照片来源 ↗
                        </a>
                      </figcaption>
                    </figure>
                  </div>
                </div>
                <div className="science-note">
                  <strong>关于这个微观世界</strong>
                  <p>
                    角色、时间和器官组合均经过游戏化简化，不能当作真实物种图鉴。自然选择作用于已有遗传差异，种群的变化跨越许多代。
                  </p>
                  <a
                    href="https://bioprinciples.biosci.gatech.edu/module-1-evolution/what-is-evolution/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    继续了解真实的进化 ↗
                  </a>
                </div>
              </div>
            )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
