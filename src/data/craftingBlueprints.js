import blueprintExplorerSource from './blueprintExplorerSource.json';

const sourceItems = Array.isArray(blueprintExplorerSource?.items) ? blueprintExplorerSource.items : [];
const sourceScopes = blueprintExplorerSource?.scopes || {};

const categoryLabels = {
  personalWeapons: 'Armas personales',
  shipWeapons: 'Armas de nave',
  ammo: 'Municion',
  armor: 'Armaduras',
  flightSuits: 'Trajes de vuelo',
  shipComponents: 'Componentes',
  unknown: 'Otros'
};

const roleLabels = {
  fps: 'FPS',
  shipCombat: 'Combate nave',
  utility: 'Utilidad',
  armor: 'Proteccion',
  logistics: 'Logistica',
  systems: 'Sistemas',
  reference: 'Referencia'
};

export const craftingBlueprints = sourceItems
  .filter(isCraftableSource)
  .map(normalizeBlueprint)
  .filter(Boolean)
  .sort((a, b) => `${a.category}${a.name}`.localeCompare(`${b.category}${b.name}`, 'es'));

export const blueprintSummary = summarize(craftingBlueprints);
export const blueprintMissions = summarizeMissions(craftingBlueprints);

function normalizeBlueprint(item, index) {
  const name = cleanText(item?.name);
  if (!name) return null;

  const categoryKey = categoryKeyFor(item);
  const missions = normalizeMissions(item.missions, item);
  const tier = tierFor(item, missions);
  const blueprintCode = cleanText(item.blueprint);
  const craftable = Boolean(item.craftable || blueprintCode);
  const role = roleFor(item, categoryKey);
  const acquisition = acquisitionFor(missions);

  return {
    id: `source-${index + 1}-${slug(name)}`,
    name,
    category: categoryLabels[categoryKey],
    categoryKey,
    family: cleanText(item.subtype) || cleanText(item.type) || categoryLabels[categoryKey],
    tier,
    rarity: rarityFor(item, tier, missions),
    rewardType: craftable ? 'Blueprint crafteable' : 'Blueprint de contrato',
    role,
    roleLabel: roleLabels[role] || 'Referencia',
    activity: primaryActivity(missions, categoryKey),
    acquisition,
    missions,
    unlockAdvice: unlockAdviceFor(item, missions, categoryKey),
    bestFor: bestFor(item, categoryKey, missions),
    source: 'Blueprint Finder',
    blueprintCode,
    craftTime: Number(item.craftTime || 0),
    materials: Array.isArray(item.materials) ? item.materials : [],
    notes: notesFor(item, missions, categoryKey)
  };
}

function isCraftableSource(item) {
  return Boolean(item?.craftable || cleanText(item?.blueprint));
}

function normalizeMissions(missions, item) {
  const seen = new Set();
  return (Array.isArray(missions) ? missions : [])
    .filter((mission) => mission && cleanText(mission.title))
    .map((mission, index) => {
      const key = [
        mission.title,
        mission.type,
        mission.faction,
        mission.system,
        mission.minRep,
        mission.repStanding,
        mission.lawful
      ].map(cleanText).join('|').toLowerCase();
      if (seen.has(key)) return null;
      seen.add(key);

      const scope = sourceScopes[mission.scopeGuid] || null;
      const repStanding = cleanText(mission.repStanding) || repStandingFromScope(scope, mission.minRep);
      const minRep = Number(mission.minRep || 0);
      const repReward = Number(mission.repReward || 0);

      return {
        id: `mission-${slug(key)}-${index + 1}`,
        name: cleanText(mission.title),
        faction: cleanText(mission.faction) || 'Contrato sin faccion',
        system: cleanText(mission.system) || systemFromList(mission.systems),
        region: cleanText(mission.system) || systemFromList(mission.systems),
        activity: translateMissionType(mission.type),
        type: cleanText(mission.type) || 'Contrato',
        difficulty: difficultyFromRep(minRep),
        probability: missionProbability(item, minRep),
        contractRank: repStanding || difficultyFromRep(minRep),
        lawful: mission.lawful !== false,
        minRep,
        repReward,
        repStanding,
        scopeName: cleanText(scope?.displayName),
        rotationNote: repReward
          ? `Otorga ${repReward.toLocaleString('es-ES')} de reputacion por completado.`
          : 'Revisa la rotacion del proveedor y repite contratos del mismo pool.',
        notes: missionNotes(mission, repStanding, minRep)
      };
    })
    .filter(Boolean);
}

function categoryKeyFor(item) {
  const type = cleanText(item.type).toLowerCase();
  const subtype = cleanText(item.subtype).toLowerCase();
  if (type === 'ammo') return 'ammo';
  if (type === 'shipcomponent') return 'shipComponents';
  if (type === 'armor') {
    if (/flight|undersuit/.test(subtype)) return 'flightSuits';
    return 'armor';
  }
  if (type === 'weapon') {
    if (/gun|nosemounted/.test(subtype)) return 'shipWeapons';
    return 'personalWeapons';
  }
  return 'unknown';
}

function roleFor(item, categoryKey) {
  const text = [item.name, item.type, item.subtype].map(cleanText).join(' ').toLowerCase();
  if (categoryKey === 'personalWeapons' || categoryKey === 'ammo') return 'fps';
  if (categoryKey === 'shipWeapons') return 'shipCombat';
  if (categoryKey === 'armor' || categoryKey === 'flightSuits') return 'armor';
  if (/fuel|quantum|cooler|power|radar|shield|component/.test(text) || categoryKey === 'shipComponents') return 'systems';
  if (/tractor|mining|salvage|utility|backpack/.test(text)) return 'utility';
  return 'reference';
}

function acquisitionFor(missions) {
  if (!missions.length) {
    return {
      status: 'Sin ruta',
      primaryFaction: 'N/D',
      primaryMission: 'N/D',
      missionCount: 0,
      systems: [],
      minRep: 0,
      maxRep: 0,
      averageRepReward: 0,
      lawfulCount: 0,
      unlawfulCount: 0
    };
  }

  const missionGroups = countBy(missions, (mission) => `${mission.faction}|${mission.name}`);
  const factionGroups = countBy(missions, (mission) => mission.faction);
  const [primaryMissionKey] = [...missionGroups.entries()].sort((a, b) => b[1] - a[1])[0];
  const [primaryFaction] = [...factionGroups.entries()].sort((a, b) => b[1] - a[1])[0];
  const repRewards = missions.map((mission) => mission.repReward).filter((value) => value > 0);

  return {
    status: 'Ruta detectada',
    primaryFaction,
    primaryMission: primaryMissionKey.split('|')[1],
    missionCount: missions.length,
    systems: unique(missions.map((mission) => mission.system)).filter((item) => item && item !== 'N/D'),
    minRep: Math.min(...missions.map((mission) => mission.minRep || 0)),
    maxRep: Math.max(...missions.map((mission) => mission.minRep || 0)),
    averageRepReward: repRewards.length ? Math.round(repRewards.reduce((sum, value) => sum + value, 0) / repRewards.length) : 0,
    lawfulCount: missions.filter((mission) => mission.lawful).length,
    unlawfulCount: missions.filter((mission) => !mission.lawful).length
  };
}

function countBy(items, selector) {
  const map = new Map();
  items.forEach((item) => {
    const key = selector(item) || 'N/D';
    map.set(key, (map.get(key) || 0) + 1);
  });
  return map;
}

function tierFor(item, missions) {
  const subtype = cleanText(item.subtype).toLowerCase();
  const craftTime = Number(item.craftTime || 0);
  const maxRep = Math.max(0, ...missions.map((mission) => Number(mission.minRep || 0)));
  if (/heavy|gun|nosemounted/.test(subtype) || craftTime >= 600 || maxRep >= 80000) return 4;
  if (/medium|power|radar/.test(subtype) || craftTime >= 300 || maxRep >= 15000) return 3;
  if (/small|ammo|arms|legs|helmet|core/.test(subtype) || craftTime >= 120 || maxRep >= 2000) return 2;
  return 1;
}

function rarityFor(item, tier, missions) {
  if (!missions.length && item.craftable) return 'Crafteable';
  return ['Comun', 'Poco comun', 'Raro', 'Elite'][Math.max(0, Math.min(3, tier - 1))];
}

function primaryActivity(missions, categoryKey) {
  if (missions[0]?.activity) return missions[0].activity;
  return {
    personalWeapons: 'Combate FPS',
    shipWeapons: 'Bounty',
    ammo: 'Suministro',
    armor: 'Bunker',
    flightSuits: 'Exploracion',
    shipComponents: 'Sistemas',
    unknown: 'Contrato'
  }[categoryKey];
}

function unlockAdviceFor(item, missions, categoryKey) {
  if (!missions.length) {
    if (item.craftable) return 'Este objeto aparece como crafteable en la base fuente, pero no tiene contrato de recompensa asociado en el dataset descargado.';
    return 'No hay contrato de obtencion asociado en el dataset descargado. Mantenerlo como referencia hasta que se publique una ruta fiable.';
  }

  const factions = unique(missions.map((mission) => mission.faction)).slice(0, 3);
  const topRep = Math.max(0, ...missions.map((mission) => mission.minRep || 0));
  const categoryHint = {
    personalWeapons: 'Prioriza contratos FPS y cadenas de reputacion del proveedor.',
    shipWeapons: 'Prioriza bounty, mercenario y cadenas ofensivas hasta que rote el contrato correcto.',
    ammo: 'Repite contratos del mismo proveedor para reducir la dispersion del pool de recompensa.',
    armor: 'Busca el set por faccion y comprueba si cada pieza comparte el mismo contrato.',
    flightSuits: 'Comprueba contratos de exploracion, carreras o proveedores concretos antes de farmear.',
    shipComponents: 'Usa contratos tecnicos, bounty o faccion segun el proveedor detectado.'
  }[categoryKey] || 'Repite contratos del mismo pool de recompensa.';

  return `${categoryHint} Fuente principal: ${factions.join(', ')}${topRep ? `, con reputacion recomendada desde ${topRep.toLocaleString('es-ES')}.` : '.'}`;
}

function bestFor(item, categoryKey, missions) {
  const values = [
    categoryLabels[categoryKey],
    cleanText(item.subtype),
    missions[0]?.faction,
    missions[0]?.system
  ].filter(Boolean);
  return unique(values).slice(0, 5);
}

function notesFor(item, missions, categoryKey) {
  const base = `${categoryLabels[categoryKey]} importado del dataset de recompensas por contrato.`;
  if (missions.length) return `${base} Detectado en ${missions.length} contrato${missions.length === 1 ? '' : 's'} o variantes de contrato.`;
  if (item.craftable) return `${base} Tiene receta crafteable registrada, pero sin mision de drop en esta fuente.`;
  return `${base} Sin ruta de obtencion asociada por ahora.`;
}

function summarize(blueprints) {
  return Object.entries(categoryLabels)
    .map(([key, label]) => ({
      key,
      label,
      count: blueprints.filter((blueprint) => blueprint.categoryKey === key && blueprint.missions.length).length
    }))
    .filter((item) => item.count > 0);
}

function summarizeMissions(blueprints) {
  const missionMap = new Map();
  blueprints.forEach((blueprint) => {
    blueprint.missions.forEach((mission) => {
      const key = [mission.name, mission.faction, mission.system, mission.minRep].join('|').toLowerCase();
      if (!missionMap.has(key)) {
        missionMap.set(key, {
          id: mission.id,
          name: mission.name,
          faction: mission.faction,
          system: mission.system,
          region: mission.region,
          activity: mission.activity,
          difficulty: mission.difficulty,
          chance: mission.probability,
          notes: mission.notes
        });
      }
    });
  });
  return [...missionMap.values()].sort((a, b) => `${a.faction}${a.name}`.localeCompare(`${b.faction}${b.name}`, 'es'));
}

function missionProbability(item, minRep) {
  if (!minRep) return 'Variable';
  if (minRep >= 80000) return 'Baja';
  if (minRep >= 15000) return 'Media';
  return 'Media';
}

function missionNotes(mission, repStanding, minRep) {
  const law = mission.lawful === false ? 'Contrato ilegal' : 'Contrato legal';
  const rep = repStanding ? `Rango: ${repStanding}.` : '';
  const required = minRep ? `Reputacion minima: ${minRep.toLocaleString('es-ES')}.` : '';
  return [law, rep, required].filter(Boolean).join(' ');
}

function difficultyFromRep(rep) {
  if (rep >= 80000) return 'Elite';
  if (rep >= 15000) return 'Alta';
  if (rep >= 2000) return 'Media';
  return 'Inicial';
}

function translateMissionType(type) {
  const value = cleanText(type);
  const lower = value.toLowerCase();
  if (lower.includes('bounty')) return 'Cazarrecompensas';
  if (lower.includes('mercenary')) return 'Mercenario';
  if (lower.includes('delivery')) return 'Entrega';
  if (lower.includes('investigation')) return 'Investigacion';
  if (lower.includes('racing')) return 'Carreras';
  if (lower.includes('maintenance')) return 'Mantenimiento';
  return value || 'Contrato';
}

function repStandingFromScope(scope, minRep) {
  const ranks = Array.isArray(scope?.ranks) ? scope.ranks : [];
  const rep = Number(minRep || 0);
  const match = ranks
    .filter((rank) => Number(rank.minReputation || rank.minRep || 0) <= rep)
    .sort((a, b) => Number(b.minReputation || b.minRep || 0) - Number(a.minReputation || a.minRep || 0))[0];
  return cleanText(match?.displayName || match?.name);
}

function systemFromList(systems) {
  if (!Array.isArray(systems) || !systems.length) return 'N/D';
  return cleanText(systems[0]) || 'N/D';
}

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function slug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
