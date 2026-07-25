// ─────────────────────────────────────────────────────────────
// LLM provider adapters with a full tool-use loop.
//
// Supports:
//   - "anthropic"  -> Anthropic Claude Messages API
//   - "openai"     -> any OpenAI-compatible /chat/completions endpoint
//                     (OpenAI, Ollama, LM Studio, ...)
//
// Returns a unified result:
//   { text, clientActions, actionLog }
//   - text:          Nikita's final reply
//   - clientActions: [{ name, args }] to run in the browser (avatar mood/pose)
//   - actionLog:     [{ name, args, result }] of all tool calls, for the UI
// ─────────────────────────────────────────────────────────────

import { toolSchemas, runServerTool, TOOL_MAP } from './tools.js';

const MAX_TOOL_ROUNDS = 6;

export async function generateReply({ system, history }) {
  const provider = (process.env.PROVIDER || 'anthropic').toLowerCase();
  if (provider === 'openai') return runOpenAI({ system, history });
  return runAnthropic({ system, history });
}

// ── Shared: dispatch one tool call ───────────────────────────
// Server tools run here. Client tools (avatar) get an immediate ack and are
// queued for the browser to apply.
async function dispatchTool(name, args, clientActions, actionLog) {
  const tool = TOOL_MAP[name];
  let result;
  if (tool && tool.side === 'client') {
    clientActions.push({ name, args });
    result = { ok: true, applied: args };
  } else {
    result = await runServerTool(name, args);
  }
  actionLog.push({ name, args, result });
  return result;
}

// ── Anthropic ────────────────────────────────────────────────
async function runAnthropic({ system, history }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY fehlt in .env');
  const base = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
  const tools = toolSchemas('anthropic');

  const messages = history.map((m) => ({ role: m.role, content: m.content }));
  const clientActions = [];
  const actionLog = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res = await fetch(`${base}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model, max_tokens: 1024, system, messages, tools }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Anthropic API ${res.status}: ${body}`);
    }
    const data = await res.json();
    const blocks = data.content || [];
    const toolUses = blocks.filter((b) => b.type === 'tool_use');
    const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();

    if (data.stop_reason === 'tool_use' && toolUses.length) {
      messages.push({ role: 'assistant', content: blocks });
      const toolResults = [];
      for (const tu of toolUses) {
        const result = await dispatchTool(tu.name, tu.input || {}, clientActions, actionLog);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify(result),
        });
      }
      messages.push({ role: 'user', content: toolResults });
      continue;
    }
    return { text: text || '…', clientActions, actionLog };
  }
  return { text: 'Ich habe zu viele Aktionen hintereinander ausgeführt — lass uns kurz durchatmen.', clientActions, actionLog };
}

// ── OpenAI-compatible ────────────────────────────────────────
async function runOpenAI({ system, history }) {
  const apiKey = process.env.OPENAI_API_KEY || 'local';
  const base = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const tools = toolSchemas('openai');

  const messages = [
    { role: 'system', content: system },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];
  const clientActions = [];
  const actionLog = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, tools, tool_choice: 'auto' }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI-kompatible API ${res.status}: ${body}`);
    }
    const data = await res.json();
    const msg = data.choices?.[0]?.message;
    if (!msg) throw new Error('Keine Antwort vom Modell erhalten.');

    if (msg.tool_calls && msg.tool_calls.length) {
      messages.push(msg);
      for (const call of msg.tool_calls) {
        let args = {};
        try { args = JSON.parse(call.function.arguments || '{}'); } catch { /* ignore */ }
        const result = await dispatchTool(call.function.name, args, clientActions, actionLog);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
      continue;
    }
    return { text: (msg.content || '…').trim(), clientActions, actionLog };
  }
  return { text: 'Ich habe zu viele Aktionen hintereinander ausgeführt — lass uns kurz durchatmen.', clientActions, actionLog };
}
