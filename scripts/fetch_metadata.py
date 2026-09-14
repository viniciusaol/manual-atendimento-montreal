import urllib.request
import json
import os

BASE_URL = "https://chat.vxautomation.com.br/api/v1/accounts/1"
HEADERS = {
    "api_access_token": "225uXmdyRZfcQ4HhGeYzMZwF",
    "User-Agent": "Mozilla/5.0"
}

def get(endpoint):
    url = f"{BASE_URL}/{endpoint}"
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def main():
    print("Fetching metadata from Chatwoot...")
    metadata = {}
    
    for ep in ["agents", "teams", "labels", "custom_attribute_definitions"]:
        try:
            data = get(ep)
            items = data.get("payload", data) if isinstance(data, dict) else data
            metadata[ep] = items
            print(f"Loaded {ep}: {len(items)}")
        except Exception as e:
            print(f"Error loading {ep}: {e}")

    os.makedirs("data", exist_ok=True)
    with open("data/metadata.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)

    print("\n--- AGENTS ---")
    for a in metadata.get("agents", []):
        print(f"ID {a.get('id')}: {a.get('name')} <{a.get('email')}> | Role: {a.get('role')}")

    print("\n--- LABELS ---")
    for l in metadata.get("labels", []):
        print(f"Label: {l.get('title')}")

    print("\n--- TEAMS ---")
    for t in metadata.get("teams", []):
        print(f"Team: {t.get('name')}")

if __name__ == "__main__":
    main()
