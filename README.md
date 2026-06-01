
# Quanto Custa 2

Plataforma de simulação de consórcios e investimentos.

## 🚀 Como rodar o projeto localmente

### Pré-requisitos

- Node.js 20+
- npm ou yarn

### Passo a passo

1. **Instalar dependências**
   ```bash
   npm install
   ```

2. **Configurar variáveis de ambiente**
   - Copie o arquivo `.env.example` para `.env` (este arquivo já está pronto com as configurações)
   ```bash
   cp .env.example .env
   ```

3. **Iniciar o servidor de desenvolvimento**
   ```bash
   npm run dev
   ```

4. **Acessar o app**
   - Abra o navegador em `http://localhost:5173`

## 🌐 Deploy no Netlify

1. **Conecte o repositório ao Netlify**
2. **Adicione as variáveis de ambiente no Netlify**:
   - No painel do Netlify: Settings → Build & deploy → Environment
   - Adicione todas as variáveis do arquivo `.env`
3. **Deploy!**

## 📁 Estrutura do projeto

```
Quanto-custa-2/
├── src/
│   ├── components/       # Componentes reutilizáveis
│   ├── hooks/           # Hooks customizados
│   ├── integrations/    # Integrações com Supabase
│   ├── lib/             # Utilitários e configurações
│   ├── routes/          # Páginas e rotas
│   └── main.tsx         # Arquivo principal
├── supabase/            # Configurações do Supabase
└── netlify.toml         # Configurações do Netlify
```

## 🛠️ Scripts disponíveis

- `npm run dev`: Inicia o servidor de desenvolvimento
- `npm run build`: Cria o build de produção
- `npm run preview`: Visualiza o build de produção
- `npm run lint`: Executa o linter
- `npm run format`: Formata o código
