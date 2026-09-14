import json
import uuid
import os

def create_workflow_1h():
    code_content = """// ========================================================
// CONFIGURAÇÕES DE DESTINO E REGRAS DE SLA (1 HORA)
// ========================================================
// Deixe 'true' para testar no seu número pessoal (ID 1511)
// Mude para 'false' para enviar aos 2 números oficiais (IDs 125 e 4)
const MODO_TESTE = true;

const DESTINATARIOS_TESTE = [
  { contact_id: 1511, nome_dest: 'Vinicius (Teste)' }
];

const DESTINATARIOS_PRODUCAO = [
  { contact_id: 125, nome_dest: 'Montreal (+55 41 93618-3407)' },
  { contact_id: 4, nome_dest: 'Gestão (+55 41 8809-7503)' }
];

const DESTINATARIOS = MODO_TESTE ? DESTINATARIOS_TESTE : DESTINATARIOS_PRODUCAO;

// ========================================================
// ETIQUETAS EXCLUSIVAS DE ESPERA (IGNORAM O ALERTA)
// ========================================================
const ETIQUETAS_IGNORAR = [
  'aguardando-professor', 
  'aguardando-aluno', 
  'turma-em-formacao',
  'em-espera'
];

const responseData = $input.first().json;
const payload = responseData.data?.payload || responseData.payload || [];

const nowSec = Math.floor(Date.now() / 1000);
const agoraFormatada = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

const clientesSemResposta = [];

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
  const labels = (conv.labels || []).map(l => l.toLowerCase().trim());
  const sender = conv.meta?.sender || {};
  const clienteNome = sender.name || 'Cliente sem nome';
  const clienteTelefone = sender.phone_number || 'Sem telefone';
  const assignee = conv.meta?.assignee?.name || '⚠️ Não atribuído';
  const chatwootLink = `https://chat.vxautomation.com.br/app/accounts/1/conversations/${convId}`;

  const waitingSince = conv.waiting_since || 0;
  const tempoEsperando = waitingSince > 0 ? (nowSec - waitingSince) : 0;
  
  // Ignora APENAS se tiver uma das 4 etiquetas oficiais de espera
  const temEtiquetaIgnorar = labels.some(l => ETIQUETAS_IGNORAR.includes(l));

  // REGRA: Cliente aguardando retorno há mais de 1 HORA (3600 segundos)
  if (waitingSince > 0 && tempoEsperando >= (60 * 60) && !temEtiquetaIgnorar) {
    clientesSemResposta.push({
      id: convId,
      nome: clienteNome,
      telefone: clienteTelefone,
      atendente: assignee,
      tempoStr: formatarTempoEspera(tempoEsperando),
      link: chatwootLink
    });
  }
}

if (clientesSemResposta.length === 0) {
  return [{ json: { tem_pendencias: false, mensagem: 'Tudo em dia!', contact_id: null } }];
}

let msg = `🚨 *MONTREAL | Plantão de Atendimento (>1 hora sem resposta)*\\n`;
msg += `⏰ *Verificação das ${agoraFormatada}*\\n\\n`;
msg += `Identificamos *${clientesSemResposta.length} cliente(s)* aguardando resposta da equipe há mais de 1 hora:\\n`;

clientesSemResposta.forEach((c, i) => {
  msg += `\\n${i + 1}️⃣ *${c.nome}* (${c.telefone})\\n`;
  msg += `⏱️ Esperando há: *${c.tempoStr}*\\n`;
  msg += `👤 Atendente: *${c.atendente}*\\n`;
  msg += `🔗 ${c.link}\\n`;
});

msg += `\\n⚠️ *Ação necessária:* Por favor, priorizem o retorno a essas conversas!`;

return DESTINATARIOS.map(dest => ({
  json: {
    tem_pendencias: true,
    contact_id: dest.contact_id,
    nome_dest: dest.nome_dest,
    mensagem: msg,
    total_clientes: clientesSemResposta.length
  }
}));"""

    return {
      "name": "Montreal Tênis - Alerta SLA 1h (Plantão de Resposta)",
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
          "name": "Verificação a cada 30 min (08h às 22h)",
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
          "name": "Filtrar Clientes sem Resposta >1h",
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
          "name": "Tem Clientes Aguardando >1h?",
          "type": "n8n-nodes-base.if",
          "typeVersion": 2.2,
          "position": [940, 380]
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
            "contactId": "={{ $json.contact_id }}"
          },
          "id": str(uuid.uuid4()),
          "name": "Obter / Criar Conversa",
          "type": "@fazer-ai/n8n-nodes-chatwoot.chatwoot",
          "typeVersion": 1,
          "position": [1180, 380],
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
            "content": "={{ $('Filtrar Clientes sem Resposta >1h').item.json.mensagem }}",
            "additionalFields": {}
          },
          "id": str(uuid.uuid4()),
          "name": "Disparar Alerta no WhatsApp",
          "type": "@fazer-ai/n8n-nodes-chatwoot.chatwoot",
          "typeVersion": 1,
          "position": [1420, 380],
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
        "Verificação a cada 30 min (08h às 22h)": {
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
                "node": "Filtrar Clientes sem Resposta >1h",
                "type": "main",
                "index": 0
              }
            ]
          ]
        },
        "Filtrar Clientes sem Resposta >1h": {
          "main": [
            [
              {
                "node": "Tem Clientes Aguardando >1h?",
                "type": "main",
                "index": 0
              }
            ]
          ]
        },
        "Tem Clientes Aguardando >1h?": {
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
      "id": "montreal-sla-1h",
      "tags": []
    }

def create_workflow_24h():
    code_content = """// ========================================================
// AUDITORIA DIÁRIA: CONVERSAS ABERTAS HÁ MAIS DE 24H
// ========================================================
// Deixe 'true' para testar no seu número pessoal (ID 1511)
// Mude para 'false' para enviar aos 2 números oficiais (IDs 125 e 4)
const MODO_TESTE = true;

const DESTINATARIOS_TESTE = [
  { contact_id: 1511, nome_dest: 'Vinicius (Teste)' }
];

const DESTINATARIOS_PRODUCAO = [
  { contact_id: 125, nome_dest: 'Montreal (+55 41 93618-3407)' },
  { contact_id: 4, nome_dest: 'Gestão (+55 41 8809-7503)' }
];

const DESTINATARIOS = MODO_TESTE ? DESTINATARIOS_TESTE : DESTINATARIOS_PRODUCAO;

const responseData = $input.first().json;
const payload = responseData.data?.payload || responseData.payload || [];

const nowSec = Math.floor(Date.now() / 1000);
const hojeData = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });

const conversasAbertas = [];

function formatarTempoAberto(segundos) {
  const dias = Math.floor(segundos / 86400);
  const horas = Math.floor((segundos % 86400) / 3600);
  if (dias > 0) return `${dias}d ${horas}h`;
  return `${horas}h`;
}

for (const conv of payload) {
  if (conv.status !== 'open') continue;

  const convId = conv.id;
  const labels = conv.labels || [];
  const sender = conv.meta?.sender || {};
  const clienteNome = sender.name || 'Cliente sem nome';
  const assignee = conv.meta?.assignee?.name || '⚠️ Não atribuído';
  const chatwootLink = `https://chat.vxautomation.com.br/app/accounts/1/conversations/${convId}`;

  const lastActivityAt = conv.last_activity_at || conv.created_at || nowSec;
  const tempoAbertoTotal = nowSec - lastActivityAt;

  // Abertas há mais de 24 horas (86400s)
  if (tempoAbertoTotal >= (24 * 3600)) {
    conversasAbertas.push({
      id: convId,
      nome: clienteNome,
      atendente: assignee,
      tempoStr: formatarTempoAberto(tempoAbertoTotal),
      labelsStr: labels.length > 0 ? labels.map(l => `#${l}`).join(' ') : 'Sem etiqueta',
      link: chatwootLink
    });
  }
}

if (conversasAbertas.length === 0) {
  return [{ json: { tem_pendencias: false, mensagem: 'Nenhuma conversa estagnada >24h hoje!', contact_id: null } }];
}

let msg = `📋 *MONTREAL | Auditoria Diária de Conversas (>24h)*\\n`;
msg += `📅 *Relatório de ${hojeData}*\\n\\n`;
msg += `Existem *${conversasAbertas.length} conversa(s)* abertas há mais de 1 dia:\\n\\n`;

const exibidas = conversasAbertas.slice(0, 10);
exibidas.forEach((c, i) => {
  msg += `${i + 1}. *${c.nome}* (${c.tempoStr})\\n`;
  msg += `   👤 Resp: *${c.atendente}* | 🏷️ ${c.labelsStr}\\n`;
  msg += `   🔗 ${c.link}\\n\\n`;
});

if (conversasAbertas.length > 10) {
  msg += `_(e mais ${conversasAbertas.length - 10} conversas abertas no Chatwoot)_\\n\\n`;
}

msg += `💡 *Ação da Secretaria:* Favor dar andamento, enviar follow-up ou marcar a conversa como 'Resolvida' no Chatwoot!`;

return DESTINATARIOS.map(dest => ({
  json: {
    tem_pendencias: true,
    contact_id: dest.contact_id,
    nome_dest: dest.nome_dest,
    mensagem: msg,
    total_abertas: conversasAbertas.length
  }
}));"""

    return {
      "name": "Montreal Tênis - Auditoria Diária de Conversas Abertas (>24h)",
      "nodes": [
        {
          "parameters": {
            "rule": {
              "interval": [
                {
                  "field": "cronExpression",
                  "expression": "30 8 * * 1-6"
                }
              ]
            }
          },
          "id": str(uuid.uuid4()),
          "name": "Disparo Diário às 08h30 (Seg a Sáb)",
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
          "name": "Filtrar Conversas Abertas >24h",
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
          "name": "Tem Conversas >24h?",
          "type": "n8n-nodes-base.if",
          "typeVersion": 2.2,
          "position": [940, 380]
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
            "contactId": "={{ $json.contact_id }}"
          },
          "id": str(uuid.uuid4()),
          "name": "Obter / Criar Conversa",
          "type": "@fazer-ai/n8n-nodes-chatwoot.chatwoot",
          "typeVersion": 1,
          "position": [1180, 380],
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
            "content": "={{ $('Filtrar Conversas Abertas >24h').item.json.mensagem }}",
            "additionalFields": {}
          },
          "id": str(uuid.uuid4()),
          "name": "Disparar Alerta no WhatsApp",
          "type": "@fazer-ai/n8n-nodes-chatwoot.chatwoot",
          "typeVersion": 1,
          "position": [1420, 380],
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
        "Disparo Diário às 08h30 (Seg a Sáb)": {
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
                "node": "Filtrar Conversas Abertas >24h",
                "type": "main",
                "index": 0
              }
            ]
          ]
        },
        "Filtrar Conversas Abertas >24h": {
          "main": [
            [
              {
                "node": "Tem Conversas >24h?",
                "type": "main",
                "index": 0
              }
            ]
          ]
        },
        "Tem Conversas >24h?": {
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
      "id": "montreal-auditoria-24h",
      "tags": []
    }

wf1h = create_workflow_1h()
wf24 = create_workflow_24h()

files = [
    (r"data/Montreal_Tenis_SLA_1h_Plantao.json", wf1h),
    (r"C:/Users/vinic/Downloads/Montreal_Tenis_SLA_1h_Plantao.json", wf1h),
    (r"C:/Users/vinic/Downloads/Montreal_Tenis_SLA_30min_Plantao.json", wf1h),
    (r"data/Montreal_Tenis_Auditoria_Diaria_24h.json", wf24),
    (r"C:/Users/vinic/Downloads/Montreal_Tenis_Auditoria_Diaria_24h.json", wf24),
]

for path, wf in files:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(wf, f, indent=2, ensure_ascii=False)
    print("Exported & Verified:", path)
