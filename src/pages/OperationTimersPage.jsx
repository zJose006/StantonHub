import React, { useEffect, useMemo, useState } from 'react';

const MINUTE = 60 * 1000;
const CYCLE_STORAGE_KEY = 'stantonhub.executiveHangar.globalAnchorV2';
const TIMER_STORAGE_KEY = 'stantonhub.executiveHangar.fixedTimers';
const SLOT_STORAGE_KEY = 'stantonhub.executiveHangar.slots';
const GLOBAL_CYCLE_ANCHOR = 1778812250 * 1000;

const cyclePhases = [
  { id: 'red', label: 'Rojo', duration: 120 * MINUTE, description: 'El hangar esta cerrando luces por bloques. Las luces pasan a verde una a una cada 24 minutos.' },
  { id: 'green', label: 'Verde', duration: 60 * MINUTE, description: 'Ventana de entrada. Las luces se apagan una a una cada 12 minutos.' },
  { id: 'blackout', label: 'Blackout', duration: 5 * MINUTE, description: 'Reset corto antes de reiniciar el ciclo completo.' }
];

const cycleTotal = cyclePhases.reduce((total, phase) => total + phase.duration, 0);
const phaseOffsets = {};
cyclePhases.reduce((start, phase) => {
  phaseOffsets[phase.id] = start;
  return start + phase.duration;
}, 0);

const missionSlots = [
  { id: 'compboard-1', label: 'Compboard 1', source: 'Checkmate Station', type: 'Tablet' },
  { id: 'compboard-2', label: 'Compboard 2', source: 'Checkmate Station', type: 'Tablet' },
  { id: 'compboard-3', label: 'Compboard 3', source: 'Checkmate Station', type: 'Tablet' },
  { id: 'compboard-4', label: 'Compboard 4', source: 'Orbituary', type: 'Tablet' },
  { id: 'compboard-5', label: 'Compboard 5', source: 'Ruin Station', type: 'Tablet' },
  { id: 'compboard-6', label: 'Compboard 6', source: 'Ruin Station', type: 'Tablet' },
  { id: 'compboard-7', label: 'Compboard 7', source: 'Orbituary', type: 'Tablet' },
  { id: 'supervisor-red', label: 'Tarjeta roja SUPVISR', source: 'PYAM-SUPVISR', type: 'Acceso final' }
];

const timerGroups = [
  {
    id: 'checkmate',
    label: 'Checkmate Station',
    note: 'Tarjetas azules y primeras tablets. Buen punto para arrancar la ruta.',
    timers: [
      { id: 'checkmate-blue-1', label: 'Tarjeta azul T1', type: 'Keycard', duration: 15 },
      { id: 'checkmate-blue-2', label: 'Tarjeta azul T2', type: 'Keycard', duration: 15 },
      { id: 'checkmate-blue-3', label: 'Tarjeta azul T3', type: 'Keycard', duration: 15 },
      { id: 'checkmate-tablet-1', label: 'Compboard 1', type: 'Tablet', duration: 30 },
      { id: 'checkmate-tablet-2', label: 'Compboard 2', type: 'Tablet', duration: 30 },
      { id: 'checkmate-tablet-3', label: 'Compboard 3', type: 'Tablet', duration: 30 }
    ]
  },
  {
    id: 'orbituary',
    label: 'Orbituary',
    note: 'Segundo bloque de tablets y tarjetas. Ideal para dividir una escuadra en dos.',
    timers: [
      { id: 'orbituary-blue-1', label: 'Tarjeta azul T1', type: 'Keycard', duration: 15 },
      { id: 'orbituary-blue-2', label: 'Tarjeta azul T2', type: 'Keycard', duration: 15 },
      { id: 'orbituary-tablet-4', label: 'Compboard 4', type: 'Tablet', duration: 30 },
      { id: 'orbituary-tablet-7', label: 'Compboard 7', type: 'Tablet', duration: 30 }
    ]
  },
  {
    id: 'ruin',
    label: 'Ruin Station',
    note: 'Bloque de ruta larga. Mantiene control de tarjetas de salas concretas.',
    timers: [
      { id: 'ruin-crypt', label: 'The Crypt', type: 'Keycard', duration: 15 },
      { id: 'ruin-last-resort', label: 'Last Resort', type: 'Keycard', duration: 15 },
      { id: 'ruin-wasteland', label: 'Wasteland', type: 'Keycard', duration: 15 },
      { id: 'ruin-tablet-5', label: 'Compboard 5', type: 'Tablet', duration: 30 },
      { id: 'ruin-tablet-6', label: 'Compboard 6', type: 'Tablet', duration: 30 }
    ]
  },
  {
    id: 'supervisor',
    label: 'PYAM-SUPVISR',
    note: 'Tarjetas rojas para el acceso final. Marcalas en cuanto se recojan.',
    timers: [
      { id: 'supervisor-red-34', label: 'Tarjeta roja -3-4', type: 'Supervisor', duration: 30 },
      { id: 'supervisor-red-35', label: 'Tarjeta roja -3-5', type: 'Supervisor', duration: 30 }
    ]
  }
];

function readNumber(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  const value = Number(window.localStorage.getItem(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readJson(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '');
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  if (typeof window !== 'undefined') window.localStorage.setItem(key, JSON.stringify(value));
}

function getPhaseState(now, anchor) {
  const elapsed = ((now - anchor) % cycleTotal + cycleTotal) % cycleTotal;
  const totalRemaining = cycleTotal - elapsed;
  let start = 0;
  for (const phase of cyclePhases) {
    if (elapsed < start + phase.duration) {
      const phaseElapsed = elapsed - start;
      const phaseRemaining = phase.duration - phaseElapsed;
      return {
        phase,
        elapsed,
        phaseElapsed,
        phaseRemaining,
        totalRemaining,
        nextAt: now + phaseRemaining,
        progress: Math.round((phaseElapsed / phase.duration) * 100)
      };
    }
    start += phase.duration;
  }
  return { phase: cyclePhases[0], elapsed: 0, phaseElapsed: 0, phaseRemaining: cyclePhases[0].duration, totalRemaining: cycleTotal, nextAt: now + cyclePhases[0].duration, progress: 0 };
}

function getLightStates(state) {
  if (state.phase.id === 'red') {
    const green = Math.min(5, Math.floor(state.phaseElapsed / (24 * MINUTE)));
    return Array.from({ length: 5 }, (_, index) => index < green ? 'green' : 'red');
  }
  if (state.phase.id === 'green') {
    const off = Math.min(5, Math.floor(state.phaseElapsed / (12 * MINUTE)));
    return Array.from({ length: 5 }, (_, index) => index < off ? 'off' : 'green');
  }
  return Array.from({ length: 5 }, () => 'off');
}

function formatDuration(ms) {
  const safe = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function formatClock(ts) {
  return new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(ts));
}

function startTimer(timer, duration = timer.duration) {
  const now = Date.now();
  return { ...timer, duration, startedAt: now, expiresAt: now + duration * MINUTE };
}

/** Consola de mision para Hangares ejecutivos. */
export function OperationTimersPage() {
  const [now, setNow] = useState(Date.now());
  const [anchor, setAnchor] = useState(() => readNumber(CYCLE_STORAGE_KEY, GLOBAL_CYCLE_ANCHOR));
  const [fixedTimers, setFixedTimers] = useState(() => readJson(TIMER_STORAGE_KEY, {}));
  const [slots, setSlots] = useState(() => readJson(SLOT_STORAGE_KEY, {}));

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => saveJson(TIMER_STORAGE_KEY, fixedTimers), [fixedTimers]);
  useEffect(() => saveJson(SLOT_STORAGE_KEY, slots), [slots]);

  const cycleState = useMemo(() => getPhaseState(now, anchor), [anchor, now]);
  const lightStates = useMemo(() => getLightStates(cycleState), [cycleState]);
  const placedCount = missionSlots.filter((slot) => slots[slot.id]).length;
  const activeTimerCount = timerGroups.flatMap((group) => group.timers).filter((timer) => {
    const entry = fixedTimers[timer.id];
    return entry && entry.expiresAt > now;
  }).length;
  const phaseCountdownLabel = cycleState.phase.id === 'red'
    ? `Abre en ${formatDuration(cycleState.phaseRemaining)}`
    : cycleState.phase.id === 'green'
      ? `Resetea en ${formatDuration(cycleState.phaseRemaining)}`
      : `Reinicio en ${formatDuration(cycleState.phaseRemaining)}`;

  function syncPhase(phaseId) {
    const nextAnchor = Date.now() - phaseOffsets[phaseId];
    setAnchor(nextAnchor);
    window.localStorage.setItem(CYCLE_STORAGE_KEY, String(nextAnchor));
  }

  function restoreGlobalAnchor() {
    setAnchor(GLOBAL_CYCLE_ANCHOR);
    window.localStorage.setItem(CYCLE_STORAGE_KEY, String(GLOBAL_CYCLE_ANCHOR));
  }

  function toggleSlot(slotId) {
    setSlots((current) => ({ ...current, [slotId]: !current[slotId] }));
  }

  function resetRun() {
    setSlots({});
    setFixedTimers({});
  }

  function launchTimer(timer) {
    setFixedTimers((current) => {
      const currentDuration = Number(current[timer.id]?.duration) || timer.duration;
      return { ...current, [timer.id]: startTimer(timer, currentDuration) };
    });
  }

  function resetTimer(timerId) {
    setFixedTimers((current) => {
      const next = { ...current };
      delete next[timerId];
      return next;
    });
  }

  function adjustTimer(timer, delta) {
    setFixedTimers((current) => {
      const entry = current[timer.id] || {};
      if (entry.startedAt && entry.expiresAt > Date.now()) return current;
      const duration = Math.max(0, Math.min(timer.duration, (Number(entry.duration) || timer.duration) + delta));
      return { ...current, [timer.id]: { ...entry, id: timer.id, label: timer.label, type: timer.type, duration } };
    });
  }

  return (
    <main className="container executive-hangar-page">
      <section className="hangar-hero-console">
        <div className="hangar-hero-copy">
          <span className="section-label">Mision</span>
          <h2>Hangares ejecutivos</h2>
          <p>Panel para coordinar el ciclo universal del hangar, revisar que compboards estan puestos y arrancar los self timers predefinidos cuando alguien toma una keycard, tablet o tarjeta roja.</p>
          <div className="hangar-kpi-row">
            <div><span>Tarjetas puestas</span><strong>{placedCount}/{missionSlots.length}</strong></div>
            <div><span>Timers activos</span><strong>{activeTimerCount}</strong></div>
            <div><span>Referencia</span><strong>Global</strong></div>
          </div>
        </div>
        <div className={`hangar-cycle-card hangar-cycle-${cycleState.phase.id}`}>
          <span>Estado del hangar</span>
          <strong>{cycleState.phase.label}</strong>
          <b>{formatDuration(cycleState.totalRemaining)}</b>
          <em>{phaseCountdownLabel}</em>
          <small>Siguiente evento a las {formatClock(cycleState.nextAt)}</small>
          <progress className="timer-progress" value={cycleState.progress} max="100" aria-label="Progreso del ciclo" />
        </div>
      </section>

      <section className="hangar-cycle-board">
        <div className="section-heading compact-heading">
          <span className="section-icon">EH</span>
          <div>
            <span className="section-label">Ciclo universal</span>
            <h2>Luces del hangar</h2>
          </div>
        </div>
        <div className="hangar-light-strip">
          {lightStates.map((state, index) => <div key={`${state}-${index}`} className={`hangar-light hangar-light-${state}`}><span>Luz {index + 1}</span><strong>{state === 'green' ? 'Verde' : state === 'red' ? 'Roja' : 'Apagada'}</strong></div>)}
        </div>
        <div className="hangar-sync-panel">
          <p>{cycleState.phase.description}</p>
          <div className="hangar-phase-warning">
            {cycleState.phase.id === 'red' && <strong>No insertar compboards durante rojo: el hangar no abre.</strong>}
            {cycleState.phase.id === 'green' && <strong>Ventana valida: puedes insertar compboards y abrir el hangar.</strong>}
            {cycleState.phase.id === 'blackout' && <strong>Blackout: puede ser reset o puerta ya abierta por otro grupo.</strong>}
          </div>
          <div className="timer-sync-buttons">
            {cyclePhases.map((phase) => <button key={phase.id} className={`timer-sync-${phase.id}`} type="button" onClick={() => syncPhase(phase.id)}>Acaba de empezar {phase.label}</button>)}
            <button className="timer-sync-global" type="button" onClick={restoreGlobalAnchor}>Usar ciclo global</button>
          </div>
          <small>Referencia global actualizada para 4.8.0-LIVE. Recalibra solo tras parche, mantenimiento o si el ciclo validado cambia.</small>
        </div>
      </section>

      <section className="hangar-mission-grid">
        <div className="hangar-slot-board">
          <div className="section-heading compact-heading">
            <span className="section-icon">CB</span>
            <div>
              <span className="section-label">Estado de apertura</span>
              <h2>Tarjetas y compboards puestos</h2>
            </div>
          </div>
          <div className="hangar-slot-grid">
            {missionSlots.map((slot) => (
              <button key={slot.id} className={`hangar-slot ${slots[slot.id] ? 'is-placed' : ''}`} type="button" onClick={() => toggleSlot(slot.id)}>
                <span>{slot.type}</span>
                <strong>{slot.label}</strong>
                <small>{slot.source}</small>
                <b>{slots[slot.id] ? 'Puesta' : 'Pendiente'}</b>
              </button>
            ))}
          </div>
          <button className="ghost-action hangar-reset-button" type="button" onClick={resetRun}>Resetear tanda</button>
        </div>

        <aside className="hangar-brief-panel">
          <span className="section-label">Lectura rapida</span>
          <h3>Como usarlo en escuadra</h3>
          <p>Cuando un jugador recoja una tarjeta, pulsa su contador en la ubicacion correspondiente. Cuando alguien coloque una compboard en el hangar, marcala como puesta. Asi el grupo ve el progreso real de la tanda.</p>
          <ul>
            <li>Blanco: sin iniciar.</li>
            <li>Rojo: en cuenta atras.</li>
            <li>Amarillo: quedan menos de 3 minutos.</li>
            <li>Verde: temporizador completado.</li>
            <li>Keycards azules: 15 min.</li>
            <li>Tablets / compboards: 30 min.</li>
            <li>Tarjetas rojas SUPVISR: 30 min.</li>
          </ul>
        </aside>
      </section>

      <section className="hangar-timer-board">
        <div className="section-heading compact-heading">
          <span className="section-icon">TK</span>
          <div>
            <span className="section-label">Self timers</span>
            <h2>Contadores por ubicacion</h2>
          </div>
        </div>
        <div className="hangar-location-grid">
          {timerGroups.map((group) => (
            <article key={group.id} className="hangar-location-card">
              <div className="hangar-location-head">
                <div><span>{group.id}</span><h3>{group.label}</h3></div>
                <p>{group.note}</p>
              </div>
              <div className="hangar-fixed-timer-list">
                {group.timers.map((timer) => <FixedTimer key={timer.id} timer={timer} entry={fixedTimers[timer.id]} now={now} onStart={launchTimer} onReset={resetTimer} onAdjust={adjustTimer} />)}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function FixedTimer({ timer, entry, now, onStart, onReset, onAdjust }) {
  const storedDuration = Number(entry?.duration);
  const duration = Number.isFinite(storedDuration) ? storedDuration : timer.duration;
  const active = Boolean(entry?.startedAt && entry.expiresAt > now);
  const complete = Boolean(entry?.startedAt && entry.expiresAt <= now);
  const warning = active && entry.expiresAt - now <= 3 * MINUTE;
  const remaining = entry?.startedAt ? entry.expiresAt - now : duration * MINUTE;
  const timerTotalMs = Math.max(1, duration * MINUTE);
  const progress = entry?.startedAt ? Math.min(100, Math.round(((now - entry.startedAt) / timerTotalMs) * 100)) : 0;

  return (
    <div className={`hangar-fixed-timer ${active ? 'is-active' : ''} ${warning ? 'is-warning' : ''} ${complete ? 'is-complete' : ''}`}>
      <div>
        <span>{timer.type}</span>
        <strong>{timer.label}</strong>
      </div>
      <b>{entry?.startedAt ? formatDuration(remaining) : `${duration} min`}</b>
      <progress className="timer-progress" value={progress} max="100" aria-label={`Progreso de ${timer.label}`} />
      <div className="hangar-fixed-actions">
        <button type="button" disabled={active} onClick={() => onAdjust(timer, -1)}>-</button>
        <button type="button" disabled={active} onClick={() => onAdjust(timer, 1)}>+</button>
        <button type="button" onClick={() => onStart(timer)}>{entry?.startedAt ? 'Reiniciar' : 'Iniciar'}</button>
        <button type="button" onClick={() => onReset(timer.id)}>Reset</button>
      </div>
    </div>
  );
}
