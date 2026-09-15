/**
 * Generates data/demo/dataset.json — a synthetic but internally consistent season
 * for every tracked competition. The site runs on it when DATA_SOURCE=demo.
 *
 * Everything is derived from a fixed seed so re-running produces identical output.
 * Dates are stored relative to `anchorDate`; the demo repository shifts them so the
 * anchor always lands on the visitor's "today".
 *
 *   pnpm demo:generate
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { slugify } from "../src/lib/slug";
import type { Competition, Player, Position, Team } from "../src/lib/types";
import type { DemoDataset, DemoEvent, DemoLineup, DemoMatch } from "../src/lib/data/demo-format";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

// ---------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(90_90_90);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const shuffle = <T>(arr: readonly T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const poisson = (lambda: number): number => {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rand();
  } while (p > L);
  return k - 1;
};
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

// ---------------------------------------------------------------------------
// Source data
// ---------------------------------------------------------------------------
const ANCHOR = "2026-09-15"; // a Tuesday: UCL matchday
const SEASON = "2026/27";

type RawTeam = [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  string,
  string | null,
];
const teamsSrc = JSON.parse(fs.readFileSync(path.join(root, "data/demo/teams.json"), "utf8")) as {
  teams: RawTeam[];
  competitions: Record<string, string[]>;
};
const competitionsSrc = JSON.parse(
  fs.readFileSync(path.join(root, "data/demo/competitions.json"), "utf8"),
) as Omit<Competition, "season">[];

const COUNTRY_NAMES: Record<string, string> = {
  "GB-ENG": "England",
  "GB-SCT": "Scotland",
  ES: "Spain",
  DE: "Germany",
  IT: "Italy",
  FR: "France",
  MC: "Monaco",
  PT: "Portugal",
  NL: "Netherlands",
  BE: "Belgium",
  TR: "Türkiye",
  GR: "Greece",
  CZ: "Czechia",
  NO: "Norway",
  DK: "Denmark",
  AZ: "Azerbaijan",
  CY: "Cyprus",
  KZ: "Kazakhstan",
  HR: "Croatia",
  AT: "Austria",
  RS: "Serbia",
  HU: "Hungary",
  IL: "Israel",
  CH: "Switzerland",
  BG: "Bulgaria",
  SE: "Sweden",
  RO: "Romania",
  BR: "Brazil",
  AR: "Argentina",
  UY: "Uruguay",
  CO: "Colombia",
  MA: "Morocco",
  SN: "Senegal",
  NG: "Nigeria",
  EG: "Egypt",
  DZ: "Algeria",
  JP: "Japan",
  KR: "South Korea",
  US: "United States",
  PL: "Poland",
  UA: "Ukraine",
};

/** Rough strength ratings so the tables look believable. Unlisted teams default to 68. */
const RATINGS: Record<string, number> = {
  "manchester-city": 88,
  liverpool: 88,
  arsenal: 88,
  chelsea: 83,
  "tottenham-hotspur": 79,
  "manchester-united": 78,
  "newcastle-united": 80,
  "aston-villa": 80,
  brighton: 76,
  "nottingham-forest": 75,
  bournemouth: 75,
  fulham: 73,
  brentford: 73,
  "crystal-palace": 74,
  everton: 72,
  "west-ham-united": 71,
  "wolverhampton-wanderers": 69,
  "leeds-united": 69,
  burnley: 66,
  sunderland: 66,
  "real-madrid": 89,
  barcelona: 89,
  "atletico-madrid": 84,
  "athletic-club": 78,
  villarreal: 78,
  "real-betis": 76,
  "real-sociedad": 75,
  sevilla: 72,
  valencia: 71,
  girona: 71,
  "celta-vigo": 72,
  osasuna: 71,
  "rayo-vallecano": 70,
  mallorca: 70,
  getafe: 69,
  espanyol: 69,
  alaves: 68,
  levante: 66,
  elche: 66,
  "real-oviedo": 65,
  "bayern-munich": 89,
  "bayer-leverkusen": 82,
  "borussia-dortmund": 82,
  "rb-leipzig": 79,
  "eintracht-frankfurt": 78,
  "vfb-stuttgart": 77,
  "sc-freiburg": 75,
  "borussia-monchengladbach": 71,
  "vfl-wolfsburg": 72,
  "werder-bremen": 71,
  hoffenheim: 70,
  "mainz-05": 72,
  "union-berlin": 70,
  augsburg: 69,
  "fc-koln": 68,
  "hamburger-sv": 68,
  "st-pauli": 67,
  heidenheim: 66,
  inter: 86,
  napoli: 85,
  milan: 82,
  juventus: 82,
  atalanta: 81,
  roma: 79,
  lazio: 77,
  bologna: 77,
  fiorentina: 76,
  como: 73,
  torino: 71,
  udinese: 70,
  genoa: 69,
  cagliari: 68,
  parma: 68,
  sassuolo: 68,
  lecce: 67,
  "hellas-verona": 66,
  cremonese: 65,
  pisa: 65,
  psg: 90,
  benfica: 80,
  "sporting-cp": 79,
  porto: 78,
  ajax: 76,
  psv: 78,
  feyenoord: 75,
  "club-brugge": 75,
  marseille: 77,
  monaco: 76,
  galatasaray: 76,
  celtic: 73,
  rangers: 70,
  olympiacos: 72,
  "slavia-praha": 71,
  "bodo-glimt": 72,
  copenhagen: 70,
  "union-sg": 70,
  "dinamo-zagreb": 69,
  salzburg: 71,
  fenerbahce: 74,
  lille: 74,
  lyon: 74,
  nice: 72,
  braga: 71,
};

// Name pools by nationality. A club draws most of its squad from its own country.
const NAMES: Record<string, { first: string[]; last: string[] }> = {
  "GB-ENG": {
    first: [
      "Harry",
      "Jack",
      "Oliver",
      "Mason",
      "Callum",
      "Kyle",
      "Jordan",
      "Reece",
      "Lewis",
      "Conor",
      "Declan",
      "Aaron",
      "Ben",
      "Josh",
      "Tyler",
      "Ethan",
      "Marcus",
      "Jamie",
      "Luke",
      "Sam",
    ],
    last: [
      "Walker",
      "Bennett",
      "Hughes",
      "Turner",
      "Clarke",
      "Foster",
      "Barnes",
      "Gallagher",
      "Morgan",
      "Chapman",
      "Hart",
      "Reid",
      "Palmer",
      "Wallace",
      "Dawson",
      "Hayes",
      "Doyle",
      "Lambert",
      "Nicholls",
      "Pearce",
    ],
  },
  "GB-SCT": {
    first: [
      "Callum",
      "Lewis",
      "Ryan",
      "Scott",
      "Kieran",
      "Stuart",
      "Craig",
      "Ross",
      "Fraser",
      "Aidan",
    ],
    last: [
      "McGregor",
      "Ferguson",
      "Robertson",
      "Christie",
      "Armstrong",
      "Souttar",
      "Hanley",
      "McTominay",
      "Adams",
      "Gilmour",
    ],
  },
  ES: {
    first: [
      "Álvaro",
      "Iker",
      "Pablo",
      "Sergio",
      "Marcos",
      "Dani",
      "Javi",
      "Mikel",
      "Unai",
      "Rubén",
      "Adrián",
      "Nico",
      "Gonzalo",
      "Jon",
      "Íñigo",
      "Hugo",
      "Raúl",
      "Pau",
      "Bryan",
      "Oihan",
    ],
    last: [
      "García",
      "Fernández",
      "López",
      "Martínez",
      "Sánchez",
      "Torres",
      "Romero",
      "Navarro",
      "Vázquez",
      "Ortega",
      "Iglesias",
      "Herrera",
      "Castro",
      "Moreno",
      "Gil",
      "Aguirre",
      "Sancet",
      "Ruiz",
      "Domínguez",
      "Vidal",
    ],
  },
  DE: {
    first: [
      "Jonas",
      "Leon",
      "Niklas",
      "Florian",
      "Jamal",
      "Tim",
      "Kai",
      "Malik",
      "Maximilian",
      "Julian",
      "Benjamin",
      "Robin",
      "Felix",
      "Lukas",
      "Nico",
      "Marius",
      "Pascal",
      "Jan",
      "Paul",
      "Moritz",
    ],
    last: [
      "Müller",
      "Schmidt",
      "Fischer",
      "Weber",
      "Wagner",
      "Becker",
      "Hofmann",
      "Krause",
      "Lehmann",
      "Vogel",
      "Brandt",
      "Roth",
      "Kramer",
      "Beier",
      "Schlotterbeck",
      "Stach",
      "Groß",
      "Anton",
      "Raum",
      "Wirtz",
    ],
  },
  IT: {
    first: [
      "Matteo",
      "Lorenzo",
      "Alessandro",
      "Nicolò",
      "Federico",
      "Davide",
      "Andrea",
      "Giacomo",
      "Riccardo",
      "Samuele",
      "Pietro",
      "Manuel",
      "Marco",
      "Luca",
      "Gianluca",
      "Tommaso",
      "Francesco",
      "Simone",
      "Destiny",
      "Sandro",
    ],
    last: [
      "Rossi",
      "Russo",
      "Esposito",
      "Bianchi",
      "Romano",
      "Colombo",
      "Ricci",
      "Marino",
      "Greco",
      "Bruno",
      "Gatti",
      "Ferrari",
      "Fabbian",
      "Locatelli",
      "Scalvini",
      "Cambiaghi",
      "Pellegrini",
      "Barella",
      "Miretti",
      "Zaniolo",
    ],
  },
  FR: {
    first: [
      "Kylian",
      "Hugo",
      "Lucas",
      "Théo",
      "Adrien",
      "Jules",
      "Maxence",
      "Rayan",
      "Malo",
      "Warren",
      "Bradley",
      "Désiré",
      "Loïc",
      "Nathan",
      "Arnaud",
      "Mathys",
      "Ibrahima",
      "Ousmane",
      "Wesley",
      "Enzo",
    ],
    last: [
      "Dubois",
      "Lefèvre",
      "Moreau",
      "Simon",
      "Laurent",
      "Michel",
      "Garcia",
      "Thomas",
      "Fofana",
      "Diallo",
      "Doué",
      "Kamara",
      "Cherki",
      "Zaïre-Emery",
      "Koné",
      "Badé",
      "Lukeba",
      "Olise",
      "Barcola",
      "Thuram",
    ],
  },
  PT: {
    first: [
      "João",
      "Gonçalo",
      "Diogo",
      "Rúben",
      "Bruno",
      "Pedro",
      "Rafael",
      "Tiago",
      "Vitinha",
      "Nuno",
      "Francisco",
      "André",
      "Renato",
      "Bernardo",
      "Fábio",
      "Tomás",
      "Rodrigo",
      "Gabriel",
      "Ricardo",
      "Geovany",
    ],
    last: [
      "Silva",
      "Santos",
      "Ferreira",
      "Pereira",
      "Oliveira",
      "Costa",
      "Rodrigues",
      "Martins",
      "Carvalho",
      "Neves",
      "Ramos",
      "Trincão",
      "Quenda",
      "Inácio",
      "Veiga",
      "Conceição",
      "Gouveia",
      "Mendes",
      "Vieira",
      "Semedo",
    ],
  },
  NL: {
    first: [
      "Jeremie",
      "Xavi",
      "Ryan",
      "Micky",
      "Tijjani",
      "Quinten",
      "Kenneth",
      "Bart",
      "Joshua",
      "Jorrel",
      "Brian",
      "Lutsharel",
      "Sem",
      "Jan",
      "Wout",
      "Justin",
      "Jurriën",
      "Ian",
      "Matthijs",
      "Nathan",
    ],
    last: [
      "de Jong",
      "van Dijk",
      "Bakker",
      "Visser",
      "Smit",
      "Meijer",
      "Timber",
      "Hato",
      "Frimpong",
      "Simons",
      "Brobbey",
      "Schouten",
      "Geertruida",
      "Kluivert",
      "Maatsen",
      "Weghorst",
      "Gravenberch",
      "Verbruggen",
      "Zirkzee",
      "Taylor",
    ],
  },
  BE: {
    first: [
      "Jérémy",
      "Arthur",
      "Amadou",
      "Leandro",
      "Zeno",
      "Loïs",
      "Dodi",
      "Charles",
      "Johan",
      "Malick",
    ],
    last: [
      "Doku",
      "Theate",
      "Onana",
      "Trossard",
      "Debast",
      "Openda",
      "Lukebakio",
      "De Ketelaere",
      "Bakayoko",
      "Fofana",
    ],
  },
  BR: {
    first: [
      "Gabriel",
      "Lucas",
      "Matheus",
      "Rafael",
      "Bruno",
      "Vinícius",
      "Rodrygo",
      "Endrick",
      "Estêvão",
      "João",
      "Igor",
      "Murillo",
      "Wesley",
      "Savinho",
      "Douglas",
      "Raphael",
      "Éder",
      "Andrey",
      "Danilo",
      "Marquinhos",
    ],
    last: [
      "Silva",
      "Santos",
      "Oliveira",
      "Souza",
      "Pereira",
      "Lima",
      "Carvalho",
      "Ribeiro",
      "Almeida",
      "Nascimento",
      "Araújo",
      "Martinelli",
      "Jesus",
      "Magalhães",
      "Paquetá",
      "Guimarães",
      "Militão",
      "Beraldo",
      "Moscardo",
      "Luiz",
    ],
  },
  AR: {
    first: [
      "Julián",
      "Enzo",
      "Alexis",
      "Lautaro",
      "Nicolás",
      "Facundo",
      "Thiago",
      "Valentín",
      "Franco",
      "Emiliano",
      "Rodrigo",
      "Cristian",
      "Giovani",
      "Alejandro",
      "Nahuel",
      "Lucas",
      "Exequiel",
      "Nehuén",
      "Marcos",
      "Claudio",
    ],
    last: [
      "Álvarez",
      "Fernández",
      "Mac Allister",
      "Martínez",
      "González",
      "Buonanotte",
      "Almada",
      "Carboni",
      "Mastantuono",
      "Echeverri",
      "Paz",
      "Romero",
      "Lo Celso",
      "Garnacho",
      "Molina",
      "Beltrán",
      "Palacios",
      "Pérez",
      "Acuña",
      "Soulé",
    ],
  },
  MA: {
    first: [
      "Achraf",
      "Brahim",
      "Youssef",
      "Sofyan",
      "Noussair",
      "Azzedine",
      "Bilal",
      "Eliesse",
      "Ismael",
      "Amir",
    ],
    last: [
      "Hakimi",
      "Díaz",
      "En-Nesyri",
      "Amrabat",
      "Mazraoui",
      "Ounahi",
      "El Khannouss",
      "Ben Seghir",
      "Saibari",
      "Richardson",
    ],
  },
  SN: {
    first: [
      "Sadio",
      "Nicolas",
      "Ismaïla",
      "Iliman",
      "Pape",
      "Lamine",
      "Habib",
      "Krépin",
      "Idrissa",
      "Moussa",
    ],
    last: [
      "Mané",
      "Jackson",
      "Sarr",
      "Ndiaye",
      "Gueye",
      "Camara",
      "Diallo",
      "Diatta",
      "Diarra",
      "Niakhaté",
    ],
  },
  NG: {
    first: [
      "Victor",
      "Ademola",
      "Samuel",
      "Calvin",
      "Alex",
      "Taiwo",
      "Wilfred",
      "Ola",
      "Bright",
      "Kelechi",
    ],
    last: [
      "Osimhen",
      "Lookman",
      "Chukwueze",
      "Bassey",
      "Iwobi",
      "Awoniyi",
      "Ndidi",
      "Aina",
      "Osayi-Samuel",
      "Iheanacho",
    ],
  },
  DK: {
    first: [
      "Rasmus",
      "Christian",
      "Pierre-Emile",
      "Morten",
      "Joakim",
      "Victor",
      "Andreas",
      "Mikkel",
      "Jesper",
      "Kasper",
    ],
    last: [
      "Højlund",
      "Eriksen",
      "Højbjerg",
      "Hjulmand",
      "Mæhle",
      "Kristiansen",
      "Christensen",
      "Damsgaard",
      "Lindstrøm",
      "Dolberg",
    ],
  },
  NO: {
    first: [
      "Erling",
      "Martin",
      "Antonio",
      "Oscar",
      "Sander",
      "Alexander",
      "Kristian",
      "Fredrik",
      "Jens",
      "Leo",
    ],
    last: [
      "Haaland",
      "Ødegaard",
      "Nusa",
      "Bobb",
      "Berge",
      "Sørloth",
      "Thorstvedt",
      "Aursnes",
      "Hauge",
      "Østigård",
    ],
  },
  HR: {
    first: [
      "Luka",
      "Joško",
      "Mateo",
      "Josip",
      "Marcelo",
      "Lovro",
      "Ivan",
      "Nikola",
      "Petar",
      "Martin",
    ],
    last: [
      "Modrić",
      "Gvardiol",
      "Kovačić",
      "Šutalo",
      "Brozović",
      "Majer",
      "Perišić",
      "Vlašić",
      "Sučić",
      "Baturina",
    ],
  },
  TR: {
    first: ["Arda", "Kenan", "Hakan", "Ferdi", "Barış", "Kerem", "Orkun", "Semih", "Can", "Yusuf"],
    last: [
      "Güler",
      "Yıldız",
      "Çalhanoğlu",
      "Kadıoğlu",
      "Yılmaz",
      "Aktürkoğlu",
      "Kökçü",
      "Kılıçsoy",
      "Uzun",
      "Akçiçek",
    ],
  },
  JP: {
    first: [
      "Takefusa",
      "Kaoru",
      "Wataru",
      "Ritsu",
      "Daichi",
      "Ayase",
      "Hidemasa",
      "Takumi",
      "Koki",
      "Ao",
    ],
    last: [
      "Kubo",
      "Mitoma",
      "Endo",
      "Doan",
      "Kamada",
      "Ueda",
      "Morita",
      "Minamino",
      "Machida",
      "Tanaka",
    ],
  },
  US: {
    first: [
      "Christian",
      "Weston",
      "Tyler",
      "Gio",
      "Folarin",
      "Malik",
      "Yunus",
      "Antonee",
      "Ricardo",
      "Johnny",
    ],
    last: [
      "Pulisic",
      "McKennie",
      "Adams",
      "Reyna",
      "Balogun",
      "Tillman",
      "Musah",
      "Robinson",
      "Pepi",
      "Cardoso",
    ],
  },
  PL: {
    first: [
      "Robert",
      "Piotr",
      "Jakub",
      "Nicola",
      "Sebastian",
      "Kacper",
      "Jan",
      "Bartosz",
      "Karol",
      "Matty",
    ],
    last: [
      "Lewandowski",
      "Zieliński",
      "Kiwior",
      "Zalewski",
      "Szymański",
      "Urbański",
      "Bednarek",
      "Slisz",
      "Świderski",
      "Cash",
    ],
  },
  UA: {
    first: [
      "Oleksandr",
      "Mykhailo",
      "Artem",
      "Illia",
      "Heorhiy",
      "Andriy",
      "Vitaliy",
      "Ruslan",
      "Anatoliy",
      "Yehor",
    ],
    last: [
      "Zinchenko",
      "Mudryk",
      "Dovbyk",
      "Zabarnyi",
      "Sudakov",
      "Lunin",
      "Mykolenko",
      "Malinovskyi",
      "Trubin",
      "Yarmolyuk",
    ],
  },
  EG: {
    first: [
      "Mohamed",
      "Omar",
      "Mostafa",
      "Trézéguet",
      "Ahmed",
      "Mahmoud",
      "Emam",
      "Zizo",
      "Ibrahim",
      "Hamza",
    ],
    last: [
      "Salah",
      "Marmoush",
      "Mohamed",
      "Elneny",
      "Hegazi",
      "Ashour",
      "Adel",
      "Trezeguet",
      "Hassan",
      "Abdelmonem",
    ],
  },
};

const FOREIGN_POOL: Record<string, string[]> = {
  "GB-ENG": ["BR", "AR", "FR", "NL", "PT", "ES", "DK", "NG", "SN", "GB-SCT", "US", "IT", "DE"],
  "GB-SCT": ["GB-ENG", "NL", "DK", "NG", "JP"],
  ES: ["AR", "BR", "FR", "PT", "MA", "UA", "NL", "GB-ENG"],
  DE: ["FR", "NL", "AT", "TR", "JP", "US", "BR", "GB-ENG", "PL", "DK"],
  IT: ["AR", "BR", "FR", "NL", "SN", "NG", "US", "TR", "HR", "PL"],
  FR: ["MA", "SN", "BR", "PT", "AR", "NG", "ES", "DE"],
  PT: ["BR", "AR", "ES", "NG", "MA", "FR"],
  NL: ["BE", "BR", "DE", "MA", "DK", "NO", "JP", "US"],
  BE: ["NL", "FR", "BR", "SN", "NG", "DK"],
  default: ["BR", "AR", "FR", "ES", "NL", "PT", "NG", "SN", "HR", "DK", "NO", "GB-ENG", "DE", "IT"],
};

const SQUAD_SHAPE: [Position, number][] = [
  ["GK", 3],
  ["DF", 8],
  ["MF", 7],
  ["FW", 5],
];

const FORMATIONS = ["4-3-3", "4-2-3-1", "4-4-2", "3-4-3", "3-5-2", "4-1-4-1"];

const COACH_SURNAMES = [
  "Marchetti",
  "Holloway",
  "Steiner",
  "Ortiz",
  "Bergström",
  "Ferreira",
  "Klein",
  "Mendes",
  "Lindqvist",
  "Ruiz",
  "Weber",
  "Rinaldi",
];

// ---------------------------------------------------------------------------
// Build teams and players
// ---------------------------------------------------------------------------
const competitions: Competition[] = competitionsSrc.map((c) => ({ ...c, season: SEASON }));

const teams: Team[] = teamsSrc.teams.map((t) => {
  const [id, name, shortName, code, countryCode, city, stadium, founded, c1, c2, leagueId] = t;
  const competitionIds: string[] = [];
  if (leagueId) competitionIds.push(leagueId);
  for (const cup of ["ucl", "uel"])
    if (teamsSrc.competitions[cup].includes(id)) competitionIds.push(cup);
  return {
    id,
    slug: id,
    name,
    shortName,
    code,
    country: COUNTRY_NAMES[countryCode] ?? countryCode,
    countryCode,
    city,
    stadium,
    founded,
    colors: [c1, c2],
    competitionIds,
    leagueId: leagueId ?? undefined,
    manager: `${pick(["Marco", "Thomas", "Diego", "Unai", "Rúben", "Vincent", "Roberto", "Xabi", "Ange", "Simone"])} ${pick(COACH_SURNAMES)}`,
  };
});

const usedSlugs = new Set<string>();
const players: Player[] = [];
const squads = new Map<string, Player[]>();

for (const team of teams) {
  const squad: Player[] = [];
  const homeCC = NAMES[team.countryCode] ? team.countryCode : "default";
  const foreign = FOREIGN_POOL[team.countryCode] ?? FOREIGN_POOL.default;
  let number = 1;
  const numbers = shuffle(Array.from({ length: 40 }, (_, i) => i + 2));
  for (const [position, count] of SQUAD_SHAPE) {
    for (let i = 0; i < count; i++) {
      const cc = homeCC !== "default" && rand() < 0.55 ? homeCC : pick(foreign);
      const pool = NAMES[cc] ?? NAMES["GB-ENG"];
      const firstName = pick(pool.first);
      const lastName = pick(pool.last);
      const name = `${firstName} ${lastName}`;
      let slug = slugify(name);
      let n = 2;
      while (usedSlugs.has(slug)) slug = `${slugify(name)}-${n++}`;
      usedSlugs.add(slug);
      const shirtNumber = position === "GK" && i === 0 ? 1 : (numbers.pop() ?? number++);
      const year = int(1995, 2007);
      const dob = `${year}-${String(int(1, 12)).padStart(2, "0")}-${String(int(1, 28)).padStart(2, "0")}`;
      const player: Player = {
        id: `p-${slug}`,
        slug,
        name,
        firstName,
        lastName,
        teamId: team.id,
        position,
        shirtNumber,
        nationality: COUNTRY_NAMES[cc] ?? cc,
        nationalityCode: cc,
        dateOfBirth: dob,
        heightCm: position === "GK" ? int(185, 198) : int(168, 194),
        preferredFoot: rand() < 0.72 ? "right" : rand() < 0.9 ? "left" : "both",
      };
      squad.push(player);
      players.push(player);
    }
  }
  squads.set(team.id, squad);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const anchor = new Date(`${ANCHOR}T00:00:00Z`);
const dayAt = (offsetDays: number, hh: number, mm = 0): string => {
  const d = new Date(anchor.getTime() + offsetDays * 86_400_000);
  d.setUTCHours(hh, mm, 0, 0);
  return d.toISOString();
};
// ANCHOR is a Tuesday. Weekend offsets relative to it: Sat = -3, Sun = -2, Fri = -4, Mon = -1.

/** Round-robin (circle method), double round with reversed venues. */
function roundRobin(ids: string[]): [string, string][][] {
  const n = ids.length;
  const arr = [...ids];
  const rounds: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    arr.splice(1, 0, arr.pop() as string);
  }
  const second = rounds.map((pairs) => pairs.map(([h, a]) => [a, h] as [string, string]));
  return [...rounds, ...shuffle(second)];
}

/** Swiss-style league phase: each team plays 8 different opponents, 4 home 4 away. */
function swissPhase(ids: string[]): [string, string][][] {
  for (let attempt = 0; attempt < 200; attempt++) {
    const remaining = new Map(ids.map((id) => [id, 8]));
    const home = new Map(ids.map((id) => [id, 4]));
    const played = new Set<string>();
    const rounds: [string, string][][] = [];
    let ok = true;
    for (let r = 0; r < 8 && ok; r++) {
      const free = shuffle(ids.filter((id) => (remaining.get(id) ?? 0) > 0));
      const pairs: [string, string][] = [];
      const used = new Set<string>();
      for (const a of free) {
        if (used.has(a)) continue;
        const b = free.find(
          (x) => x !== a && !used.has(x) && !played.has(`${a}|${x}`) && !played.has(`${x}|${a}`),
        );
        if (!b) {
          ok = false;
          break;
        }
        used.add(a);
        used.add(b);
        played.add(`${a}|${b}`);
        const aHome = (home.get(a) ?? 0) > 0 && ((home.get(b) ?? 0) === 0 || rand() < 0.5);
        const [h, w] = aHome ? [a, b] : [b, a];
        home.set(h, (home.get(h) ?? 0) - 1);
        remaining.set(a, (remaining.get(a) ?? 0) - 1);
        remaining.set(b, (remaining.get(b) ?? 0) - 1);
        pairs.push([h, w]);
      }
      if (ok && pairs.length !== ids.length / 2) ok = false;
      rounds.push(pairs);
    }
    if (ok) return rounds;
  }
  throw new Error("could not build a Swiss phase");
}

const LEAGUE_SLOTS: [number, number, number][][] = [
  // weekend pattern A: [dayOffsetFromSaturday, hh, mm]
  [
    [-1, 19, 0],
    [0, 11, 30],
    [0, 14, 0],
    [0, 14, 0],
    [0, 14, 0],
    [0, 14, 0],
    [0, 16, 30],
    [1, 13, 0],
    [1, 15, 0],
    [1, 16, 30],
  ],
  // pattern B
  [
    [0, 12, 30],
    [0, 14, 0],
    [0, 14, 0],
    [0, 14, 0],
    [0, 16, 30],
    [0, 19, 0],
    [1, 12, 0],
    [1, 14, 0],
    [1, 16, 30],
    [2, 19, 0],
  ],
];

let matchSeq = 0;
const matches: DemoMatch[] = [];

function expectedGoals(homeId: string, awayId: string): [number, number] {
  const rh = RATINGS[homeId] ?? 68;
  const ra = RATINGS[awayId] ?? 68;
  const diff = (rh - ra) / 10;
  const home = Math.max(0.35, 1.45 + diff * 0.35);
  const away = Math.max(0.3, 1.1 - diff * 0.3);
  return [home, away];
}

function chooseScorer(squad: Player[], starting: Player[]): Player {
  const r = rand();
  const pool = starting.filter((p) =>
    r < 0.52 ? p.position === "FW" : r < 0.9 ? p.position === "MF" : p.position === "DF",
  );
  return pick(pool.length ? pool : starting.filter((p) => p.position !== "GK"));
}

function buildLineup(teamId: string): { lineup: DemoLineup; starting: Player[]; bench: Player[] } {
  const squad = squads.get(teamId)!;
  const formation = pick(FORMATIONS);
  const lines = formation.split("-").map(Number); // e.g. [4,3,3]
  const defenders = lines[0];
  const forwards = lines[lines.length - 1];
  const midfielders = 10 - defenders - forwards;
  const byPos = (p: Position) => shuffle(squad.filter((x) => x.position === p));
  const gk = byPos("GK").slice(0, 1);
  const df = byPos("DF");
  const mf = byPos("MF");
  const fw = byPos("FW");
  const starting = [
    ...gk,
    ...df.slice(0, defenders),
    ...mf.slice(0, midfielders),
    ...fw.slice(0, forwards),
  ];
  // fill gaps if a line asks for more than the squad has in that position
  const startingIds = new Set(starting.map((p) => p.id));
  const rest = shuffle(squad.filter((p) => !startingIds.has(p.id)));
  while (starting.length < 11 && rest.length) starting.push(rest.shift()!);
  const bench = [
    ...squad.filter((p) => p.position === "GK" && !startingIds.has(p.id)).slice(0, 1),
    ...rest.filter((p) => p.position !== "GK").slice(0, 8),
  ];
  return {
    lineup: {
      formation,
      starting: starting.map((p) => p.id),
      bench: bench.map((p) => p.id),
      captain: pick(starting.filter((p) => p.position !== "GK")).id,
    },
    starting,
    bench,
  };
}

function simulate(m: DemoMatch) {
  const [lh, la] = expectedGoals(m.homeTeamId, m.awayTeamId);
  const gh = poisson(lh);
  const ga = poisson(la);
  const homeLineup = buildLineup(m.homeTeamId);
  const awayLineup = buildLineup(m.awayTeamId);
  const events: DemoEvent[] = [];
  const minuteSet = new Set<number>();
  const uniqueMinute = () => {
    let min = int(1, 90);
    while (minuteSet.has(min)) min = int(1, 90);
    minuteSet.add(min);
    return min;
  };
  const addGoals = (count: number, side: 0 | 1, lineup: typeof homeLineup, squad: Player[]) => {
    for (let i = 0; i < count; i++) {
      const minute = uniqueMinute();
      const r = rand();
      const type = r < 0.08 ? "penalty" : r < 0.11 ? "own_goal" : "goal";
      const scorer =
        type === "own_goal"
          ? pick((side === 0 ? awayLineup : homeLineup).starting.filter((p) => p.position !== "GK"))
          : chooseScorer(squad, lineup.starting);
      const assist =
        type === "goal" && rand() < 0.7
          ? pick(lineup.starting.filter((p) => p.id !== scorer.id && p.position !== "GK")).id
          : null;
      events.push([
        minute,
        minute === 45 || minute === 90 ? int(0, 4) : 0,
        side,
        type,
        scorer.id,
        assist,
      ]);
    }
  };
  addGoals(gh, 0, homeLineup, squads.get(m.homeTeamId)!);
  addGoals(ga, 1, awayLineup, squads.get(m.awayTeamId)!);
  // cards
  const cards = int(1, 5);
  for (let i = 0; i < cards; i++) {
    const side = rand() < 0.5 ? 0 : 1;
    const lu = side === 0 ? homeLineup : awayLineup;
    events.push([uniqueMinute(), 0, side, "yellow", pick(lu.starting).id, null]);
  }
  if (rand() < 0.07) {
    const side = rand() < 0.5 ? 0 : 1;
    const lu = side === 0 ? homeLineup : awayLineup;
    events.push([
      int(55, 88),
      0,
      side,
      "red",
      pick(lu.starting.filter((p) => p.position !== "GK")).id,
      null,
    ]);
  }
  // substitutions
  for (const [side, lu] of [
    [0, homeLineup],
    [1, awayLineup],
  ] as const) {
    const n = int(3, 5);
    const outs = shuffle(lu.starting.filter((p) => p.position !== "GK")).slice(0, n);
    const ins = shuffle(lu.bench.filter((p) => p.position !== "GK")).slice(0, n);
    for (let i = 0; i < Math.min(outs.length, ins.length); i++) {
      events.push([int(58, 88), 0, side, "substitution", outs[i].id, ins[i].id]);
    }
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const ht: [number, number] = [
    events.filter((e) => e[2] === 0 && isGoal(e[3]) && e[0] <= 45).length,
    events.filter((e) => e[2] === 1 && isGoal(e[3]) && e[0] <= 45).length,
  ];
  m.result = { ft: [gh, ga], ht };
  m.events = events;
  m.lineups = { home: homeLineup.lineup, away: awayLineup.lineup };
  m.attendance = int(18_000, 75_000);
}
const isGoal = (t: string) => t === "goal" || t === "penalty" || t === "own_goal";

function addMatch(partial: Omit<DemoMatch, "id">): DemoMatch {
  const m: DemoMatch = { id: `m${(++matchSeq).toString(36)}`, ...partial };
  matches.push(m);
  return m;
}

// Domestic leagues: ~10 rounds played, next round this coming weekend.
const PLAYED_ROUNDS = 10;
for (const comp of competitions.filter((c) => c.kind === "league")) {
  const ids = teams.filter((t) => t.leagueId === comp.id).map((t) => t.id);
  const rounds = roundRobin(ids);
  const firstSaturdayOffset = -3 - (PLAYED_ROUNDS - 1) * 7; // round 1 Saturday
  rounds.forEach((pairs, idx) => {
    const round = idx + 1;
    // winter break: skip two weekends around round 18
    const extraWeeks = round > 18 ? 2 : 0;
    const satOffset = firstSaturdayOffset + (idx + extraWeeks) * 7;
    const slots = shuffle(LEAGUE_SLOTS[idx % 2]);
    shuffle(pairs).forEach(([h, a], i) => {
      const [d, hh, mm] = slots[i % slots.length];
      const stadium = teams.find((t) => t.id === h)!.stadium;
      addMatch({
        competitionId: comp.id,
        round,
        kickoff: dayAt(satOffset + d, hh, mm),
        homeTeamId: h,
        awayTeamId: a,
        venue: stadium,
      });
    });
  });
}

// UEFA competitions: matchday 1 & 2 played, matchday 3 is this week (UCL Tue/Wed, UEL Thu).
const UEFA_MD_OFFSETS = [-28, -14, 0, 21, 49, 77, 105, 119]; // relative to anchor Tuesday
for (const comp of competitions.filter((c) => c.kind === "cup")) {
  const ids = teamsSrc.competitions[comp.id];
  const rounds = swissPhase(ids);
  rounds.forEach((pairs, idx) => {
    const base = UEFA_MD_OFFSETS[idx];
    const ordered = shuffle(pairs);
    ordered.forEach(([h, a], i) => {
      let day: number;
      let hh: number;
      let mm: number;
      if (comp.id === "ucl") {
        // Two matchday days; spread today's fixtures across the day so the demo has
        // something live at almost any hour.
        if (idx === 2 && i < 9) {
          day = 0;
          [hh, mm] = [
            [10, 0],
            [12, 0],
            [14, 0],
            [16, 0],
            [17, 45],
            [19, 0],
            [20, 0],
            [21, 0],
            [22, 0],
          ][i] as [number, number];
        } else {
          day = i < 9 ? 0 : 1;
          [hh, mm] = i % 9 < 2 ? [16, 45] : [19, 0];
        }
      } else {
        day = 2; // Thursday
        [hh, mm] = i < 9 ? [16, 45] : [19, 0];
      }
      addMatch({
        competitionId: comp.id,
        round: idx + 1,
        stage: "League phase",
        kickoff: dayAt(base + day, hh, mm),
        homeTeamId: h,
        awayTeamId: a,
        venue: teams.find((t) => t.id === h)!.stadium,
      });
    });
  });
}

// Simulate everything that kicks off on or before the anchor day.
const anchorEnd = new Date(`${ANCHOR}T23:59:59Z`).getTime();
for (const m of matches) if (new Date(m.kickoff).getTime() <= anchorEnd) simulate(m);

matches.sort((a, b) => a.kickoff.localeCompare(b.kickoff));

const dataset: DemoDataset = {
  version: 1,
  generatedAt: new Date().toISOString(),
  anchorDate: ANCHOR,
  season: SEASON,
  competitions,
  teams,
  players,
  matches,
};

const out = path.join(root, "data/demo/dataset.json");
fs.writeFileSync(out, JSON.stringify(dataset));
const played = matches.filter((m) => m.result).length;
console.log(
  `wrote ${path.relative(root, out)} — ${teams.length} teams, ${players.length} players, ${matches.length} matches (${played} played), ${(fs.statSync(out).size / 1024 / 1024).toFixed(2)} MB`,
);
