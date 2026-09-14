# Portal do Manual Interno & Guia da Secretaria
## Montreal Tênis Clube

Este projeto é uma aplicação web autônoma (Single Page Application moderna em HTML5, CSS3 e JavaScript puro) desenvolvida para servir como **Manual Operacional, FAQ e Central de Scripts** para a equipe de secretaria e recepção do Montreal Tênis Clube.

---

## 🌟 Recursos Principais

1. **Atendimento Chatwoot & Scripts Rápidos:**
   - Catálogo completo de mensagens padronizadas (com código de atalho tipo `#boas-vindas`, `#aula-avulsa`, `#nivelamento`, `#descontos`, etc.).
   - Botão **"Copiar Script"** com feedback visual imediato em 1 clique.
   - **Alerta visual destacado** sobre o uso correto de **Notas Privadas (amarelas)** no Chatwoot para recados internos.
2. **Calculadora & Simulador de Mensalidades:**
   - Calcula na hora os valores acumulando:
     - Formato (Grupo, Dupla, Individual).
     - Frequência semanal (1x, 2x com 5% OFF, 3x+ com 7% OFF).
     - Horário Não Nobre (10h às 15h) com 12% OFF.
     - Plano Família (2 membros 5% OFF, 3+ membros 7% OFF).
     - Abatimento integral da aula avulsa na 1ª mensalidade.
   - Gera automaticamente o texto formatado para enviar no WhatsApp com 1 clique no botão *"Copiar Simulação para o WhatsApp"*.
3. **Módulo Matchpoint & Vídeos:**
   - Valores oficiais de locação de quadra (R$ 90 aluno / R$ 100 não aluno).
   - Passo a passo de aprovação de cadastro e links para Android / iOS.
   - Área com player embutido pronto para tutoriais e demonstrações em vídeo.
4. **Matriz de Nivelamento & Turmas:**
   - Tabela comparativa (Iniciante Zero até Avançado).
   - Regras de lotação (máximo 4 alunos por quadra).
   - Procedimento para quando o parceiro da dupla tranca/viaja.
5. **Professores, Clima & Reposições:**
   - Comunicado oficial de cancelamento por chuva (`#aviso-chuva`).
   - Regra oficial de feriados (compensação justa pelos meses de 5 aulas sem cobrança extra).
   - Regra de falta com aviso prévio de 24h.
6. **Checklists Diários Interativos:**
   - Rotinas de Abertura (Manhã), Tarde e Fechamento (Noite).
   - Salva o progresso no navegador (`localStorage`) para conferência da equipe.
7. **Busca Rápida Global (`Ctrl + K`):**
   - Encontra qualquer script, regra ou termo instantaneamente.
8. **Modo Escuro e Modo Claro:**
   - Alternância com 1 clique no topo.

---

## 🚀 Como Hospedar no seu Domínio (`montrealtenis.com.br`)

Como a aplicação é 100% estática e não necessita de banco de dados ou Node.js, ela roda em qualquer servidor Apache, cPanel ou Nginx.

### Opção 1: Pasta no Domínio Principal (ex: `montrealtenis.com.br/secretaria/`)
1. No seu servidor/FTP/cPanel, acesse a pasta raiz do site (geralmente `public_html/`).
2. Crie uma nova pasta chamada `secretaria` (ou `manual`).
3. Envie para dentro dessa pasta os 3 arquivos principais:
   - `index.html`
   - `style.css`
   - `app.js`
4. Pronto! O manual estará acessível diretamente em:
   `https://montrealtenis.com.br/secretaria/`

### Opção 2: Subdomínio (ex: `equipe.montrealtenis.com.br` ou `manual.montrealtenis.com.br`)
1. Crie o subdomínio no cPanel/DNS (apontando para a pasta onde você colocar os arquivos).
2. Coloque os 3 arquivos (`index.html`, `style.css`, `app.js`) nessa pasta.
