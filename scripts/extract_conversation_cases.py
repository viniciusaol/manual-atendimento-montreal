import json

with open("data/sample_dialogues.json", encoding="utf-8") as f:
    dialogues = json.load(f)

cases = []
for d in dialogues:
    cid = d["conversation_id"]
    contact = d["contact_name"]
    labels = d.get("labels", [])
    msgs = d["dialogue"]
    
    # Simple transcript formatting
    transcript = []
    for m in msgs:
        role = "CLIENTE" if m["message_type"] == 0 else ("SECRETARIA" if m["message_type"] == 1 else "SISTEMA")
        transcript.append(f"[{role}]: {m['content']}")

    cases.append({
        "cid": cid,
        "contact": contact,
        "labels": labels,
        "length": len(msgs),
        "transcript": transcript
    })

with open("data/case_studies.json", "w", encoding="utf-8") as f:
    json.dump(cases, f, ensure_ascii=False, indent=2)

print(f"Generated {len(cases)} case studies.")
