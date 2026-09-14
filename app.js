/* =========================================================
   MONTREAL TÊNIS CLUBE - MANUAL & GUIA DA SECRETARIA
   Interactions, Instant Search, Calculator & Checklists
========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  // --------------------------------------------------------
  // 1. TABS NAVIGATION
  // --------------------------------------------------------
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');

  function switchTab(targetTabId) {
    navItems.forEach(item => {
      if (item.getAttribute('data-tab') === targetTabId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    tabPanes.forEach(pane => {
      if (pane.id === `tab-${targetTabId}`) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });

    // Scroll to top of content
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const target = item.getAttribute('data-tab');
      switchTab(target);
      window.location.hash = target;
    });
  });

  // Handle URL hash on initial load
  if (window.location.hash) {
    const hash = window.location.hash.replace('#', '');
    if (document.getElementById(`tab-${hash}`)) {
      switchTab(hash);
    }
  }

  // --------------------------------------------------------
  // 2. ONE-CLICK SCRIPT COPY WITH TOAST NOTIFICATION
  // --------------------------------------------------------
  const copyButtons = document.querySelectorAll('.btn-copy');
  const toast = document.getElementById('toastNotification');
  const toastMsg = document.getElementById('toastMessage');
  let toastTimer = null;

  function showToast(message) {
    if (toastTimer) clearTimeout(toastTimer);
    toastMsg.textContent = message;
    toast.style.display = 'flex';

    toastTimer = setTimeout(() => {
      toast.style.display = 'none';
    }, 2500);
  }

  copyButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const targetElem = document.getElementById(targetId);
      if (!targetElem) return;

      const text = targetElem.innerText || targetElem.textContent;
      navigator.clipboard.writeText(text).then(() => {
        const originalHtml = btn.innerHTML;
        btn.classList.add('copied');
        btn.innerHTML = '<span>✅</span> Copiado!';
        showToast('Script copiado com sucesso! Só colar no Chatwoot.');

        setTimeout(() => {
          btn.classList.remove('copied');
          btn.innerHTML = originalHtml;
        }, 2000);
      }).catch(err => {
        console.error('Falha ao copiar:', err);
      });
    });
  });

  // --------------------------------------------------------
  // 2.1 INLINE SCRIPT EDITING & DUAL PERSISTENCE (LOCAL + SUPABASE)
  // --------------------------------------------------------
  const SCRIPTS_STORAGE_KEY = 'montreal_custom_scripts_v1';

  function loadSavedCustomScripts() {
    try {
      const saved = localStorage.getItem(SCRIPTS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  }

  function saveCustomScripts(data) {
    localStorage.setItem(SCRIPTS_STORAGE_KEY, JSON.stringify(data));
  }

  async function syncCustomScriptToSupabase(scriptId, text) {
    const payload = {
      date_key: '2000-01-01',
      task_id: `script_${scriptId}`,
      task_desc: text || '',
      shift: 'custom_script',
      is_completed: !!text,
      completed_at: new Date().toISOString()
    };
    try {
      await fetch(`${SUPABASE_REST_URL}?on_conflict=date_key,task_id`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.warn('Erro ao sincronizar script no Supabase:', err);
    }
  }

  async function loadRemoteCustomScripts() {
    try {
      const res = await fetch(`${SUPABASE_REST_URL}?date_key=eq.2000-01-01&select=*`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
          const localData = loadSavedCustomScripts();
          let updated = false;
          rows.forEach(r => {
            if (r.task_id && r.task_id.startsWith('script_')) {
              const scriptId = r.task_id.replace('script_', '');
              if (r.is_completed && r.task_desc) {
                localData[scriptId] = r.task_desc;
                updated = true;
              } else if (!r.is_completed) {
                delete localData[scriptId];
                updated = true;
              }
            }
          });
          if (updated) {
            saveCustomScripts(localData);
            applyAllCustomScripts(localData);
          }
        }
      }
    } catch (e) {
      // Fallback silencioso
    }
  }

  function applyAllCustomScripts(customScripts) {
    document.querySelectorAll('.script-card').forEach(card => {
      const scriptBox = card.querySelector('.script-box');
      if (!scriptBox) return;

      const scriptId = scriptBox.id;
      if (!scriptBox.hasAttribute('data-default-text')) {
        scriptBox.setAttribute('data-default-text', scriptBox.innerText.trim());
      }

      const scriptMeta = card.querySelector('.script-meta');
      if (customScripts[scriptId]) {
        scriptBox.innerText = customScripts[scriptId];
        if (scriptMeta && !scriptMeta.querySelector('.tag-edited')) {
          const badge = document.createElement('span');
          badge.className = 'script-tag tag-edited';
          badge.textContent = 'Personalizado';
          scriptMeta.appendChild(badge);
        }
      } else {
        const defaultText = scriptBox.getAttribute('data-default-text');
        if (defaultText) scriptBox.innerText = defaultText;
        const badge = scriptMeta ? scriptMeta.querySelector('.tag-edited') : null;
        if (badge) badge.remove();
      }
    });
  }

  const customScripts = loadSavedCustomScripts();
  applyAllCustomScripts(customScripts);
  loadRemoteCustomScripts();

  document.querySelectorAll('.script-card').forEach(card => {
    const scriptBox = card.querySelector('.script-box');
    if (!scriptBox) return;

    const scriptId = scriptBox.id;

    // Wrap header actions and add Edit button
    const header = card.querySelector('.script-card-header');
    const copyBtn = card.querySelector('.btn-copy');
    if (header && copyBtn && !header.querySelector('.btn-edit')) {
      let actionsContainer = header.querySelector('.script-actions');
      if (!actionsContainer) {
        actionsContainer = document.createElement('div');
        actionsContainer.className = 'script-actions';
        copyBtn.parentNode.insertBefore(actionsContainer, copyBtn);
        actionsContainer.appendChild(copyBtn);
      }

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn-edit';
      editBtn.innerHTML = '<span>✏️</span> Editar';
      actionsContainer.insertBefore(editBtn, copyBtn);

      editBtn.addEventListener('click', () => {
        // Toggle editing mode
        if (scriptBox.classList.contains('editing')) {
          cancelEditing(card, scriptBox, editBtn);
        } else {
          startEditing(card, scriptBox, editBtn, scriptId);
        }
      });
    }
  });

  function startEditing(card, scriptBox, editBtn, scriptId) {
    // Store text before editing for cancellation
    scriptBox.setAttribute('data-pre-edit-text', scriptBox.innerText);
    scriptBox.setAttribute('contenteditable', 'true');
    scriptBox.classList.add('editing');
    scriptBox.focus();

    editBtn.classList.add('active');
    editBtn.innerHTML = '<span>✏️</span> Editando...';

    // Remove existing bar if any
    const existingBar = card.querySelector('.edit-actions-bar');
    if (existingBar) existingBar.remove();

    const isCustom = !!customScripts[scriptId];

    const actionBar = document.createElement('div');
    actionBar.className = 'edit-actions-bar';
    actionBar.innerHTML = `
      ${isCustom ? '<button type="button" class="btn-reset-edit">🔄 Restaurar Padrão</button>' : ''}
      <button type="button" class="btn-cancel-edit">✕ Cancelar</button>
      <button type="button" class="btn-save-edit">💾 Salvar Alterações</button>
    `;

    card.appendChild(actionBar);

    // Bind save
    actionBar.querySelector('.btn-save-edit').addEventListener('click', () => {
      const newText = scriptBox.innerText.trim();
      customScripts[scriptId] = newText;
      saveCustomScripts(customScripts);
      syncCustomScriptToSupabase(scriptId, newText);

      scriptBox.removeAttribute('contenteditable');
      scriptBox.classList.remove('editing');
      editBtn.classList.remove('active');
      editBtn.innerHTML = '<span>✏️</span> Editar';
      actionBar.remove();

      // Ensure badge
      const scriptMeta = card.querySelector('.script-meta');
      if (scriptMeta && !scriptMeta.querySelector('.tag-edited')) {
        const badge = document.createElement('span');
        badge.className = 'script-tag tag-edited';
        badge.textContent = 'Personalizado';
        scriptMeta.appendChild(badge);
      }

      showToast('Mensagem personalizada salva com sucesso!');
    });

    // Bind cancel
    actionBar.querySelector('.btn-cancel-edit').addEventListener('click', () => {
      cancelEditing(card, scriptBox, editBtn);
    });

    // Bind reset to default
    const resetBtn = actionBar.querySelector('.btn-reset-edit');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        const defaultText = scriptBox.getAttribute('data-default-text');
        scriptBox.innerText = defaultText;
        delete customScripts[scriptId];
        saveCustomScripts(customScripts);
        syncCustomScriptToSupabase(scriptId, '');

        scriptBox.removeAttribute('contenteditable');
        scriptBox.classList.remove('editing');
        editBtn.classList.remove('active');
        editBtn.innerHTML = '<span>✏️</span> Editar';
        actionBar.remove();

        const badge = card.querySelector('.tag-edited');
        if (badge) badge.remove();

        showToast('Script restaurado para o padrão original!');
      });
    }
  }

  function cancelEditing(card, scriptBox, editBtn) {
    const preText = scriptBox.getAttribute('data-pre-edit-text');
    if (preText) scriptBox.innerText = preText;
    scriptBox.removeAttribute('contenteditable');
    scriptBox.classList.remove('editing');
    editBtn.classList.remove('active');
    editBtn.innerHTML = '<span>✏️</span> Editar';
    const existingBar = card.querySelector('.edit-actions-bar');
    if (existingBar) existingBar.remove();
  }

  // --------------------------------------------------------
  // 3. SCRIPT FILTER CHIPS (ALL, LEADS, PRECOS, FUP, REGRAS)
  // --------------------------------------------------------
  const filterChips = document.querySelectorAll('.filter-chip');
  const scriptCards = document.querySelectorAll('.script-card');

  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      const filter = chip.getAttribute('data-filter');
      scriptCards.forEach(card => {
        const cat = card.getAttribute('data-category');
        if (filter === 'all' || cat === filter) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  // --------------------------------------------------------
  // 4. GLOBAL SEARCH (CTRL + K / INSTANT TYPEAHEAD)
  // --------------------------------------------------------
  const searchInput = document.getElementById('globalSearchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const searchDropdown = document.getElementById('searchResultsDropdown');

  // Collect searchable items
  const searchableIndex = [];
  document.querySelectorAll('.script-card').forEach(card => {
    const title = card.querySelector('h4') ? card.querySelector('h4').textContent : '';
    const macro = card.querySelector('.macro-code') ? card.querySelector('.macro-code').textContent : '';
    const keywords = card.getAttribute('data-keywords') || '';
    const bodyText = card.querySelector('.script-box') ? card.querySelector('.script-box').textContent : '';
    const tabParent = card.closest('.tab-pane');
    const tabId = tabParent ? tabParent.id.replace('tab-', '') : 'atendimento';

    searchableIndex.push({
      title,
      macro,
      text: `${title} ${macro} ${keywords} ${bodyText}`.toLowerCase(),
      snippet: bodyText.substring(0, 90) + '...',
      tabId,
      elem: card
    });
  });

  // Add other key guides to search
  searchableIndex.push({
    title: 'Calculadora de Mensalidades & Descontos',
    macro: '#simulador',
    text: 'calculadora simulador mensalidade preco desconto familia frequencia nao nobre',
    snippet: 'Simule o valor com 12% off não nobre, 5% ou 7% de frequência e plano família.',
    tabId: 'simulador',
    elem: document.getElementById('tab-simulador')
  });

  searchableIndex.push({
    title: 'Regras de Locação de Quadras (Matchpoint)',
    macro: '#locacao',
    text: 'locacao aluguel quadra preco 90 aluno 100 nao aluno saibro matchpoint app',
    snippet: 'R$ 90/h Aluno e R$ 100/h Não Aluno. Pagamento obrigatório direto pelo App.',
    tabId: 'matchpoint',
    elem: document.getElementById('tab-matchpoint')
  });

  searchableIndex.push({
    title: 'Checklist Diário de Abertura & Limpeza',
    macro: '#checklists',
    text: 'checklist abertura limpeza fechamento quadras vestiarios luzes refletores portao',
    snippet: 'Rotinas operacionais da manhã, tarde e noite para a recepção da Montreal.',
    tabId: 'limpeza',
    elem: document.getElementById('tab-limpeza')
  });

  function performSearch(query) {
    const q = query.trim().toLowerCase();
    if (!q) {
      searchDropdown.style.display = 'none';
      clearSearchBtn.style.display = 'none';
      return;
    }

    clearSearchBtn.style.display = 'block';
    const matches = searchableIndex.filter(item => item.text.includes(q));

    if (matches.length === 0) {
      searchDropdown.innerHTML = `<div style="padding: 12px; font-size: 0.82rem; color: var(--text-muted); text-align: center;">Nenhum procedimento encontrado para "${query}".</div>`;
      searchDropdown.style.display = 'block';
      return;
    }

    searchDropdown.innerHTML = matches.slice(0, 6).map((item, idx) => `
      <div class="search-result-item" data-idx="${idx}">
        <div class="search-result-header">
          <span class="search-result-title">${item.title}</span>
          <span class="search-result-tag">${item.macro}</span>
        </div>
        <span class="search-result-snippet">${item.snippet}</span>
      </div>
    `).join('');

    searchDropdown.style.display = 'block';

    // Click handler on search items
    searchDropdown.querySelectorAll('.search-result-item').forEach((el, index) => {
      el.addEventListener('click', () => {
        const item = matches[index];
        switchTab(item.tabId);
        searchDropdown.style.display = 'none';
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';

        // Scroll into card with glow
        if (item.elem && item.elem.scrollIntoView) {
          setTimeout(() => {
            item.elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            item.elem.style.boxShadow = '0 0 0 3px var(--clay-primary)';
            setTimeout(() => { item.elem.style.boxShadow = ''; }, 2000);
          }, 150);
        }
      });
    });
  }

  searchInput.addEventListener('input', (e) => {
    performSearch(e.target.value);
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchDropdown.style.display = 'none';
    clearSearchBtn.style.display = 'none';
  });

  // Global Ctrl + K shortcut
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.topbar-search')) {
      searchDropdown.style.display = 'none';
    }
  });

  // --------------------------------------------------------
  // 5. CALCULADORA & SIMULADOR DE MENSALIDADES
  // --------------------------------------------------------
  // --------------------------------------------------------
  // 5. CALCULADORA & SIMULADOR DE MENSALIDADES (TABELA OFICIAL)
  // --------------------------------------------------------
  const BASE_PRICES = {
    // Treinamentos Adulto (por aluno - 1x por semana)
    grupo_adulto: { name: 'Grupo (4 alunos)', price: 335, category: 'Adulto' },
    trio_adulto: { name: 'Trio', price: 395, category: 'Adulto' },
    dupla_adulto: { name: 'Dupla', price: 430, category: 'Adulto' },
    individual_adulto: { name: 'Individual', price: 720, category: 'Adulto' },

    // Treinamentos Kids (por aluno - 1x por semana)
    baby_kids: { name: 'Baby Tennis (4 a 6 anos)', price: 255, category: 'Kids' },
    kids_regular: { name: 'Kids (6 a 10 anos)', price: 255, category: 'Kids' },
    individual_kids: { name: 'Individual Kids (até 12 anos)', price: 450, category: 'Kids', onlyNonPeak: true }
  };

  // --------------------------------------------------------
  // 4. SIMULADOR DE MENSALIDADES (MULTI-TREINOS / GRADE LIVRE)
  // --------------------------------------------------------
  const workoutsList = document.getElementById('workoutsList');
  const btnAddWorkout = document.getElementById('btnAddWorkout');
  const txtGradeTotalTreinos = document.getElementById('txtGradeTotalTreinos');
  const badgeBeneficioFreq = document.getElementById('badgeBeneficioFreq');

  const selectFamilia = document.getElementById('selectFamilia');
  const groupFamilia = document.getElementById('groupFamilia');
  const checkAbaterAvulsa = document.getElementById('checkAbaterAvulsa');
  const inputValorAvulsa = document.getElementById('inputValorAvulsa');

  // Breakdown output elements
  const resValorBruto = document.getElementById('resValorBruto');
  const rowSubtotalFreq = document.getElementById('rowSubtotalFreq');
  const txtFreqQtd = document.getElementById('txtFreqQtd');
  const resSubtotalFreq = document.getElementById('resSubtotalFreq');
  const rowDescNobre = document.getElementById('rowDescNobre');
  const resDescNobre = document.getElementById('resDescNobre');
  const rowDescFreq = document.getElementById('rowDescFreq');
  const txtDescFreq = document.getElementById('txtDescFreq');
  const resDescFreq = document.getElementById('resDescFreq');
  const rowDescFam = document.getElementById('rowDescFam');
  const txtDescFam = document.getElementById('txtDescFam');
  const resDescFam = document.getElementById('resDescFam');
  const rowTetoAviso = document.getElementById('rowTetoAviso');
  const resValorFinal = document.getElementById('resValorFinal');
  const rowProporcional = document.getElementById('rowProporcional');
  const txtProporcao = document.getElementById('txtProporcao');
  const resValorProporcional = document.getElementById('resValorProporcional');
  const rowAbatimento = document.getElementById('rowAbatimento');
  const resPrimeiraMensalidade = document.getElementById('resPrimeiraMensalidade');
  const simScriptOutput = document.getElementById('simScriptOutput');
  const btnCopySim = document.getElementById('btnCopySim');

  function formatBRL(val) {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  // State: Array of workouts
  let studentWorkouts = [
    {
      id: Date.now(),
      formatKey: 'grupo_adulto',
      isNaoNobre: false,
      prop: 1.00
    }
  ];

  function renderWorkouts() {
    if (!workoutsList) return;
    workoutsList.innerHTML = '';

    studentWorkouts.forEach((w, index) => {
      const card = document.createElement('div');
      card.className = 'workout-item-card';
      card.setAttribute('data-id', w.id);

      const isFirst = index === 0;
      const title = isFirst ? '🎾 Treino #1 (Principal)' : `🎾 Treino #${index + 1}`;

      card.innerHTML = `
        <div class="workout-item-header">
          <div class="workout-number-badge">
            <strong>${title}</strong>
          </div>
          ${studentWorkouts.length > 1 ? `<button type="button" class="btn-remove-workout" data-id="${w.id}">🗑️ Remover Treino</button>` : ''}
        </div>

        <div style="margin-bottom:10px;">
          <label style="font-size:0.78rem; font-weight:600; color:var(--text-secondary); margin-bottom:4px; display:block;">Modalidade do Treino:</label>
          <select class="form-select select-workout-format">
            <optgroup label="Treinamentos Adulto">
              <option value="grupo_adulto" ${w.formatKey === 'grupo_adulto' ? 'selected' : ''}>Adulto - Grupo (4 alunos) — R$ 335,00</option>
              <option value="trio_adulto" ${w.formatKey === 'trio_adulto' ? 'selected' : ''}>Adulto - Trio — R$ 395,00</option>
              <option value="dupla_adulto" ${w.formatKey === 'dupla_adulto' ? 'selected' : ''}>Adulto - Dupla — R$ 430,00</option>
              <option value="individual_adulto" ${w.formatKey === 'individual_adulto' ? 'selected' : ''}>Adulto - Individual — R$ 720,00</option>
            </optgroup>
            <optgroup label="Treinamentos Kids">
              <option value="baby_kids" ${w.formatKey === 'baby_kids' ? 'selected' : ''}>Baby Tennis (4 a 6 anos) — R$ 255,00</option>
              <option value="kids_regular" ${w.formatKey === 'kids_regular' ? 'selected' : ''}>Kids (6 a 10 anos) — R$ 255,00</option>
              <option value="individual_kids" ${w.formatKey === 'individual_kids' ? 'selected' : ''}>Individual Kids (até 12 anos) — R$ 450,00 (10h–15h)</option>
            </optgroup>
          </select>
        </div>

        <div style="margin-bottom:10px;">
          <label class="checkbox-box" style="padding:6px 10px; font-size:0.78rem;">
            <input type="checkbox" class="check-workout-nao-nobre" ${w.isNaoNobre ? 'checked' : ''}>
            <span>Horário 10h às 15h — 12% OFF (tarifa própria, não acumula)</span>
          </label>
        </div>

        <div>
          <label style="font-size:0.78rem; font-weight:600; color:var(--text-secondary); margin-bottom:4px; display:block;">1ª Matrícula (Aulas restantes no mês de início):</label>
          <select class="form-select select-workout-prop" style="font-size:0.8rem; padding:6px 10px;">
            <option value="0.25" ${w.prop === 0.25 ? 'selected' : ''}>1 treino restante neste mês (25%)</option>
            <option value="0.50" ${w.prop === 0.50 ? 'selected' : ''}>2 treinos restantes neste mês (50%)</option>
            <option value="0.75" ${w.prop === 0.75 ? 'selected' : ''}>3 treinos restantes neste mês (75%)</option>
            <option value="1.00" ${w.prop === 1.00 ? 'selected' : ''}>4 treinos restantes / Mês cheio (100%)</option>
          </select>
        </div>
      `;

      const selFormat = card.querySelector('.select-workout-format');
      const chkNaoNobre = card.querySelector('.check-workout-nao-nobre');
      const selProp = card.querySelector('.select-workout-prop');
      const btnRemove = card.querySelector('.btn-remove-workout');

      selFormat.addEventListener('change', () => {
        w.formatKey = selFormat.value;
        const plan = BASE_PRICES[w.formatKey];
        if (plan && plan.onlyNonPeak) {
          w.isNaoNobre = true;
          chkNaoNobre.checked = true;
        }
        calculateSimulation();
      });

      chkNaoNobre.addEventListener('change', () => {
        w.isNaoNobre = chkNaoNobre.checked;
        calculateSimulation();
      });

      selProp.addEventListener('change', () => {
        w.prop = parseFloat(selProp.value);
        calculateSimulation();
      });

      if (btnRemove) {
        btnRemove.addEventListener('click', () => {
          studentWorkouts = studentWorkouts.filter(item => item.id !== w.id);
          renderWorkouts();
          calculateSimulation();
        });
      }

      workoutsList.appendChild(card);
    });
  }

  if (btnAddWorkout) {
    btnAddWorkout.addEventListener('click', () => {
      studentWorkouts.push({
        id: Date.now() + Math.random(),
        formatKey: 'grupo_adulto',
        isNaoNobre: false,
        prop: 1.00
      });
      renderWorkouts();
      calculateSimulation();
    });
  }

  if (checkAbaterAvulsa) {
    checkAbaterAvulsa.addEventListener('change', () => {
      inputValorAvulsa.style.display = checkAbaterAvulsa.checked ? 'block' : 'none';
      calculateSimulation();
    });
  }

  if (selectFamilia) selectFamilia.addEventListener('change', calculateSimulation);
  if (inputValorAvulsa) inputValorAvulsa.addEventListener('input', calculateSimulation);

  function calculateSimulation() {
    const totalAulasSemanais = studentWorkouts.length;

    // Atualiza badges da grade
    if (txtGradeTotalTreinos) {
      txtGradeTotalTreinos.textContent = `${totalAulasSemanais} treino${totalAulasSemanais > 1 ? 's' : ''} por semana`;
    }
    if (badgeBeneficioFreq) {
      if (totalAulasSemanais === 1) {
        badgeBeneficioFreq.className = 'badge-pill bg-blue';
        badgeBeneficioFreq.textContent = 'Tabela Base (1x)';
      } else if (totalAulasSemanais === 2) {
        badgeBeneficioFreq.className = 'badge-pill bg-green';
        badgeBeneficioFreq.textContent = '🎉 2x na semana: 5% OFF Ativado!';
      } else {
        badgeBeneficioFreq.className = 'badge-pill bg-green';
        badgeBeneficioFreq.textContent = `🔥 ${totalAulasSemanais}x na semana: 7% OFF Ativado!`;
      }
    }

    // Regras Oficiais de Desconto da Planilha:
    // Frequência: 1x = 0%, 2x = 5%, 3x+ = 7%
    let pctFreq = 0;
    if (totalAulasSemanais === 2) pctFreq = 0.05;
    else if (totalAulasSemanais >= 3) pctFreq = 0.07;

    const pctFamilia = parseInt(selectFamilia.value, 10) / 100;
    rowTetoAviso.style.display = 'none';

    let somaBaseTotal = 0;
    let mensalidadeRegularTotal = 0;
    let proporcionalTotal = 0;

    let temNaoNobre = false;
    let temTetoAtingido = false;

    const treinosDetalhes = [];

    studentWorkouts.forEach((w, idx) => {
      const plan = BASE_PRICES[w.formatKey] || { name: 'Grupo (4 alunos)', price: 335, category: 'Adulto' };
      const basePrice = plan.price;
      const isNaoNobre = w.isNaoNobre || !!plan.onlyNonPeak;

      somaBaseTotal += basePrice;

      let descEfetivoTreino = 0;
      let mensalTreino = 0;

      if (isNaoNobre) {
        temNaoNobre = true;
        descEfetivoTreino = 0.12;
        mensalTreino = basePrice * (1 - 0.12);
      } else {
        let somaDesc = pctFreq + pctFamilia;
        if (somaDesc > 0.12) {
          somaDesc = 0.12;
          temTetoAtingido = true;
        }
        descEfetivoTreino = somaDesc;
        mensalTreino = basePrice * (1 - descEfetivoTreino);
      }

      mensalTreino = Math.round(mensalTreino * 100) / 100;
      mensalidadeRegularTotal += mensalTreino;

      // Proporcional de entrada deste treino
      const propValTreino = Math.round((mensalTreino * w.prop) * 100) / 100;
      proporcionalTotal += propValTreino;

      const propTxt = w.prop === 0.25 ? '1 treino (25%)' : (w.prop === 0.50 ? '2 treinos (50%)' : (w.prop === 0.75 ? '3 treinos (75%)' : '4 treinos / Cheio (100%)'));

      treinosDetalhes.push({
        num: idx + 1,
        nome: `${plan.category} - ${plan.name}`,
        base: basePrice,
        isNaoNobre,
        descPct: descEfetivoTreino,
        mensalRegular: mensalTreino,
        propPct: w.prop,
        propTxt,
        propVal: propValTreino
      });
    });

    mensalidadeRegularTotal = Math.round(mensalidadeRegularTotal * 100) / 100;
    proporcionalTotal = Math.round(proporcionalTotal * 100) / 100;

    if (temTetoAtingido) rowTetoAviso.style.display = 'flex';

    // Atualização dos campos de Resumo
    resValorBruto.textContent = formatBRL(somaBaseTotal);

    if (totalAulasSemanais > 1) {
      rowSubtotalFreq.style.display = 'flex';
      txtFreqQtd.textContent = `${totalAulasSemanais} treinos/semana`;
      resSubtotalFreq.textContent = formatBRL(somaBaseTotal);
    } else {
      rowSubtotalFreq.style.display = 'none';
    }

    // Desconto Não Nobre
    if (temNaoNobre) {
      rowDescNobre.style.display = 'flex';
      resDescNobre.textContent = '12% OFF nos treinos das 10h às 15h';
    } else {
      rowDescNobre.style.display = 'none';
    }

    // Desconto Frequência
    if (pctFreq > 0) {
      rowDescFreq.style.display = 'flex';
      txtDescFreq.textContent = `${(pctFreq * 100).toFixed(0)}%`;
      const econFreq = somaBaseTotal - mensalidadeRegularTotal;
      resDescFreq.textContent = `Economia de ${formatBRL(econFreq)}`;
    } else {
      rowDescFreq.style.display = 'none';
    }

    // Desconto Família
    if (pctFamilia > 0 && !temNaoNobre) {
      rowDescFam.style.display = 'flex';
      txtDescFam.textContent = `${(pctFamilia * 100).toFixed(0)}%`;
      resDescFam.textContent = 'Cumulativo aplicado';
    } else {
      rowDescFam.style.display = 'none';
    }

    resValorFinal.textContent = `${formatBRL(mensalidadeRegularTotal)} /mês`;

    // Proporcional
    txtProporcao.textContent = totalAulasSemanais === 1 ? treinosDetalhes[0].propTxt : `${totalAulasSemanais} treinos combinados`;
    resValorProporcional.textContent = formatBRL(proporcionalTotal);

    // Abatimento Avulsa
    let totalPagarPrimeiroMes = proporcionalTotal;
    if (checkAbaterAvulsa.checked) {
      const valorAvulsa = parseFloat(inputValorAvulsa.value) || 0;
      totalPagarPrimeiroMes = Math.max(0, proporcionalTotal - valorAvulsa);
      rowAbatimento.style.display = 'flex';
      resPrimeiraMensalidade.textContent = `${formatBRL(totalPagarPrimeiroMes)} (Abatido ${formatBRL(valorAvulsa)})`;
    } else {
      rowAbatimento.style.display = 'none';
    }

    // Geração da Mensagem Pronta para WhatsApp
    let scriptMsg = `Olá! Segue a simulação oficial do seu plano aqui na Montreal Tênis Clube 🎾✨\n\n`;

    if (totalAulasSemanais === 1) {
      const t = treinosDetalhes[0];
      scriptMsg += `📌 *Modalidade:* ${t.nome}\n`;
      scriptMsg += `🗓️ *Frequência:* 1x por semana\n`;
      if (t.isNaoNobre) scriptMsg += `⏰ *Horário:* 10h às 15h (12% OFF aplicado)\n`;
      if (pctFamilia > 0 && !t.isNaoNobre) scriptMsg += `👨‍👩‍👧 *Plano Família:* ${(pctFamilia * 100).toFixed(0)}% OFF\n`;
      scriptMsg += `\n💰 *Mensalidade Regular:* ${formatBRL(mensalidadeRegularTotal)} /mês\n`;

      if (t.propPct < 1.00 || checkAbaterAvulsa.checked) {
        scriptMsg += `\n🤝 *Sua 1ª Matrícula é Proporcional:*`;
        if (t.propPct < 1.00) {
          scriptMsg += `\n• Como você iniciará para fazer *${t.propTxt}* neste primeiro mês, o valor proporcional é de *${formatBRL(proporcionalTotal)}*.`;
        }
        if (checkAbaterAvulsa.checked) {
          const valorAvulsa = parseFloat(inputValorAvulsa.value) || 0;
          scriptMsg += `\n• Abatemos integralmente os ${formatBRL(valorAvulsa)} da sua aula avulsa!`;
          scriptMsg += `\n👉 *Total da 1ª Matrícula:* *${formatBRL(totalPagarPrimeiroMes)}*`;
        } else if (t.propPct < 1.00) {
          scriptMsg += `\n👉 *Total da 1ª Matrícula:* *${formatBRL(proporcionalTotal)}*`;
        }
        scriptMsg += `\n(A partir do 2º mês vigora a mensalidade regular de ${formatBRL(mensalidadeRegularTotal)} /mês).\n`;
      }
    } else {
      scriptMsg += `📋 *Composição da sua Grade Semanal (${totalAulasSemanais} treinos/semana):*\n`;
      treinosDetalhes.forEach(t => {
        scriptMsg += `• *Treino #${t.num}:* ${t.nome} (Base: ${formatBRL(t.base)}${t.isNaoNobre ? ' • 10h-15h 12% OFF' : ''})\n`;
      });

      if (pctFreq > 0) {
        scriptMsg += `\n🏃 *Desconto de Frequência (${totalAulasSemanais}x na semana):* ${(pctFreq * 100).toFixed(0)}% OFF sobre os treinos!\n`;
      }
      if (pctFamilia > 0) {
        scriptMsg += `👨‍👩‍👧 *Plano Família:* ${(pctFamilia * 100).toFixed(0)}% OFF cumulativo\n`;
      }
      scriptMsg += `\n💰 *Valor da Mensalidade Regular da Grade:* ${formatBRL(mensalidadeRegularTotal)} /mês\n`;

      const temAlgumProp = treinosDetalhes.some(t => t.propPct < 1.00);
      if (temAlgumProp || checkAbaterAvulsa.checked) {
        scriptMsg += `\n🤝 *Detalhamento da sua 1ª Matrícula / Entrada Proporcional:*`;
        treinosDetalhes.forEach(t => {
          scriptMsg += `\n• Treino #${t.num} (${t.propTxt}): ${formatBRL(t.propVal)}`;
        });
        if (checkAbaterAvulsa.checked) {
          const valorAvulsa = parseFloat(inputValorAvulsa.value) || 0;
          scriptMsg += `\n• *Abatimento da Aula Avulsa:* - ${formatBRL(valorAvulsa)}`;
        }
        scriptMsg += `\n👉 *Total da 1ª Matrícula:* *${formatBRL(totalPagarPrimeiroMes)}*\n`;
        scriptMsg += `(A partir do 2º mês vigora a mensalidade regular de ${formatBRL(mensalidadeRegularTotal)} /mês).\n`;
      }
    }

    scriptMsg += `\nPodemos confirmar seus horários e garantir suas vagas?`;
    if (simScriptOutput) simScriptOutput.value = scriptMsg;
  }

  // Inicializa renderização
  renderWorkouts();
  calculateSimulation();

  // --------------------------------------------------------
  // TABELA MATRIZ DE REFERÊNCIA OFICIAL (CONFORME EXCEL)
  // --------------------------------------------------------
  const MATRIX_DATA = {
    grupo: {
      name: 'Grupo / Equipe',
      base: 335,
      rows: [
        { label: 'Preço cheio', desc: '0,0%', t1: 83.75, t2: 167.50, t3: 251.25, t4: 335.00 },
        { label: 'Desconto 5%', desc: '5,0%', t1: 79.56, t2: 159.13, t3: 238.69, t4: 318.25 },
        { label: 'Desconto 7%', desc: '7,0%', t1: 77.89, t2: 155.77, t3: 233.66, t4: 311.55 },
        { label: 'Desconto 10%', desc: '10,0%', t1: 75.38, t2: 150.75, t3: 226.13, t4: 301.50 },
        { label: 'Desconto 12%', desc: '12,0%', t1: 73.70, t2: 147.40, t3: 221.10, t4: 294.80 }
      ]
    },
    trio: {
      name: 'Trio',
      base: 395,
      rows: [
        { label: 'Preço cheio', desc: '0,0%', t1: 98.75, t2: 197.50, t3: 296.25, t4: 395.00 },
        { label: 'Desconto 5%', desc: '5,0%', t1: 93.81, t2: 187.63, t3: 281.44, t4: 375.25 },
        { label: 'Desconto 7%', desc: '7,0%', t1: 91.84, t2: 183.68, t3: 275.51, t4: 367.35 },
        { label: 'Desconto 10%', desc: '10,0%', t1: 88.88, t2: 177.75, t3: 266.63, t4: 355.50 },
        { label: 'Desconto 12%', desc: '12,0%', t1: 86.90, t2: 173.80, t3: 260.70, t4: 347.60 }
      ]
    },
    dupla: {
      name: 'Dupla',
      base: 430,
      rows: [
        { label: 'Preço cheio', desc: '0,0%', t1: 107.50, t2: 215.00, t3: 322.50, t4: 430.00 },
        { label: 'Desconto 5%', desc: '5,0%', t1: 102.13, t2: 204.25, t3: 306.38, t4: 408.50 },
        { label: 'Desconto 7%', desc: '7,0%', t1: 99.98, t2: 199.95, t3: 299.92, t4: 399.90 },
        { label: 'Desconto 10%', desc: '10,0%', t1: 96.75, t2: 193.50, t3: 290.25, t4: 387.00 },
        { label: 'Desconto 12%', desc: '12,0%', t1: 94.60, t2: 189.20, t3: 283.80, t4: 378.40 }
      ]
    },
    individual: {
      name: 'Individual',
      base: 720,
      rows: [
        { label: 'Preço cheio', desc: '0,0%', t1: 180.00, t2: 360.00, t3: 540.00, t4: 720.00 },
        { label: 'Desconto 5%', desc: '5,0%', t1: 171.00, t2: 342.00, t3: 513.00, t4: 684.00 },
        { label: 'Desconto 7%', desc: '7,0%', t1: 167.40, t2: 334.80, t3: 502.20, t4: 669.60 },
        { label: 'Desconto 10%', desc: '10,0%', t1: 162.00, t2: 324.00, t3: 486.00, t4: 648.00 },
        { label: 'Desconto 12%', desc: '12,0%', t1: 158.40, t2: 316.80, t3: 475.20, t4: 633.60 }
      ]
    }
  };

  const matrixTabSelector = document.getElementById('matrixTabSelector');
  const matrixTableBody = document.getElementById('matrixTableBody');

  function renderMatrixTable(modalityKey) {
    const data = MATRIX_DATA[modalityKey] || MATRIX_DATA.grupo;
    matrixTableBody.innerHTML = data.rows.map(r => `
      <tr>
        <td><strong>${r.label}</strong></td>
        <td><span class="badge-pill bg-blue">${r.desc}</span></td>
        <td>${formatBRL(r.t1)}</td>
        <td>${formatBRL(r.t2)}</td>
        <td>${formatBRL(r.t3)}</td>
        <td><strong>${formatBRL(r.t4)}</strong></td>
      </tr>
    `).join('');
  }

  if (matrixTabSelector) {
    matrixTabSelector.querySelectorAll('.pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        matrixTabSelector.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mod = btn.getAttribute('data-matrix');
        renderMatrixTable(mod);
      });
    });
    renderMatrixTable('grupo');
  }

  if (btnCopySim && simScriptOutput) {
    btnCopySim.addEventListener('click', () => {
      navigator.clipboard.writeText(simScriptOutput.value).then(() => {
        showToast('Simulação copiada para o WhatsApp!');
      });
    });
  }

  // Run initial calculation
  calculateSimulation();

  // --------------------------------------------------------
  // 6. CHECKLISTS DIÁRIOS & GERENCIAMENTO DE EQUIPE (EXCEL)
  // --------------------------------------------------------
  const CHECKLIST_STORAGE_KEY = 'montreal_daily_checklists_v2';
  const TEAM_STORAGE_KEY = 'montreal_team_names_v1';
  
  const DEFAULT_TEAM = {
    colab1: 'Cynthia',
    colab2: 'Lucas',
    colab3: 'Alex'
  };

  let currentTeam = { ...DEFAULT_TEAM };

  // Elementos do Modal de Equipe
  const modalTeamConfig = document.getElementById('modalTeamConfig');
  const btnEditTeam = document.getElementById('btnEditTeam');
  const btnCloseTeamModal = document.getElementById('btnCloseTeamModal');
  const btnSaveTeamNames = document.getElementById('btnSaveTeamNames');
  const btnResetTeamDefault = document.getElementById('btnResetTeamDefault');
  const inputColab1 = document.getElementById('inputColab1');
  const inputColab2 = document.getElementById('inputColab2');
  const inputColab3 = document.getElementById('inputColab3');

  // Elementos dos Chips
  const chipColab1 = document.getElementById('chipColab1');
  const chipColab2 = document.getElementById('chipColab2');
  const chipColab3 = document.getElementById('chipColab3');
  const colabChips = document.querySelectorAll('.colab-chip');

  // Elementos de Progresso dos Turnos
  const progressManhaBadge = document.getElementById('progressManhaBadge');
  const progressManhaBar = document.getElementById('progressManhaBar');
  const progressTardeBadge = document.getElementById('progressTardeBadge');
  const progressTardeBar = document.getElementById('progressTardeBar');
  const progressNoiteBadge = document.getElementById('progressNoiteBadge');
  const progressNoiteBar = document.getElementById('progressNoiteBar');

  const allCheckboxes = document.querySelectorAll('.checklist-items input[type="checkbox"]');
  const btnResetChecklists = document.getElementById('btnResetChecklists');

  // 1. Carregar e Aplicar Nomes da Equipe
  function loadTeamNames() {
    const saved = localStorage.getItem(TEAM_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        currentTeam.colab1 = parsed.colab1 || DEFAULT_TEAM.colab1;
        currentTeam.colab2 = parsed.colab2 || DEFAULT_TEAM.colab2;
        currentTeam.colab3 = parsed.colab3 || DEFAULT_TEAM.colab3;
      } catch (e) {
        currentTeam = { ...DEFAULT_TEAM };
      }
    }
    applyTeamNamesToDOM();
  }

  function applyTeamNamesToDOM() {
    // Atualiza Inputs do Modal
    if (inputColab1) inputColab1.value = currentTeam.colab1;
    if (inputColab2) inputColab2.value = currentTeam.colab2;
    if (inputColab3) inputColab3.value = currentTeam.colab3;

    // Atualiza Chips de Filtro
    if (chipColab1) {
      chipColab1.textContent = `🌅 ${currentTeam.colab1} (Manhã)`;
      chipColab1.setAttribute('data-colab', currentTeam.colab1);
    }
    if (chipColab2) {
      chipColab2.textContent = `☀️ ${currentTeam.colab2} (Tarde/Noite)`;
      chipColab2.setAttribute('data-colab', currentTeam.colab2);
    }
    if (chipColab3) {
      chipColab3.textContent = `🌙 ${currentTeam.colab3} (Tarde/Noite)`;
      chipColab3.setAttribute('data-colab', currentTeam.colab3);
    }

    // Atualiza Badges nas Linhas de Tarefa
    document.querySelectorAll('[data-colab-key="colab1"]').forEach(el => {
      el.textContent = `👤 ${currentTeam.colab1}`;
    });
    document.querySelectorAll('[data-colab-key="colab2"]').forEach(el => {
      el.textContent = `👤 ${currentTeam.colab2}`;
    });
    document.querySelectorAll('[data-colab-key="colab3"]').forEach(el => {
      el.textContent = `👤 ${currentTeam.colab3}`;
    });
    document.querySelectorAll('[data-colab-key="colab2_3"]').forEach(el => {
      el.textContent = `👥 ${currentTeam.colab2} e ${currentTeam.colab3}`;
    });

    // Atualiza data-colab nos itens para filtro correto
    document.querySelectorAll('.check-row-item').forEach(item => {
      const badge = item.querySelector('.colab-badge');
      if (badge) {
        const key = badge.getAttribute('data-colab-key');
        if (key === 'colab1') item.setAttribute('data-colab', currentTeam.colab1);
        else if (key === 'colab2') item.setAttribute('data-colab', currentTeam.colab2);
        else if (key === 'colab3') item.setAttribute('data-colab', currentTeam.colab3);
        else if (key === 'colab2_3') item.setAttribute('data-colab', `${currentTeam.colab2},${currentTeam.colab3}`);
      }
    });
  }

  // 2. Modal Handlers
  if (btnEditTeam && modalTeamConfig) {
    btnEditTeam.addEventListener('click', () => {
      modalTeamConfig.style.display = 'flex';
    });
  }

  if (btnCloseTeamModal && modalTeamConfig) {
    btnCloseTeamModal.addEventListener('click', () => {
      modalTeamConfig.style.display = 'none';
    });
  }

  if (modalTeamConfig) {
    modalTeamConfig.addEventListener('click', (e) => {
      if (e.target === modalTeamConfig) {
        modalTeamConfig.style.display = 'none';
      }
    });
  }

  if (btnSaveTeamNames) {
    btnSaveTeamNames.addEventListener('click', () => {
      const n1 = inputColab1.value.trim() || DEFAULT_TEAM.colab1;
      const n2 = inputColab2.value.trim() || DEFAULT_TEAM.colab2;
      const n3 = inputColab3.value.trim() || DEFAULT_TEAM.colab3;

      currentTeam = { colab1: n1, colab2: n2, colab3: n3 };
      localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(currentTeam));
      applyTeamNamesToDOM();
      modalTeamConfig.style.display = 'none';
      showToast('Nomes da equipe atualizados com sucesso!');
    });
  }

  if (btnResetTeamDefault) {
    btnResetTeamDefault.addEventListener('click', () => {
      currentTeam = { ...DEFAULT_TEAM };
      localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(currentTeam));
      applyTeamNamesToDOM();
      modalTeamConfig.style.display = 'none';
      showToast('Nomes restaurados para o padrão original!');
    });
  }

  // 3. Filtro por Colaborador
  colabChips.forEach(chip => {
    chip.addEventListener('click', () => {
      colabChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      const selectedColab = chip.getAttribute('data-colab');
      const rowItems = document.querySelectorAll('.check-row-item');

      rowItems.forEach(row => {
        if (selectedColab === 'all') {
          row.classList.remove('hidden-by-filter');
        } else {
          const rowColab = row.getAttribute('data-colab') || '';
          if (rowColab.includes(selectedColab)) {
            row.classList.remove('hidden-by-filter');
          } else {
            row.classList.add('hidden-by-filter');
          }
        }
      });
    });
  });

  // 4. Progresso e Persistência dos Checklists (Diário + Supabase)
  const SUPABASE_REST_URL = 'https://ehhjnwosqcrfwonqhfoz.supabase.co/rest/v1/mt_daily_checklist_logs';
  const SUPABASE_ANON_KEY = 'sb_publishable_kYqGp1MgzhhD3DmW0WTfig_TQVODJ8r';

  function getTodayKey() {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }); // Formato: YYYY-MM-DD
  }

  function updateDateLabel() {
    const label = document.getElementById('auditTodayDateLabel');
    if (!label) return;
    const now = new Date();
    const opts = { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' };
    const str = now.toLocaleDateString('pt-BR', opts);
    label.textContent = `Rotina de Hoje: ${str.charAt(0).toUpperCase() + str.slice(1)}`;
  }

  function getDailyStorageKey() {
    return `montreal_daily_checklist_${getTodayKey()}`;
  }

  function updateShiftProgress() {
    function calcProgress(listId, badgeEl, barEl) {
      const list = document.getElementById(listId);
      if (!list) return;
      const cbs = list.querySelectorAll('input[type="checkbox"]');
      const total = cbs.length;
      const done = Array.from(cbs).filter(cb => cb.checked).length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;

      if (badgeEl) badgeEl.textContent = `${done}/${total} feitos (${pct}%)`;
      if (barEl) barEl.style.width = `${pct}%`;
    }

    calcProgress('checkListManha', progressManhaBadge, progressManhaBar);
    calcProgress('checkListTarde', progressTardeBadge, progressTardeBar);
    calcProgress('checkListNoite', progressNoiteBadge, progressNoiteBar);
  }

  function loadChecklistState() {
    updateDateLabel();
    const dailyKey = getDailyStorageKey();
    const saved = localStorage.getItem(dailyKey);
    if (!saved) {
      allCheckboxes.forEach(cb => cb.checked = false);
      updateShiftProgress();
      loadRemoteChecklist();
      return;
    }
    try {
      const states = JSON.parse(saved);
      allCheckboxes.forEach(cb => {
        const id = cb.getAttribute('data-id');
        if (id && states[id] !== undefined) {
          cb.checked = states[id];
        }
      });
    } catch (e) {
      console.error('Erro ao ler checklists:', e);
    }
    updateShiftProgress();
    loadRemoteChecklist();
  }

  function saveChecklistState() {
    const states = {};
    allCheckboxes.forEach(cb => {
      const id = cb.getAttribute('data-id');
      if (id) states[id] = cb.checked;
    });
    localStorage.setItem(getDailyStorageKey(), JSON.stringify(states));
    updateShiftProgress();
  }

  async function syncChecklistToSupabase(taskId, isChecked, rowItem) {
    const syncStatusEl = document.getElementById('auditSyncStatus');
    if (syncStatusEl) {
      syncStatusEl.className = 'audit-sync-status syncing';
      syncStatusEl.innerHTML = '<span class="sync-dot">🟡</span> Sincronizando com Supabase...';
    }

    const timeEl = rowItem ? rowItem.querySelector('.time-pill') : null;
    const descEl = rowItem ? rowItem.querySelector('.task-desc') : null;
    const colabEl = rowItem ? rowItem.querySelector('.colab-badge') : null;
    const cardEl = rowItem ? rowItem.closest('.checklist-card') : null;

    let shift = 'outro';
    if (cardEl && cardEl.id === 'cardTurnoManha') shift = 'manha';
    else if (cardEl && cardEl.id === 'cardTurnoTarde') shift = 'tarde';
    else if (cardEl && cardEl.id === 'cardTurnoNoite') shift = 'noite';

    const payload = {
      date_key: getTodayKey(),
      task_id: taskId,
      task_desc: descEl ? descEl.textContent.trim() : '',
      shift: shift,
      scheduled_time: timeEl ? timeEl.textContent.replace('⏰', '').trim() : '',
      collaborator_name: colabEl ? colabEl.textContent.replace('👤', '').replace('👥', '').trim() : '',
      is_completed: isChecked,
      completed_at: new Date().toISOString()
    };

    try {
      await fetch(`${SUPABASE_REST_URL}?on_conflict=date_key,task_id`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(payload)
      });
      if (syncStatusEl) {
        syncStatusEl.className = 'audit-sync-status';
        syncStatusEl.innerHTML = '<span class="sync-dot">🟢</span> Sincronizado com Auditoria n8n & Supabase';
      }
    } catch (err) {
      console.warn('Erro ao salvar no Supabase:', err);
      if (syncStatusEl) {
        syncStatusEl.className = 'audit-sync-status';
        syncStatusEl.innerHTML = '<span class="sync-dot">💾</span> Salvo localmente';
      }
    }
  }

  async function loadRemoteChecklist() {
    const todayStr = getTodayKey();
    try {
      const res = await fetch(`${SUPABASE_REST_URL}?date_key=eq.${todayStr}&order=completed_at.asc&select=*`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
          const remoteState = {};
          rows.forEach(r => {
            if (r.task_id) remoteState[r.task_id] = r.is_completed;
          });
          allCheckboxes.forEach(cb => {
            const id = cb.getAttribute('data-id');
            if (id && remoteState[id] !== undefined) {
              cb.checked = remoteState[id];
            }
          });
          localStorage.setItem(getDailyStorageKey(), JSON.stringify(remoteState));
          updateShiftProgress();
        }
      }
    } catch (e) {
      // Offline fallback silencioso
    }
  }

  allCheckboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      saveChecklistState();
      const id = cb.getAttribute('data-id');
      const rowItem = cb.closest('.check-row-item');
      syncChecklistToSupabase(id, cb.checked, rowItem);
      showToast('Item do checklist registrado!');
    });
  });

  if (btnResetChecklists) {
    btnResetChecklists.addEventListener('click', () => {
      if (confirm('Deseja desmarcar todas as tarefas para iniciar um novo dia na secretaria?')) {
        allCheckboxes.forEach(cb => {
          cb.checked = false;
          const id = cb.getAttribute('data-id');
          const rowItem = cb.closest('.check-row-item');
          syncChecklistToSupabase(id, false, rowItem);
        });
        localStorage.removeItem(getDailyStorageKey());
        localStorage.removeItem(CHECKLIST_STORAGE_KEY);
        updateShiftProgress();
        showToast('Checklists reiniciados para o novo dia!');
      }
    });
  }

  // Inicialização
  loadTeamNames();
  loadChecklistState();

  // --------------------------------------------------------
  // 7. THEME TOGGLE (DARK / LIGHT MODE)
  // --------------------------------------------------------
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeIcon = document.getElementById('themeIcon');

  themeToggleBtn.addEventListener('click', () => {
    if (document.body.classList.contains('theme-dark')) {
      document.body.classList.remove('theme-dark');
      document.body.classList.add('theme-light');
      themeIcon.textContent = '☀️';
      localStorage.setItem('montreal_theme', 'light');
    } else {
      document.body.classList.remove('theme-light');
      document.body.classList.add('theme-dark');
      themeIcon.textContent = '🌙';
      localStorage.setItem('montreal_theme', 'dark');
    }
  });

  if (localStorage.getItem('montreal_theme') === 'light') {
    document.body.classList.remove('theme-dark');
    document.body.classList.add('theme-light');
    themeIcon.textContent = '☀️';
  }

  // --------------------------------------------------------
  // 7. DASHBOARD & RELATÓRIOS DE SLA DO CHATWOOT
  // --------------------------------------------------------
  const SLA_REPORT_EMBEDDED = {
    "generated_at": "14/09/2026 às 11:34",
    "total_conversas_historico": 750,
    "periods": {
      "mes_atual": {
        "period_name": "Mês Atual (Setembro/2026)",
        "total_conversas": 734,
        "pct_meta_5min": 83.5,
        "tempo_medio_primeira_resposta_min": 14.2,
        "tempo_mediano_primeira_resposta_min": 0.1,
        "total_respondidas": 693,
        "total_dentro_meta": 579,
        "total_resolvidas": 693,
        "pct_resolvidas": 94.4,
        "total_sem_atribuicao": 683,
        "pct_sem_atribuicao": 93.1,
        "faixas_velocidade": {
          "super_rapido_2m": 521,
          "meta_2_5m": 58,
          "atraso_5_30m": 73,
          "critico_30m_plus": 41
        },
        "por_atendente": [
          {
            "name": "Não Atribuído",
            "total": 683,
            "respondidas": 644,
            "pct_meta_5min": 85.7,
            "tempo_medio_min": 8.6,
            "tempo_mediano_min": 0.1,
            "resolvidas": 656,
            "pct_resolvidas": 96.0
          },
          {
            "name": "Atendimento | Montreal Tênis Clube:",
            "total": 48,
            "respondidas": 46,
            "pct_meta_5min": 54.3,
            "tempo_medio_min": 92.5,
            "tempo_mediano_min": 3.5,
            "resolvidas": 34,
            "pct_resolvidas": 70.8
          },
          {
            "name": "Atendimento || Montreal Tênis Clube:",
            "total": 2,
            "respondidas": 2,
            "pct_meta_5min": 50.0,
            "tempo_medio_min": 17.8,
            "tempo_mediano_min": 17.8,
            "resolvidas": 2,
            "pct_resolvidas": 100.0
          },
          {
            "name": "Atendimento III | Montreal Tênis Clube:",
            "total": 1,
            "respondidas": 1,
            "pct_meta_5min": 100.0,
            "tempo_medio_min": 0.1,
            "tempo_mediano_min": 0.1,
            "resolvidas": 1,
            "pct_resolvidas": 100.0
          }
        ],
        "por_horario": {
          "08": 46, "09": 81, "10": 68, "11": 91, "12": 37, "13": 43, "14": 47, "15": 45,
          "16": 48, "17": 51, "18": 38, "19": 34, "20": 52, "21": 25, "22": 13, "outros": 15
        },
        "por_etiqueta": [
          { "tag": "Sem etiqueta", "count": 276, "pct": 37.6 },
          { "tag": "recebeu_formulário", "count": 176, "pct": 24.0 },
          { "tag": "professor", "count": 129, "pct": 17.6 },
          { "tag": "interessado", "count": 124, "pct": 16.9 },
          { "tag": "sócio", "count": 102, "pct": 13.9 },
          { "tag": "Caixa de Entrada - Montreal", "count": 100, "pct": 13.6 },
          { "tag": "aluno", "count": 74, "pct": 10.1 },
          { "tag": "pré-inscrito", "count": 58, "pct": 7.9 }
        ]
      },
      "mes_anterior": {
        "period_name": "Mês Anterior (Agosto/2026)",
        "total_conversas": 12,
        "pct_meta_5min": 66.7,
        "tempo_medio_primeira_resposta_min": 10.2,
        "tempo_mediano_primeira_resposta_min": 0.5,
        "total_respondidas": 12,
        "total_dentro_meta": 8,
        "total_resolvidas": 11,
        "pct_resolvidas": 91.7,
        "total_sem_atribuicao": 7,
        "pct_sem_atribuicao": 58.3,
        "faixas_velocidade": {
          "super_rapido_2m": 8,
          "meta_2_5m": 0,
          "atraso_5_30m": 3,
          "critico_30m_plus": 1
        },
        "por_atendente": [
          {
            "name": "Não Atribuído",
            "total": 7,
            "respondidas": 7,
            "pct_meta_5min": 85.7,
            "tempo_medio_min": 11.7,
            "tempo_mediano_min": 0.38,
            "resolvidas": 7,
            "pct_resolvidas": 100.0
          },
          {
            "name": "Atendimento | Montreal Tênis Clube:",
            "total": 5,
            "respondidas": 5,
            "pct_meta_5min": 40.0,
            "tempo_medio_min": 8.1,
            "tempo_mediano_min": 7.7,
            "resolvidas": 4,
            "pct_resolvidas": 80.0
          }
        ],
        "por_horario": {
          "08": 0, "09": 0, "10": 1, "11": 1, "12": 1, "13": 0, "14": 0, "15": 1,
          "16": 2, "17": 2, "18": 2, "19": 0, "20": 2, "21": 0, "22": 0, "outros": 0
        },
        "por_etiqueta": [
          { "tag": "recebeu_formulário", "count": 9, "pct": 75.0 },
          { "tag": "interessado", "count": 5, "pct": 41.7 },
          { "tag": "matchmaker", "count": 3, "pct": 25.0 },
          { "tag": "Sem etiqueta", "count": 2, "pct": 16.7 },
          { "tag": "pendente_formação", "count": 1, "pct": 8.3 }
        ]
      },
      "ultimos_30d": {
        "period_name": "Últimos 30 Dias",
        "total_conversas": 746,
        "pct_meta_5min": 83.3,
        "tempo_medio_primeira_resposta_min": 14.1,
        "tempo_mediano_primeira_resposta_min": 0.1,
        "total_respondidas": 705,
        "total_dentro_meta": 587,
        "total_resolvidas": 704,
        "pct_resolvidas": 94.4,
        "total_sem_atribuicao": 690,
        "pct_sem_atribuicao": 92.5,
        "faixas_velocidade": {
          "super_rapido_2m": 529,
          "meta_2_5m": 58,
          "atraso_5_30m": 76,
          "critico_30m_plus": 42
        },
        "por_atendente": [
          {
            "name": "Não Atribuído",
            "total": 690,
            "respondidas": 651,
            "pct_meta_5min": 85.7,
            "tempo_medio_min": 8.7,
            "tempo_mediano_min": 0.1,
            "resolvidas": 663,
            "pct_resolvidas": 96.1
          },
          {
            "name": "Atendimento | Montreal Tênis Clube:",
            "total": 53,
            "respondidas": 51,
            "pct_meta_5min": 52.9,
            "tempo_medio_min": 84.2,
            "tempo_mediano_min": 3.55,
            "resolvidas": 38,
            "pct_resolvidas": 71.7
          },
          {
            "name": "Atendimento || Montreal Tênis Clube:",
            "total": 2,
            "respondidas": 2,
            "pct_meta_5min": 50.0,
            "tempo_medio_min": 17.8,
            "tempo_mediano_min": 17.8,
            "resolvidas": 2,
            "pct_resolvidas": 100.0
          },
          {
            "name": "Atendimento III | Montreal Tênis Clube:",
            "total": 1,
            "respondidas": 1,
            "pct_meta_5min": 100.0,
            "tempo_medio_min": 0.1,
            "tempo_mediano_min": 0.1,
            "resolvidas": 1,
            "pct_resolvidas": 100.0
          }
        ],
        "por_horario": {
          "08": 46, "09": 81, "10": 69, "11": 92, "12": 38, "13": 43, "14": 47, "15": 46,
          "16": 50, "17": 53, "18": 40, "19": 34, "20": 54, "21": 25, "22": 13, "outros": 15
        },
        "por_etiqueta": [
          { "tag": "Sem etiqueta", "count": 278, "pct": 37.3 },
          { "tag": "recebeu_formulário", "count": 185, "pct": 24.8 },
          { "tag": "interessado", "count": 129, "pct": 17.3 },
          { "tag": "professor", "count": 129, "pct": 17.3 },
          { "tag": "sócio", "count": 102, "pct": 13.7 },
          { "tag": "Caixa de Entrada - Montreal", "count": 100, "pct": 13.4 },
          { "tag": "aluno", "count": 74, "pct": 9.9 },
          { "tag": "pré-inscrito", "count": 58, "pct": 7.8 }
        ]
      },
      "ultimos_7d": {
        "period_name": "Últimos 7 Dias",
        "total_conversas": 629,
        "pct_meta_5min": 84.2,
        "tempo_medio_primeira_resposta_min": 13.9,
        "tempo_mediano_primeira_resposta_min": 0.1,
        "total_respondidas": 588,
        "total_dentro_meta": 495,
        "total_resolvidas": 589,
        "pct_resolvidas": 93.6,
        "total_sem_atribuicao": 589,
        "pct_sem_atribuicao": 93.6,
        "faixas_velocidade": {
          "super_rapido_2m": 449,
          "meta_2_5m": 46,
          "atraso_5_30m": 60,
          "critico_30m_plus": 33
        },
        "por_atendente": [
          {
            "name": "Não Atribuído",
            "total": 589,
            "respondidas": 550,
            "pct_meta_5min": 86.4,
            "tempo_medio_min": 7.7,
            "tempo_mediano_min": 0.1,
            "resolvidas": 562,
            "pct_resolvidas": 95.4
          },
          {
            "name": "Atendimento | Montreal Tênis Clube:",
            "total": 37,
            "respondidas": 35,
            "pct_meta_5min": 51.4,
            "tempo_medio_min": 110.8,
            "tempo_mediano_min": 4.12,
            "resolvidas": 24,
            "pct_resolvidas": 64.9
          },
          {
            "name": "Atendimento || Montreal Tênis Clube:",
            "total": 2,
            "respondidas": 2,
            "pct_meta_5min": 50.0,
            "tempo_medio_min": 17.8,
            "tempo_mediano_min": 17.8,
            "resolvidas": 2,
            "pct_resolvidas": 100.0
          },
          {
            "name": "Atendimento III | Montreal Tênis Clube:",
            "total": 1,
            "respondidas": 1,
            "pct_meta_5min": 100.0,
            "tempo_medio_min": 0.1,
            "tempo_mediano_min": 0.1,
            "resolvidas": 1,
            "pct_resolvidas": 100.0
          }
        ],
        "por_horario": {
          "08": 39, "09": 72, "10": 59, "11": 79, "12": 33, "13": 37, "14": 37, "15": 36,
          "16": 34, "17": 44, "18": 31, "19": 32, "20": 50, "21": 22, "22": 11, "outros": 13
        },
        "por_etiqueta": [
          { "tag": "Sem etiqueta", "count": 246, "pct": 39.1 },
          { "tag": "recebeu_formulário", "count": 146, "pct": 23.2 },
          { "tag": "professor", "count": 109, "pct": 17.3 },
          { "tag": "interessado", "count": 105, "pct": 16.7 },
          { "tag": "sócio", "count": 84, "pct": 13.4 },
          { "tag": "Caixa de Entrada - Montreal", "count": 76, "pct": 12.1 },
          { "tag": "aluno", "count": 67, "pct": 10.7 },
          { "tag": "pré-inscrito", "count": 53, "pct": 8.4 }
        ]
      }
    }
  };

  let slaReportData = SLA_REPORT_EMBEDDED;
  const selectPeriodoSla = document.getElementById('selectPeriodoSla');
  const btnRefreshSla = document.getElementById('btnRefreshSla');

  async function loadSlaReportData() {
    try {
      const res = await fetch('data/chatwoot_sla_report.json?t=' + Date.now());
      if (res.ok) {
        const freshData = await res.json();
        if (freshData && freshData.periods) {
          slaReportData = freshData;
        }
      }
    } catch (err) {
      console.log('Usando dataset embutido.');
    }
    const curVal = selectPeriodoSla ? selectPeriodoSla.value : 'mes_atual';
    renderSlaDashboard(curVal);
  }

  function renderSlaDashboard(periodKey) {
    if (!slaReportData || !slaReportData.periods) return;
    const p = slaReportData.periods[periodKey] || slaReportData.periods['mes_atual'];
    if (!p) return;

    // 1. KPI Cards
    const kpiMeta5m = document.getElementById('kpiMeta5m');
    const kpiMeta5mSub = document.getElementById('kpiMeta5mSub');
    const kpiProgressMeta = document.getElementById('kpiProgressMeta');
    const kpiBadgeStatus = document.getElementById('kpiBadgeStatus');
    const kpiTempoMedio = document.getElementById('kpiTempoMedio');
    const kpiTempoMediano = document.getElementById('kpiTempoMediano');
    const kpiTotalConvs = document.getElementById('kpiTotalConvs');
    const kpiTaxaResolucaoSub = document.getElementById('kpiTaxaResolucaoSub');

    if (kpiMeta5m) kpiMeta5m.textContent = `${p.pct_meta_5min}%`;
    if (kpiMeta5mSub) kpiMeta5mSub.innerHTML = `<strong>${p.total_dentro_meta} de ${p.total_respondidas}</strong> conversas respondidas em até 5 min`;
    if (kpiProgressMeta) kpiProgressMeta.style.width = `${Math.min(100, p.pct_meta_5min)}%`;

    if (kpiBadgeStatus) {
      if (p.pct_meta_5min >= 80) {
        kpiBadgeStatus.textContent = 'Excelente';
        kpiBadgeStatus.style.background = 'rgba(16, 185, 129, 0.2)';
        kpiBadgeStatus.style.color = '#34d399';
      } else if (p.pct_meta_5min >= 65) {
        kpiBadgeStatus.textContent = 'Bom';
        kpiBadgeStatus.style.background = 'rgba(245, 158, 11, 0.2)';
        kpiBadgeStatus.style.color = '#fbbf24';
      } else {
        kpiBadgeStatus.textContent = 'Atenção';
        kpiBadgeStatus.style.background = 'rgba(239, 68, 68, 0.2)';
        kpiBadgeStatus.style.color = '#f87171';
      }
    }

    if (kpiTempoMedio) kpiTempoMedio.innerHTML = `${p.tempo_medio_primeira_resposta_min} <small>min</small>`;
    if (kpiTempoMediano) kpiTempoMediano.innerHTML = `${p.tempo_mediano_primeira_resposta_min} <small>min</small>`;
    if (kpiTotalConvs) kpiTotalConvs.textContent = p.total_conversas;
    if (kpiTaxaResolucaoSub) kpiTaxaResolucaoSub.innerHTML = `<strong>${p.pct_resolvidas}%</strong> resolvidas (${p.total_resolvidas} conversas)`;

    // 2. Faixas de Velocidade
    const f = p.faixas_velocidade || {};
    const totalResp = p.total_respondidas || 1;

    const pctUltra = ((f.super_rapido_2m || 0) / totalResp * 100).toFixed(1);
    const pctOk = ((f.meta_2_5m || 0) / totalResp * 100).toFixed(1);
    const pctWarn = ((f.atraso_5_30m || 0) / totalResp * 100).toFixed(1);
    const pctDanger = ((f.critico_30m_plus || 0) / totalResp * 100).toFixed(1);

    const elUltra = document.getElementById('tierSuperRapido');
    const barUltra = document.getElementById('tierBarSuperRapido');
    if (elUltra) elUltra.textContent = `${f.super_rapido_2m || 0} conversas (${pctUltra}%)`;
    if (barUltra) barUltra.style.width = `${pctUltra}%`;

    const elOk = document.getElementById('tierMeta');
    const barOk = document.getElementById('tierBarMeta');
    if (elOk) elOk.textContent = `${f.meta_2_5m || 0} conversas (${pctOk}%)`;
    if (barOk) barOk.style.width = `${pctOk}%`;

    const elWarn = document.getElementById('tierAtraso');
    const barWarn = document.getElementById('tierBarAtraso');
    if (elWarn) elWarn.textContent = `${f.atraso_5_30m || 0} conversas (${pctWarn}%)`;
    if (barWarn) barWarn.style.width = `${pctWarn}%`;

    const elDanger = document.getElementById('tierCritico');
    const barDanger = document.getElementById('tierBarCritico');
    if (elDanger) elDanger.textContent = `${f.critico_30m_plus || 0} conversas (${pctDanger}%)`;
    if (barDanger) barDanger.style.width = `${pctDanger}%`;

    // 3. Gráfico de Horários de Pico
    const chartContainer = document.getElementById('hourlyChartContainer');
    if (chartContainer && p.por_horario) {
      chartContainer.innerHTML = '';
      const counts = p.por_horario;
      const values = Object.keys(counts).filter(k => k !== 'outros').map(k => counts[k]);
      const maxVal = Math.max(...values, 1);

      for (let h = 8; h <= 22; h++) {
        const hKey = String(h).padStart(2, '0');
        const count = counts[hKey] || 0;
        const heightPct = Math.max(4, Math.round((count / maxVal) * 100));

        const col = document.createElement('div');
        col.className = 'hourly-col';
        col.innerHTML = `
          ${count > 0 ? `<span class="hourly-val-tooltip">${count}</span>` : ''}
          <div class="hourly-bar" style="height: ${heightPct}%;" title="${count} conversas às ${hKey}:00"></div>
          <span class="hourly-label">${hKey}h</span>
        `;
        chartContainer.appendChild(col);
      }
    }

    // 4. Distribuição por Etiquetas
    const tagsContainer = document.getElementById('tagsDistributionGrid');
    if (tagsContainer && p.por_etiqueta) {
      tagsContainer.innerHTML = '';
      p.por_etiqueta.forEach(item => {
        const tagCard = document.createElement('div');
        tagCard.className = 'tag-metric-card';
        tagCard.innerHTML = `
          <div class="tag-name-row">
            <span class="tag-pill-badge">${item.tag}</span>
            <span class="tag-count-num">${item.count}</span>
          </div>
          <span class="tag-pct-sub">${item.pct}% do total de atendimentos</span>
        `;
        tagsContainer.appendChild(tagCard);
      });
    }

    // 5. Tabela de Performance por Atendente
    const tbody = document.getElementById('agentTableBody');
    if (tbody && p.por_atendente) {
      tbody.innerHTML = '';
      p.por_atendente.forEach(ag => {
        let badgeClass = 'green';
        if (ag.pct_meta_5min < 70) badgeClass = 'red';
        else if (ag.pct_meta_5min < 85) badgeClass = 'yellow';

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>
            <div class="agent-name-cell">
              <span>👤</span>
              <strong>${ag.name}</strong>
            </div>
          </td>
          <td><strong>${ag.total}</strong></td>
          <td>${ag.respondidas}</td>
          <td>
            <span class="agent-badge-sla ${badgeClass}">${ag.pct_meta_5min}%</span>
          </td>
          <td>${ag.tempo_medio_min} min</td>
          <td>${ag.tempo_mediano_min} min</td>
          <td>${ag.resolvidas}</td>
          <td><strong>${ag.pct_resolvidas}%</strong></td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  if (selectPeriodoSla) {
    selectPeriodoSla.onchange = function() {
      renderSlaDashboard(this.value);
    };
    selectPeriodoSla.addEventListener('input', function() {
      renderSlaDashboard(this.value);
    });
  }

  if (btnRefreshSla) {
    btnRefreshSla.addEventListener('click', async () => {
      btnRefreshSla.classList.add('loading');
      await loadSlaReportData();
      showToast('Dados do SLA sincronizados com o Chatwoot!');
      setTimeout(() => {
        btnRefreshSla.classList.remove('loading');
      }, 600);
    });
  }

  // Expose globally for inline onchange
  window.renderSlaDashboard = renderSlaDashboard;

  // Render inicial
  renderSlaDashboard('mes_atual');
  loadSlaReportData();

});

// Global video toggle function
function toggleVideo(btn, videoUrl) {
  const card = btn.closest('.video-card');
  const previewBox = card.querySelector('.video-preview-box');
  const realContainer = previewBox.querySelector('.video-real-container');
  const placeholder = previewBox.querySelector('.video-placeholder');

  if (!videoUrl) {
    alert('Vídeo demonstrativo em fase de gravação. Em breve disponível no portal!');
    return;
  }

  if (realContainer.style.display === 'none') {
    realContainer.querySelector('iframe').src = videoUrl;
    realContainer.style.display = 'block';
    placeholder.style.display = 'none';
    btn.textContent = 'Ocultar Vídeo';
  } else {
    realContainer.querySelector('iframe').src = '';
    realContainer.style.display = 'none';
    placeholder.style.display = 'flex';
    btn.textContent = 'Assistir Demonstração';
  }
}
