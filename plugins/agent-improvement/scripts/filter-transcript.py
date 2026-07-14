#!/usr/bin/env python3
"""Pre-filter a Claude Code session transcript for the skill-run reviewer.

Keeps the review signal — conversation text, tool calls, errors, truncated
thinking/results — and drops the bulk: toolUseResult duplicates, the JSON
envelope, attachments, and session bookkeeping. Measured ~10x size reduction
on real sessions, which collapses the reviewer's API-call count (and cost)
because the whole filtered file fits in one or two Read calls.

Truncation markers embed original sizes ("…[truncated N of M chars]") so the
reviewer can still spot oversized tool results; error results are kept whole
because they are friction signal. See scripts/reviewer-prompt.md.

Usage: filter-transcript.py <transcript.jsonl> <output.jsonl>
"""
import json, sys

TOOL_RESULT_KEEP = 600   # chars of healthy tool_result content
THINKING_KEEP = 400      # chars per thinking block
TOOL_INPUT_KEEP = 800    # chars of serialized tool_use input

DROP_TYPES = {
    'file-history-snapshot', 'queue-operation', 'attachment', 'mode',
    'permission-mode', 'ai-title', 'last-prompt', 'worktree-state',
    'relocated', 'pr-link',
}

def trunc(s, keep):
    if not isinstance(s, str) or len(s) <= keep:
        return s
    return s[:keep] + f' …[truncated {len(s)-keep:,} of {len(s):,} chars]'

def slim_tool_result(block):
    if block.get('is_error'):
        return block  # errors are friction signal — keep whole
    c = block.get('content')
    if isinstance(c, str):
        block['content'] = trunc(c, TOOL_RESULT_KEEP)
    elif isinstance(c, list):
        budget = TOOL_RESULT_KEEP
        out = []
        for b in c:
            if isinstance(b, dict) and b.get('type') == 'text':
                b = dict(b, text=trunc(b.get('text', ''), max(budget, 0)))
                budget -= len(b['text'])
            out.append(b)
        block['content'] = out
    return block

def slim_content(content):
    if isinstance(content, str):
        return content
    out = []
    for b in content or []:
        if not isinstance(b, dict):
            out.append(b); continue
        b = dict(b)
        bt = b.get('type')
        if bt == 'tool_result':
            b = slim_tool_result(b)
        elif bt == 'thinking':
            b = {'type': 'thinking', 'thinking': trunc(b.get('thinking', ''), THINKING_KEEP)}
        elif bt == 'tool_use':
            raw = json.dumps(b.get('input'))
            if len(raw) > TOOL_INPUT_KEEP:
                b['input'] = {'_truncated': trunc(raw, TOOL_INPUT_KEEP)}
            b.pop('signature', None)
        out.append(b)
    return out

def main(src, dst):
    kept = convo = 0
    with open(src) as f, open(dst, 'w') as w:
        for line in f:
            try:
                e = json.loads(line)
            except json.JSONDecodeError:
                continue
            t = e.get('type')
            if t in DROP_TYPES:
                continue
            slim = {'type': t}
            if e.get('timestamp'): slim['timestamp'] = e['timestamp']
            if e.get('isSidechain'): slim['isSidechain'] = True
            if t in ('user', 'assistant'):
                msg = e.get('message') or {}
                slim['message'] = {
                    'role': msg.get('role', t),
                    'content': slim_content(msg.get('content')),
                }
                convo += 1
            elif t in ('system', 'summary'):
                for k in ('subtype', 'content', 'summary', 'durationMs', 'level'):
                    if k in e: slim[k] = e[k]
            else:
                continue
            w.write(json.dumps(slim, separators=(',', ':')) + '\n')
            kept += 1
    print(f'filter-transcript: {src} -> {dst} ({kept} entries kept)')
    if convo == 0:
        # No user/assistant entries survived — transcript format may have
        # changed. Fail so the caller falls back to the raw transcript.
        print('filter-transcript: no conversation entries found; failing '
              'so the caller uses the unfiltered transcript', file=sys.stderr)
        sys.exit(2)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
