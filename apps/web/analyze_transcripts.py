import json, re, os
from collections import Counter

transcript_files = [
    "/c/Users/jhami/.claude/projects/C--Users-jhami/c26e2244-9f8e-4c6a-994c-0d4a3898d272/subagents/agent-aa31c0afd467ea897.jsonl",
    "/c/Users/jhami/.claude/projects/C--Users-jhami/c26e2244-9f8e-4c6a-994c-0d4a3898d272/subagents/agent-a3656732f2e4f6584.jsonl",
    "/c/Users/jhami/.claude/projects/C--Users-jhami/c26e2244-9f8e-4c6a-994c-0d4a3898d272.jsonl",
    "/c/Users/jhami/.claude/projects/C--Users-jhami-Documents-Proyectos-sirer-project/2736568f-359c-4c87-af91-219407be7088.jsonl",
    "/c/Users/jhami/.claude/projects/C--Users-jhami/ee537a3b-b9f3-4739-a394-71d77324f290.jsonl",
    "/c/Users/jhami/.claude/projects/C--Users-jhami/112e9e83-0e2e-4041-a201-d4f4281af54f.jsonl",
    "/c/Users/jhami/.claude/projects/C--Users-jhami-Documents-Proyectos-sirer-project/c076ae29-46b6-408a-8d64-ff466868a75b.jsonl",
    "/c/Users/jhami/.claude/projects/C--Users-jhami-Documents-Proyectos-sirer-project/c076ae29-46b6-408a-8d64-ff466868a75b/subagents/agent-a7b41019a12aef690.jsonl",
    "/c/Users/jhami/.claude/projects/C--Users-jhami-Documents-Proyectos-sirer-project/c076ae29-46b6-408a-8d64-ff466868a75b/subagents/agent-a912835193ac747f7.jsonl",
    "/c/Users/jhami/.claude/projects/c--Users-jhami-Documents-Proyectos-toeic-exam/f884cc59-d045-4125-ac02-32b5286ae063.jsonl",
    "/c/Users/jhami/.claude/projects/c--Users-jhami-Documents-Proyectos-onconor-facturacion/062237cb-d4a6-4abd-9541-c9585096e6a3.jsonl",
    "/c/Users/jhami/.claude/projects/c--Users-jhami-Documents-Proyectos-onconor-facturacion/062237cb-d4a6-4abd-9541-c9585096e6a3/subagents/agent-a37005ee7ebc9414b.jsonl",
    "/c/Users/jhami/.claude/projects/c--Users-jhami-Documents-Proyectos-onconor-facturacion/f2ce3467-bf58-4686-bac8-bb7bb9f112be.jsonl",
    "/c/Users/jhami/.claude/projects/C--Users-jhami-Documents-Proyectos-sirer-project/23c58869-73bc-4191-8f3a-4d337dee174b.jsonl",
    "/c/Users/jhami/.claude/projects/C--Users-jhami-Documents-Proyectos-sirer-project/23c58869-73bc-4191-8f3a-4d337dee174b/subagents/agent-ab560a9a52899662e.jsonl",
    "/c/Users/jhami/.claude/projects/c--Users-jhami-Documents-Proyectos-onconor-facturacion/db7216a5-2605-4487-b2b3-341d0c231b8c.jsonl",
    "/c/Users/jhami/.claude/projects/c--Users-jhami-Documents-Proyectos-onconor-facturacion/db7216a5-2605-4487-b2b3-341d0c231b8c/subagents/agent-a48933e8406e702c4.jsonl",
    "/c/Users/jhami/.claude/projects/c--Users-jhami-Documents-Proyectos-onconor-facturacion/db7216a5-2605-4487-b2b3-341d0c231b8c/subagents/agent-a7c1ffbde5b354ca1.jsonl",
    "/c/Users/jhami/.claude/projects/c--Users-jhami-Documents-Proyectos-onconor-facturacion/db7216a5-2605-4487-b2b3-341d0c231b8c/subagents/agent-ad6096eaaa260b715.jsonl",
    "/c/Users/jhami/.claude/projects/c--Users-jhami-Documents-Proyectos-onconor-facturacion/db7216a5-2605-4487-b2b3-341d0c231b8c/subagents/agent-a171b1293c112681e.jsonl",
    "/c/Users/jhami/.claude/projects/C--Users-jhami--openclaw-workspace/d84315f8-d1cd-4a8c-9356-dbb8e72a2072.jsonl",
    "/c/Users/jhami/.claude/projects/C--Users-jhami--openclaw-workspace/b1ec535d-5c48-4372-8218-9ef89df8a8ec.jsonl",
    "/c/Users/jhami/.claude/projects/c--Users-jhami-Documents-Proyectos-onconor-facturacion/db7216a5-2605-4487-b2b3-341d0c231b8c/subagents/agent-a56c3bae042721147.jsonl",
    "/c/Users/jhami/.claude/projects/c--Users-jhami-Documents-Proyectos-onconor-facturacion/db7216a5-2605-4487-b2b3-341d0c231b8c/subagents/agent-adc83dadbc36628aa.jsonl",
    "/c/Users/jhami/.claude/projects/C--Users-jhami-Documents-Proyectos-netcontrol-ai/45fc6595-6bbd-40ab-b9f3-720ffe7d5d4c.jsonl",
    "/c/Users/jhami/.claude/projects/C--Users-jhami-Documents-Proyectos-netcontrol-ai/45fc6595-6bbd-40ab-b9f3-720ffe7d5d4c/subagents/agent-a60235343d91507ba.jsonl",
    "/c/Users/jhami/.claude/projects/C--Users-jhami-Documents-Proyectos-netcontrol-ai/7aca4249-87de-47c0-b579-7d2ba8bf365e.jsonl",
    "/c/Users/jhami/.claude/projects/C--Users-jhami-Documents-Proyectos-netcontrol-ai/12e6b895-e92f-4328-9e9d-ddb58c68139d.jsonl",
    "/c/Users/jhami/.claude/projects/C--Users-jhami/3ab305fa-78eb-40f1-9a73-f25b255717fc.jsonl",
    "/c/Users/jhami/.claude/projects/c--Users-jhami-Documents-Proyectos-onconor-facturacion/3b4370c9-85fc-456e-83bb-6ad99cedad13.jsonl",
    "/c/Users/jhami/.claude/projects/c--Users-jhami-Documents-Proyectos-onconor-facturacion/0679f1a4-daec-491c-ab15-efc5d3d9eb59.jsonl",
    "/c/Users/jhami/.claude/projects/c--Users-jhami-Documents-Proyectos-onconor-facturacion/0679f1a4-daec-491c-ab15-efc5d3d9eb59/subagents/agent-a1fea12e0d3430669.jsonl",
    "/c/Users/jhami/.claude/projects/c--Users-jhami-Documents-Proyectos-onconor-facturacion/0679f1a4-daec-491c-ab15-efc5d3d9eb59/subagents/agent-a11fd946e30f8793d.jsonl",
    "/c/Users/jhami/.claude/projects/c--Users-jhami-Documents-Proyectos-onconor-facturacion/0679f1a4-daec-491c-ab15-efc5d3d9eb59/subagents/agent-a5a72a00d0e45f760.jsonl",
    "/c/Users/jhami/.claude/projects/C--Users-jhami/d7649e26-000a-4d41-86b2-1aca109d70fe.jsonl",
    "/c/Users/jhami/.claude/projects/C--Users-jhami/b772c83d-7179-4b76-afdc-c3adb65e71a6.jsonl",
    "/c/Users/jhami/.claude/projects/c--Users-jhami-Documents-Proyectos-onconor-facturacion/b808758c-9c39-4774-8ed2-801739719a69.jsonl",
    "/c/Users/jhami/.claude/projects/C--Users-jhami--openclaw-workspace/0fc2d542-83b3-4eeb-883d-b0034b8747bc.jsonl",
    "/c/Users/jhami/.claude/projects/C--Users-jhami--openclaw-workspace/31879f76-e479-4613-a7bd-23abed819c23.jsonl",
    "/c/Users/jhami/.claude/projects/C--Users-jhami--openclaw-workspace/6e84cd76-de54-4fc3-ac70-5b4fc7f51f59.jsonl",
    "/c/Users/jhami/.claude/projects/C--Users-jhami/5d79a50d-948b-49f5-bb6f-c0f579c364a5.jsonl",
    "/c/Users/jhami/.claude/projects/c--Users-jhami-Documents-Proyectos-primos-silva/08664162-eb53-4677-9e55-0f81bd1832a5.jsonl",
    "/c/Users/jhami/.claude/projects/c--Users-jhami-Documents-Proyectos-onconor-facturacion/90292799-a844-4302-a818-a6bb333d3524.jsonl",
    "/c/Users/jhami/.claude/projects/c--Users-jhami-Documents-Proyectos-primos-silva/7c958382-0375-4dec-87d3-218b85139005.jsonl",
    "/c/Users/jhami/.claude/projects/c--Users-jhami-Documents-Proyectos-onconor-facturacion/90292799-a844-4302-a818-a6bb333d3524/subagents/agent-ae1ea9d1a16420816.jsonl",
    "/c/Users/jhami/.claude/projects/c--Users-jhami-Documents-Proyectos-onconor-facturacion/c958869f-0f4e-4611-ab2f-017973ff8f76.jsonl",
    "/c/Users/jhami/.claude/projects/c--Users-jhami-Documents-Proyectos-onconor-facturacion/90292799-a844-4302-a818-a6bb333d3524/subagents/agent-a2da77539eb5b2628.jsonl",
    "/c/Users/jhami/.claude/projects/c--Users-jhami-Documents-Proyectos-onconor-facturacion/cfdcb132-a8dc-4dde-ad7f-7e822141f3dc.jsonl",
    "/c/Users/jhami/.claude/projects/c--Users-jhami-Documents-Proyectos-WPAT/bbbf824a-df6c-4dec-a71a-1dae5c47263a.jsonl",
    "/c/Users/jhami/.claude/projects/c--Users-jhami-Documents-Proyectos-onconor-facturacion/a87cbbca-64e2-4b5d-9f68-7e9c9b19a2a4.jsonl",
]

bash_counter = Counter()
mcp_counter = Counter()

def leading_token(cmd):
    cmd = cmd.strip()
    tokens = cmd.split()
    i = 0
    while i < len(tokens) and re.match(r'^[A-Z_][A-Z0-9_]*=', tokens[i]):
        i += 1
    if i >= len(tokens):
        return None, None
    primary = tokens[i]
    if primary in ('sudo', 'timeout') and i + 1 < len(tokens):
        primary = tokens[i+1]
        i += 1
    first_arg = tokens[i+1] if i + 1 < len(tokens) else None
    return primary, first_arg

for path in transcript_files:
    if not os.path.exists(path):
        continue
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            if obj.get('type') != 'assistant':
                continue
            msg = obj.get('message', {})
            for item in msg.get('content', []):
                if item.get('type') != 'tool_use':
                    continue
                name = item.get('name', '')
                inp = item.get('input', {})
                if name == 'Bash':
                    cmd = inp.get('command', '')
                    primary, first_arg = leading_token(cmd)
                    if primary:
                        key = f"{primary} {first_arg}" if first_arg else primary
                        bash_counter[key] += 1
                elif name.startswith('mcp__'):
                    mcp_counter[name] += 1

print("=== TOP BASH COMMANDS ===")
for cmd, count in bash_counter.most_common(40):
    print(f"{count:4d}  {cmd}")

print("\n=== TOP MCP TOOLS ===")
for tool, count in mcp_counter.most_common(20):
    print(f"{count:4d}  {tool}")
