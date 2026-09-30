/**
 * Procedural Genome / DNA system for infinite vertebrate and organism biodiversity.
 * Scientifically grounded in comparative anatomy, paleontology, and functional biomechanics.
 */

export type LocomotionStance = 'quadrupedal' | 'bipedal' | 'avian_theropod' | 'hexapodal' | 'serpentine';
export type FootPosture = 'digitigrade' | 'unguligrade' | 'plantigrade';
export type SkullArchetype = 'dolichocephalic' | 'mesocephalic' | 'brachycephalic' | 'theropod' | 'ceratopsian';
export type EarType = 'feline_pointed' | 'canine_erect' | 'rounded_ursine' | 'floppy' | 'reptilian_slit' | 'frill';
export type HornType = 'none' | 'bovid_swept' | 'ceratopsian_brow' | 'rhino_nasal' | 'antler_fork' | 'dorsal_spines';
export type ExtremityType = 'paw_claws' | 'talons' | 'hoof' | 'padded_sole' | 'scythe_claw';
export type IntegumentType = 'smooth_hide' | 'reptilian_scales' | 'fur_texture' | 'chitin_armor' | 'dermal_scutes';
export type PatternType = 'countershade_clean' | 'tiger_stripes' | 'leopard_rosettes' | 'dorsal_saddle' | 'bioluminescent_veins';
export type TailTipStyle = 'none' | 'tuft' | 'fin' | 'spade' | 'club';

export interface CreatureDNA {
  seed: number;
  scientificName: string;
  vernacularName: string;
  taxonomicClass: string;
  ecologicalNiche: string;

  // Stance & Scale
  stance: LocomotionStance;
  postureErectness: number; // 0.0 (sprawling) to 1.0 (pillar-erect)
  scale: number; // 0.8 to 2.5

  // Vertebral Anatomy
  spineLength: number;
  spineCurvature: number; // arching of thoracic/lumbar
  thoracicWidth: number; // ribcage broadness
  thoracicDepth: number; // ribcage ventral keel depth
  lumbarLength: number; // flank spacing
  pelvisWidth: number; // hip girdle
  tailLength: number;
  tailThickness: number;
  tailTipStyle: TailTipStyle;

  // Cervical & Cranial Anatomy
  neckLength: number;
  neckArch: number;
  neckThickness: number;
  skullArchetype: SkullArchetype;
  skullSize: number;
  snoutLength: number;
  snoutWidth: number;
  snoutDrop: number;
  mandibleDepth: number;
  eyeOrbitSize: number;
  eyeForwardFacing: number; // 0 = lateral (prey), 1 = binocular (predator)
  earType: EarType;
  earScale: number;
  hornType: HornType;
  hornScale: number;

  // Appendicular Anatomy & Limbs
  footPosture: FootPosture;
  limbPairs: number; // 1 (theropod biped), 2 (quadruped), 3 (hexapod), 0 (serpent)
  forelimbScale: number;
  hindlimbScale: number;
  scapulaVolume: number;
  femurThickness: number;
  extremityType: ExtremityType;

  // Soft Tissue, Muscle Hypertrophy & Dermis
  muscleMassIndex: number; // 0.6 (gracile) to 1.6 (hypertrophic apex)
  dorsalCrestAdipose: number; // bison/rhino hump or sail
  bellySlack: number;
  dermalThickness: number;
  dermalRoughnessFrequency: number;

  // Pigmentation & Integument
  integument: IntegumentType;
  pattern: PatternType;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  specularGloss: number;

  // Deep Learning & Vertex Displacement Biomechanics
  neuralBulgeIntensity: number; // 0.5 to 2.0
  respirationRate: number; // breaths per min
  respirationAmplitude: number; // vertex displacement amplitude
  elasticTensionModulus: number; // muscle recoil damping
}

// Pseudo-random generator with seed
export class PRNG {
  private s: number;
  constructor(seed: number) {
    this.s = Math.abs(seed) % 2147483647;
    if (this.s <= 0) this.s += 2147483646;
  }
  next(): number {
    this.s = (this.s * 16807) % 2147483647;
    return (this.s - 1) / 2147483646;
  }
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

// Scientific Taxonomy Generator for procedural organisms
const GREEK_PREFIX = [
  'Panthera', 'Smilo', 'Titan', 'Draco', 'Cyno', 'Therio', 'Acro', 'Veloci',
  'Chiro', 'Chalic', 'Cerato', 'Mega', 'Orycto', 'Bary', 'Xeno', 'Brachy'
];
const GREEK_SUFFIX = [
  'morphus', 'gnathus', 'raptor', 'pteryx', 'therium', 'strix', 'saurus',
  'don', 'phagus', 'cetus', 'draco', 'ceras', 'rhynchus', 'chelys'
];
const SPECIFIC_EPITHET = [
  'ferox', 'atrox', 'imperator', 'venator', 'gracilis', 'robustus', 'titanus',
  'striatus', 'obscurus', 'carnifex', 'chimaera', 'vulgaris', 'rex', 'cursor'
];
const COMMON_ADJECTIVES = [
  'Apex', 'Gilded', 'Dusk', 'Highland', 'Phantom', 'Ironhide', 'Crested',
  'Spotted', 'Spined', 'Tundra', 'Savanna', 'Abyssal', 'Saber-toothed', 'Grizzled'
];
const COMMON_NOUNS = [
  'Prowler', 'Behemoth', 'Stalker', 'Strider', 'Hound', 'Drake', 'Stag',
  'Gorgon', 'Crawler', 'Ravager', 'Marauder', 'Basilisk', 'Gryph', 'Ripper'
];

export function generateRandomDNA(seed: number = Math.floor(Math.random() * 1000000)): CreatureDNA {
  const rng = new PRNG(seed);

  const stances: LocomotionStance[] = ['quadrupedal', 'quadrupedal', 'avian_theropod', 'bipedal', 'hexapodal'];
  const stance = rng.pick(stances);

  const footPostures: FootPosture[] = ['digitigrade', 'unguligrade', 'plantigrade'];
  const footPosture = rng.pick(footPostures);

  const skullArchetypes: SkullArchetype[] = ['dolichocephalic', 'mesocephalic', 'brachycephalic', 'theropod', 'ceratopsian'];
  const skullArchetype = stance === 'avian_theropod' ? 'theropod' : rng.pick(skullArchetypes);

  const earTypes: EarType[] = ['feline_pointed', 'canine_erect', 'rounded_ursine', 'floppy', 'reptilian_slit', 'frill'];
  const earType = (stance === 'avian_theropod') ? 'reptilian_slit' : rng.pick(earTypes);

  const hornTypes: HornType[] = ['none', 'none', 'bovid_swept', 'ceratopsian_brow', 'rhino_nasal', 'antler_fork', 'dorsal_spines'];
  const hornType = rng.pick(hornTypes);

  const extremities: ExtremityType[] = footPosture === 'unguligrade'
    ? ['hoof']
    : footPosture === 'plantigrade'
    ? ['padded_sole', 'paw_claws']
    : ['paw_claws', 'talons', 'scythe_claw'];
  const extremityType = rng.pick(extremities);

  const integuments: IntegumentType[] = ['smooth_hide', 'reptilian_scales', 'fur_texture', 'chitin_armor', 'dermal_scutes'];
  const integument = rng.pick(integuments);

  const patterns: PatternType[] = ['countershade_clean', 'tiger_stripes', 'leopard_rosettes', 'dorsal_saddle', 'bioluminescent_veins'];
  const pattern = rng.pick(patterns);

  const tailStyles: TailTipStyle[] = ['none', 'tuft', 'fin', 'spade', 'club'];
  const tailTipStyle = rng.pick(tailStyles);

  // Palettes tailored to biological camouflage & melanin
  const palettes = [
    { p: '#8b5a2b', s: '#e6c280', a: '#2c1608' }, // Tawny big cat
    { p: '#3d4035', s: '#828c74', a: '#1a1f16' }, // Saurian moss green
    { p: '#4a3b32', s: '#c4a482', a: '#d97736' }, // Striped predator
    { p: '#262930', s: '#707885', a: '#00d2be' }, // Abyssal bioluminescent
    { p: '#7a2021', s: '#e8a87c', a: '#f7d070' }, // Desert dragon crimson
    { p: '#8c8275', s: '#d9d0c1', a: '#2a2824' }, // Mountain crag grey
    { p: '#1e242b', s: '#4b5563', a: '#93c5fd' }, // Glacial tundra predator
  ];
  const colorScheme = rng.pick(palettes);

  const limbPairs = stance === 'avian_theropod' || stance === 'bipedal' ? 1 : stance === 'hexapodal' ? 3 : 2;

  const scientificName = `${rng.pick(GREEK_PREFIX)}${rng.pick(GREEK_SUFFIX)} ${rng.pick(SPECIFIC_EPITHET)}`;
  const vernacularName = `${rng.pick(COMMON_ADJECTIVES)} ${rng.pick(COMMON_NOUNS)}`;

  const classes = [
    'Vertebrata · Synapsida (Mammaliaform)',
    'Vertebrata · Archosauria (Theropod)',
    'Vertebrata · Squamata (Lepidosaur)',
    'Ecdysozoa · Arthropoda (Chitinous Hexapod)'
  ];
  const taxonomicClass = stance === 'hexapodal'
    ? classes[3]
    : stance === 'avian_theropod'
    ? classes[1]
    : rng.pick([classes[0], classes[1], classes[2]]);

  const niches = [
    'Hyper-carnivorous Apex Ambush Predator',
    'High-speed Cursorial Pursuit Hunter',
    'Armored Mega-herbivore Browser',
    'Subterranean Burrowing Omnivore',
    'Riparian Piscivorous Stalker'
  ];
  const ecologicalNiche = rng.pick(niches);

  return {
    seed,
    scientificName,
    vernacularName,
    taxonomicClass,
    ecologicalNiche,

    stance,
    postureErectness: stance === 'avian_theropod' ? 0.9 : rng.range(0.3, 0.95),
    scale: rng.range(1.0, 1.4),

    spineLength: rng.range(1.6, 2.8),
    spineCurvature: rng.range(0.05, 0.28),
    // Harmonized, biologically proportional trunk dimensions (not too skinny, not too thick)
    thoracicWidth: rng.range(0.58, 0.74),
    thoracicDepth: rng.range(0.56, 0.72),
    lumbarLength: rng.range(0.48, 0.95),
    pelvisWidth: rng.range(0.54, 0.72),
    tailLength: stance === 'avian_theropod' ? rng.range(1.9, 2.7) : rng.range(0.9, 2.2),
    tailThickness: stance === 'avian_theropod' ? rng.range(0.20, 0.32) : rng.range(0.14, 0.28),
    tailTipStyle,

    neckLength: stance === 'avian_theropod' ? rng.range(0.5, 1.0) : rng.range(0.3, 0.85),
    neckArch: rng.range(0.15, 0.65),
    neckThickness: rng.range(0.24, 0.50),
    skullArchetype,
    // Realistic, anatomically balanced skull dimensions (commanding head size, not small)
    skullSize: rng.range(0.38, 0.55),
    snoutLength: rng.range(0.38, 0.72),
    snoutWidth: rng.range(0.22, 0.42),
    snoutDrop: rng.range(0.02, 0.16),
    mandibleDepth: rng.range(0.20, 0.36),
    eyeOrbitSize: rng.range(0.09, 0.16),
    eyeForwardFacing: rng.range(0.4, 0.95),
    earType,
    earScale: earType === 'reptilian_slit' ? 0.05 : rng.range(0.15, 0.45),
    hornType,
    hornScale: hornType === 'none' ? 0 : rng.range(0.2, 0.65),

    footPosture,
    limbPairs,
    forelimbScale: stance === 'avian_theropod' ? rng.range(0.35, 0.55) : rng.range(0.88, 1.15),
    hindlimbScale: rng.range(0.88, 1.22),
    scapulaVolume: rng.range(0.22, 0.48),
    femurThickness: rng.range(0.16, 0.34),
    extremityType,

    muscleMassIndex: rng.range(0.85, 1.55),
    dorsalCrestAdipose: rng.range(0.0, 0.35),
    bellySlack: rng.range(0.05, 0.25),
    dermalThickness: 0.0,
    dermalRoughnessFrequency: 16.0,

    integument,
    pattern,
    primaryColor: colorScheme.p,
    secondaryColor: colorScheme.s,
    accentColor: colorScheme.a,
    specularGloss: rng.range(0.2, 0.65),

    neuralBulgeIntensity: 1.2,
    respirationRate: rng.range(16, 26),
    respirationAmplitude: 0.035,
    elasticTensionModulus: 0.85,
  };
}

export interface ArchetypePreset {
  id: string;
  name: string;
  description: string;
  generator: () => CreatureDNA;
}

export const ARCHETYPE_PRESETS: ArchetypePreset[] = [
  {
    id: 'apex_felid',
    name: 'Saber Panthera (Apex Carnivore)',
    description: 'High-power muscular predator with digitigrade limbs, heavy scapular girdle, and retractable claws.',
    generator: () => {
      const dna = generateRandomDNA(42819);
      dna.scientificName = 'Machairodus ferox';
      dna.vernacularName = 'Ghostfang Saber-cat';
      dna.taxonomicClass = 'Vertebrata · Felidae (Apex Carnivora)';
      dna.stance = 'quadrupedal';
      dna.footPosture = 'digitigrade';
      dna.skullArchetype = 'brachycephalic';
      dna.skullSize = 0.46;
      dna.snoutLength = 0.50;
      dna.snoutWidth = 0.34;
      dna.mandibleDepth = 0.28;
      dna.thoracicWidth = 0.62;
      dna.thoracicDepth = 0.60;
      dna.pelvisWidth = 0.58;
      dna.muscleMassIndex = 1.45;
      dna.neckThickness = 0.48;
      dna.scapulaVolume = 0.42;
      dna.primaryColor = '#804c27';
      dna.secondaryColor = '#dfba85';
      dna.accentColor = '#1f130b';
      dna.thoracicWidth = 0.66;
      dna.thoracicDepth = 0.64;
      dna.pelvisWidth = 0.62;
      dna.pattern = 'leopard_rosettes';
      dna.integument = 'fur_texture';
      dna.hornType = 'none';
      dna.earType = 'feline_pointed';
      dna.tailTipStyle = 'tuft';
      dna.tailLength = 1.4;
      return dna;
    }
  },
  {
    id: 'saurian_theropod',
    name: 'Veloce Tyrannus (Bipedal Theropod)',
    description: 'Hollow-boned cursorial archosaur with counterbalanced tail, binocular vision, and sickle-bearing talons.',
    generator: () => {
      const dna = generateRandomDNA(88912);
      dna.scientificName = 'Acrovenator rex';
      dna.vernacularName = 'Scythe-tail Ravager';
      dna.taxonomicClass = 'Vertebrata · Saurischia (Dromaeosaurid)';
      dna.stance = 'avian_theropod';
      dna.footPosture = 'digitigrade';
      dna.skullArchetype = 'theropod';
      dna.skullSize = 0.48;
      dna.snoutLength = 0.68;
      dna.snoutWidth = 0.28;
      dna.snoutDrop = 0.08;
      dna.mandibleDepth = 0.26;
      dna.thoracicWidth = 0.58;
      dna.thoracicDepth = 0.60;
      dna.pelvisWidth = 0.56;
      dna.neckLength = 0.95;
      dna.neckArch = 0.55;
      dna.tailLength = 2.4;
      dna.tailThickness = 0.26;
      dna.tailTipStyle = 'fin';
      dna.hindlimbScale = 1.25;
      dna.forelimbScale = 0.45;
      dna.limbPairs = 1;
      dna.extremityType = 'scythe_claw';
      dna.primaryColor = '#2b4736';
      dna.secondaryColor = '#6c8a74';
      dna.accentColor = '#c43d27';
      dna.pattern = 'tiger_stripes';
      dna.integument = 'reptilian_scales';
      dna.hornType = 'ceratopsian_brow';
      dna.hornScale = 0.35;
      dna.earType = 'reptilian_slit';
      return dna;
    }
  },
  {
    id: 'titan_behemoth',
    name: 'Gorgon Megatherium (Mega-Behemoth)',
    description: 'Immense armored herbivore browser with hypertrophied columnar limbs, dermal scutes, and cranial horns.',
    generator: () => {
      const dna = generateRandomDNA(13054);
      dna.scientificName = 'Titanoceros imperator';
      dna.vernacularName = 'Crested Iron-Strider';
      dna.taxonomicClass = 'Vertebrata · Ungulata (Pachyderm Mega-Fauna)';
      dna.stance = 'quadrupedal';
      dna.footPosture = 'unguligrade';
      dna.skullArchetype = 'ceratopsian';
      dna.skullSize = 0.52;
      dna.snoutLength = 0.58;
      dna.snoutWidth = 0.38;
      dna.mandibleDepth = 0.28;
      dna.thoracicWidth = 0.72;
      dna.thoracicDepth = 0.72;
      dna.pelvisWidth = 0.70;
      dna.muscleMassIndex = 1.55;
      dna.dorsalCrestAdipose = 0.22;
      dna.femurThickness = 0.32;
      dna.primaryColor = '#474c52';
      dna.secondaryColor = '#8b939c';
      dna.accentColor = '#2a2b2e';
      dna.pattern = 'dorsal_saddle';
      dna.integument = 'dermal_scutes';
      dna.hornType = 'bovid_swept';
      dna.hornScale = 0.6;
      dna.tailLength = 0.9;
      dna.tailTipStyle = 'club';
      return dna;
    }
  },
  {
    id: 'abyssal_hexapod',
    name: 'Xeno Carabus (Chitinous Hexapod)',
    description: 'Six-legged chitinous cursorial organism with bioluminescent venation, compound vision, and high-tensile exoskeleton.',
    generator: () => {
      const dna = generateRandomDNA(77123);
      dna.scientificName = 'Hexapodus bioluminescens';
      dna.vernacularName = 'Neon Stalker';
      dna.taxonomicClass = 'Ecdysozoa · Arthropoda (Chitinous Biosphere)';
      dna.stance = 'hexapodal';
      dna.footPosture = 'digitigrade';
      dna.skullArchetype = 'dolichocephalic';
      dna.skullSize = 0.44;
      dna.snoutLength = 0.50;
      dna.snoutWidth = 0.26;
      dna.mandibleDepth = 0.22;
      dna.thoracicWidth = 0.62;
      dna.thoracicDepth = 0.60;
      dna.pelvisWidth = 0.58;
      dna.limbPairs = 3;
      dna.muscleMassIndex = 1.15;
      dna.primaryColor = '#12161f';
      dna.secondaryColor = '#283344';
      dna.accentColor = '#00f0ff';
      dna.pattern = 'bioluminescent_veins';
      dna.integument = 'chitin_armor';
      dna.hornType = 'antler_fork';
      dna.hornScale = 0.45;
      dna.tailLength = 1.6;
      dna.tailTipStyle = 'fin';
      dna.specularGloss = 0.75;
      return dna;
    }
  }
];
