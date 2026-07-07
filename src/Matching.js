/**
 * Carregamento das inscrições e cruzamento com os aprovados por frequência.
 *
 * A busca é por NOME normalizado (maiúsculas, sem acentos, sem espaços
 * extras). Quando existe mais de uma inscrição com o mesmo nome, vale
 * sempre a MAIS RECENTE (pelo Carimbo de data/hora) — os dados do aluno
 * não mudam entre inscrições. Se as inscrições repetidas tiverem
 * CPF/e-mail diferentes entre si (possíveis alunos homônimos), o
 * certificado sai normalmente e a linha recebe um aviso na coluna
 * Observações para conferência.
 *
 * CPF e e-mail, quando preenchidos na lista de aprovados, têm
 * prioridade sobre o nome por serem únicos por aluno.
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
    return { porCpf: {}, porEmail: {}, porNome: {} };
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

  // Cada índice guarda { registro, tempo } e mantém sempre a inscrição
  // mais recente para a mesma chave.
  const porCpf = {};
  const porEmail = {};
  const porNome = {};

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

    const tempo = tempoDaInscricao(pegar(linha, INSCRICAO_COLS.TIMESTAMP), i);
    const cpf = normalizarCpf(registro.cpf);
    const email = normalizarEmail(registro.email);

    if (cpf) {
      guardarMaisRecente(porCpf, cpf, registro, tempo);
    }
    if (email) {
      guardarMaisRecente(porEmail, email, registro, tempo);
    }

    const nomeNormalizado = normalizarTexto(registro.nome);
    const entrada = porNome[nomeNormalizado];
    // Inscrições repetidas com o mesmo nome mas CPF/e-mail diferentes
    // podem ser alunos homônimos: o certificado sai com os dados da
    // inscrição mais recente, mas a linha recebe um aviso.
    const homonimo = Boolean(
      entrada &&
      ((cpf && entrada.cpf && cpf !== entrada.cpf) ||
        (!cpf && email && entrada.email && email !== entrada.email))
    );
    if (!entrada || tempo >= entrada.tempo) {
      porNome[nomeNormalizado] = {
        registro: registro,
        tempo: tempo,
        cpf: cpf || (entrada ? entrada.cpf : ''),
        email: email || (entrada ? entrada.email : ''),
        homonimo: homonimo || Boolean(entrada && entrada.homonimo)
      };
    } else {
      entrada.homonimo = entrada.homonimo || homonimo;
      entrada.cpf = entrada.cpf || cpf;
      entrada.email = entrada.email || email;
    }
  }

  return { porCpf: porCpf, porEmail: porEmail, porNome: porNome };
}

/**
 * Guarda em indice[chave] a inscrição de tempo mais recente.
 */
function guardarMaisRecente(indice, chave, registro, tempo) {
  if (!indice[chave] || tempo >= indice[chave].tempo) {
    indice[chave] = { registro: registro, tempo: tempo };
  }
}

/**
 * Converte o Carimbo de data/hora em um número comparável.
 * Aceita Date (célula de data do Sheets) ou texto "dd/mm/aaaa hh:mm:ss".
 * Sem data válida, usa a posição da linha (as respostas do Forms já
 * chegam em ordem cronológica).
 */
function tempoDaInscricao(valor, indiceLinha) {
  if (valor instanceof Date) {
    return valor.getTime();
  }
  const m = String(valor == null ? '' : valor)
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    return new Date(
      Number(m[3]), Number(m[2]) - 1, Number(m[1]),
      Number(m[4]), Number(m[5]), Number(m[6] || 0)
    ).getTime();
  }
  return indiceLinha;
}

// Texto do aviso gravado na coluna Observações quando o mesmo nome
// aparece com CPFs/e-mails diferentes nas inscrições.
const AVISO_HOMONIMO =
  'Havia mais de uma inscrição com este nome (possíveis homônimos); ' +
  'foram usados os dados da inscrição mais recente. Confira se necessário.';

/**
 * Procura um aprovado por frequência nas inscrições.
 *
 * Retorna { registro, aviso }:
 *   - registro: dados da inscrição mais recente, ou null se o nome não
 *     foi encontrado;
 *   - aviso: texto para a coluna Observações ('' quando não há o que
 *     avisar).
 */
function buscarInscricao(indices, aprovado) {
  // CPF e e-mail são únicos por aluno: quando preenchidos, decidem.
  const cpf = normalizarCpf(aprovado.cpf);
  if (cpf && indices.porCpf[cpf]) {
    return { registro: indices.porCpf[cpf].registro, aviso: '' };
  }

  const email = normalizarEmail(aprovado.email);
  if (email && indices.porEmail[email]) {
    return { registro: indices.porEmail[email].registro, aviso: '' };
  }

  const nome = normalizarTexto(aprovado.nome);
  const entrada = nome ? indices.porNome[nome] : null;
  if (!entrada) {
    return { registro: null, aviso: '' };
  }
  return {
    registro: entrada.registro,
    aviso: entrada.homonimo ? AVISO_HOMONIMO : ''
  };
}
