/**
 * Aba "Base de Dados": registro final de cada certificado gerado.
 *
 * A chave de deduplicação é estado + CPF (ou nome, se não houver CPF)
 * + curso, então rodar o processamento de novo nunca gera certificado
 * duplicado para o mesmo aluno.
 */

/**
 * Abre (ou cria) a aba Base de Dados e devolve a aba junto com o
 * conjunto de chaves já registradas.
 */
function abrirBaseDados() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  let aba = planilha.getSheetByName(ABA_BASE_DADOS);
  if (!aba) {
    aba = planilha.insertSheet(ABA_BASE_DADOS);
    aba.appendRow(BASE_DADOS_HEADERS);
    aba.setFrozenRows(1);
  }

  const chaves = {};
  const valores = aba.getDataRange().getValues();
  if (valores.length > 1) {
    const colunas = mapearCabecalhos(valores[0]);
    for (let i = 1; i < valores.length; i++) {
      const chave = chaveBaseDados(
        valores[i][colunas['Estado']],
        valores[i][colunas['CPF']],
        valores[i][colunas['Nome']],
        valores[i][colunas['Curso']]
      );
      chaves[chave] = true;
    }
  }

  return { aba: aba, chaves: chaves };
}

/**
 * Chave única de um certificado na base de dados.
 */
function chaveBaseDados(estado, cpf, nome, curso) {
  const identidade = normalizarCpf(cpf) || normalizarTexto(nome);
  return [normalizarTexto(estado), identidade, normalizarTexto(curso)].join('|');
}

/**
 * Acrescenta um aluno à base de dados e registra a chave para as
 * próximas verificações de duplicidade.
 */
function registrarNaBase(baseDados, cfg, registro, linkCertificado) {
  baseDados.aba.appendRow([
    dataDeHoje(),
    cfg.estado,
    registro.semana || '',
    registro.escola || '',
    registro.curso,
    registro.nome,
    registro.cpf,
    registro.email,
    registro.telefone,
    registro.nascimento,
    registro.idade,
    registro.raca,
    registro.sexo,
    registro.escolaridade,
    registro.pcd,
    linkCertificado
  ]);
  baseDados.chaves[
    chaveBaseDados(cfg.estado, registro.cpf, registro.nome, registro.curso)
  ] = true;
}
