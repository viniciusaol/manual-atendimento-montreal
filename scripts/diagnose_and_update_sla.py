import requests
import json
import time
import sys
from datetime import datetime
from collections import defaultdict

def main():
    headers = {'api_access_token': '225uXmdyRZfcQ4HhGeYzMZwF'}
    base = 'https://chat.vxautomation.com.br/api/v1/accounts/1'

    all_conversations = []
    session = requests.Session()
    session.headers.update(headers)

    print("Fetching conversations from Chatwoot...", flush=True)
    # Fetch 30 pages = 750 conversations
    for page in range(1, 31):
        try:
            r = session.get(f"{base}/conversations?status=all&page={page}", timeout=6)
            if r.status_code != 200:
                print(f"Page {page} status {r.status_code}", flush=True)
                break
            payload = r.json().get('data', {}).get('payload', [])
            if not payload:
                print(f"Page {page} empty. Done.", flush=True)
                break
            all_conversations.extend(payload)
            print(f"Page {page}: +{len(payload)} (Total: {len(all_conversations)})", flush=True)
        except Exception as e:
            print(f"Error page {page}: {e}", flush=True)
            break

    print(f"Total conversations retrieved: {len(all_conversations)}", flush=True)

    now_ts = int(time.time())
    now_dt = datetime.now()

    def process_slice(conversations, period_name):
        total = len(conversations)
        if total == 0:
            return {
                "period_name": period_name,
                "total_conversas": 0,
                "pct_meta_5min": 0,
                "tempo_medio_primeira_resposta_min": 0,
                "tempo_mediano_primeira_resposta_min": 0,
                "total_respondidas": 0,
                "total_dentro_meta": 0,
                "total_resolvidas": 0,
                "pct_resolvidas": 0,
                "total_sem_atribuicao": 0,
                "pct_sem_atribuicao": 0,
                "faixas_velocidade": {"super_rapido_2m": 0, "meta_2_5m": 0, "atraso_5_30m": 0, "critico_30m_plus": 0},
                "por_atendente": [],
                "por_horario": {str(h).zfill(2): 0 for h in range(8, 23)},
                "por_etiqueta": []
            }

        frt_list = []
        dentro_5m = 0
        resolvidas = 0
        sem_atribuicao = 0

        faixas = {
            "super_rapido_2m": 0,
            "meta_2_5m": 0,
            "atraso_5_30m": 0,
            "critico_30m_plus": 0
        }

        agent_stats = defaultdict(lambda: {
            "name": "",
            "total": 0,
            "respondidas": 0,
            "dentro_5m": 0,
            "frt_list": [],
            "resolvidas": 0
        })

        hourly_counts = {str(h).zfill(2): 0 for h in range(8, 23)}
        hourly_counts["outros"] = 0

        tag_counts = defaultdict(int)

        for c in conversations:
            created_at = c.get('created_at') or now_ts
            dt = datetime.fromtimestamp(created_at)
            hora_str = str(dt.hour).zfill(2)
            if hora_str in hourly_counts:
                hourly_counts[hora_str] += 1
            else:
                hourly_counts["outros"] += 1

            status = c.get('status')
            if status == 'resolved':
                resolvidas += 1

            labels = c.get('labels') or []
            if not labels:
                tag_counts["Sem etiqueta"] += 1
            else:
                for l in labels:
                    tag_counts[l] += 1

            assignee_obj = c.get('meta', {}).get('assignee')
            if not assignee_obj or not assignee_obj.get('name'):
                agent_name = "Não Atribuído"
                sem_atribuicao += 1
            else:
                agent_name = assignee_obj.get('name')

            agent_stats[agent_name]["name"] = agent_name
            agent_stats[agent_name]["total"] += 1
            if status == 'resolved':
                agent_stats[agent_name]["resolvidas"] += 1

            first_reply = c.get('first_reply_created_at')
            if first_reply and first_reply > created_at:
                diff_sec = first_reply - created_at
                diff_min = round(diff_sec / 60, 2)
                frt_list.append(diff_min)

                agent_stats[agent_name]["respondidas"] += 1
                agent_stats[agent_name]["frt_list"].append(diff_min)

                if diff_sec <= 300:
                    dentro_5m += 1
                    agent_stats[agent_name]["dentro_5m"] += 1

                if diff_sec <= 120:
                    faixas["super_rapido_2m"] += 1
                elif diff_sec <= 300:
                    faixas["meta_2_5m"] += 1
                elif diff_sec <= 1800:
                    faixas["atraso_5_30m"] += 1
                else:
                    faixas["critico_30m_plus"] += 1
            elif first_reply and first_reply <= created_at:
                frt_list.append(0.1)
                dentro_5m += 1
                faixas["super_rapido_2m"] += 1
                agent_stats[agent_name]["respondidas"] += 1
                agent_stats[agent_name]["dentro_5m"] += 1
                agent_stats[agent_name]["frt_list"].append(0.1)

        total_respondidas = len(frt_list)
        pct_meta_5min = round((dentro_5m / total_respondidas) * 100, 1) if total_respondidas > 0 else 0
        media_frt = round(sum(frt_list) / total_respondidas, 1) if total_respondidas > 0 else 0

        sorted_frt = sorted(frt_list)
        if total_respondidas > 0:
            mid = total_respondidas // 2
            mediana_frt = sorted_frt[mid] if total_respondidas % 2 != 0 else round((sorted_frt[mid-1] + sorted_frt[mid]) / 2, 1)
        else:
            mediana_frt = 0

        por_atendente_list = []
        for ag_name, st in agent_stats.items():
            ag_resp = st["respondidas"]
            ag_pct_5m = round((st["dentro_5m"] / ag_resp) * 100, 1) if ag_resp > 0 else 0
            ag_media = round(sum(st["frt_list"]) / ag_resp, 1) if ag_resp > 0 else 0
            ag_sorted = sorted(st["frt_list"])
            if ag_resp > 0:
                ag_mid = ag_resp // 2
                ag_mediana = ag_sorted[ag_mid] if ag_resp % 2 != 0 else round((ag_sorted[ag_mid-1] + ag_sorted[ag_mid]) / 2, 1)
            else:
                ag_mediana = 0
            ag_pct_res = round((st["resolvidas"] / st["total"]) * 100, 1) if st["total"] > 0 else 0

            por_atendente_list.append({
                "name": ag_name,
                "total": st["total"],
                "respondidas": ag_resp,
                "pct_meta_5min": ag_pct_5m,
                "tempo_medio_min": ag_media,
                "tempo_mediano_min": ag_mediana,
                "resolvidas": st["resolvidas"],
                "pct_resolvidas": ag_pct_res
            })

        por_atendente_list.sort(key=lambda x: x["total"], reverse=True)
        top_tags = [{"tag": k, "count": v, "pct": round((v / total) * 100, 1)} for k, v in sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)]

        return {
            "period_name": period_name,
            "total_conversas": total,
            "pct_meta_5min": pct_meta_5min,
            "tempo_medio_primeira_resposta_min": media_frt,
            "tempo_mediano_primeira_resposta_min": mediana_frt,
            "total_respondidas": total_respondidas,
            "total_dentro_meta": dentro_5m,
            "total_resolvidas": resolvidas,
            "pct_resolvidas": round((resolvidas / total) * 100, 1),
            "total_sem_atribuicao": sem_atribuicao,
            "pct_sem_atribuicao": round((sem_atribuicao / total) * 100, 1),
            "faixas_velocidade": faixas,
            "por_atendente": por_atendente_list,
            "por_horario": hourly_counts,
            "por_etiqueta": top_tags[:8]
        }

    # Slice by dates
    convs_mes_atual = [c for c in all_conversations if datetime.fromtimestamp(c.get('created_at', 0)).month == now_dt.month and datetime.fromtimestamp(c.get('created_at', 0)).year == now_dt.year]
    
    mes_ant = 12 if now_dt.month == 1 else now_dt.month - 1
    ano_ant = now_dt.year - 1 if now_dt.month == 1 else now_dt.year
    convs_mes_anterior = [c for c in all_conversations if datetime.fromtimestamp(c.get('created_at', 0)).month == mes_ant and datetime.fromtimestamp(c.get('created_at', 0)).year == ano_ant]

    convs_30d = [c for c in all_conversations if (now_ts - c.get('created_at', 0)) <= (30 * 86400)]
    convs_7d = [c for c in all_conversations if (now_ts - c.get('created_at', 0)) <= (7 * 86400)]

    print(f"Mês Atual (Setembro): {len(convs_mes_atual)} convs", flush=True)
    print(f"Mês Anterior (Agosto): {len(convs_mes_anterior)} convs", flush=True)
    print(f"Últimos 30 Dias: {len(convs_30d)} convs", flush=True)
    print(f"Últimos 7 Dias: {len(convs_7d)} convs", flush=True)

    report = {
        "generated_at": datetime.now().strftime("%d/%m/%Y às %H:%M"),
        "total_conversas_historico": len(all_conversations),
        "periods": {
            "mes_atual": process_slice(convs_mes_atual, "Mês Atual (Setembro/2026)"),
            "mes_anterior": process_slice(convs_mes_anterior, "Mês Anterior (Agosto/2026)"),
            "ultimos_30d": process_slice(convs_30d, "Últimos 30 Dias"),
            "ultimos_7d": process_slice(convs_7d, "Últimos 7 Dias")
        }
    }

    with open("data/chatwoot_sla_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print("Saved to data/chatwoot_sla_report.json successfully!", flush=True)

if __name__ == "__main__":
    main()
