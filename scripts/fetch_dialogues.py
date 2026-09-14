import urllib.request
import json
import time
import os

BASE_URL = "https://chat.vxautomation.com.br/api/v1/accounts/1"
HEADERS = {
    "api_access_token": "225uXmdyRZfcQ4HhGeYzMZwF",
    "User-Agent": "Mozilla/5.0"
}

def api_get(endpoint):
    url = f"{BASE_URL}/{endpoint}"
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def main():
    with open("data/conversations_list_sample.json", encoding="utf-8") as f:
        all_convos = json.load(f)

    # Categorize conversations
    categories = {
        "interessado_lead": [],
        "aluno_mensalista": [],
        "pendente_formacao": [],
        "professor": [],
        "matchmaker": [],
        "outros": []
    }

    for c in all_convos:
        labels = c.get("labels", [])
        if "pendente_formação" in labels or "pendente_formaçao" in labels or any("forma" in l for l in labels):
            categories["pendente_formacao"].append(c)
        elif "professor" in labels:
            categories["professor"].append(c)
        elif "matchmaker" in labels:
            categories["matchmaker"].append(c)
        elif any(l in ["interessado", "recebeu_formulário", "fup_interessado", "pré-inscrito"] for l in labels):
            categories["interessado_lead"].append(c)
        elif any(l in ["aluno", "mensalista", "sócio", "familia"] for l in labels):
            categories["aluno_mensalista"].append(c)
        else:
            categories["outros"].append(c)

    targets = []
    targets.extend(categories["interessado_lead"][:15])
    targets.extend(categories["aluno_mensalista"][:15])
    targets.extend(categories["pendente_formacao"][:10])
    targets.extend(categories["professor"][:10])
    targets.extend(categories["matchmaker"][:8])
    targets.extend(categories["outros"][:7])

    # De-duplicate by ID
    unique_targets = {t["id"]: t for t in targets}.values()
    print(f"Total targeted conversations to download: {len(unique_targets)}")

    results = []
    for i, c in enumerate(unique_targets):
        cid = c["id"]
        contact = c.get("meta", {}).get("sender", {}).get("name", "Cliente")
        labels = c.get("labels", [])
        try:
            msg_data = api_get(f"conversations/{cid}/messages")
            messages = msg_data.get("payload", [])
            
            clean_msgs = []
            for m in messages:
                content = m.get("content")
                if content and content.strip():
                    sender_name = m.get("sender", {}).get("name") if m.get("sender") else "Sistema"
                    clean_msgs.append({
                        "id": m.get("id"),
                        "created_at": m.get("created_at"),
                        "message_type": m.get("message_type"), # 0: cliente, 1: atendente, 2: atividade
                        "sender_type": m.get("sender_type"),
                        "sender_name": sender_name,
                        "content": content.strip()
                    })

            if clean_msgs:
                results.append({
                    "conversation_id": cid,
                    "contact_name": contact,
                    "labels": labels,
                    "dialogue": clean_msgs
                })
            
            if (i + 1) % 10 == 0 or i == len(unique_targets) - 1:
                print(f"Downloaded {i+1}/{len(unique_targets)} conversations...")
            time.sleep(0.2)
        except Exception as e:
            print(f"Error fetching convo {cid}: {e}")

    with open("data/sample_dialogues.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\nDone! Successfully saved {len(results)} conversation dialogues to data/sample_dialogues.json")

if __name__ == "__main__":
    main()
