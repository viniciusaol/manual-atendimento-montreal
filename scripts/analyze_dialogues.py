import json
import re
from collections import Counter

def main():
    with open("data/sample_dialogues.json", encoding="utf-8") as f:
        convos = json.load(f)

    print(f"Total conversations: {len(convos)}")
    total_msgs = sum(len(c["dialogue"]) for c in convos)
    print(f"Total messages: {total_msgs}")

    # Extract attendant standard messages / templates
    attendant_msgs = []
    client_questions = []

    # Keywords tracker
    keywords = [
        "aula", "preço", "valor", "mensalidade", "planos", "horário", "reposição",
        "chuva", "quadra", "aluguel", "locação", "raquete", "bolinha", "cancelar",
        "professor", "turma", "nível", "iniciante", "kids", "criança", "torneio",
        "matchpoint", "gympass", "estacionamento", "endereço", "uniforme", "pagamento"
    ]
    keyword_counts = Counter()

    for c in convos:
        for m in c["dialogue"]:
            text = m["content"]
            text_lower = text.lower()
            
            for kw in keywords:
                if kw in text_lower:
                    keyword_counts[kw] += 1

            if m.get("message_type") == 0: # Client
                # Check if it has question mark or question intent
                if "?" in text or any(w in text_lower for w in ["como", "quanto", "tem", "qual", "pode", "queria"]):
                    client_questions.append({
                        "contact": c["contact_name"],
                        "labels": c["labels"],
                        "question": text
                    })
            elif m.get("message_type") == 1: # Attendant
                # Only longer substantive messages (likely procedures or explanations)
                if len(text) > 60:
                    attendant_msgs.append({
                        "contact": c["contact_name"],
                        "labels": c["labels"],
                        "text": text
                    })

    print("\n================== TOP PALAVRAS-CHAVE DETECTADAS ==================")
    for kw, count in keyword_counts.most_common(20):
        print(f"  {kw:<15}: {count} menções")

    # Save extracted analysis
    analysis_result = {
        "keyword_counts": dict(keyword_counts),
        "client_questions_sample": client_questions[:40],
        "attendant_scripts_sample": attendant_msgs[:40]
    }

    with open("data/analysis_summary.json", "w", encoding="utf-8") as f:
        json.dump(analysis_result, f, ensure_ascii=False, indent=2)

    print("\nSaved full analysis to data/analysis_summary.json successfully!")

if __name__ == "__main__":
    main()
