import json
import os
import urllib.request
import time
from collections import defaultdict, Counter

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
    # Load existing sample dialogues
    with open("data/sample_dialogues.json", encoding="utf-8") as f:
        dialogues = json.load(f)

    print(f"Loaded {len(dialogues)} dialogues from previous sample.")

    # Let's inspect more conversations across labels if needed
    # We will analyze:
    # 1. Main questions grouped by topic / category
    # 2. Points of friction / Where the customer drops off or complains
    # 3. Flaws in current attendant messages (robotic, delay, asking to download app too early, missing pricing, passive answers)
    # 4. Success patterns vs Failure patterns

    analysis = {
        "perguntas_frequentes_por_categoria": defaultdict(list),
        "falhas_identificadas_no_atendimento": [],
        "padroes_de_atrito": [],
        "analise_mensagens_atendente": []
    }

    for d in dialogues:
        cid = d["conversation_id"]
        contact = d["contact_name"]
        labels = d.get("labels", [])
        msgs = d["dialogue"]

        # Track conversation flow
        client_msgs = [m for m in msgs if m.get("message_type") == 0]
        staff_msgs = [m for m in msgs if m.get("message_type") == 1]

        # Analyze client questions
        for cm in client_msgs:
            text = cm["content"].strip()
            text_lower = text.lower()

            # Categorize
            if any(w in text_lower for w in ["preço", "valor", "quanto custa", "tabela", "mensalidade"]):
                analysis["perguntas_frequentes_por_categoria"]["Preços, Planos e Valores"].append({
                    "cid": cid, "contact": contact, "text": text
                })
            elif any(w in text_lower for w in ["locação", "locar", "alugar", "aluguel", "reserva de quadra", "horário de quadra", "sábado", "domingo"]):
                analysis["perguntas_frequentes_por_categoria"]["Locação de Quadras & Horários"].append({
                    "cid": cid, "contact": contact, "text": text
                })
            elif any(w in text_lower for w in ["iniciante", "nunca joguei", "achar as pessoas", "grupo", "dupla", "equipe", "trocam de grupo"]):
                analysis["perguntas_frequentes_por_categoria"]["Nivelamento & Formação de Turmas"].append({
                    "cid": cid, "contact": contact, "text": text
                })
            elif any(w in text_lower for w in ["raquete", "material", "bolinha", "comprar"]):
                analysis["perguntas_frequentes_por_categoria"]["Equipamentos & Materiais"].append({
                    "cid": cid, "contact": contact, "text": text
                })
            elif any(w in text_lower for w in ["reposição", "repor", "feriado", "falta", "remarcar", "antecipar", "chuva"]):
                analysis["perguntas_frequentes_por_categoria"]["Reposição, Faltas & Clima"].append({
                    "cid": cid, "contact": contact, "text": text
                })
            elif any(w in text_lower for w in ["cancelar", "cancelaram", "estorno", "isento", "reembolso"]):
                analysis["perguntas_frequentes_por_categoria"]["Cancelamentos, Estornos & Reclamações"].append({
                    "cid": cid, "contact": contact, "text": text
                })
            elif any(w in text_lower for w in ["experimental", "conhecer", "avulsa", "primeira aula"]):
                analysis["perguntas_frequentes_por_categoria"]["Aula Experimental / Primeira Aula"].append({
                    "cid": cid, "contact": contact, "text": text
                })

    # Save detailed categorized report
    with open("data/deep_audit_report.json", "w", encoding="utf-8") as f:
        json.dump(analysis, f, ensure_ascii=False, indent=2)

    print("Categorized questions summary:")
    for cat, items in analysis["perguntas_frequentes_por_categoria"].items():
        print(f"  - {cat}: {len(items)} menções extraídas")

if __name__ == "__main__":
    main()
