/**
 * Funções utilitárias de normalização e formatação.
 */

/**
 * Normaliza texto para comparação: maiúsculas, sem acentos,
 * sem espaços duplicados e sem espaços nas pontas.
 */
function normalizarTexto(valor) {
  return String(valor == null ? '' : valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normaliza CPF para comparação: apenas dígitos, completando com
 * zeros à esquerda quando a planilha removeu o zero inicial.
 * Retorna '' se o valor não tiver cara de CPF.
 */
function normalizarCpf(valor) {
  const digitos = String(valor == null ? '' : valor).replace(/\D/g, '');
  if (digitos.length < 9 || digitos.length > 11) {
    return '';
  }
  return digitos.padStart(11, '0');
}

/**
 * Normaliza e-mail para comparação.
 */
function normalizarEmail(valor) {
  return String(valor == null ? '' : valor).toLowerCase().trim();
}

/**
 * Formata datas vindas do Sheets como dd/MM/yyyy; valores que já
 * são texto passam direto.
 */
function formatarData(valor) {
  if (valor instanceof Date) {
    return Utilities.formatDate(
      valor,
      Session.getScriptTimeZone(),
      'dd/MM/yyyy'
    );
  }
  return String(valor == null ? '' : valor).trim();
}

/**
 * Data de hoje formatada para uso nos certificados e na base de dados.
 */
function dataDeHoje() {
  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    'dd/MM/yyyy'
  );
}

/**
 * Remove caracteres inválidos para nome de arquivo no Drive.
 */
function sanitizarNomeArquivo(nome) {
  return String(nome).replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
}

/**
 * Monta um mapa cabeçalho -> índice da coluna a partir da primeira
 * linha de uma matriz de valores. A comparação ignora espaços extras.
 */
function mapearCabecalhos(linhaCabecalho) {
  const mapa = {};
  linhaCabecalho.forEach(function (celula, indice) {
    const chave = String(celula == null ? '' : celula).replace(/\s+/g, ' ').trim();
    if (chave && !(chave in mapa)) {
      mapa[chave] = indice;
    }
  });
  return mapa;
}
