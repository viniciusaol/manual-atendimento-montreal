import json
import uuid
import os

code_content = """// ========================================================
// CONFIGURAÇÕES DE DESTINO E REGRAS DE SLA
// ========================================================
// Mude para true para testar disparando apenas no seu telefone pessoal
const MODO_TESTE = false;

const TELEFONE_TESTE = ['5541988731963'];
const TELEFONES_PRODUCAO = ['5541936183407', '554188097503'];

const DESTINATARIOS = MODO_TESTE ? TELEFONE_TESTE : TELEFONES_PRODUCAO;

// Etiquetas de espera legítima (não geram alerta falso de 30m)
const ETIQUETAS_IGNORAR_30M = ['aguardando-professor', 'aguardando-aluno', 'em-espera', 'espera', 'turma-em-formacao'];

const responseData = $input.first().json;
const payload = responseData.data?.payload || responseData.payload || [];

const nowSec = Math.floor(Date.now() / 1000);
const agoraFormatada = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

const clientesSemResposta30m = [];
const conversasAbertas24h = [];

function formatarTempoEspera(segundos) {
  const min = Math.floor(segundos / 60);
  if (min < 60) return `${min} min`;
  const horas = Math.floor(min / 60);
  const minRestantes = min % 60;
  if (horas < 24) return `${horas}h ${minRestantes}m`;
  const dias = Math.floor(horas / 24);
  return `${dias}d ${horas % 24}h`;
}

for (const conv of payload) {
  if (conv.status !== 'open') continue;

  const convId = conv.id;
  const labels = conv.labels || [];
  const sender = conv.meta?.sender || {};
  const clienteNome = sender.name || 'Cliente sem nome';
  const clienteTelefone = sender.phone_number || 'Sem telefone';
  const assignee = conv.meta?.assignee?.name || '⚠️ Não atribuído';
  const chatwootLink = `https://chat.vxautomation.com.br/app/accounts/1/conversations/${convId}`;

  const waitingSince = conv.waiting_since || 0;
  const lastActivityAt = conv.last_activity_at || conv.created_at || nowSec;
  
  const tempoEsperando = waitingSince > 0 ? (nowSec - waitingSince) : 0;
  const tempoAbertoTotal = nowSec - lastActivityAt;

  const temEtiquetaEspera = labels.some(l => ETIQUETAS_IGNORAR_30M.includes(l.toLowerCase()));

  // 1. REGRA 30 MIN: Cliente mandou mensagem e está aguardando retorno há mais de 30 min
  if (waitingSince > 0 && tempoEsperando >= (30 * 60) && !temEtiquetaEspera) {
    clientesSemResposta30m.push({
      id: convId,
      nome: clienteNome,
      telefone: clienteTelefone,
      atendente: assignee,
      tempoStr: formatarTempoEspera(tempoEsperando),
      link: chatwootLink,
      labels: labels
    });
  }

  // 2. REGRA 24H: Conversa aberta estagnada há mais de 24h
  if (tempoAbertoTotal >= (24 * 3600) && !labels.includes('em-espera')) {
    conversasAbertas24h.push({
      id: convId,
      nome: clienteNome,
      telefone: clienteTelefone,
      atendente: assignee,
      tempoStr: formatarTempoEspera(tempoAbertoTotal),
      link: chatwootLink,
      labels: labels
    });
  }
}

const temPendencias = clientesSemResposta30m.length > 0 || conversasAbertas24h.length > 0;

if (!temPendencias) {
  return [{ json: { tem_pendencias: false, mensagem: 'Tudo em dia! Nenhuma conversa pendente.', destinatarios: [] } }];
}

// Montagem da Mensagem do WhatsApp
let msg = `🎾 *MONTREAL TÊNIS CLUBE | Alerta de SLA de Atendimento*\\n📅 *Horário da Verificação:* ${agoraFormatada}\\n\\n`;

if (clientesSemResposta30m.length > 0) {
  msg += `🚨 *CLIENTES AGUARDANDO RESPOSTA (>30 MIN) — ${clientesSemResposta30m.length} contato(s):*\\n`;
  clientesSemResposta30m.forEach((c, i) => {
    msg += `\\n${i + 1}️⃣ *${c.nome}* (${c.telefone})\\n`;
    msg += `⏱️ Esperando há: *${c.tempoStr}*\\n`;
    msg += `👤 Atendente: *${c.atendente}*\\n`;
    msg += `🔗 ${c.link}\\n`;
  });
  msg += `\\n`;
}

if (conversasAbertas24h.length > 0) {
  msg += `📋 *CONVERSAS ABERTAS HÁ MAIS DE 24H (${conversasAbertas24h.length}):*\\n`;
  const exibidas = conversasAbertas24h.slice(0, 8);
  exibidas.forEach((c, i) => {
    msg += `• *${c.nome}* (Aberta há ${c.tempoStr}) — Resp: *${c.atendente}*\\n`;
    msg += `  🔗 ${c.link}\\n`;
  });
  if (conversasAbertas24h.length > 8) {
    msg += `  _(e mais ${conversasAbertas24h.length - 8} conversas abertas no Chatwoot)_\\n`;
  }
}

msg += `\\n⚠️ *Ação recomendada:* Favor priorizar o retorno aos clientes pendentes e fechar conversas resolvidas!`;

// Retorna um item para cada telefone de destino
return DESTINATARIOS.map(tel => ({
  json: {
    tem_pendencias: true,
    telefone_destino: tel,
    mensagem: msg,
    qtd_30m: clientesSemResposta30m.length,
    qtd_24h: conversasAbertas24h.length
  }
}));"""

workflow = {
  "name": "Montreal Tênis - Gestão & Alerta de SLA de Atendimento (Chatwoot)",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "cronExpression",
              "expression": "*/30 8-22 * * *"
            }
          ]
        }
      },
      "id": str(uuid.uuid4()),
      "name": "Disparo a cada 30 min (08h às 22h)",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.2,
      "position": [200, 300]
    },
    {
      "parameters": {},
      "id": str(uuid.uuid4()),
      "name": "Testar Agora (Manual)",
      "type": "n8n-nodes-base.manualTrigger",
      "typeVersion": 1,
      "position": [200, 480]
    },
    {
      "parameters": {
        "url": "https://chat.vxautomation.com.br/api/v1/accounts/1/conversations",
        "sendHeaders": True,
        "headerParameters": {
          "parameters": [
            {
              "name": "api_access_token",
              "value": "225uXmdyRZfcQ4HhGeYzMZwF"
            }
          ]
        },
        "sendQuery": True,
        "queryParameters": {
          "parameters": [
            {
              "name": "status",
              "value": "open"
            },
            {
              "name": "page",
              "value": "1"
            }
          ]
        },
        "options": {}
      },
      "id": str(uuid.uuid4()),
      "name": "Buscar Conversas Abertas no Chatwoot",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [460, 380]
    },
    {
      "parameters": {
        "jsCode": code_content
      },
      "id": str(uuid.uuid4()),
      "name": "Analisar SLA (30min & 24h) e Montar Relatório",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [700, 380]
    },
    {
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": True,
            "leftValue": "",
            "typeValidation": "strict",
            "version": 2
          },
          "conditions": [
            {
              "id": str(uuid.uuid4()),
              "leftValue": "={{ $json.tem_pendencias }}",
              "rightValue": True,
              "operator": {
                "type": "boolean",
                "operation": "equals"
              }
            }
          ],
          "combinator": "and"
        }
      },
      "id": str(uuid.uuid4()),
      "name": "Tem Conversas Pendentes?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2.2,
      "position": [940, 380]
    },
    {
      "parameters": {
        "resource": "contact",
        "operation": "search",
        "accountId": {
          "__rl": True,
          "value": "1",
          "mode": "list"
        },
        "searchQuery": "={{ $json.telefone_destino }}"
      },
      "id": str(uuid.uuid4()),
      "name": "Buscar Contato no Chatwoot",
      "type": "@fazer-ai/n8n-nodes-chatwoot.chatwoot",
      "typeVersion": 1,
      "position": [1180, 280],
      "credentials": {
        "fazerAiChatwootApi": {
          "id": "fB0aqKwNZZKGeE0W",
          "name": "Chatwoot fazer.ai account"
        }
      }
    },
    {
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": True,
            "leftValue": "",
            "typeValidation": "strict",
            "version": 2
          },
          "conditions": [
            {
              "id": str(uuid.uuid4()),
              "leftValue": "={{ $json.id }}",
              "rightValue": "",
              "operator": {
                "type": "string",
                "operation": "notEmpty"
              }
            }
          ],
          "combinator": "and"
        }
      },
      "id": str(uuid.uuid4()),
      "name": "Contato Existe?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2.2,
      "position": [1400, 280]
    },
    {
      "parameters": {
        "resource": "contact",
        "accountId": {
          "__rl": True,
          "value": "1",
          "mode": "list"
        },
        "name": "Gestão / Secretaria Montreal",
        "phoneNumber": "={{ $('Analisar SLA (30min & 24h) e Montar Relatório').item.json.telefone_destino.startsWith('+') ? $('Analisar SLA (30min & 24h) e Montar Relatório').item.json.telefone_destino : '+' + $('Analisar SLA (30min & 24h) e Montar Relatório').item.json.telefone_destino }}",
        "additionalFields": {}
      },
      "id": str(uuid.uuid4()),
      "name": "Criar Contato se Não Existir",
      "type": "@fazer-ai/n8n-nodes-chatwoot.chatwoot",
      "typeVersion": 1,
      "position": [1620, 380],
      "credentials": {
        "fazerAiChatwootApi": {
          "id": "fB0aqKwNZZKGeE0W",
          "name": "Chatwoot fazer.ai account"
        }
      }
    },
    {
      "parameters": {
        "operation": "create",
        "accountId": {
          "__rl": True,
          "value": "1",
          "mode": "list"
        },
        "inboxId": {
          "__rl": True,
          "value": "7",
          "mode": "list"
        },
        "contactId": "={{ $json.payload ? $json.payload.contact.id : $json.id }}"
      },
      "id": str(uuid.uuid4()),
      "name": "Obter / Criar Conversa",
      "type": "@fazer-ai/n8n-nodes-chatwoot.chatwoot",
      "typeVersion": 1,
      "position": [1860, 280],
      "credentials": {
        "fazerAiChatwootApi": {
          "id": "fB0aqKwNZZKGeE0W",
          "name": "Chatwoot fazer.ai account"
        }
      }
    },
    {
      "parameters": {
        "operation": "sendMessage",
        "accountId": {
          "__rl": True,
          "value": "1",
          "mode": "list"
        },
        "inboxId": {
          "__rl": True,
          "value": "7",
          "mode": "list"
        },
        "conversationId": "={{ $json.id }}",
        "content": "={{ $('Analisar SLA (30min & 24h) e Montar Relatório').item.json.mensagem }}",
        "additionalFields": {}
      },
      "id": str(uuid.uuid4()),
      "name": "Disparar Alerta no WhatsApp",
      "type": "@fazer-ai/n8n-nodes-chatwoot.chatwoot",
      "typeVersion": 1,
      "position": [2100, 280],
      "credentials": {
        "fazerAiChatwootApi": {
          "id": "fB0aqKwNZZKGeE0W",
          "name": "Chatwoot fazer.ai account"
        }
      }
    }
  ],
  "pinData": {},
  "connections": {
    "Disparo a cada 30 min (08h às 22h)": {
      "main": [
        [
          {
            "node": "Buscar Conversas Abertas no Chatwoot",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Testar Agora (Manual)": {
      "main": [
        [
          {
            "node": "Buscar Conversas Abertas no Chatwoot",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Buscar Conversas Abertas no Chatwoot": {
      "main": [
        [
          {
            "node": "Analisar SLA (30min & 24h) e Montar Relatório",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Analisar SLA (30min & 24h) e Montar Relatório": {
      "main": [
        [
          {
            "node": "Tem Conversas Pendentes?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Tem Conversas Pendentes?": {
      "main": [
        [
          {
            "node": "Buscar Contato no Chatwoot",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Buscar Contato no Chatwoot": {
      "main": [
        [
          {
            "node": "Contato Existe?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Contato Existe?": {
      "main": [
        [
          {
            "node": "Obter / Criar Conversa",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Criar Contato se Não Existir",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Criar Contato se Não Existir": {
      "main": [
        [
          {
            "node": "Obter / Criar Conversa",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Obter / Criar Conversa": {
      "main": [
        [
          {
            "node": "Disparar Alerta no WhatsApp",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "active": False,
  "settings": {
    "executionOrder": "v1"
  },
  "versionId": str(uuid.uuid4()),
  "meta": {
    "templateCredsSetupCompleted": True,
    "instanceId": "33738330930e3881dd5571eca013f36ddf8aab20e4ea5c1f2ebaf4a2b4668ac6"
  },
  "id": "montreal-sla-alertas",
  "tags": []
}

targets = [
    r"data/Montreal_Tenis_Gestao_SLA_Atendimento_n8n.json",
    r"C:/Users/vinic/Downloads/Montreal_Tenis_Gestao_SLA_Atendimento_n8n.json"
]

for t in targets:
    with open(t, "w", encoding="utf-8") as f:
        json.dump(workflow, f, indent=2, ensure_ascii=False)
    print("Written cleanly to:", t)

# Verify validity
for t in targets:
    with open(t, encoding="utf-8") as f:
        d = json.load(f)
    print("Verified valid JSON:", t, "Nodes:", len(d.get("nodes", [])))
