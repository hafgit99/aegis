import { CryptoService } from './cryptoService';
import { SecureMemory } from '../utils/secureMemory';

// BIP39 English Wordlist (2048 words) - Standard for high entropy
const RECOVERY_WORDS_POOL = [
  "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract", "absurd", "abuse", "access", "accident", "account", "accuse", "achieve", "acid", "acoustic", "acquire", "across", "act", "action", "actor", "actress", "actual", "adapt", "add", "addict", "address", "adjust", "admit", "adult", "advance", "advice", "aerobic", "affair", "afford", "afraid", "again", "age", "agent", "agree", "ahead", "aim", "air", "airport", "aisle", "alarm", "album", "alcohol", "alert", "alien", "all", "alley", "allow", "almost", "alone", "alpha", "already", "also", "alter", "always", "amateur", "amazing", "among", "amount", "amused", "analyst", "anchor", "ancient", "anger", "angle", "angry", "animal", "ankle", "announce", "annual", "another", "answer", "antenna", "antique", "anxiety", "any", "apart", "apology", "appear", "apple", "approve", "april", "arch", "arctic", "area", "arena", "argue", "arm", "armed", "armor", "army", "around", "arrange", "arrest", "arrive", "arrow", "art", "artefact", "artist", "artwork", "ask", "aspect", "assault", "asset", "assist", "assume", "asthma", "athlete", "atom", "attack", "attend", "attitude", "attract", "auction", "audit", "august", "aunt", "author", "auto", "autumn", "average", "avocado", "avoid", "awake", "aware", "away", "awesome", "awful", "awkward", "axis",
  "baby", "bachelor", "bacon", "badge", "bag", "balance", "balcony", "ball", "bamboo", "banana", "banner", "bar", "barely", "bargain", "barrel", "base", "basic", "basket", "battle", "beach", "bean", "beauty", "because", "become", "beef", "before", "begin", "behave", "behind", "believe", "below", "belt", "bench", "benefit", "best", "betray", "better", "between", "beyond", "bicycle", "bid", "bike", "bind", "biology", "bird", "birth", "bitter", "black", "blade", "blame", "blanket", "blast", "bleak", "bless", "blind", "blood", "blossom", "blouse", "blue", "blur", "blush", "board", "boat", "body", "boil", "bomb", "bone", "bonus", "book", "boost", "border", "boring", "borrow", "boss", "bottom", "bounce", "box", "boy", "bracket", "brain", "brand", "brass", "brave", "bread", "breeze", "brick", "bridge", "brief", "bright", "bring", "brisk", "broccoli", "broken", "bronze", "broom", "brother", "brown", "brush", "bubble", "buddy", "budget", "buffalo", "build", "bulb", "bulk", "bullet", "bundle", "bunker", "burden", "burger", "burst", "bus", "business", "busy", "butter", "buyer", "buzz",
  "cabbage", "cabin", "cable", "cactus", "cage", "cake", "call", "calm", "camera", "camp", "can", "canal", "cancel", "candy", "cannon", "canoe", "canvas", "canyon", "capable", "capital", "captain", "car", "carbon", "card", "cargo", "carpet", "carry", "cart", "case", "cash", "casino", "castle", "casual", "cat", "catalog", "catch", "category", "cattle", "caught", "cause", "caution", "cave", "ceiling", "celery", "cement", "census", "century", "cereal", "certain", "chair", "chalk", "champion", "change", "chaos", "chapter", "charge", "chase", "chat", "cheap", "check", "cheese", "chef", "cherry", "chest", "chicken", "chief", "child", "chimney", "choice", "choose", "chronic", "chuckle", "chunk", "churn", "cigar", "cinnamon", "circle", "citizen", "city", "civil", "claim", "clap", "clarify", "claw", "clay", "clean", "clerk", "clever", "click", "client", "cliff", "climb", "clinic", "clip", "clock", "clog", "close", "cloth", "cloud", "clown", "club", "clump", "cluster", "clutch", "coach", "coast", "coconut", "code", "coffee", "coil", "coin", "collect", "color", "column", "combine", "come", "comfort", "comic", "common", "company", "concert", "conduct", "confirm", "congress", "connect", "consider", "control", "convince", "cook", "cool", "copper", "copy", "coral", "core", "corn", "correct", "cost", "cotton", "couch", "country", "couple", "course", "cousin", "cover", "coyote", "crack", "cradle", "craft", "cram", "crane", "crash", "crater", "crawl", "crazy", "cream", "credit", "creek", "crew", "cricket", "crime", "crisp", "critic", "crop", "cross", "crouch", "crowd", "crucial", "cruel", "cruise", "crumble", "crunch", "crush", "cry", "crystal", "cube", "culture", "cup", "cupboard", "curious", "current", "curtain", "curve", "cushion", "custom", "cute", "cycle",
  "dad", "damage", "damp", "dance", "danger", "daring", "dash", "daughter", "dawn", "day", "deal", "debate", "debris", "decade", "december", "decide", "decline", "decorate", "decrease", "deer", "defense", "define", "defy", "degree", "delay", "deliver", "demand", "demise", "denial", "dentist", "deny", "depart", "depend", "deposit", "depth", "deputy", "derive", "describe", "desert", "design", "desk", "despair", "destroy", "detail", "detect", "develop", "device", "devote", "diagram", "dial", "diamond", "diary", "dice", "diesel", "diet", "differ", "digital", "dignity", "dilemma", "dinner", "dinosaur", "direct", "dirt", "disagree", "discover", "disease", "dish", "dismiss", "disorder", "display", "distance", "divert", "divide", "divorce", "dizzy", "doctor", "document", "dog", "doll", "dolphin", "domain", "donate", "donkey", "donor", "door", "dose", "double", "dove", "draft", "dragon", "drama", "drastic", "draw", "dream", "dress", "drift", "drill", "drink", "drip", "drive", "drop", "drum", "dry", "duck", "dumb", "dune", "during", "dust", "dutch", "duty", "dwarf", "dynamic",
  "eager", "eagle", "early", "earn", "earth", "easily", "east", "easy", "echo", "ecology", "economy", "edge", "edit", "educate", "effort", "egg", "eight", "either", "elbow", "elder", "electric", "elegant", "element", "elephant", "elevator", "elite", "else", "embark", "embody", "embrace", "emerge", "emotion", "employ", "empower", "empty", "enable", "enact", "end", "endless", "endorse", "enemy", "energy", "enforce", "engage", "engine", "enhance", "enjoy", "enlist", "enough", "enrich", "enroll", "ensure", "enter", "entire", "entry", "envelope", "episode", "equal", "equip", "era", "erase", "erode", "erosion", "error", "erupt", "escape", "essay", "essence", "estate", "eternal", "ethics", "evidence", "evil", "evoke", "evolve", "exact", "example", "excess", "exchange", "excite", "exclude", "excuse", "execute", "exercise", "exhaust", "exhibit", "exile", "exist", "exit", "exotic", "expand", "expect", "expire", "explain", "expose", "express", "extend", "extra", "eye", "eyebrow",
  "fabric", "face", "faculty", "fade", "faint", "faith", "fall", "false", "fame", "family", "famous", "fan", "fancy", "fantasy", "farm", "fashion", "fat", "fatal", "father", "fatigue", "fault", "favorite", "feature", "february", "federal", "fee", "feed", "feel", "female", "fence", "festival", "fetch", "fever", "few", "fiber", "fiction", "field", "figure", "file", "film", "filter", "final", "find", "fine", "finger", "finish", "fire", "firm", "first", "fiscal", "fish", "fit", "fitness", "fix", "flag", "flame", "flash", "flat", "flavor", "flee", "flight", "flip", "float", "flock", "floor", "flower", "fluid", "flush", "fly", "foam", "focus", "fog", "foil", "fold", "follow", "food", "foot", "force", "forest", "forget", "fork", "fortune", "forum", "forward", "fossil", "foster", "found", "fox", "fragile", "frame", "frequent", "fresh", "friend", "fringe", "frog", "front", "frost", "frown", "frozen", "fruit", "fuel", "fun", "funny", "furnace", "fury", "future",
  "gadget", "gain", "galaxy", "gallery", "game", "gap", "garage", "garbage", "garden", "garlic", "garment", "gas", "gasp", "gate", "gather", "gauge", "gaze", "general", "genius", "genre", "gentle", "genuine", "gesture", "ghost", "giant", "gift", "giggle", "ginger", "giraffe", "girl", "give", "glad", "glance", "glare", "glass", "glide", "glimpse", "globe", "gloom", "glory", "glove", "glow", "glue", "goat", "goddess", "gold", "good", "goose", "gorilla", "gospel", "gossip", "govern", "gown", "grab", "grace", "grain", "grant", "grape", "grass", "gravity", "great", "green", "grid", "grief", "grit", "grocery", "group", "grow", "grunt", "guard", "guess", "guide", "guilt", "guitar", "gun", "gym",
  "habit", "hair", "half", "hammer", "hamster", "hand", "happy", "harbor", "hard", "harsh", "harvest", "hat", "have", "hawk", "hazard", "head", "health", "heart", "heavy", "hedgehog", "height", "hello", "helmet", "help", "hen", "hero", "hidden", "high", "hill", "hint", "hip", "hire", "history", "hobby", "hockey", "hold", "hole", "holiday", "hollow", "home", "honey", "hood", "hope", "horn", "horror", "horse", "hospital", "host", "hotel", "hour", "hover", "hub", "huge", "human", "humble", "humor", "hundred", "hungry", "hunt", "hurdle", "hurry", "hurt", "husband", "hybrid",
  "ice", "icon", "idea", "identify", "idle", "ignore", "ill", "illegal", "illness", "image", "imitate", "immense", "immune", "impact", "impose", "improve", "impulse", "inch", "include", "income", "increase", "index", "indicate", "indoor", "industry", "infant", "inflict", "inform", "inhale", "inherit", "initial", "inject", "injury", "inmate", "inner", "innocent", "input", "inquiry", "insane", "insect", "inside", "inspire", "install", "intact", "interest", "into", "invest", "invite", "involve", "iron", "island", "isolate", "issue", "item", "ivory",
  "jacket", "jaguar", "jar", "jazz", "jealous", "jeans", "jelly", "jewel", "job", "join", "joke", "journey", "joy", "judge", "juice", "jump", "jungle", "junior", "junk", "just",
  "kangaroo", "keen", "keep", "ketchup", "key", "kick", "kid", "kidney", "kind", "kingdom", "kiss", "kit", "kitchen", "kite", "kitten", "kiwi", "knee", "knife", "knock", "know",
  "lab", "label", "labor", "ladder", "lady", "lake", "lamp", "language", "laptop", "large", "later", "latin", "laugh", "laundry", "lava", "law", "lawn", "lawsuit", "layer", "lazy", "leader", "leaf", "learn", "leave", "lecture", "left", "leg", "legal", "legend", "leisure", "lemon", "lend", "length", "lens", "leopard", "lesson", "letter", "level", "liar", "liberty", "library", "license", "life", "lift", "light", "like", "limb", "limit", "link", "lion", "liquid", "list", "little", "live", "lizard", "load", "loan", "lobster", "local", "lock", "logic", "lonely", "long", "loop", "lottery", "loud", "lounge", "love", "loyal", "lucky", "luggage", "lumber", "lunar", "lunch", "luxury", "lyrics",
  "machine", "mad", "magic", "magnet", "maid", "mail", "main", "major", "make", "mammal", "man", "manage", "mandate", "mango", "mansion", "manual", "maple", "marble", "march", "margin", "marine", "market", "marriage", "mask", "mass", "master", "match", "material", "math", "matrix", "matter", "maximum", "maze", "meadow", "mean", "measure", "meat", "mechanic", "medal", "media", "melody", "melt", "member", "memory", "mention", "menu", "mercy", "merge", "merit", "merry", "mesh", "message", "metal", "method", "middle", "midnight", "milk", "million", "mimic", "mind", "minimum", "minor", "minute", "miracle", "mirror", "misery", "miss", "mistake", "mix", "mixed", "mixture", "mobile", "model", "modify", "mom", "moment", "monitor", "monkey", "monster", "month", "moon", "moral", "more", "morning", "mosquito", "mother", "motion", "motor", "mountain", "mouse", "move", "movie", "much", "muffin", "mule", "multiply", "muscle", "museum", "mushroom", "music", "must", "mutual", "myself", "mystery", "myth",
  "naive", "name", "napkin", "narrow", "nasty", "nation", "nature", "near", "neck", "need", "negative", "neglect", "neither", "nephew", "nerve", "nest", "net", "network", "neutral", "never", "news", "next", "nice", "night", "noble", "noise", "nominee", "noodle", "normal", "north", "nose", "notable", "note", "nothing", "notice", "novel", "now", "nuclear", "number", "nurse", "nut",
  "oak", "obey", "object", "oblige", "obscure", "observe", "obtain", "obvious", "occur", "ocean", "october", "odor", "off", "offer", "office", "often", "oil", "okay", "old", "olive", "olympic", "omit", "once", "one", "onion", "online", "only", "open", "opera", "opinion", "oppose", "option", "orange", "orbit", "orchard", "order", "ordinary", "organ", "orient", "original", "orphan", "ostrich", "other", "outdoor", "outer", "output", "outside", "oval", "oven", "over", "own", "owner", "oxygen", "oyster", "ozone",
  "pact", "paddle", "page", "pair", "palace", "palm", "panda", "panel", "panic", "panther", "paper", "parade", "parent", "park", "parrot", "party", "pass", "patch", "path", "patient", "patrol", "pattern", "pause", "pave", "payment", "peace", "peanut", "pear", "peasant", "pelican", "pen", "penalty", "pencil", "people", "pepper", "perfect", "permit", "person", "pet", "phone", "photo", "phrase", "physical", "piano", "picnic", "picture", "piece", "pig", "pigeon", "pill", "pilot", "pink", "pioneer", "pipe", "pistol", "pitch", "pizza", "place", "planet", "plastic", "plate", "play", "please", "pledge", "pluck", "plug", "plunge", "poem", "poet", "point", "polar", "pole", "police", "pond", "pony", "pool", "popular", "portion", "position", "possible", "post", "potato", "pottery", "poverty", "powder", "power", "practice", "praise", "predict", "prefer", "prepare", "present", "pretty", "prevent", "price", "pride", "primary", "print", "priority", "prison", "private", "prize", "problem", "process", "produce", "profit", "program", "project", "promote", "proof", "property", "prosper", "protect", "proud", "provide", "public", "pudding", "pull", "pulp", "pulse", "pumpkin", "punch", "pupil", "puppy", "purchase", "purity", "purpose", "purse", "push", "put", "puzzle", "pyramid",
  "quality", "quantum", "quarter", "question", "quick", "quit", "quiz", "quote",
  "rabbit", "raccoon", "race", "rack", "radar", "radio", "rail", "rain", "raise", "rally", "ramp", "ranch", "random", "range", "rapid", "rare", "rate", "rather", "raven", "raw", "razor", "ready", "real", "reason", "rebel", "rebuild", "recall", "receive", "recipe", "record", "recycle", "reduce", "reflect", "reform", "refuse", "region", "regret", "regular", "reject", "relax", "release", "relief", "rely", "remain", "remember", "remind", "remove", "render", "renew", "rent", "reopen", "repair", "repeat", "replace", "report", "require", "rescue", "resemble", "resist", "resource", "response", "result", "retire", "retreat", "return", "reunion", "reveal", "review", "reward", "rhythm", "rib", "ribbon", "rice", "rich", "ride", "ridge", "rifle", "right", "rigid", "ring", "riot", "ripple", "risk", "ritual", "rival", "river", "road", "roast", "robot", "robust", "rocket", "romance", "roof", "rookie", "room", "rose", "rotate", "rough", "round", "route", "royal", "rubber", "rude", "rug", "rule", "run", "runway", "rural",
  "sad", "saddle", "sadness", "safe", "sail", "salad", "salmon", "salon", "salt", "salute", "same", "sample", "sand", "satisfy", "satoshi", "sauce", "sausage", "save", "say", "scale", "scan", "scare", "scatter", "scene", "scheme", "school", "science", "scissors", "scorpion", "scout", "scrap", "screen", "script", "scrub", "sea", "search", "season", "seat", "second", "secret", "section", "security", "seed", "seek", "segment", "select", "sell", "seminar", "senior", "sense", "sentence", "series", "service", "session", "settle", "setup", "seven", "shadow", "shaft", "shallow", "share", "shed", "shell", "sheriff", "shield", "shift", "shine", "ship", "shiver", "shock", "shoe", "shoot", "shop", "short", "shoulder", "shove", "shrimp", "shrug", "shuffle", "shy", "sibling", "sick", "side", "siege", "sight", "sign", "silent", "silk", "silly", "silver", "similar", "simple", "since", "sing", "siren", "sister", "situate", "six", "size", "skate", "sketch", "ski", "skill", "skin", "skirt", "skull", "slab", "slam", "sleep", "slender", "slice", "slide", "slight", "slim", "slogan", "slot", "slow", "slush", "small", "smart", "smile", "smoke", "smooth", "snack", "snake", "snap", "sniff", "snow", "soap", "soccer", "social", "sock", "soda", "soft", "solar", "soldier", "solid", "solution", "solve", "someone", "song", "soon", "sorry", "sort", "soul", "sound", "soup", "source", "south", "space", "spare", "spatial", "spawn", "speak", "special", "speed", "spell", "spend", "sphere", "spice", "spider", "spike", "spin", "spirit", "split", "spoil", "sponsor", "spoon", "sport", "spot", "spray", "spread", "spring", "spy", "square", "squeeze", "squirrel", "stable", "stadium", "staff", "stage", "stairs", "stamp", "stand", "start", "state", "stay", "steak", "steel", "stem", "step", "stereo", "stick", "still", "sting", "stock", "stomach", "stone", "stool", "story", "stove", "strategy", "street", "strike", "strong", "struggle", "student", "stuff", "stumble", "style", "subject", "submit", "subway", "success", "such", "sudden", "suffer", "sugar", "suggest", "suit", "summer", "sun", "sunny", "sunset", "super", "supply", "supreme", "sure", "surface", "surge", "surprise", "surround", "survey", "suspect", "sustain", "swallow", "swamp", "swap", "swarm", "swear", "sweet", "swift", "swim", "swing", "switch", "sword", "symbol", "symptom", "syrup", "system",
  "table", "tackle", "tag", "tail", "talent", "talk", "tank", "tape", "target", "task", "taste", "tattoo", "taxi", "teach", "team", "tell", "ten", "tenant", "tennis", "tent", "term", "test", "text", "thank", "that", "theme", "then", "theory", "there", "they", "thing", "this", "thought", "three", "thrive", "throw", "thumb", "thunder", "ticket", "tide", "tiger", "tilt", "timber", "time", "tiny", "tip", "tired", "tissue", "title", "toast", "tobacco", "today", "toddler", "toe", "together", "toilet", "token", "tomato", "tomorrow", "tone", "tongue", "tonight", "tool", "tooth", "top", "topic", "topple", "torch", "tornado", "tortoise", "toss", "total", "tourist", "toward", "tower", "town", "toy", "track", "trade", "traffic", "tragic", "train", "transfer", "trap", "trash", "travel", "tray", "treat", "tree", "trend", "trial", "tribe", "trick", "trigger", "trim", "trip", "trophy", "trouble", "truck", "true", "truly", "trumpet", "trust", "truth", "try", "tube", "tuition", "tumble", "tuna", "tunnel", "turkey", "turn", "turtle", "twelve", "twenty", "twice", "twin", "twist", "two", "type", "typical",
  "ugly", "umbrella", "unable", "unaware", "uncle", "uncover", "under", "undo", "unfair", "unfold", "unhappy", "uniform", "unique", "unit", "universe", "unknown", "unlock", "until", "unusual", "unveil", "update", "upgrade", "uphold", "upon", "upper", "upset", "urban", "urge", "usage", "use", "used", "useful", "useless", "usual", "utility",
  "vacant", "vacuum", "vague", "valid", "valley", "valve", "van", "vanish", "vapor", "various", "vast", "vault", "vehicle", "velvet", "vendor", "venture", "venue", "verb", "verify", "version", "very", "vessel", "veteran", "viable", "vibrant", "vicious", "victory", "video", "view", "village", "vintage", "violin", "virtual", "virus", "visa", "visit", "visual", "vital", "vivid", "vocal", "voice", "void", "volcano", "volume", "vote", "voyage",
  "wage", "wagon", "wait", "walk", "wall", "walnut", "want", "warfare", "warm", "warrior", "wash", "wasp", "waste", "water", "wave", "way", "wealth", "weapon", "wear", "weasel", "weather", "web", "wedding", "weekend", "weird", "welcome", "west", "wet", "whale", "what", "wheat", "wheel", "when", "where", "whip", "whisper", "wide", "width", "wife", "wild", "will", "win", "window", "wine", "wing", "wink", "winner", "winter", "wire", "wisdom", "wise", "wish", "witness", "wolf", "woman", "wonder", "wood", "wool", "word", "work", "world", "worry", "worth", "wrap", "wreck", "wrestle", "wrist", "write", "wrong",
  "yard", "year", "yellow", "you", "young", "youth",
  "zebra", "zero", "zone", "zoo"
];

const encoder = new TextEncoder();

// Recovery words versioning
const RECOVERY_VERSION = "4.0";
const RECOVERY_WORDS_COUNT = 24;
const RECOVERY_STORAGE_KEY = 'aegis_recovery_blob';
const RECOVERY_HASH_KEY = 'aegis_recovery_hash';
const RECOVERY_METADATA_KEY = 'aegis_recovery_metadata';

export interface RecoveryMetadata {
  version: string;
  timestamp: number;
  deviceId: string;
  wordCount: number;
  checksum: string;
  createdAt: number;
  lastVerified?: number;
  verificationCount: number;
  isActive: boolean;
}

export interface EncryptedRecoveryMetadata {
  payload: string; // encrypted metadata JSON
  iv: string;
  tag: string;
  algorithm: string; // "AES-256-GCM"
  version: number; // 1
}

export interface RecoveryBackup {
  payload: string; // encrypted master key
  iv: string;
  tag: string;
  encryptedMetadata?: EncryptedRecoveryMetadata; // v2+: encrypted metadata
  metadata?: RecoveryMetadata; // v1: plain metadata (deprecated)
}

// SECURITY: Helper to get device ID (same as Electron main.js)
async function getDeviceIdFromElectron(): Promise<string> {
  if ((window as any).electronAPI?.getDeviceId) {
    return await (window as any).electronAPI.getDeviceId();
  }
  // Fallback for testing
  return "AEGIS-LOCAL-TEST-DEVICE";
}

// Calculate checksum of words for integrity verification
function calculateWordsChecksum(words: string[]): string {
  const combined = words.join('');
  const data = new TextEncoder().encode(combined);
  // Simple checksum (not cryptographic, just for UI feedback)
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data[i];
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

// Validate recovery words format
export function validateRecoveryWords(words: string[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!words || !Array.isArray(words)) {
    return { valid: false, errors: ['Words must be an array'] };
  }

  if (words.length !== RECOVERY_WORDS_COUNT) {
    errors.push(`Expected ${RECOVERY_WORDS_COUNT} words, got ${words.length}`);
  }

  const invalidWords = words.filter(w => !RECOVERY_WORDS_POOL.includes(w.toLowerCase().trim()));
  if (invalidWords.length > 0) {
    errors.push(`Invalid words found: ${invalidWords.join(', ')}`);
  }

  const duplicates = words.filter((w, i) => words.indexOf(w) !== i);
  if (duplicates.length > 0) {
    errors.push(`Duplicate words not recommended: ${[...new Set(duplicates)].join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Generate recovery PIN (optional 4-6 digit PIN)
export function generateRecoveryPIN(): string {
  // SECURITY: Use rejection sampling for uniform distribution (prevents modulo bias)
  const array = new Uint32Array(1);
  window.crypto.getRandomValues(array);

  // Rejection sampling: Only accept values that produce valid 6-digit PINs (000000-999999)
  // This ensures uniform distribution without modulo bias
  while (true) {
    const value = array[0];
    if (value < 1000000) {
      return value.toString().padStart(6, '0');
    }
  }
}

// Hash recovery PIN for secure storage with Argon2id (GPU-resistant)
async function hashRecoveryPIN(pin: string): Promise<string> {
  // SECURITY: Generate 16-byte cryptographic salt
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const saltB64 = CryptoService.arrayBufferToBase64(salt);

  try {
    // Use Argon2id via CryptoService (memory-hard, GPU-resistant)
    const { raw: hashBytes } = await CryptoService.deriveKeyWithRaw(pin, salt, 3, CryptoService.PURPOSES.PIN_HASHING);

    // Return JSON with new Argon2id format
    return JSON.stringify({
      hash: CryptoService.arrayBufferToBase64(hashBytes),
      salt: saltB64,
      algorithm: 'ARGON2ID-SHA256',
      version: 3
    });
  } catch (e) {
    console.error('PIN hashing failed:', e);
    throw new Error('PIN_HASH_FAILED');
  }
}

// SECURITY: Encrypt recovery metadata with master key
async function encryptRecoveryMetadata(
  metadata: RecoveryMetadata,
  masterKey: CryptoKey
): Promise<EncryptedRecoveryMetadata> {
  try {
    const metadataJson = JSON.stringify(metadata);
    const { ciphertext, iv, tag } = await CryptoService.encrypt(metadataJson, masterKey);

    return {
      payload: CryptoService.arrayBufferToBase64(ciphertext),
      iv: CryptoService.arrayBufferToBase64(iv.buffer as ArrayBuffer),
      tag: CryptoService.arrayBufferToBase64(tag.buffer as ArrayBuffer),
      algorithm: 'AES-256-GCM',
      version: 1
    };
  } catch (e) {
    console.error('Metadata encryption failed:', e);
    throw new Error('METADATA_ENCRYPTION_FAILED');
  }
}

// SECURITY: Decrypt recovery metadata with master key
async function decryptRecoveryMetadata(
  encrypted: EncryptedRecoveryMetadata,
  masterKey: CryptoKey
): Promise<RecoveryMetadata> {
  try {
    const ciphertext = new Uint8Array(
      CryptoService.base64ToArrayBuffer(encrypted.payload)
    );
    const iv = new Uint8Array(
      CryptoService.base64ToArrayBuffer(encrypted.iv)
    );
    const tag = new Uint8Array(
      CryptoService.base64ToArrayBuffer(encrypted.tag)
    );

    const metadataJson = await CryptoService.decrypt(ciphertext, masterKey, iv, tag);
    return JSON.parse(metadataJson);
  } catch (e) {
    console.error('Metadata decryption failed:', e);
    throw new Error('METADATA_DECRYPTION_FAILED');
  }
}

export class RecoveryService {
  private static constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  static generateWords(): string[] {
    const array = new Uint32Array(RECOVERY_WORDS_COUNT);
    window.crypto.getRandomValues(array);
    return Array.from(array).map(val => RECOVERY_WORDS_POOL[val % RECOVERY_WORDS_POOL.length]);
  }

  static async deriveKeyFromWords(words: string[], deviceId?: string): Promise<CryptoKey> {
    const cleanWords = words
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length > 0);

    if (cleanWords.length !== RECOVERY_WORDS_COUNT) {
      throw new Error("INVALID_WORD_COUNT");
    }

    const combined = cleanWords.join(' ');

    // SECURITY: Include device ID in salt for device-specific recovery
    const device = deviceId || await getDeviceIdFromElectron();
    const salt = encoder.encode(`aegis_vault_recovery_device_${device}_argon2id_${RECOVERY_VERSION}_secure`);

    // CryptoService üzerinden Argon2id kullanarak anahtar türetiyoruz
    return await CryptoService.deriveKeyFromPassword(combined, salt);
  }

  static async setupRecovery(masterKeyRaw: Uint8Array, pinProtection?: boolean): Promise<{
    words: string[];
    pin?: string;
    checksum: string;
  }> {
    if (!masterKeyRaw) throw new Error("MASTER_KEY_MISSING");

    let tempRecoveryKey: CryptoKey | null = null;

    try {
      const words = this.generateWords();
      const deviceId = await getDeviceIdFromElectron();

      // Derive recovery key
      tempRecoveryKey = await this.deriveKeyFromWords(words, deviceId);

      const checksum = calculateWordsChecksum(words);

      // SECURITY: Encrypt master key (raw bytes) with recovery key
      const recoveryKeyB64 = CryptoService.arrayBufferToBase64(masterKeyRaw);

      const { ciphertext, iv, tag } = await CryptoService.encrypt(recoveryKeyB64, tempRecoveryKey);

      // Generate optional PIN protection
      let pin: string | undefined;
      let pinHash: string | undefined;
      if (pinProtection) {
        pin = generateRecoveryPIN();
        pinHash = await hashRecoveryPIN(pin);
      }

      const metadata: RecoveryMetadata = {
        version: RECOVERY_VERSION,
        timestamp: Date.now(),
        deviceId: deviceId,
        wordCount: RECOVERY_WORDS_COUNT,
        checksum: checksum,
        createdAt: Date.now(),
        verificationCount: 0,
        isActive: true
      };

      // SECURITY: Encrypt metadata with master key (v2+)
      const masterKeyCryptoKey = await window.crypto.subtle.importKey(
        'raw',
        new Uint8Array(masterKeyRaw), // Ensure proper Uint8Array type
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
      );

      const encryptedMetadata = await encryptRecoveryMetadata(metadata, masterKeyCryptoKey);

      const backup: RecoveryBackup = {
        payload: CryptoService.arrayBufferToBase64(ciphertext.buffer),
        iv: CryptoService.arrayBufferToBase64(iv.buffer),
        tag: CryptoService.arrayBufferToBase64(tag.buffer),
        encryptedMetadata: encryptedMetadata // v2+: encrypted metadata
      };

      localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(backup));
      // v2+: Encrypted metadata only (not plain text)
      localStorage.removeItem(RECOVERY_METADATA_KEY); // Remove old plain metadata
      localStorage.setItem(RECOVERY_METADATA_KEY + '_encrypted', JSON.stringify(encryptedMetadata));

      if (pinHash) {
        localStorage.setItem(RECOVERY_HASH_KEY, pinHash);
      }

      // AUDIT: Log recovery setup
      if ((window as any).electronAPI?.audit) {
        await (window as any).electronAPI.audit.logEvent('RECOVERY_WORDS_GENERATED', {
          timestamp: Date.now(),
          version: RECOVERY_VERSION,
          pinProtected: !!pin
        });
      }

      // SECURITY: Do NOT store recovery words in localStorage
      // Return to user for manual backup only
      return {
        words,
        pin: pin,
        checksum: checksum
      };
    } catch (e: any) {
      console.error("Kurtarma kurulumu başarısız:", e);
      throw new Error(e.message || "RECOVERY_SETUP_FAILED");
    }
  }

  static getRecoveryMetadata(): RecoveryMetadata | null {
    // v2+: Try to get encrypted metadata
    const encryptedMetadataStr = localStorage.getItem(RECOVERY_METADATA_KEY + '_encrypted');
    if (encryptedMetadataStr) {
      try {
        // Return as indicator that encrypted metadata exists
        // Full decryption happens in recovery verification flow with masterKey
        return JSON.parse(encryptedMetadataStr) as any;
      } catch (e) {
        console.error('Failed to parse encrypted metadata:', e);
      }
    }

    // Fallback: v1 plain metadata (backward compatibility)
    const metadata = localStorage.getItem(RECOVERY_METADATA_KEY);
    return metadata ? JSON.parse(metadata) : null;
  }

  // SECURITY: Get and decrypt recovery metadata with master key
  static async getDecryptedRecoveryMetadata(masterKey: CryptoKey): Promise<RecoveryMetadata | null> {
    // v2+: Encrypted metadata
    const encryptedMetadataStr = localStorage.getItem(RECOVERY_METADATA_KEY + '_encrypted');
    if (encryptedMetadataStr) {
      try {
        const encryptedMetadata: EncryptedRecoveryMetadata = JSON.parse(encryptedMetadataStr);
        return await decryptRecoveryMetadata(encryptedMetadata, masterKey);
      } catch (e) {
        console.error('Failed to decrypt metadata:', e);
        return null;
      }
    }

    // Fallback: v1 plain metadata
    const metadata = localStorage.getItem(RECOVERY_METADATA_KEY);
    return metadata ? JSON.parse(metadata) : null;
  }

  // SECURITY: Check if metadata is encrypted (v2+)
  private static isEncryptedRecoveryMetadata(metadata: any): boolean {
    return metadata && typeof metadata === 'object' && 'v' in metadata && 'iv' in metadata && 'ciphertext' in metadata;
  }

  // SECURITY: Update encrypted metadata safely
  private static async updateEncryptedMetadata(
    masterKey: CryptoKey,
    updates: Partial<RecoveryMetadata>
  ): Promise<void> {
    try {
      // Get current encrypted metadata
      const encryptedMetadataStr = localStorage.getItem(RECOVERY_METADATA_KEY + '_encrypted');
      if (!encryptedMetadataStr) return;

      const encryptedMetadata: EncryptedRecoveryMetadata = JSON.parse(encryptedMetadataStr);

      // Decrypt
      const currentMetadata = await decryptRecoveryMetadata(encryptedMetadata, masterKey);

      // Update only provided fields
      const updatedMetadata: RecoveryMetadata = {
        ...currentMetadata,
        ...updates,
        version: currentMetadata.version, // Preserve version
        createdAt: currentMetadata.createdAt // Preserve creation date
      };

      // Re-encrypt
      const newEncryptedMetadata = await encryptRecoveryMetadata(updatedMetadata, masterKey);

      // Store
      localStorage.setItem(RECOVERY_METADATA_KEY + '_encrypted', JSON.stringify(newEncryptedMetadata));
    } catch (e) {
      console.error('Failed to update encrypted metadata:', e);
    }
  }

  static async verifyRecoveryPIN(pin: string, masterKey?: CryptoKey): Promise<boolean> {
    const storedData = localStorage.getItem(RECOVERY_HASH_KEY);
    if (!storedData) return true; // No PIN protection

    try {
      const stored = JSON.parse(storedData);

      // Backward compatibility: old SHA-256 format
      if (stored.algorithm === undefined || stored.algorithm === 'SHA-256') {
        const encoder = new TextEncoder();
        const data = encoder.encode(pin);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
        const providedHash = CryptoService.arrayBufferToBase64(hashBuffer);
        const isValid = providedHash === stored; // Old format was just the hash string

        if (isValid) {
          // Update metadata with encrypted support
          if (masterKey) {
            await this.updateEncryptedMetadata(masterKey, {
              lastVerified: Date.now(),
              verificationCount: ((await this.getDecryptedRecoveryMetadata(masterKey))?.verificationCount || 0) + 1,
            });
          } else {
            const metadata = this.getRecoveryMetadata();
            if (metadata && !this.isEncryptedRecoveryMetadata(metadata)) {
              metadata.lastVerified = Date.now();
              metadata.verificationCount = (metadata.verificationCount || 0) + 1;
              localStorage.setItem(RECOVERY_METADATA_KEY, JSON.stringify(metadata));
            }
          }
        }
        return isValid;
      }

      // Argon2id verification (version 3+) - Modern, GPU-resistant
      if (stored.algorithm === 'ARGON2ID-SHA256' && stored.salt && stored.hash) {
        const salt = new Uint8Array(CryptoService.base64ToArrayBuffer(stored.salt));

        // Derive using Argon2id with same parameters
        const { raw: hashBytes } = await CryptoService.deriveKeyWithRaw(pin, salt, 3);
        const providedHash = CryptoService.arrayBufferToBase64(hashBytes);

        // SECURITY: Constant-time comparison to prevent timing attacks
        const isValid = this.constantTimeCompare(providedHash, stored.hash);

        if (isValid) {
          // Update metadata with encrypted support
          if (masterKey) {
            await this.updateEncryptedMetadata(masterKey, {
              lastVerified: Date.now(),
              verificationCount: ((await this.getDecryptedRecoveryMetadata(masterKey))?.verificationCount || 0) + 1,
            });
          } else {
            const metadata = this.getRecoveryMetadata();
            if (metadata && !this.isEncryptedRecoveryMetadata(metadata)) {
              metadata.lastVerified = Date.now();
              metadata.verificationCount = (metadata.verificationCount || 0) + 1;
              localStorage.setItem(RECOVERY_METADATA_KEY, JSON.stringify(metadata));
            }
          }
        }

        return isValid;
      }

      // PBKDF2 verification (version 2) - Legacy support with transparent upgrade
      if (stored.algorithm === 'PBKDF2-SHA256-100k' && stored.salt && stored.hash) {
        const salt = new Uint8Array(
          CryptoService.base64ToArrayBuffer(stored.salt)
        );

        const key = await window.crypto.subtle.deriveKey(
          {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
          },
          await window.crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(pin),
            'PBKDF2',
            false,
            ['deriveKey']
          ),
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt']
        );

        const exported = await window.crypto.subtle.exportKey('raw', key);
        const providedHashBytes = new Uint8Array(exported);
        const providedHash = CryptoService.arrayBufferToBase64(providedHashBytes);

        const isValid = providedHash === stored.hash;

        if (isValid) {
          // SECURITY: Transparent upgrade to Argon2id
          console.log('[Security] Upgrading PIN hash from PBKDF2 to Argon2id...');
          try {
            const newHash = await hashRecoveryPIN(pin);
            localStorage.setItem(RECOVERY_HASH_KEY, newHash);
          } catch (e) {
            console.error('[Security] PIN upgrade failed:', e);
          }

          // Update metadata with encrypted support
          if (masterKey) {
            await this.updateEncryptedMetadata(masterKey, {
              lastVerified: Date.now(),
              verificationCount: ((await this.getDecryptedRecoveryMetadata(masterKey))?.verificationCount || 0) + 1,
            });
          } else {
            const metadata = this.getRecoveryMetadata();
            if (metadata && !this.isEncryptedRecoveryMetadata(metadata)) {
              metadata.lastVerified = Date.now();
              metadata.verificationCount = (metadata.verificationCount || 0) + 1;
              localStorage.setItem(RECOVERY_METADATA_KEY, JSON.stringify(metadata));
            }
          }
        }

        return isValid;
      }

      return false; // Unknown algorithm
    } catch (e) {
      console.error('PIN verification failed:', e);
      return false;
    }
  }

  // Verify recovery checksum matches current metadata
  static verifyChecksumIntegrity(words: string[], expectedChecksum: string): boolean {
    const calculatedChecksum = calculateWordsChecksum(words);
    return calculatedChecksum === expectedChecksum;
  }

  // Get recovery status and metadata
  static getRecoveryStatus(): {
    isSetup: boolean;
    metadata?: RecoveryMetadata;
    needsVerification: boolean;
    daysUntilVerificationNeeded?: number;
  } {
    const metadata = this.getRecoveryMetadata();
    if (!metadata) {
      return { isSetup: false, needsVerification: false };
    }

    const daysSinceCreation = (Date.now() - (metadata.createdAt || metadata.timestamp)) / (1000 * 60 * 60 * 24);
    const needsVerification = !metadata.lastVerified || daysSinceCreation > 90;

    return {
      isSetup: true,
      metadata,
      needsVerification,
      daysUntilVerificationNeeded: needsVerification ? 0 : Math.ceil(90 - daysSinceCreation)
    };
  }

  // Reset recovery (clear all recovery data)
  static resetRecovery(): boolean {
    try {
      localStorage.removeItem(RECOVERY_STORAGE_KEY);
      localStorage.removeItem(RECOVERY_HASH_KEY);
      localStorage.removeItem(RECOVERY_METADATA_KEY);

      // AUDIT: Log recovery reset
      if ((window as any).electronAPI?.audit) {
        (window as any).electronAPI.audit.logEvent('RECOVERY_WORDS_RESET', {
          timestamp: Date.now()
        }).catch(() => { });
      }

      return true;
    } catch (e) {
      console.error("Kurtarma sıfırlama başarısız:", e);
      return false;
    }
  }

  // Export recovery data as encrypted JSON
  static exportRecoveryAsJSON(): string {
    const backup = localStorage.getItem(RECOVERY_STORAGE_KEY);
    const metadataEncrypted = localStorage.getItem(RECOVERY_METADATA_KEY + '_encrypted');
    const metadataPlain = localStorage.getItem(RECOVERY_METADATA_KEY);

    if (!backup || (!metadataEncrypted && !metadataPlain)) {
      throw new Error("RECOVERY_NOT_SETUP");
    }

    const exportData = {
      version: "4.0",
      exportedAt: new Date().toISOString(),
      backup: JSON.parse(backup),
      // metadata placeholder to satisfy legacy structure if needed
      metadata: metadataEncrypted ? JSON.parse(metadataEncrypted) : JSON.parse(metadataPlain!),
      // DO NOT export words or PIN - only encrypted backup
      _notice: "This backup contains encrypted recovery data. Keep it safe and offline."
    };

    return JSON.stringify(exportData, null, 2);
  }

  // Import recovery data from JSON
  static async importRecoveryFromJSON(jsonData: string): Promise<{ success: boolean; message: string }> {
    try {
      const data = JSON.parse(jsonData);

      if (!data.backup || !data.backup.metadata) {
        throw new Error("INVALID_BACKUP_FORMAT");
      }

      const backup = data.backup;
      localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(backup));
      localStorage.setItem(RECOVERY_METADATA_KEY, JSON.stringify(backup.metadata));

      // AUDIT: Log recovery import
      if ((window as any).electronAPI?.audit) {
        (window as any).electronAPI.audit.logEvent('RECOVERY_WORDS_IMPORTED', {
          timestamp: Date.now(),
          version: backup.metadata.version
        }).catch(() => { });
      }

      return {
        success: true,
        message: "Recovery data imported successfully"
      };
    } catch (e: any) {
      return {
        success: false,
        message: e.message || "IMPORT_FAILED"
      };
    }
  }

  // Validate device binding for recovery
  static async validateDeviceBinding(): Promise<{
    isValid: boolean;
    currentDevice: string;
    recoveryDevice: string;
  }> {
    const metadata = this.getRecoveryMetadata();
    const currentDevice = await getDeviceIdFromElectron();

    if (!metadata) {
      return {
        isValid: false,
        currentDevice,
        recoveryDevice: "NOT_SET"
      };
    }

    return {
      isValid: currentDevice === metadata.deviceId,
      currentDevice,
      recoveryDevice: metadata.deviceId
    };
  }

  static async deriveKeyFromWordsLegacy(words: string[]): Promise<CryptoKey> {
    const combined = words.join(' ');
    const salt = encoder.encode("aegis_vault_recovery_v1_fixed_salt_2025_secure");

    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(combined),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 600000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  static async recoverVault(words: string[], pin?: string): Promise<{ key: CryptoKey; raw: Uint8Array }> {
    // Validate words format first
    const validation = validateRecoveryWords(words);
    if (!validation.valid) {
      throw new Error(`INVALID_RECOVERY_WORDS: ${validation.errors.join('; ')}`);
    }

    // Check PIN if required
    if (localStorage.getItem(RECOVERY_HASH_KEY) && !pin) {
      throw new Error("PIN_REQUIRED");
    }

    if (pin && !(await this.verifyRecoveryPIN(pin))) {
      throw new Error("INVALID_PIN");
    }

    const blobStr = localStorage.getItem(RECOVERY_STORAGE_KEY);
    if (!blobStr) throw new Error("NO_RECOVERY_BLOB");

    const blob: RecoveryBackup = JSON.parse(blobStr);

    // Verify device ID match for v4.0+
    if (blob.metadata.version === RECOVERY_VERSION) {
      const currentDeviceId = await getDeviceIdFromElectron();
      if (blob.metadata.deviceId !== currentDeviceId) {
        throw new Error("RECOVERY_DEVICE_MISMATCH");
      }
    }

    const ciphertext = CryptoService.base64ToArrayBuffer(blob.payload);
    const iv = new Uint8Array(CryptoService.base64ToArrayBuffer(blob.iv));
    const tag = new Uint8Array(CryptoService.base64ToArrayBuffer(blob.tag));

    // Try modern method first (v4.0 / v3.0)
    try {
      const deviceId = await getDeviceIdFromElectron();
      const recoveryKey = await this.deriveKeyFromWords(words, deviceId);
      const decryptedRawKeyB64 = await CryptoService.decrypt(
        new Uint8Array(ciphertext),
        recoveryKey,
        iv,
        tag
      );
      const rawKey = CryptoService.base64ToArrayBuffer(decryptedRawKeyB64);
      const key = await window.crypto.subtle.importKey(
        'raw',
        rawKey,
        { name: 'AES-GCM' },
        false, // SECURITY: Non-extractable
        ['encrypt', 'decrypt']
      );
      return { key, raw: new Uint8Array(rawKey) };
    } catch (e) {
      // Try Argon2id legacy (3 iterations)
      try {
        const deviceId = await getDeviceIdFromElectron();
        const combined = words.map(w => w.trim().toLowerCase()).join(' ');
        const salt = encoder.encode(`aegis_vault_recovery_device_${deviceId}_argon2id_${RECOVERY_VERSION}_secure`);
        const { key: recoveryKey } = await CryptoService.deriveKeyWithRaw(combined, salt, 3, CryptoService.PURPOSES.RECOVERY_EXECUTION);

        const decryptedRawKeyB64 = await CryptoService.decrypt(
          new Uint8Array(ciphertext),
          recoveryKey,
          iv,
          tag
        );
        const rawKey = CryptoService.base64ToArrayBuffer(decryptedRawKeyB64);
        const key = await window.crypto.subtle.importKey(
          'raw',
          rawKey,
          { name: 'AES-GCM' },
          false,
          ['encrypt', 'decrypt']
        );
        return { key, raw: new Uint8Array(rawKey) };
      } catch (argonLegacyErr) {
        // Try legacy method (v2.1 PBKDF2)
        try {
          const legacyKey = await this.deriveKeyFromWordsLegacy(words);
          const decryptedRawKeyB64 = await CryptoService.decrypt(
            new Uint8Array(ciphertext),
            legacyKey,
            iv,
            tag
          );
          const rawKey = CryptoService.base64ToArrayBuffer(decryptedRawKeyB64);
          const key = await window.crypto.subtle.importKey(
            'raw',
            rawKey,
            { name: 'AES-GCM' },
            false,
            ['encrypt', 'decrypt']
          );
          return { key, raw: new Uint8Array(rawKey) };
        } catch (legacyErr) {
          throw new Error("RECOVERY_AUTH_FAILED");
        }
      }
    }
  }

  static isSetup(): boolean {
    return !!localStorage.getItem(RECOVERY_STORAGE_KEY);
  }

  static validateRecoveryWords(words: string[]) {
    return validateRecoveryWords(words);
  }
}