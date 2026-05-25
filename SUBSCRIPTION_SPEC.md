# Especificação: Sistema de Assinaturas — Quanto Custa × SimplisPay

> **Base URL SimplisPay:** `https://api.simplispay.com.br/` (substituir `api.zsystems.com.br` em qualquer referência legada)

---

## 1. Visão Geral

O Quanto Custa usa a SimplisPay como gateway de cobranças recorrentes. O fluxo principal é:

```
Usuário preenche checkout
       ↓
Edge function `process-subscription` cria assinatura na SimplisPay
       ↓
SimplisPay gerencia os ciclos de cobrança automaticamente
       ↓
Webhook `simplispay-webhook` recebe eventos de status
       ↓
DB Supabase atualizado; ledger registra cada evento
```

A SimplisPay **não envia headers de autenticação no webhook** — segurança garantida pelo endpoint ser secreto.

---

## 2. Planos Configurados na SimplisPay

Dois planos são criados via `POST https://api.simplispay.com.br/planos` com o token master de marketplace. Os IDs resultantes são armazenados como variáveis de ambiente na edge function.

### 2.1 Plano Mensal

```json
{
  "name": "Quanto Custa — Mensal",
  "description": "Acesso completo ao Quanto Custa com cobrança mensal automática",
  "email": "contato@quantocusta.app",
  "setup_amount": 0,
  "amount": 4900,
  "grace_period": "14",
  "tolerance_period": 3,
  "frequency": "monthly",
  "interval": 1,
  "currency": "BRL",
  "payment_methods": "credit_card",
  "has_expiration": false,
  "expire_subscriptions": false
}
```

`amount`: 4900 = R$ 49,00 (centavos). Ajustar conforme precificação final.  
`grace_period: "14"` → 14 dias de trial antes da primeira cobrança.  
`tolerance_period: 3` → 3 dias de tolerância em caso de falha no pagamento.

### 2.2 Plano Anual

```json
{
  "name": "Quanto Custa — Anual",
  "description": "Acesso completo ao Quanto Custa com cobrança anual automática",
  "email": "contato@quantocusta.app",
  "setup_amount": 0,
  "amount": 46800,
  "grace_period": "14",
  "tolerance_period": 3,
  "frequency": "annualy",
  "interval": 1,
  "currency": "BRL",
  "payment_methods": "credit_card",
  "has_expiration": false,
  "expire_subscriptions": false
}
```

`amount`: 46800 = R$ 468,00 (equivale a R$ 39/mês × 12, ~20% de desconto).  
**Atenção:** A SimplisPay usa `"annualy"` (com um `l`) — não `"annually"`.

### 2.3 Variáveis de Ambiente (edge function)

```
SIMPLISPAY_BASE_URL=https://api.simplispay.com.br
SIMPLISPAY_EMAIL=<email-da-conta-marketplace>
SIMPLISPAY_PASSWORD=<senha-da-conta-marketplace>
SIMPLISPAY_PLAN_ID_MONTHLY=<id-retornado-na-criacao-do-plano-mensal>
SIMPLISPAY_PLAN_ID_ANNUAL=<id-retornado-na-criacao-do-plano-anual>
```

---

## 3. Autenticação na SimplisPay

Token JWT com validade de **4 horas**. A edge function mantém o token em cache na tabela `gateway_tokens`.

### 3.1 Geração

```
POST https://api.simplispay.com.br/createToken
Content-Type: application/json

{
  "email": "<SIMPLISPAY_EMAIL>",
  "password": "<SIMPLISPAY_PASSWORD>"
}
```

Resposta:
```json
{
  "success": true,
  "token": "eyJhbGci..."
}
```

### 3.2 Uso

Todas as chamadas à SimplisPay incluem:
```
Authorization: Bearer <token>
Content-Type: application/json
```

### 3.3 Estratégia de Cache

```typescript
// Regra de renovação: renovar se faltar menos de 30 minutos para expirar
const MIN_VALID_MS = 30 * 60 * 1_000;

async function getValidSimplisPayToken(): Promise<string> {
  const cached = await supabase
    .from('gateway_tokens')
    .select('token_value, token_expires_at, consecutive_failures')
    .eq('provider', 'simplispay')
    .single();

  if (cached.data && cached.data.consecutive_failures < 3) {
    const expiresAt = new Date(cached.data.token_expires_at).getTime();
    if (expiresAt - Date.now() > MIN_VALID_MS) {
      return cached.data.token_value;
    }
  }

  return refreshSimplisPayToken(); // chama /createToken e atualiza gateway_tokens
}
```

---

## 4. Schema do Banco de Dados

### 4.1 Tipos (Enums) — nomenclatura exata

```sql
-- Status interno da assinatura no nosso sistema
CREATE TYPE public.subscription_status AS ENUM (
  'trialing',    -- dentro do período de trial (14 dias), sem cobrança ainda
  'active',      -- paga e ativa
  'past_due',    -- pagamento falhou, dentro do tolerance_period
  'suspended',   -- suspensa pela plataforma ou por falha persistente
  'canceled',    -- cancelada definitivamente (removed na SimplisPay)
  'expired'      -- plano com data de expiração atingida (reservado para uso futuro)
);

-- Ciclo de cobrança
CREATE TYPE public.billing_cycle AS ENUM (
  'monthly',
  'annual'
);

-- Tipos de eventos do ledger
CREATE TYPE public.subscription_event_type AS ENUM (
  'checkout_initiated',        -- usuário iniciou checkout
  'checkout_failed',           -- erro ao criar assinatura na SimplisPay
  'trial_started',             -- assinatura criada, trial ativo
  'trial_ended',               -- trial expirou, primeira cobrança ocorrerá
  'subscription_activated',    -- primeira cobrança paga, status → active
  'subscription_updated',      -- SimplisPay atualizou dados da assinatura
  'subscription_past_due',     -- pagamento falhou, status → past_due
  'subscription_suspended',    -- assinatura suspensa
  'subscription_reactivated',  -- assinatura reativada após suspensão
  'subscription_canceled',     -- assinatura cancelada definitivamente
  'invoice_paid',              -- fatura individual paga (renovação)
  'invoice_failed',            -- tentativa de cobrança falhou
  'invoice_refunded',          -- fatura estornada
  'webhook_received',          -- webhook recebido (log bruto, antes de processar)
  'admin_action'               -- ação manual de admin
);

-- Fonte do evento
CREATE TYPE public.event_source AS ENUM (
  'checkout',   -- gerado pelo processo de checkout
  'webhook',    -- gerado por webhook da SimplisPay
  'admin',      -- ação de admin via painel
  'system'      -- processo automático (cron, retry, etc.)
);
```

### 4.2 Tabela `gateway_tokens`

Cache do token de autenticação da SimplisPay.

```sql
CREATE TABLE public.gateway_tokens (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider            text        NOT NULL UNIQUE,        -- 'simplispay'
  token_value         text        NOT NULL,
  token_expires_at    timestamptz NOT NULL,
  last_refresh_at     timestamptz NOT NULL DEFAULT now(),
  last_refresh_success boolean    NOT NULL DEFAULT true,
  consecutive_failures int        NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Apenas service_role pode acessar (nunca exposto a usuários)
ALTER TABLE public.gateway_tokens ENABLE ROW LEVEL SECURITY;
-- Sem policies públicas — acesso apenas via service_role nas edge functions
```

### 4.3 Tabela `subscriptions` — versão completa

> Substitui (ou adiciona colunas a) a tabela `subscriptions` existente que hoje tem apenas `status` genérico.

```sql
CREATE TABLE public.subscriptions (
  -- Identificadores
  id                          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id                     uuid          NOT NULL REFERENCES public.plans(id),

  -- Ciclo e valores
  billing_cycle               billing_cycle NOT NULL,
  amount_cents                integer       NOT NULL,       -- valor cobrado em centavos
  currency                    text          NOT NULL DEFAULT 'BRL',

  -- Status interno
  status                      subscription_status NOT NULL DEFAULT 'trialing',

  -- Datas de controle
  started_at                  timestamptz   NOT NULL DEFAULT now(),
  trial_ends_at               timestamptz,                  -- now() + 14 dias, setado no checkout
  current_period_start        timestamptz,                  -- início do período de cobrança vigente
  current_period_end          timestamptz,                  -- fim do período de cobrança vigente (= due_date SimplisPay)
  canceled_at                 timestamptz,
  expires_at                  timestamptz,                  -- para compatibilidade com código existente

  -- Dados do pagamento
  payment_method              text          NOT NULL DEFAULT 'credit_card',
  card_last_four              text,                         -- 4 últimos dígitos (sem PCI risk, dado exibido em UI)
  card_brand                  text,                         -- 'visa', 'mastercard', etc.

  -- Referências SimplisPay
  simplispay_subscription_id  text          UNIQUE,         -- data.id retornado no webhook (int convertido para text)
  simplispay_plan_id          text          NOT NULL,       -- SIMPLISPAY_PLAN_ID_MONTHLY ou ANNUAL
  simplispay_client_id        text,                         -- cliente_id da SimplisPay

  -- Idempotência do checkout
  idempotency_key             text          UNIQUE NOT NULL,

  -- Metadados
  updated_at                  timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT subscriptions_user_unique UNIQUE (user_id) -- um usuário, uma assinatura ativa
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX subscriptions_user_id_idx ON public.subscriptions (user_id);
CREATE INDEX subscriptions_status_idx ON public.subscriptions (status);
CREATE INDEX subscriptions_simplispay_id_idx ON public.subscriptions (simplispay_subscription_id);

CREATE TRIGGER subscriptions_updated
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
CREATE POLICY "Users view own subscription" ON public.subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage subscriptions" ON public.subscriptions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
-- Inserção e atualização via service_role (edge functions) sem RLS
```

### 4.4 Tabela `subscription_ledger_events`

Registro imutável de todos os eventos da assinatura. Nunca atualiza registros — apenas insere.

```sql
CREATE TABLE public.subscription_ledger_events (
  id                          uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id             uuid                    REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  user_id                     uuid                    REFERENCES auth.users(id) ON DELETE SET NULL,

  -- O quê aconteceu
  event_type                  subscription_event_type NOT NULL,
  source                      event_source            NOT NULL,

  -- Status anterior e novo (para auditoria de transições)
  status_before               subscription_status,
  status_after                subscription_status,

  -- Referências SimplisPay
  simplispay_subscription_id  text,
  simplispay_event_status     text,                           -- status bruto do webhook ('created', 'suspended', etc.)
  simplispay_status_id        integer,                        -- status_assinatura_id bruto (1,2,3,4)
  hook_id                     integer,                        -- hook_id do webhook SimplisPay

  -- Dados completos do evento (payload bruto do webhook ou dados do checkout)
  payload                     jsonb,

  -- Erros (se houver)
  error_message               text,

  created_at                  timestamptz             NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_ledger_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX ledger_subscription_id_idx ON public.subscription_ledger_events (subscription_id);
CREATE INDEX ledger_user_id_idx ON public.subscription_ledger_events (user_id);
CREATE INDEX ledger_created_at_idx ON public.subscription_ledger_events (created_at DESC);
CREATE INDEX ledger_event_type_idx ON public.subscription_ledger_events (event_type);

-- Admins podem ler; usuários leem o próprio
CREATE POLICY "Users view own ledger" ON public.subscription_ledger_events
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
-- Inserção apenas via service_role (edge functions)
```

### 4.5 Tabela `billing_invoices`

Rastreia cada fatura (cobrança) individual da assinatura, conforme retornado pelo endpoint `/planos/assinatura/{id}/faturas`.

```sql
CREATE TABLE public.billing_invoices (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id             uuid        NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  user_id                     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Referências SimplisPay
  simplispay_invoice_id       text        UNIQUE,           -- data.id da fatura na SimplisPay
  simplispay_pedido_id        text,                         -- pedido_id vinculado (pode ser null se pré-auth)

  -- Valores
  amount_cents                integer     NOT NULL,
  currency                    text        NOT NULL DEFAULT 'BRL',

  -- Status da fatura
  -- 'pending' | 'paid' | 'failed' | 'voided' | 'refunded'
  status                      text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'voided', 'refunded')),

  -- Datas
  date_invoice                date,                         -- data da emissão
  due_date                    date,                         -- vencimento
  paid_at                     timestamptz,
  voided_at                   timestamptz,

  -- Tentativas de cobrança
  retries                     integer     NOT NULL DEFAULT 0,
  max_retries                 integer     NOT NULL DEFAULT 3,

  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;

CREATE INDEX invoices_subscription_id_idx ON public.billing_invoices (subscription_id);
CREATE INDEX invoices_user_id_idx ON public.billing_invoices (user_id);
CREATE INDEX invoices_status_idx ON public.billing_invoices (status);

CREATE TRIGGER billing_invoices_updated
  BEFORE UPDATE ON public.billing_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Users view own invoices" ON public.billing_invoices
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
```

---

## 5. Checkout de Assinatura

### 5.1 Dados Coletados no Frontend

```typescript
// Request enviado para a edge function
interface SubscriptionCheckoutRequest {
  idempotencyKey: string;           // gerado no frontend: crypto.randomUUID()
  billingCycle: 'monthly' | 'annual';

  customer: {
    name: string;                   // nome completo
    email: string;
    cpf: string;                    // apenas dígitos (validar CPF no frontend)
    birthDate: string;              // formato YYYY-MM-DD
    phone: string;                  // celular, apenas dígitos
  };

  address: {
    street: string;                 // logradouro
    number: string;                 // numero
    complement?: string;            // complemento
    neighborhood: string;           // bairro (obrigatório na SimplisPay)
    city: string;                   // cidade
    state: string;                  // estado — 2 letras ISO (ex: "SP")
    zipCode: string;                // cep — apenas dígitos
  };

  card: {
    holderName: string;             // titular (nome como no cartão)
    number: string;                 // numero — apenas dígitos
    securityCode: string;           // codigoSeguranca (CVV/CVC)
    expiry: string;                 // validade — formato MM/YYYY
  };
}
```

**Validações obrigatórias no frontend antes de enviar:**
- CPF válido (dígito verificador)
- Número de cartão: 13–19 dígitos
- Validade: MM ≤ 12, ano ≥ ano atual
- CVV: 3–4 dígitos
- CEP: 8 dígitos

### 5.2 Montagem do Payload para SimplisPay

```typescript
// Payload final enviado a POST /planos/assinar
interface SimplisPaySubscriptionPayload {
  planoId: number;                  // SIMPLISPAY_PLAN_ID_MONTHLY ou ANNUAL (int)
  // expiration_date omitido → assinatura sem data de fim

  cliente: {
    nome: string;                   // customer.name
    email: string;                  // customer.email
    dataNascimento: string;         // customer.birthDate (YYYY-MM-DD)
    cpf: string;                    // customer.cpf (apenas dígitos)
    celular: string;                // customer.phone (apenas dígitos)
    telefone?: string;              // opcional
  };

  endereco: {
    logradouro: string;             // address.street
    numero: string;                 // address.number
    complemento: string;            // address.complement ?? ""
    bairro: string;                 // address.neighborhood
    cep: string;                    // address.zipCode (apenas dígitos)
    cidade: string;                 // address.city
    estado: string;                 // address.state (2 letras)
  };

  cartao: {
    titular: string;                // card.holderName
    numero: string;                 // card.number (apenas dígitos)
    codigoSeguranca: string;        // card.securityCode
    validade: string;               // card.expiry (MM/YYYY)
  };
}
```

---

## 6. Edge Function: `process-subscription`

**Localização:** `supabase/functions/process-subscription/index.ts`  
**Método:** POST  
**Auth:** Requer JWT do usuário autenticado (header `Authorization: Bearer <supabase-jwt>`)

### 6.1 Fluxo Completo

```
1. Validar JWT do usuário → extrair user_id
2. Validar corpo da requisição (campos obrigatórios, formatos)
3. Checar idempotência:
   SELECT * FROM subscriptions WHERE idempotency_key = $1
   → se encontrado E status != 'canceled', retornar 200 com dados existentes
4. Checar se usuário já tem assinatura ativa:
   SELECT * FROM subscriptions WHERE user_id = $1 AND status IN ('trialing','active','past_due','suspended')
   → se sim, retornar 409 com mensagem de conflito
5. Obter token SimplisPay (cache ou refresh)
6. Determinar planoId:
   billingCycle == 'monthly' → SIMPLISPAY_PLAN_ID_MONTHLY
   billingCycle == 'annual'  → SIMPLISPAY_PLAN_ID_ANNUAL
7. INSERT em subscriptions com status='trialing' (antes de chamar SimplisPay — garante idempotência)
8. INSERT em subscription_ledger_events: event_type='checkout_initiated'
9. POST https://api.simplispay.com.br/planos/assinar
   Timeout: 30 segundos
10. Se erro da SimplisPay:
    → UPDATE subscriptions SET status='canceled' WHERE id=<subscriptionId>
    → INSERT ledger: event_type='checkout_failed', error_message=<msg>
    → retornar 422 com mensagem de erro
11. Se sucesso:
    → UPDATE subscriptions SET
        status='trialing',
        simplispay_subscription_id = String(data.id),
        simplispay_client_id = String(data.cliente_id),
        trial_ends_at = now() + INTERVAL '14 days',
        current_period_start = now(),
        current_period_end = data.due_date (SimplisPay retorna due_date)
    → INSERT ledger: event_type='trial_started', status_after='trialing'
12. Retornar 201 com:
    { subscriptionId, status: 'trialing', trialEndsAt, billingCycle, amountCents }
```

### 6.2 Resposta da SimplisPay no Checkout

```json
{
  "success": true,
  "message": "Operação realizada com sucesso",
  "data": {
    "id": 90,
    "ativo": 1,
    "status_assinatura_id": 1,
    "payment_method": "credit",
    "due_date": "2026-06-05",
    "expiration_date": null,
    "amount": 49.00,
    "currency": "BRL",
    "plano_id": 42,
    "cliente_id": 202,
    "modified": "2026-05-22T21:21:57.076Z",
    "created": "2026-05-22T21:21:57.076Z"
  }
}
```

**Campos relevantes:**
- `data.id` → `simplispay_subscription_id` (converter para text)
- `data.cliente_id` → `simplispay_client_id`
- `data.due_date` → `current_period_end` (data da próxima cobrança)

### 6.3 Regras de Negócio do Trial

```typescript
const TRIAL_DAYS = 14;

// Ao criar a assinatura:
const trialEndsAt = new Date();
trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

// O grace_period do plano na SimplisPay já controla isso do lado deles.
// No nosso lado, usamos trial_ends_at para controle de acesso e exibição no UI.
```

---

## 7. Edge Function: `simplispay-webhook`

**Localização:** `supabase/functions/simplispay-webhook/index.ts`  
**Método:** POST  
**Auth:** Nenhuma (SimplisPay não envia auth headers — endpoint é secreto)

### 7.1 Estrutura do Webhook Recebido

```typescript
interface SimplisPayWebhookPayload {
  url: string;
  type: 'subscription' | 'plan' | 'transaction';
  status: 'created' | 'updated' | 'suspended' | 'active' | 'deleted';
  hook_id: number;
  data: {
    id: number;                     // ID da assinatura na SimplisPay
    plano_id: number;
    cliente_id: number;
    ativo: 0 | 1;                   // 1=ativo, 0=suspenso/cancelado
    status_assinatura_id: 1 | 2 | 3 | 4;
    payment_method: 'credit';
    due_date: string;               // data da próxima cobrança (YYYY-MM-DD)
    due_since_date: string;         // data da primeira cobrança
    expiration_date: string | null;
    suspended_at: string | null;
    amount: number;                 // valor em reais (não centavos)
    currency: 'BRL';
    subscription_id?: string;       // hash alternativo de identificação
    created: string;
    modified: string;
    removed: string | null;
    plano: {
      id: number;
      name: string;
      frequency: string;
      interval: number;
      amount: number;
      grace_period: string;
      tolerance_period: number;
    };
    status_assinatura: {
      titulo: string;               // 'Pago' | 'Aguardando' | 'Cancelado' | 'Atrasado'
    };
    cliente: {
      id?: number;
      nome: string;
      email: string;
    };
  };
}
```

### 7.2 Mapeamento de Status

```typescript
// status_assinatura_id da SimplisPay → subscription_status interno
const SIMPLISPAY_STATUS_MAP: Record<number, SubscriptionStatus> = {
  1: 'active',    // Aguardando (primeira cobrança pendente, mas assinatura válida)
  2: 'canceled',  // Cancelado
  3: 'active',    // Pago
  4: 'past_due',  // Atrasado
};

// webhook.status → subscription_event_type interno
const WEBHOOK_EVENT_TYPE_MAP: Record<string, SubscriptionEventType> = {
  created:   'subscription_activated',   // primeira ativação pós-checkout
  updated:   'subscription_updated',
  suspended: 'subscription_suspended',
  active:    'subscription_reactivated',
  deleted:   'subscription_canceled',
};
```

### 7.3 Regra de Progressão de Status (sem regressão)

```typescript
const STATUS_ORDER: Record<SubscriptionStatus, number> = {
  trialing:  0,
  active:    1,
  past_due:  2,
  suspended: 3,
  canceled:  4,
  expired:   5,
};

function canTransition(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  // canceled e expired são estados finais — nunca sair deles
  if (from === 'canceled' || from === 'expired') return false;
  // active não pode voltar para trialing
  if (from === 'active' && to === 'trialing') return false;
  // past_due não pode voltar para trialing
  if (from === 'past_due' && to === 'trialing') return false;
  return true;
}
```

### 7.4 Fluxo do Webhook

```
1. Parsear JSON do body
2. INSERT IMEDIATO em subscription_ledger_events:
   event_type='webhook_received', payload=<body completo>
   → Garante rastreabilidade mesmo se processamento falhar
3. Retornar 200 OK (SimplisPay para de tentar reenviar)
4. Processar de forma assíncrona (ou síncrona antes do return — ver nota):

   a. Filtrar: processar apenas type='subscription'
      → Outros types ('plan', 'transaction'): logar e ignorar

   b. Extrair simplispay_subscription_id = String(data.id)

   c. Buscar assinatura:
      SELECT * FROM subscriptions WHERE simplispay_subscription_id = $1

   d. Se não encontrada:
      → logar aviso, não fazer nada (pode ser webhook de checkout ainda não confirmado)
      → NÃO retornar erro (SimplisPay retentar é pior)

   e. Mapear novo status:
      newStatus = SIMPLISPAY_STATUS_MAP[data.status_assinatura_id]

   f. Verificar se pode transicionar:
      canTransition(subscription.status, newStatus) → se não, logar e pular UPDATE

   g. Se webhook.status == 'created' e subscription.status == 'trialing':
      → Verificar se trial ainda está ativo (trial_ends_at > now())
      → Se trial ativo: manter 'trialing', apenas atualizar due_date
      → Se trial expirado: transicionar para 'active'

   h. UPDATE subscriptions SET
        status = newStatus,
        current_period_end = data.due_date (se presente),
        canceled_at = (se newStatus == 'canceled' ? now() : canceled_at),
        updated_at = now()
      WHERE id = <subscription.id>

   i. INSERT subscription_ledger_events:
        event_type = WEBHOOK_EVENT_TYPE_MAP[webhook.status],
        source = 'webhook',
        status_before = subscription.status,
        status_after = newStatus,
        simplispay_event_status = webhook.status,
        simplispay_status_id = data.status_assinatura_id,
        hook_id = webhook.hook_id,
        payload = data (sem dados sensíveis de cartão)
```

> **Nota sobre timing:** No Supabase Edge Functions (Deno), o processamento deve ocorrer antes do `return new Response(...)` ou usando `EdgeRuntime.waitUntil()` para não bloquear o response. Retornar 200 primeiro e depois processar com `waitUntil` é a abordagem mais robusta.

---

## 8. Mapeamento de Eventos por Cenário

| Cenário | Webhook Recebido | `event_type` inserido | `status` resultante |
|---|---|---|---|
| Checkout bem-sucedido | (chamada direta) | `trial_started` | `trialing` |
| Trial ativo, primeira cobrança agendada | `type=subscription, status=created` | `subscription_updated` | `trialing` |
| Trial expirado, primeira cobrança paga | `type=subscription, status=updated, status_assinatura_id=3` | `subscription_activated` | `active` |
| Renovação mensal/anual paga | `type=subscription, status=updated, status_assinatura_id=3` | `invoice_paid` | `active` |
| Cobrança falhou | `type=subscription, status=updated, status_assinatura_id=4` | `subscription_past_due` | `past_due` |
| Assinatura suspensa | `type=subscription, status=suspended` | `subscription_suspended` | `suspended` |
| Assinatura reativada | `type=subscription, status=active` | `subscription_reactivated` | `active` |
| Assinatura cancelada | `type=subscription, status=deleted` | `subscription_canceled` | `canceled` |

---

## 9. Controle de Acesso (RLS + Lógica de Aplicação)

### 9.1 Regra de Acesso ao App

```typescript
// Um usuário pode usar o app se:
function userHasAccess(subscription: Subscription): boolean {
  const now = new Date();

  if (subscription.status === 'trialing') {
    // Trial ativo
    return subscription.trial_ends_at
      ? new Date(subscription.trial_ends_at) > now
      : false;
  }

  if (subscription.status === 'active') return true;

  // past_due: manter acesso por tolerance_period (3 dias conforme plano)
  if (subscription.status === 'past_due') {
    const toleranceDays = 3;
    const graceCutoff = new Date(subscription.current_period_end!);
    graceCutoff.setDate(graceCutoff.getDate() + toleranceDays);
    return graceCutoff > now;
  }

  return false; // suspended, canceled, expired
}
```

### 9.2 Integração com `plans` existente

A tabela `plans` já tem `monthly_simulation_limit` e `features`. O checkout define `plan_id` baseado no `billing_cycle`:

```typescript
// No checkout, buscar o plan_id interno correspondente:
const internalPlanId = billingCycle === 'monthly'
  ? INTERNAL_PLAN_ID_MONTHLY   // UUID do plans.id do plano "Mensal"
  : INTERNAL_PLAN_ID_ANNUAL;   // UUID do plans.id do plano "Anual"
```

---

## 10. API de Gerenciamento (Chamadas que o Admin/Sistema Faz à SimplisPay)

### 10.1 Suspender Assinatura

```
POST https://api.simplispay.com.br/planos/assinatura/suspender
Authorization: Bearer <token>

{ "assinatura_id": <simplispay_subscription_id_int> }
```

### 10.2 Reativar Assinatura

```
POST https://api.simplispay.com.br/planos/assinatura/reativar
Authorization: Bearer <token>

{ "assinatura_id": <simplispay_subscription_id_int> }
```

### 10.3 Cancelar Assinatura

```
DELETE https://api.simplispay.com.br/planos/assinatura/<simplispay_subscription_id>
Authorization: Bearer <token>
```

### 10.4 Listar Faturas de uma Assinatura

```
GET https://api.simplispay.com.br/planos/assinatura/<simplispay_subscription_id>/faturas
Authorization: Bearer <token>
```

Retorna array de faturas com `status: 'paid' | 'pending' | 'voided'`.  
Usar para sincronizar `billing_invoices`.

### 10.5 Estornar Fatura

```
POST https://api.simplispay.com.br/planos/assinatura/estornar
Authorization: Bearer <token>

{ "id": <simplispay_invoice_id> }
```

---

## 11. Migração SQL Completa

Arquivo: `supabase/migrations/YYYYMMDDHHMMSS_subscription_billing.sql`

```sql
-- 1. Tipos
CREATE TYPE public.subscription_status AS ENUM (
  'trialing', 'active', 'past_due', 'suspended', 'canceled', 'expired'
);

CREATE TYPE public.billing_cycle AS ENUM ('monthly', 'annual');

CREATE TYPE public.subscription_event_type AS ENUM (
  'checkout_initiated', 'checkout_failed', 'trial_started', 'trial_ended',
  'subscription_activated', 'subscription_updated', 'subscription_past_due',
  'subscription_suspended', 'subscription_reactivated', 'subscription_canceled',
  'invoice_paid', 'invoice_failed', 'invoice_refunded',
  'webhook_received', 'admin_action'
);

CREATE TYPE public.event_source AS ENUM ('checkout', 'webhook', 'admin', 'system');

-- 2. gateway_tokens
CREATE TABLE public.gateway_tokens (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider              text        NOT NULL UNIQUE,
  token_value           text        NOT NULL,
  token_expires_at      timestamptz NOT NULL,
  last_refresh_at       timestamptz NOT NULL DEFAULT now(),
  last_refresh_success  boolean     NOT NULL DEFAULT true,
  consecutive_failures  int         NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gateway_tokens ENABLE ROW LEVEL SECURITY;

-- 3. Substituir/alterar subscriptions existente
-- (Se a tabela já existe com dados de teste, dropar e recriar; em prod: ALTER TABLE)
DROP TABLE IF EXISTS public.subscriptions CASCADE;

CREATE TABLE public.subscriptions (
  id                          uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid                NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id                     uuid                NOT NULL REFERENCES public.plans(id),
  billing_cycle               billing_cycle       NOT NULL,
  amount_cents                integer             NOT NULL,
  currency                    text                NOT NULL DEFAULT 'BRL',
  status                      subscription_status NOT NULL DEFAULT 'trialing',
  started_at                  timestamptz         NOT NULL DEFAULT now(),
  trial_ends_at               timestamptz,
  current_period_start        timestamptz,
  current_period_end          timestamptz,
  canceled_at                 timestamptz,
  expires_at                  timestamptz,
  payment_method              text                NOT NULL DEFAULT 'credit_card',
  card_last_four              text,
  card_brand                  text,
  simplispay_subscription_id  text                UNIQUE,
  simplispay_plan_id          text                NOT NULL,
  simplispay_client_id        text,
  idempotency_key             text                UNIQUE NOT NULL,
  updated_at                  timestamptz         NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_user_unique UNIQUE (user_id)
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX subscriptions_user_id_idx     ON public.subscriptions (user_id);
CREATE INDEX subscriptions_status_idx      ON public.subscriptions (status);
CREATE INDEX subscriptions_simplispay_idx  ON public.subscriptions (simplispay_subscription_id);

CREATE TRIGGER subscriptions_updated
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Users view own subscription" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage subscriptions" ON public.subscriptions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. subscription_ledger_events
CREATE TABLE public.subscription_ledger_events (
  id                          uuid                        PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id             uuid                        REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  user_id                     uuid                        REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type                  subscription_event_type     NOT NULL,
  source                      event_source                NOT NULL,
  status_before               subscription_status,
  status_after                subscription_status,
  simplispay_subscription_id  text,
  simplispay_event_status     text,
  simplispay_status_id        integer,
  hook_id                     integer,
  payload                     jsonb,
  error_message               text,
  created_at                  timestamptz                 NOT NULL DEFAULT now()
);
ALTER TABLE public.subscription_ledger_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX ledger_subscription_id_idx ON public.subscription_ledger_events (subscription_id);
CREATE INDEX ledger_user_id_idx         ON public.subscription_ledger_events (user_id);
CREATE INDEX ledger_created_at_idx      ON public.subscription_ledger_events (created_at DESC);
CREATE INDEX ledger_event_type_idx      ON public.subscription_ledger_events (event_type);

CREATE POLICY "Users view own ledger" ON public.subscription_ledger_events
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 5. billing_invoices
CREATE TABLE public.billing_invoices (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id         uuid        NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  user_id                 uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  simplispay_invoice_id   text        UNIQUE,
  simplispay_pedido_id    text,
  amount_cents            integer     NOT NULL,
  currency                text        NOT NULL DEFAULT 'BRL',
  status                  text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'voided', 'refunded')),
  date_invoice            date,
  due_date                date,
  paid_at                 timestamptz,
  voided_at               timestamptz,
  retries                 integer     NOT NULL DEFAULT 0,
  max_retries             integer     NOT NULL DEFAULT 3,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;

CREATE INDEX invoices_subscription_id_idx ON public.billing_invoices (subscription_id);
CREATE INDEX invoices_user_id_idx         ON public.billing_invoices (user_id);
CREATE INDEX invoices_status_idx          ON public.billing_invoices (status);

CREATE TRIGGER billing_invoices_updated
  BEFORE UPDATE ON public.billing_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Users view own invoices" ON public.billing_invoices
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
```

---

## 12. TypeScript Types (para edge functions e frontend)

```typescript
// supabase/functions/_shared/types.ts

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'suspended'
  | 'canceled'
  | 'expired';

export type BillingCycle = 'monthly' | 'annual';

export type SubscriptionEventType =
  | 'checkout_initiated'
  | 'checkout_failed'
  | 'trial_started'
  | 'trial_ended'
  | 'subscription_activated'
  | 'subscription_updated'
  | 'subscription_past_due'
  | 'subscription_suspended'
  | 'subscription_reactivated'
  | 'subscription_canceled'
  | 'invoice_paid'
  | 'invoice_failed'
  | 'invoice_refunded'
  | 'webhook_received'
  | 'admin_action';

export type EventSource = 'checkout' | 'webhook' | 'admin' | 'system';

// Status da SimplisPay → status interno
export const SIMPLISPAY_STATUS_ID_MAP: Record<number, SubscriptionStatus> = {
  1: 'active',    // Aguardando
  2: 'canceled',  // Cancelado
  3: 'active',    // Pago
  4: 'past_due',  // Atrasado
};

// Webhook status → event_type interno
export const WEBHOOK_STATUS_TO_EVENT: Record<string, SubscriptionEventType> = {
  created:   'subscription_activated',
  updated:   'subscription_updated',
  suspended: 'subscription_suspended',
  active:    'subscription_reactivated',
  deleted:   'subscription_canceled',
};

// Máquina de estados — quais transições são permitidas
export const ALLOWED_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  trialing:  ['active', 'past_due', 'canceled', 'expired'],
  active:    ['past_due', 'suspended', 'canceled', 'expired'],
  past_due:  ['active', 'suspended', 'canceled', 'expired'],
  suspended: ['active', 'canceled', 'expired'],
  canceled:  [],  // estado final
  expired:   [],  // estado final
};

export function canTransition(
  from: SubscriptionStatus,
  to: SubscriptionStatus
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

// Checkout request (frontend → edge function)
export interface SubscriptionCheckoutRequest {
  idempotencyKey: string;
  billingCycle: BillingCycle;
  customer: {
    name: string;
    email: string;
    cpf: string;        // apenas dígitos
    birthDate: string;  // YYYY-MM-DD
    phone: string;      // apenas dígitos
  };
  address: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;      // 2 letras
    zipCode: string;    // apenas dígitos
  };
  card: {
    holderName: string;
    number: string;     // apenas dígitos
    securityCode: string;
    expiry: string;     // MM/YYYY
  };
}

// Payload enviado à SimplisPay
export interface SimplisPaySubscriptionPayload {
  planoId: number;
  cliente: {
    nome: string;
    email: string;
    dataNascimento: string;
    cpf: string;
    celular: string;
    telefone?: string;
  };
  endereco: {
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cep: string;
    cidade: string;
    estado: string;
  };
  cartao: {
    titular: string;
    numero: string;
    codigoSeguranca: string;
    validade: string;
  };
}

// Resposta da SimplisPay ao criar assinatura
export interface SimplisPaySubscriptionResponse {
  success: boolean;
  message: string;
  data: {
    id: number;
    ativo: 0 | 1;
    status_assinatura_id: 1 | 2 | 3 | 4;
    payment_method: 'credit';
    due_date: string;
    expiration_date: string | null;
    amount: number;
    currency: 'BRL';
    plano_id: number;
    cliente_id: number;
    modified: string;
    created: string;
  };
}

// Webhook payload da SimplisPay
export interface SimplisPayWebhookPayload {
  url: string;
  type: 'subscription' | 'plan' | 'transaction';
  status: 'created' | 'updated' | 'suspended' | 'active' | 'deleted';
  hook_id: number;
  data: {
    id: number;
    plano_id: number;
    cliente_id: number;
    ativo: 0 | 1;
    status_assinatura_id: 1 | 2 | 3 | 4;
    payment_method: 'credit';
    due_date: string;
    due_since_date: string;
    expiration_date: string | null;
    suspended_at: string | null;
    amount: number;
    currency: 'BRL';
    subscription_id?: string;
    created: string;
    modified: string;
    removed: string | null;
    plano: {
      id: number;
      name: string;
      frequency: string;
      interval: number;
      amount: number;
      grace_period: string;
      tolerance_period: number;
    };
    status_assinatura: { titulo: string };
    cliente: {
      id?: number;
      nome: string;
      email: string;
    };
  };
}
```

---

## 13. Checklist de Implementação

### Banco de Dados
- [ ] Criar migration com enums, `gateway_tokens`, nova `subscriptions`, `subscription_ledger_events`, `billing_invoices`
- [ ] Inserir planos internos na tabela `plans` (Mensal e Anual) e guardar seus UUIDs como env vars

### SimplisPay (setup único)
- [ ] Criar Plano Mensal via API → guardar ID em `SIMPLISPAY_PLAN_ID_MONTHLY`
- [ ] Criar Plano Anual via API → guardar ID em `SIMPLISPAY_PLAN_ID_ANNUAL`
- [ ] Registrar URL do webhook: `POST /estabelecimentos/url-webhook` com URL da edge function `simplispay-webhook`

### Edge Functions
- [ ] `supabase/functions/process-subscription/index.ts` — checkout + criação
- [ ] `supabase/functions/simplispay-webhook/index.ts` — recebimento de eventos
- [ ] `supabase/functions/_shared/simplispay-client.ts` — token management + chamadas API
- [ ] `supabase/functions/_shared/types.ts` — tipos compartilhados

### Frontend
- [ ] Componente de checkout (`/checkout` ou modal) com campos do `SubscriptionCheckoutRequest`
- [ ] Validação de CPF, cartão, CEP no frontend
- [ ] Página de gerenciamento de assinatura (status, próxima cobrança, cancelar)
- [ ] Guard de rota verificando `userHasAccess(subscription)` para rotas autenticadas

### Segurança
- [ ] Dados de cartão **nunca** persistidos no Supabase — enviados diretamente à SimplisPay
- [ ] `gateway_tokens` sem RLS pública — apenas `service_role` acessa
- [ ] Webhook URL não documentada publicamente
