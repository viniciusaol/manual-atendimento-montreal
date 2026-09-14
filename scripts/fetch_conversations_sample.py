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
    os.makedirs("data", exist_ok=True)
    all_conversations = []
    
    # Let's fetch the first 10 pages of conversations (250 conversations) to get recent interactions
    print("Fetching conversations list (pages 1 to 10)...")
    for page in range(1, 11):
        try:
            data = api_get(f"conversations?status=all&page={page}")
            payload = data.get("data", {}).get("payload", [])
            if not payload:
                print(f"Page {page} empty, stopping.")
                break
            all_conversations.extend(payload)
            print(f"Page {page}: fetched {len(payload)} conversations (Total: {len(all_conversations)})")
            time.sleep(0.3)
        except Exception as e:
            print(f"Error fetching page {page}: {e}")
            break

    with open("data/conversations_list_sample.json", "w", encoding="utf-8") as f:
        json.dump(all_conversations, f, ensure_ascii=False, indent=2)

    print(f"\nSaved {len(all_conversations)} conversations to data/conversations_list_sample.json")

    # Now let's fetch messages for 50 interesting conversations (with messages count > 2)
    sample_targets = [c for c in all_conversations if (c.get("messages_count", 0) or 0) >= 3][:60]
    print(f"\nFetching detailed messages for {len(sample_targets)} conversations with dialogue...")

    detailed_convos = []
    for i, c in enumerate(sample_targets):
        cid = c.get("id")
        contact = c.get("meta", {}).get("sender", {}).get("name", "Unknown")
        labels = c.get("labels", [])
        try:
            msg_data = api_get(f"conversations/{cid}/messages")
            messages = msg_data.get("payload", [])
            
            # Format clean dialogue
            dialogue = []
            for m in messages:
                sender_type = m.get("sender_type")
                content = m.get("content")
                if content:
                    dialogue.append({
                        "id": m.get("id"),
                        "created_at": m.get("created_at"),
                        "message_type": m.get("message_type"), # 0: incoming (client), 1: outgoing (agent)
                        "sender_type": sender_type,
                        "sender_name": m.get("sender", {}).get("name") if m.get("sender") else None,
                        "content": content
                    })

            detailed_convos.append({
                "conversation_id": cid,
                "contact_name": contact,
                "labels": labels,
                "messages_count": len(dialogue),
                "dialogue": dialogue
            })
            if (i + 1) % 10 == 0 or i == len(sample_targets) - 1:
                print(f"Fetched messages for {i+1}/{len(sample_targets)} conversations...")
            time.sleep(0.25)
        except Exception as e:
            print(f"Error fetching messages for #{cid}: {e}")

    with open("data/detailed_conversations_sample.json", "w", encoding="utf-8") as f:
        json.dump(detailed_convos, f, ensure_ascii=False, indent=2)

    print(f"\nDone! Detailed dialogues saved to data/detailed_conversations_sample.json")

if __name__ == "__main__":
    main()
