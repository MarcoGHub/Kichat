import { Avatar } from './avatar.js';

const avatar = new Avatar(document.getElementById('avatar'));
avatar.setMood('cool');
avatar.setPose('idle');

const els = {
  messages: document.getElementById('messages'),
  input: document.getElementById('input'),
  form: document.getElementById('composer'),
  sendBtn: document.getElementById('sendBtn'),
  status: document.getElementById('status'),
  moodBadge: document.getElementById('moodBadge'),
  actionFeed: document.getElementById('actionFeed'),
  providerDot: document.getElementById('providerDot'),
  providerLabel: document.getElementById('providerLabel'),
  clearBtn: document.getElementById('clearBtn'),
};

const STORAGE_KEY = 'kichat.history.v1';
let history = loadHistory();

// ── Boot ─────────────────────────────────────────────────────
renderHistory();
checkConfig();

if (history.length === 0) {
  const greeting = '*Sie lehnt lässig an der Wand, mustert dich mit einem halben Lächeln.* Na, endlich da. Ich bin Nikita. Sag mir, was du brauchst — ich bin ganz Ohr.';
  pushMessage('nikita', greeting);
  history.push({ role: 'assistant', content: greeting });
  saveHistory();
  avatar.setMood('playful');
  setMoodBadge('playful');
}

// ── Events ───────────────────────────────────────────────────
els.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = els.input.value.trim();
  if (!text) return;
  els.input.value = '';
  await send(text);
});

els.clearBtn.addEventListener('click', () => {
  if (!confirm('Verlauf wirklich löschen?')) return;
  history = [];
  saveHistory();
  els.messages.innerHTML = '';
  els.actionFeed.innerHTML = '';
});

// ── Core send flow ───────────────────────────────────────────
async function send(text) {
  pushMessage('user', text);
  history.push({ role: 'user', content: text });
  saveHistory();

  setBusy(true);
  const typing = showTyping();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ history }),
    });
    const data = await res.json();
    typing.remove();

    if (!res.ok || data.error) {
      pushMessage('error', data.error || `Fehler ${res.status}`);
      setStatus('Fehler');
      return;
    }

    // Apply avatar actions
    applyClientActions(data.clientActions || []);
    renderActionLog(data.actionLog || []);

    // Type out Nikita's reply
    await typeReply(data.text || '…');
    history.push({ role: 'assistant', content: data.text || '…' });
    saveHistory();
    setStatus('bereit');
  } catch (err) {
    typing.remove();
    pushMessage('error', 'Verbindungsfehler: ' + err.message);
    setStatus('offline');
  } finally {
    setBusy(false);
    els.input.focus();
  }
}

function applyClientActions(actions) {
  for (const a of actions) {
    if (a.name === 'set_mood' && a.args?.mood) {
      avatar.setMood(a.args.mood);
      setMoodBadge(a.args.mood);
    } else if (a.name === 'set_pose' && a.args?.pose) {
      avatar.setPose(a.args.pose);
    }
  }
}

function renderActionLog(log) {
  for (const entry of log) {
    if (entry.name === 'set_mood' || entry.name === 'set_pose') continue; // shown via avatar
    const chip = document.createElement('div');
    chip.className = 'action-chip';
    const summary = summarizeResult(entry);
    chip.innerHTML = `<b>⚡ ${escapeHtml(entry.name)}</b> ${escapeHtml(summary)}`;
    els.actionFeed.appendChild(chip);
  }
  els.actionFeed.scrollTop = els.actionFeed.scrollHeight;
}

function summarizeResult(entry) {
  const r = entry.result || {};
  if (r.error) return '— ' + r.error;
  if (entry.name === 'take_note') return '— Notiz gespeichert';
  if (entry.name === 'remember') return '— gemerkt: ' + Object.values(r.remembered || {}).join(', ');
  if (entry.name === 'add_reminder') return '— Erinnerung angelegt';
  if (entry.name === 'list_reminders') return `— ${(r.reminders || []).length} Erinnerung(en)`;
  if (entry.name === 'list_notes') return `— ${(r.notes || []).length} Notiz(en)`;
  if (entry.name === 'get_time') return '— ' + (r.local || '');
  return 'ausgeführt';
}

// ── Typing animation ─────────────────────────────────────────
async function typeReply(fullText) {
  const el = document.createElement('div');
  el.className = 'msg nikita';
  els.messages.appendChild(el);
  avatar.speak(true);
  setStatus('spricht…');

  const chunks = fullText.split('');
  let shown = '';
  for (let i = 0; i < chunks.length; i++) {
    shown += chunks[i];
    el.innerHTML = formatText(shown);
    if (i % 2 === 0) { scrollMessages(); await sleep(12); }
  }
  el.innerHTML = formatText(fullText);
  avatar.speak(false);
  scrollMessages();
}

// ── Rendering helpers ────────────────────────────────────────
function pushMessage(role, text) {
  const el = document.createElement('div');
  el.className = 'msg ' + role;
  el.innerHTML = role === 'nikita' ? formatText(text) : escapeHtml(text);
  els.messages.appendChild(el);
  scrollMessages();
}

function renderHistory() {
  els.messages.innerHTML = '';
  for (const m of history) {
    pushMessage(m.role === 'assistant' ? 'nikita' : 'user', m.content);
  }
}

function showTyping() {
  const el = document.createElement('div');
  el.className = 'typing';
  el.innerHTML = 'Nikita schreibt <span>.</span><span>.</span><span>.</span>';
  els.messages.appendChild(el);
  scrollMessages();
  return el;
}

function formatText(text) {
  // *italic* for described actions/body language
  return escapeHtml(text).replace(/\*(.+?)\*/g, '<em>$1</em>');
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function scrollMessages() { els.messages.scrollTop = els.messages.scrollHeight; }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function setBusy(b) { els.sendBtn.disabled = b; els.input.disabled = b; if (!b) els.input.focus(); }
function setStatus(s) { els.status.textContent = s; }
function setMoodBadge(m) { els.moodBadge.textContent = m; }

// ── Config / persistence ─────────────────────────────────────
async function checkConfig() {
  try {
    const res = await fetch('/api/config');
    const cfg = await res.json();
    els.providerLabel.textContent = `${cfg.provider}${cfg.configured ? '' : ' (kein API-Key)'}`;
    els.providerDot.className = 'dot ' + (cfg.configured ? 'ok' : 'bad');
    if (!cfg.configured) {
      pushMessage('error', `Kein API-Key konfiguriert. Kopiere .env.example nach .env und trage deinen ${cfg.provider}-Key ein, dann starte den Server neu.`);
    }
  } catch {
    els.providerLabel.textContent = 'Server offline';
    els.providerDot.className = 'dot bad';
  }
}

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveHistory() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-100))); }
  catch { /* ignore quota */ }
}
