/**
 * Constantes do projeto: nomes de abas, cabeçalhos e configurações gerais.
 *
 * Se algum cabeçalho mudar nas planilhas de inscrição, basta atualizar aqui.
 */

// Abas da planilha mestre
const ABA_CONFIG = 'Config';
const ABA_BASE_DADOS = 'Base de Dados';

// Margem de segurança sobre o limite de ~6 minutos de execução do Apps Script.
// Ao atingir esse tempo, o processamento para com segurança e pode ser
// retomado executando o menu novamente (linhas já processadas são puladas).
const LIMITE_EXECUCAO_MS = 4.5 * 60 * 1000;

// Se true, mantém também a cópia editável (Slides/Docs) do certificado no
// Drive, além do PDF. Se false, mantém apenas o PDF.
const MANTER_COPIA_EDITAVEL = false;

// Cabeçalhos da aba Config (uma linha por estado)
const CONFIG_COLS = {
  ESTADO: 'Estado',
  ID_INSCRICOES: 'ID Planilha de Inscrições',
  ABA_INSCRICOES: 'Aba de Inscrições',
  ABA_APROVADOS: 'Aba de Aprovados',
  ID_PASTA: 'ID da Pasta no Drive',
  ID_TEMPLATE: 'ID do Template',
  ATIVO: 'Ativo'
};

// Cabeçalhos padronizados das planilhas de inscrição (Google Forms)
const INSCRICAO_COLS = {
  TIMESTAMP: 'Carimbo de data/hora',
  NOME: 'Nome Formatado',
  CURSO: 'Para qual curso você quer se inscrever?',
  TELEFONE: 'Telefone Formatado',
  EMAIL: 'E-mail',
  CPF: 'CPF Formatado',
  NASCIMENTO: 'Qual sua data de nascimento? (DIA/MÊS/ANO)',
  IDADE: 'Idade',
  RACA: 'Cor da pele / Raça / Etnia',
  SEXO: 'Sexo',
  ESCOLARIDADE: 'Qual nível ou série escolar você está frequentando atualmente?',
  PCD: 'Você é uma pessoa com deficiência (PCD)?'
};

// Cabeçalhos esperados nas abas de aprovados por frequência.
// Nome é obrigatório; CPF e E-mail são opcionais, mas tornam o
// cruzamento muito mais confiável.
const APROVADOS_COLS = {
  NOME: 'Nome',
  CPF: 'CPF',
  EMAIL: 'E-mail',
  STATUS: 'Status',
  LINK: 'Link do Certificado'
};

// Valores possíveis da coluna Status nas abas de aprovados
const STATUS = {
  GERADO: 'CERTIFICADO GERADO',
  JA_EXISTIA: 'JÁ GERADO ANTERIORMENTE',
  NAO_ENCONTRADO: 'NÃO ENCONTRADO NA INSCRIÇÃO'
};

// Cabeçalhos da aba Base de Dados (criada automaticamente)
const BASE_DADOS_HEADERS = [
  'Data de Processamento',
  'Estado',
  'Curso',
  'Nome',
  'CPF',
  'E-mail',
  'Telefone',
  'Data de Nascimento',
  'Idade',
  'Cor da pele / Raça / Etnia',
  'Sexo',
  'Escolaridade',
  'PCD',
  'Link do Certificado'
];
