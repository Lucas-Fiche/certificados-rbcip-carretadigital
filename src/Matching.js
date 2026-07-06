/**
 * Carregamento das inscrições e cruzamento com os aprovados por frequência.
 *
 * Ordem de busca (da mais confiável para a menos):
 *   1. CPF (apenas dígitos, com zeros à esquerda)
 *   2. E-mail (minúsculas)
 *   3. Nome normalizado (maiúsculas, sem acentos, sem espaços extras)
 *
 * Quando o mesmo aluno se inscreve mais de uma vez, vale a inscrição
 * mais recente (última linha da planilha do Forms).
 */

/**
 * Lê a planilha de inscrições de um estado e devolve índices de busca.
 */
function carregarInscricoes(cfg) {
  const planilha = SpreadsheetApp.openById(cfg.idInscricoes);
  const aba = cfg.abaInscricoes
    ? planilha.getSheetByName(cfg.abaInscricoes)
    : planilha.getSheets()[0];
  if (!aba) {
    throw new Error(
      cfg.estado + ': aba de inscrições "' + cfg.abaInscricoes + '" não encontrada.'
    );
  }

  const valores = aba.getDataRange().getValues();
  if (valores.length < 2) {
    return { porCpf: {}, porEmail: {}, porNome: {}, nomesAmbiguos: {} };
  }

  const colunas = mapearCabecalhos(valores[0]);
  if (!(INSCRICAO_COLS.NOME in colunas)) {
    throw new Error(
      cfg.estado + ': a coluna "' + INSCRICAO_COLS.NOME + '" não existe nas inscrições.'
    );
  }

  const pegar = function (linha, nomeColuna) {
    return nomeColuna in colunas ? linha[colunas[nomeColuna]] : '';
  };

  const porCpf = {};
  const porEmail = {};
  const porNome = {};
  // Para detectar homônimos: nome normalizado -> identidades (CPF ou
  // e-mail) distintas vistas com esse nome.
  const identidadesPorNome = {};

  for (let i = 1; i < valores.length; i++) {
    const linha = valores[i];
    const registro = {
      nome: String(pegar(linha, INSCRICAO_COLS.NOME) || '').trim(),
      curso: String(pegar(linha, INSCRICAO_COLS.CURSO) || '').trim(),
      telefone: String(pegar(linha, INSCRICAO_COLS.TELEFONE) || '').trim(),
      email: String(pegar(linha, INSCRICAO_COLS.EMAIL) || '').trim(),
      cpf: String(pegar(linha, INSCRICAO_COLS.CPF) || '').trim(),
      nascimento: formatarData(pegar(linha, INSCRICAO_COLS.NASCIMENTO)),
      idade: String(pegar(linha, INSCRICAO_COLS.IDADE) || '').trim(),
      raca: String(pegar(linha, INSCRICAO_COLS.RACA) || '').trim(),
      sexo: String(pegar(linha, INSCRICAO_COLS.SEXO) || '').trim(),
      escolaridade: String(pegar(linha, INSCRICAO_COLS.ESCOLARIDADE) || '').trim(),
      pcd: String(pegar(linha, INSCRICAO_COLS.PCD) || '').trim()
    };

    if (!registro.nome) {
      continue;
    }

    // A inscrição mais recente sobrescreve as anteriores de propósito.
    const cpf = normalizarCpf(registro.cpf);
    if (cpf) {
      porCpf[cpf] = registro;
    }
    const email = normalizarEmail(registro.email);
    if (email) {
      porEmail[email] = registro;
    }

    const nomeNormalizado = normalizarTexto(registro.nome);
    porNome[nomeNormalizado] = registro;
    const identidade = cpf || email || 'linha-' + i;
    if (!identidadesPorNome[nomeNormalizado]) {
      identidadesPorNome[nomeNormalizado] = {};
    }
    identidadesPorNome[nomeNormalizado][identidade] = true;
  }

  // Nomes que aparecem com mais de um CPF/e-mail são de alunos
  // diferentes: a busca só por nome não pode decidir entre eles.
  const nomesAmbiguos = {};
  Object.keys(identidadesPorNome).forEach(function (nome) {
    if (Object.keys(identidadesPorNome[nome]).length > 1) {
      nomesAmbiguos[nome] = true;
    }
  });

  return {
    porCpf: porCpf,
    porEmail: porEmail,
    porNome: porNome,
    nomesAmbiguos: nomesAmbiguos
  };
}

/**
 * Procura um aprovado por frequência nas inscrições.
 *
 * Retorna { registro, nomeAmbiguo }:
 *   - registro: dados da inscrição, ou null se não encontrado;
 *   - nomeAmbiguo: true quando o nome existe nas inscrições mas
 *     pertence a mais de um aluno — é preciso preencher o CPF (ou
 *     e-mail) na aba de aprovados para desempatar.
 */
function buscarInscricao(indices, aprovado) {
  const cpf = normalizarCpf(aprovado.cpf);
  if (cpf && indices.porCpf[cpf]) {
    return { registro: indices.porCpf[cpf], nomeAmbiguo: false };
  }

  const email = normalizarEmail(aprovado.email);
  if (email && indices.porEmail[email]) {
    return { registro: indices.porEmail[email], nomeAmbiguo: false };
  }

  const nome = normalizarTexto(aprovado.nome);
  if (nome && indices.porNome[nome]) {
    if (indices.nomesAmbiguos[nome]) {
      return { registro: null, nomeAmbiguo: true };
    }
    return { registro: indices.porNome[nome], nomeAmbiguo: false };
  }

  return { registro: null, nomeAmbiguo: false };
}
