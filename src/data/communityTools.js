import { routes } from '../config/routes.js';

export const communityTools = [
  {
    id: 'blueprint-finder',
    name: 'Blueprint Finder',
    provider: 'Stanton Hub',
    category: 'Crafting',
    type: 'Interna',
    status: 'Disponible',
    url: routes.blueprintFinder,
    description: 'Busca planos de fabricacion por categoria, material necesario, resultado y uso recomendado.',
    useCases: ['Crafting', 'Materiales', 'Industria']
  },
  {
    id: 'mining-material-finder',
    name: 'Buscador de materiales de mineria',
    provider: 'Stanton Hub',
    category: 'Mineria',
    type: 'Interna',
    status: 'Disponible',
    url: routes.miningMaterials,
    description: 'Consulta materiales minables, ubicaciones recomendadas, calidad esperada, riesgo y equipo util.',
    useCases: ['Mineria', 'Farmeo', 'Rutas']
  },
  {
    id: 'ship-compare',
    name: 'Comparador de naves',
    provider: 'Stanton Hub',
    category: 'Flota',
    type: 'Interna',
    status: 'Disponible',
    url: routes.shipCompare,
    description: 'Enfrenta dos naves con puntuacion operativa, estadisticas, rol y capacidades especiales.',
    useCases: ['Flota', 'Compra', 'Comparacion']
  },
  {
    id: 'component-catalog',
    name: 'Catalogo de componentes',
    provider: 'Stanton Hub',
    category: 'Loadout',
    type: 'Interna',
    status: 'Disponible',
    url: routes.components,
    description: 'Explora armas, escudos, quantum, propulsion y sistemas detectados en las fichas de naves.',
    useCases: ['Componentes', 'Loadout', 'Naves']
  },
  {
    id: 'trade-route-planner',
    name: 'Planificador de rutas comerciales',
    provider: 'Stanton Hub',
    category: 'Comercio',
    type: 'Interna',
    status: 'Pendiente',
    url: routes.communityTools,
    description: 'Modulo previsto para calcular rutas de compra y venta usando precios locales sincronizados.',
    useCases: ['Comercio', 'Hauling', 'UEX']
  },
  {
    id: 'fleet-loadout-planner',
    name: 'Planificador de loadouts',
    provider: 'Stanton Hub',
    category: 'Loadout',
    type: 'Interna',
    status: 'Pendiente',
    url: routes.communityTools,
    description: 'Modulo previsto para montar configuraciones de armas y componentes por nave desde nuestro catalogo.',
    useCases: ['Combate', 'Energia', 'Componentes']
  },
  {
    id: 'operation-timers',
    name: 'Temporizadores de operaciones',
    provider: 'Stanton Hub',
    category: 'Operaciones',
    type: 'Interna',
    status: 'Disponible',
    url: routes.operationTimers,
    description: 'Controla ciclos de hangares ejecutivos y temporizadores manuales para tarjetas, objetivos y ventanas de grupo.',
    useCases: ['Hangares', 'Tarjetas', 'Contested Zones']
  },
  {
    id: 'keybind-planner',
    name: 'Planificador de controles',
    provider: 'Stanton Hub',
    category: 'Controles',
    type: 'Interna',
    status: 'Pendiente',
    url: routes.communityTools,
    description: 'Modulo previsto para guardar perfiles de teclado, HOTAS y HOSAS por tipo de actividad.',
    useCases: ['Controles', 'HOSAS', 'Pilotos']
  }
];
