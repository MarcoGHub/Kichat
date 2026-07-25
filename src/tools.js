// ─────────────────────────────────────────────────────────────
// Action system.
//
// Each tool is a real action Nikita can perform. To add your own action,
// append an object to the TOOLS array with:
//   - name:        unique identifier
//   - description: what it does (the model reads this to decide when to use it)
//   - parameters:  JSON-schema-style properties
//   - side:        "server" (runs here) or "client" (runs in the browser)
//   - run:         async (args, ctx) => resultObject   (server tools only)
//
// Client-side tools (like set_mood/set_pose) are executed in the browser;
// the server just forwards them. See public/app.js.
//
// SAFETY NOTE: These tools are intentionally a curated, safe set. Arbitrary
// shell/command execution is deliberately NOT provided. If you add powerful
// tools, keep the user in control.
// ─────────────────────────────────────────────────────────────

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

// ── Tiny JSON store ──────────────────────────────────────────
async function loadStore() {
  try {
    const raw = await fs.readFile(STORE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { memory: {}, notes: [], reminders: [] };
  }
}

async function saveStore(store) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
}

// ── Avatar vocabulary (kept in sync with the frontend) ───────
export const MOODS = ['neutral', 'happy', 'playful', 'affectionate', 'cool', 'intense', 'sad', 'thoughtful'];
export const POSES = ['idle', 'lean', 'arms-crossed', 'wave', 'wink', 'combat'];

// ── Tool definitions ─────────────────────────────────────────
export const TOOLS = [
  {
    name: 'set_mood',
    description: 'Ändert deinen Gesichtsausdruck/deine Stimmung auf dem Bildschirm. Nutze das, damit dein Avatar zu deiner Emotion passt.',
    parameters: {
      mood: { type: 'string', enum: MOODS, description: 'Die anzuzeigende Stimmung.' },
    },
    required: ['mood'],
    side: 'client',
  },
  {
    name: 'set_pose',
    description: 'Ändert deine Körperhaltung/Pose auf dem Bildschirm.',
    parameters: {
      pose: { type: 'string', enum: POSES, description: 'Die anzuzeigende Pose.' },
    },
    required: ['pose'],
    side: 'client',
  },
  {
    name: 'remember',
    description: 'Merke dir dauerhaft eine Information über den Nutzer oder eure Beziehung (z. B. Name, Vorlieben, Details). Überschreibt einen vorhandenen Schlüssel.',
    parameters: {
      key: { type: 'string', description: 'Kurzer Bezeichner, z. B. "lieblingsfarbe".' },
      value: { type: 'string', description: 'Der zu merkende Wert.' },
    },
    required: ['key', 'value'],
    side: 'server',
    async run(args) {
      const store = await loadStore();
      store.memory[args.key] = args.value;
      await saveStore(store);
      return { ok: true, remembered: { [args.key]: args.value } };
    },
  },
  {
    name: 'recall',
    description: 'Rufe eine zuvor gemerkte Information ab. Ohne Schlüssel wird alles Gemerkte zurückgegeben.',
    parameters: {
      key: { type: 'string', description: 'Optionaler Schlüssel. Leer lassen für alles.' },
    },
    required: [],
    side: 'server',
    async run(args) {
      const store = await loadStore();
      if (args.key) return { key: args.key, value: store.memory[args.key] ?? null };
      return { memory: store.memory };
    },
  },
  {
    name: 'take_note',
    description: 'Speichere eine Notiz für den Nutzer (Ideen, To-dos, alles Notierenswerte).',
    parameters: {
      text: { type: 'string', description: 'Der Notiztext.' },
    },
    required: ['text'],
    side: 'server',
    async run(args) {
      const store = await loadStore();
      const note = { id: Date.now(), text: args.text, createdAt: new Date().toISOString() };
      store.notes.push(note);
      await saveStore(store);
      return { ok: true, note, total: store.notes.length };
    },
  },
  {
    name: 'list_notes',
    description: 'Gib alle gespeicherten Notizen zurück.',
    parameters: {},
    required: [],
    side: 'server',
    async run() {
      const store = await loadStore();
      return { notes: store.notes };
    },
  },
  {
    name: 'add_reminder',
    description: 'Lege eine Erinnerung an. "when" ist ein ISO-Zeitpunkt oder eine natürliche Beschreibung ("morgen 9 Uhr"). Die App zeigt fällige Erinnerungen an.',
    parameters: {
      text: { type: 'string', description: 'Woran erinnert werden soll.' },
      when: { type: 'string', description: 'Wann — ISO-Zeit oder natürliche Sprache.' },
    },
    required: ['text', 'when'],
    side: 'server',
    async run(args) {
      const store = await loadStore();
      const dueAt = parseWhen(args.when);
      const reminder = {
        id: Date.now(),
        text: args.text,
        when: args.when,
        dueAt: dueAt ? dueAt.toISOString() : null,
        done: false,
        createdAt: new Date().toISOString(),
      };
      store.reminders.push(reminder);
      await saveStore(store);
      return { ok: true, reminder };
    },
  },
  {
    name: 'list_reminders',
    description: 'Gib alle Erinnerungen zurück (offen und erledigt).',
    parameters: {},
    required: [],
    side: 'server',
    async run() {
      const store = await loadStore();
      return { reminders: store.reminders };
    },
  },
  {
    name: 'get_time',
    description: 'Gib das aktuelle Datum und die aktuelle Uhrzeit zurück.',
    parameters: {},
    required: [],
    side: 'server',
    async run() {
      const now = new Date();
      return { iso: now.toISOString(), local: now.toLocaleString('de-DE') };
    },
  },
  {
    name: 'web_search',
    description: 'Durchsuche das Web nach aktuellen Informationen. Nur verfügbar, wenn in der Konfiguration aktiviert.',
    parameters: {
      query: { type: 'string', description: 'Die Suchanfrage.' },
    },
    required: ['query'],
    side: 'server',
    async run(args) {
      if (process.env.ENABLE_WEB_SEARCH !== '1') {
        return { error: 'Websuche ist deaktiviert. In .env ENABLE_WEB_SEARCH=1 setzen und einen Suchanbieter in src/tools.js einbinden.' };
      }
      // Wire up your preferred search API here and return results.
      return { error: 'Kein Suchanbieter eingebunden. Siehe web_search in src/tools.js.' };
    },
  },
];

// ── Very light natural-language time parsing ─────────────────
function parseWhen(when) {
  if (!when) return null;
  const direct = new Date(when);
  if (!isNaN(direct.getTime())) return direct;

  const now = new Date();
  const s = when.toLowerCase();
  const timeMatch = s.match(/(\d{1,2})[:.](\d{2})|(\d{1,2})\s*uhr/);
  let hour = 9, minute = 0;
  if (timeMatch) {
    if (timeMatch[1]) { hour = +timeMatch[1]; minute = +timeMatch[2]; }
    else if (timeMatch[3]) { hour = +timeMatch[3]; minute = 0; }
  }
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  if (s.includes('morgen')) target.setDate(target.getDate() + 1);
  else if (s.includes('übermorgen')) target.setDate(target.getDate() + 2);
  else if (target <= now) target.setDate(target.getDate() + 1); // "heute 8 Uhr" schon vorbei -> morgen
  return target;
}

// ── Helpers used by the server/providers ─────────────────────
export const TOOL_MAP = Object.fromEntries(TOOLS.map((t) => [t.name, t]));

export function toolsDescriptionForPrompt() {
  return TOOLS.map((t) => `- ${t.name}: ${t.description}`).join('\n');
}

export function avatarDescriptionForPrompt() {
  return `Stimmungen: ${MOODS.join(', ')}\nPosen: ${POSES.join(', ')}`;
}

// Convert our tool defs into the schema the given provider expects.
export function toolSchemas(provider) {
  return TOOLS.map((t) => {
    const properties = {};
    for (const [k, v] of Object.entries(t.parameters)) properties[k] = v;
    const inputSchema = { type: 'object', properties, required: t.required || [] };
    if (provider === 'openai') {
      return {
        type: 'function',
        function: { name: t.name, description: t.description, parameters: inputSchema },
      };
    }
    // anthropic
    return { name: t.name, description: t.description, input_schema: inputSchema };
  });
}

export async function runServerTool(name, args, ctx = {}) {
  const tool = TOOL_MAP[name];
  if (!tool) return { error: `Unbekanntes Werkzeug: ${name}` };
  if (tool.side !== 'server' || typeof tool.run !== 'function') {
    return { error: `Werkzeug ${name} wird clientseitig ausgeführt.` };
  }
  try {
    return await tool.run(args || {}, ctx);
  } catch (err) {
    return { error: String(err && err.message ? err.message : err) };
  }
}
