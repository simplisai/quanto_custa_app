const fs = require('fs');
const glob = require('glob');
const path = require('path');

function removeAccents(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  const wordsToReplace = {
    'patrimônio': 'patrimonio', 'Patrimônio': 'Patrimonio',
    'evolução': 'evolucao', 'Evolução': 'Evolucao',
    'consórcio': 'consorcio', 'Consórcio': 'Consorcio',
    'Mês': 'Mes', 'mês': 'mes',
    'Cenário': 'Cenario', 'Gráfico': 'Grafico',
    'Análise': 'Analise', 'Imóvel': 'Imovel', 'imóvel': 'imovel',
    'Líquido': 'Liquido', 'líquido': 'liquido',
    'Rentabilidade': 'Rentabilidade', 'Economia': 'Economia',
    'Você': 'Voce', 'você': 'voce',
    'pós-contemplação': 'pos-contemplacao', 'Pós-Contemplação': 'Pos-Contemplacao', 'Pós-contemplação': 'Pos-contemplacao',
    'Contemplação': 'Contemplacao', 'contemplação': 'contemplacao',
    'Estratégia': 'Estrategia', 'estratégia': 'estrategia',
    'Inflação': 'Inflacao', 'inflação': 'inflacao',
    'público': 'publico', 'Público': 'Publico',
    'próprio': 'proprio', 'Próprio': 'Proprio',
    'Média': 'Media', 'média': 'media', 'Médio': 'Medio', 'médio': 'medio',
    'Pré': 'Pre', 'pré': 'pre', 'Pós': 'Pos', 'pós': 'pos',
    'Até': 'Ate', 'até': 'ate', 'Mínimo': 'Minimo', 'mínimo': 'minimo', 'Máximo': 'Maximo', 'máximo': 'maximo',
    'Tradição': 'Tradicao', 'tradição': 'tradicao',
    'Cálculo': 'Calculo', 'cálculo': 'calculo',
    'Rápido': 'Rapido', 'rápido': 'rapido',
    'Início': 'Inicio', 'início': 'inicio', 'Término': 'Termino', 'término': 'termino',
    'Área': 'Area', 'área': 'area', 'Único': 'Unico', 'único': 'unico',
    'Válido': 'Valido', 'válido': 'valido',
    'Benefício': 'Beneficio', 'benefício': 'beneficio',
    'Família': 'Familia', 'família': 'familia',
    'Fácil': 'Facil', 'fácil': 'facil', 'Dúvida': 'Duvida', 'dúvida': 'duvida',
    'Construção': 'Construcao', 'construção': 'construcao',
    'Opção': 'Opcao', 'opção': 'opcao', 'Visão': 'Visao', 'visão': 'visao',
    'Período': 'Periodo', 'período': 'periodo',
    'Administração': 'Administracao', 'administração': 'administracao',
    'Fração': 'Fracao', 'fração': 'fracao',
    'Veículo': 'Veiculo', 'veículo': 'veiculo', 'Automóvel': 'Automovel', 'automóvel': 'automovel',
    'Aprovação': 'Aprovacao', 'aprovação': 'aprovacao', 'Emissão': 'Emissao', 'emissão': 'emissao',
    'Isenção': 'Isencao', 'isenção': 'isencao', 'Acréscimo': 'Acrescimo', 'acréscimo': 'acrescimo',
    'Decisão': 'Decisao', 'decisão': 'decisao', 'Amortização': 'Amortizacao', 'amortização': 'amortizacao',
    'Comparação': 'Comparacao', 'comparação': 'comparacao', 'Simulação': 'Simulacao', 'simulação': 'simulacao',
    'Correção': 'Correcao', 'correção': 'correcao', 'Projeção': 'Projecao', 'projeção': 'projecao',
    'Cotação': 'Cotacao', 'cotação': 'cotacao', 'Diferença': 'Diferenca', 'diferença': 'diferenca',
    'Redução': 'Reducao', 'redução': 'reducao', 'Estatística': 'Estatistica', 'estatística': 'estatistica',
    'Diário': 'Diario', 'diário': 'diario',
    'Relatório': 'Relatorio', 'relatório': 'relatorio',
    'Tributação': 'Tributacao', 'tributação': 'tributacao',
    'Situação': 'Situacao', 'situação': 'situacao',
    'Condição': 'Condicao', 'condição': 'condicao', 'Avaliação': 'Avaliacao', 'avaliação': 'avaliacao',
    'Apresentação': 'Apresentacao', 'apresentação': 'apresentacao', 'Ação': 'Acao', 'ação': 'acao',
    'Proteção': 'Protecao', 'proteção': 'protecao',
    'Histórico': 'Historico', 'histórico': 'historico',
    'Prático': 'Pratico', 'prático': 'pratico',
    'Econômico': 'Economico', 'econômico': 'economico',
    'Crédito': 'Credito', 'crédito': 'credito', 'Débito': 'Debito', 'débito': 'debito',
    'Múltiplo': 'Multiplo', 'múltiplo': 'multiplos', 'Lógico': 'Logico', 'lógico': 'logico',
    'Físico': 'Fisico', 'físico': 'fisico', 'Básico': 'Basico', 'básico': 'basico',
    'Clássico': 'Classico', 'clássico': 'classico', 'Típico': 'Tipico', 'típico': 'tipico',
    'Último': 'Ultimo', 'último': 'ultimo', 'Próximo': 'Proximo', 'próximo': 'proximo',
    'Vários': 'Varios', 'vários': 'varios',
    'Também': 'Tambem', 'também': 'tambem',
    'Três': 'Tres', 'três': 'tres',
    'Saída': 'Saida', 'saída': 'saida',
    'Dívida': 'Divida', 'dívida': 'divida',
    'Índice': 'Indice', 'índice': 'indice',
    'Inteligência': 'Inteligencia', 'inteligência': 'inteligencia',
    'Imobiliária': 'Imobiliaria', 'imobiliária': 'imobiliaria',
    'Líquida': 'Liquida', 'líquida': 'liquida',
    'Específico': 'Especifico', 'específico': 'especifico',
    '<ÆPor que consórcio': 'Por que consorcio'
  };

  const lines = content.split('\n');
  const outLines = lines.map(line => {
    if (line.includes('<Rp') || line.includes('</Rp') || line.includes('RpText')) {
      let l = line;
      for (const [accented, unaccented] of Object.entries(wordsToReplace)) {
        l = l.split(accented).join(unaccented);
      }
      return l;
    }
    return line;
  });
  
  fs.writeFileSync(filePath, outLines.join('\n'));
}

const files = [
  ...glob.sync('src/routes/_authenticated/simuladores/*.tsx'),
  ...glob.sync('src/routes/_authenticated/*.tsx'),
  ...glob.sync('src/components/RpShell.tsx')
];

files.forEach(processFile);
console.log('Done');
