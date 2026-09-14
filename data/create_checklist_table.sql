-- =========================================================================
-- MONTREAL TÊNIS CLUBE - TABELA DE REGISTRO DIÁRIO DE CHECKLISTS & ROTINAS
-- Execute este script no SQL Editor do Supabase (Projeto: ehhjnwosqcrfwonqhfoz)
-- =========================================================================

CREATE TABLE IF NOT EXISTS mt_daily_checklist_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_key DATE NOT NULL DEFAULT CURRENT_DATE, -- Data no formato YYYY-MM-DD
  task_id TEXT NOT NULL, -- Identificador da tarefa (m_1 a m_9, t_1 a t_6, n_1 a n_7)
  task_desc TEXT, -- Descrição da tarefa
  shift TEXT, -- Turno: 'manha', 'tarde', 'noite'
  scheduled_time TEXT, -- Horário previsto (ex: '07:00', '11:00', '18:20', '22:30')
  collaborator_name TEXT, -- Nome do colaborador responsável
  is_completed BOOLEAN DEFAULT TRUE, -- Status de conclusão
  completed_at TIMESTAMPTZ DEFAULT NOW(), -- Timestamp exato da marcação
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date_key, task_id) -- Garante um único registro por tarefa por dia (upsert)
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE mt_daily_checklist_logs ENABLE ROW LEVEL SECURITY;

-- Política de Acesso Público para Leitura e Gravação (anon)
DROP POLICY IF EXISTS "Allow anon all mt_daily_checklist_logs" ON mt_daily_checklist_logs;
CREATE POLICY "Allow anon all mt_daily_checklist_logs" ON mt_daily_checklist_logs 
  FOR ALL 
  TO anon, authenticated, service_role 
  USING (true) 
  WITH CHECK (true);

-- Índices de performance para busca diária rápida
CREATE INDEX IF NOT EXISTS idx_mt_checklist_date ON mt_daily_checklist_logs (date_key);
CREATE INDEX IF NOT EXISTS idx_mt_checklist_completed ON mt_daily_checklist_logs (date_key, is_completed);
