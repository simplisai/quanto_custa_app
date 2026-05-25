# EXECUTION PLAN — SAAS `Quanto-custa-2`

## 1. Visão geral
O objetivo deste projeto é transformar a aplicação atual em um SaaS funcional e escalável para análise patrimonial e futuras operações. O produto final precisa ter uma área administrativa completa, uma área do usuário organizada por operações, persistência de dados no Supabase e uma base preparada para crescer sem refatorações grandes.

Este plano descreve o que já foi feito, o que ainda falta fazer e o que é esperado como resultado final. Ele deve ser usado como referência de execução, priorização e acompanhamento de progresso.

---

## 2. Estado atual do projeto
Hoje o SaaS está em fase inicial de estruturação. Já existe uma calculadora patrimonial funcional na área autenticada do usuário, e as rotas principais da aplicação autenticada já foram mapeadas. Também foi criada uma base inicial para o painel administrativo e para a área do usuário, mas ainda sem a profundidade funcional necessária para um SaaS real.

O sistema ainda não está integrado completamente com Supabase para entidades centrais do produto. Também não existem, em nível funcional, as páginas e fluxos completos de clientes, templates, gestão de assinaturas e histórico operacional detalhado.

---

## 3. O que já foi feito
### 3.1 Estrutura e navegação
- O repositório correto do projeto foi identificado como `Quanto-custa-2`.
- As rotas autenticadas principais foram mapeadas.
- Foi criada uma base inicial de navegação para o painel administrativo.
- Foi criada uma base inicial de navegação para a área do usuário.
- O arquivo `EXECUTION_PLAN.md` passou a ser o documento central de acompanhamento do projeto.

### 3.2 Painel administrativo
- Foi criada a página principal do admin como ponto de entrada do painel.
- Foram criadas páginas base para:
  - gestão de usuários;
  - financeiro;
  - suporte.
- Essas páginas existem como estrutura inicial, mas ainda precisam ser evoluídas para operações reais de SaaS.

### 3.3 Área do usuário
- Foi mantida a calculadora patrimonial já existente como primeira operação funcional do sistema.
- Foi criada a página de dashboard do usuário.
- Foi criada a página de histórico do usuário.
- A área do usuário foi organizada em torno da experiência de operar, registrar e consultar atividades.

### 3.4 Plano de execução
- O plano foi refeito para refletir a visão de SaaS.
- O escopo passou a incluir admin, usuário, Supabase e preparação para novas operações.

---

## 4. O que ainda falta fazer
### 4.1 Painel administrativo
O admin ainda precisa ser transformado em uma central real de gestão do SaaS. Isso inclui:
- Dashboard com métricas reais.
- Gestão completa de usuários.
- Gestão de assinaturas.
- Financeiro com histórico completo das transações das assinaturas.
- Suporte com fila, status, prioridade e acompanhamento.

### 4.2 Área do usuário
A área do usuário ainda precisa ser expandida para suportar o funcionamento real do SaaS. Isso inclui:
- Página inicial com as operações disponíveis para execução.
- Página de histórico de operações realizadas.
- Página de clientes, com cadastro e vínculo de operações.
- Página de templates por tipo de operação.
- Estrutura pronta para novas operações além da Calculadora Patrimonial.

### 4.3 Supabase
Ainda falta criar a base de dados completa no Supabase e ligar as páginas a essa estrutura. Isso inclui:
- criação das tabelas centrais;
- relacionamentos entre usuário, assinatura, cliente, operação e template;
- regras de acesso;
- persistência dos dados da aplicação;
- preparação para crescimento futuro.

### 4.4 Qualidade e evolução
Ainda faltam as etapas de acabamento e robustez do produto:
- validação de navegação;
- estados vazios;
- indicadores de carregamento;
- filtros e busca;
- revisão de tipagem;
- revisão de build;
- padronização visual e de UX.

---

## 5. O que é esperado do produto final
Ao final da implementação, o SaaS deve entregar uma experiência completa com duas grandes áreas: administração e uso operacional.

### 5.1 No painel administrativo
Espera-se que o admin permita:
- acompanhar a saúde do SaaS;
- ver quantidade de usuários ativos, cancelados e pendentes;
- gerenciar assinaturas;
- acompanhar o histórico financeiro das assinaturas;
- monitorar suporte;
- executar ações administrativas com segurança.

### 5.2 Na área do usuário
Espera-se que o usuário consiga:
- entrar no sistema e ver as operações disponíveis;
- executar a Calculadora Patrimonial;
- salvar e revisar histórico de operações;
- cadastrar clientes;
- consultar o histórico de operações por cliente;
- criar e aplicar templates predefinidos por operação;
- usar novas operações que forem adicionadas no futuro sem reestruturação pesada.

### 5.3 Na base de dados
Espera-se que o Supabase sustente:
- autenticação;
- perfis de usuário;
- assinaturas;
- planos;
- pagamentos;
- suporte;
- operações;
- clientes;
- templates;
- trilha de auditoria;
- configurações do app.

---

## 6. Escopo funcional detalhado
### 6.1 Dashboard do admin
O dashboard deve consolidar a visão do SaaS com indicadores como:
- usuários totais;
- usuários ativos;
- cancelados;
- pendentes;
- volume de assinaturas;
- indicadores de saúde da operação;
- movimentação recente.

### 6.2 Gestão de usuários
A página de usuários deve permitir:
- visualizar todos os usuários;
- identificar status;
- ver último acesso;
- consultar perfil e permissões;
- buscar e filtrar usuários;
- preparar ações administrativas futuras.

### 6.3 Gestão de assinaturas
A página de assinaturas deve permitir:
- acompanhar plano atual;
- ver status da assinatura;
- identificar renovação;
- analisar cancelamentos;
- visualizar upgrades e downgrades;
- consultar histórico resumido por usuário.

### 6.4 Financeiro
A página financeira deve registrar e exibir:
- histórico das transações das assinaturas;
- pagamentos aprovados;
- falhas de cobrança;
- cancelamentos;
- estornos futuros, quando houver;
- indicadores consolidados de receita recorrente.

### 6.5 Suporte
A página de suporte deve organizar:
- solicitações abertas;
- tickets em andamento;
- tickets resolvidos;
- prioridade;
- status de atendimento;
- acompanhamento operacional.

### 6.6 Home do usuário
A home do usuário deve apresentar:
- operações disponíveis;
- destaque para a Calculadora Patrimonial;
- preparação visual para futuras operações;
- atalhos para histórico, clientes e templates.

### 6.7 Histórico de operações
A página de histórico deve permitir:
- consultar operações realizadas;
- visualizar data e tipo da operação;
- abrir detalhes de cada execução;
- aplicar filtros futuros;
- reabrir ou reutilizar registros.

### 6.8 Clientes
A página de clientes deve permitir:
- criar novo cliente durante uma operação;
- associar operações a um cliente;
- acessar o histórico de operações daquele cliente;
- editar dados cadastrais;
- organizar os clientes por usuário autenticado.

### 6.9 Templates
A página de templates deve permitir:
- criar templates por tipo de operação;
- definir parâmetros padrão;
- escolher para qual operação o template se aplica;
- reutilizar configurações pré-definidas;
- aplicar exemplos como taxas predefinidas para uma operadora específica.

### 6.10 Operações futuras
A aplicação deve suportar novas operações sem refatoração estrutural. A Calculadora Patrimonial é apenas a primeira operação do SaaS.

---

## 7. Base de dados no Supabase
A base de dados ainda não foi criada de forma completa e precisa ser desenhada para suportar o SaaS inteiro.

### 7.1 Entidades principais esperadas
- users
- profiles
- subscriptions
- plans
- payments
- support_tickets
- operations
- operation_types
- clients
- client_operations
- templates
- template_operation_rules
- audit_logs
- app_settings

### 7.2 Requisitos do banco
- Tabelas centrais do SaaS.
- Relacionamentos consistentes entre usuário, assinatura, cliente, operação e template.
- Campos para status, histórico e auditoria.
- Políticas de acesso para admin e usuário.
- Estrutura preparada para novas operações no futuro.

---

## 8. Fases de execução
### Fase 1 — Base estrutural
- Revisar rotas e layout global.
- Padronizar navegação do admin e do usuário.
- Organizar menus, shell e páginas autenticadas.
- Garantir consistência de estrutura entre as áreas.

### Fase 2 — Admin SaaS
- Finalizar dashboard administrativo.
- Implementar gestão de usuários.
- Implementar gestão de assinaturas.
- Estruturar financeiro com histórico das transações.
- Estruturar suporte com organização operacional.

### Fase 3 — Área do usuário
- Estruturar home com operações disponíveis.
- Implementar histórico de operações.
- Implementar clientes.
- Implementar templates.
- Preparar a base para múltiplas operações.

### Fase 4 — Supabase
- Criar o schema completo.
- Definir relacionamentos e constraints.
- Criar políticas de acesso.
- Conectar autenticação e persistência.
- Salvar operações, clientes, templates e assinaturas.

### Fase 5 — Qualidade e evolução
- Validar navegação.
- Validar estados vazios e carregamento.
- Ajustar UX e consistência visual.
- Revisar tipagem e build.
- Preparar a aplicação para novas operações.

---

## 9. Entregáveis esperados
- SaaS funcional com admin e área do usuário.
- Dashboard administrativo com indicadores reais.
- Gestão de usuários e assinaturas.
- Histórico financeiro das assinaturas.
- Página inicial com operações disponíveis.
- Histórico de operações.
- Clientes e templates operacionais.
- Base pronta e integrada ao Supabase.

---

## 10. Fora do escopo deste plano
Este plano não inclui a integração com gateway de pagamentos nem a implementação da cobrança externa.

---

## 11. Prioridade imediata
1. Estruturar o banco no Supabase.
2. Consolidar o dashboard do admin.
3. Implementar assinaturas e gestão de usuários.
4. Criar clientes, templates e histórico operacional.
5. Conectar persistência real às páginas existentes.

---

## 12. Progresso atual
### Já avançado
- Descoberta da estrutura do projeto.
- Mapeamento das rotas autenticadas.
- Criação da base inicial do admin.
- Criação da base inicial da área do usuário.
- Reescrita do plano estratégico.

### Em andamento
- Evolução das páginas de admin.
- Evolução da área do usuário.
- Definição da base Supabase.
- Preparação para persistência real.

### Ainda pendente
- Schema completo do Supabase.
- Gestão real de assinaturas.
- Clientes e templates.
- Histórico operacional persistido.
- Validação final de qualidade.

---

## 13. Critério de sucesso
O projeto será considerado pronto quando o SaaS estiver funcional de ponta a ponta, com admin operando a base de usuários e assinaturas, usuário executando operações e salvando histórico, Supabase sustentando os dados e a estrutura pronta para expansão de novas funcionalidades.
