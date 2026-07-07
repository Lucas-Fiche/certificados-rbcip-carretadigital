/**
 * Carregamento das inscrições e cruzamento com os aprovados por frequência.
 *
 * A busca principal é por NOME normalizado (maiúsculas, sem acentos,
 * sem espaços extras). Quando existe mais de um aluno inscrito com o
 * mesmo nome (homônimos), o CURSO informado na lista de aprovados
 * desempata; se ainda assim houver empate, a linha é marcada como
 * ambígua para revisão manual (preencher CPF ou e-mail resolve).
 *
 * CPF e e-mail, quando preenchidos na lista de aprovados, têm
 * prioridade sobre o nome por serem únicos por aluno.
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

  const porCpf = {};
  const porEmail = {};
  // Nome normalizado -> lista de inscrições. Cada item da lista é um
  // aluno possivelmente diferente (homônimo); inscrições repetidas do
  // mesmo aluno substituem a anterior (vale a mais recente).
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

    // A inscrição mais recente sobrescreve as anteriores de propósito.
    const cpf = normalizarCpf(registro.cpf);
    if (cpf) {
      porCpf[cpf] = registro;
    }
    const email = normalizarEmail(registro.email);
    if (email) {
      porEmail[email] = registro;
    }

    // Dois registros com o mesmo nome são considerados o mesmo aluno
    // (re-inscrição) quando têm o mesmo CPF/e-mail — ou, na falta dos
    // dois, o mesmo curso. Caso contrário, são homônimos.
    const nomeNormalizado = normalizarTexto(registro.nome);
    const identidade = cpf || email || 'CURSO|' + normalizarTexto(registro.curso);
    if (!porNome[nomeNormalizado]) {
      porNome[nomeNormalizado] = [];
    }
    const lista = porNome[nomeNormalizado];
    let substituido = false;
    for (let j = 0; j < lista.length; j++) {
      if (lista[j].identidade === identidade) {
        lista[j].registro = registro; // inscrição mais recente vence
        substituido = true;
        break;
      }
    }
    if (!substituido) {
      lista.push({ identidade: identidade, registro: registro });
    }
  }

  return { porCpf: porCpf, porEmail: porEmail, porNome: porNome };
}

/**
 * Procura um aprovado por frequência nas inscrições.
 *
 * Retorna { registro, nomeAmbiguo }:
 *   - registro: dados da inscrição, ou null se não encontrado;
 *   - nomeAmbiguo: true quando o nome pertence a mais de um aluno e o
 *     curso informado na lista de aprovados não bastou para desempatar.
 */
function buscarInscricao(indices, aprovado) {
  // CPF e e-mail são únicos por aluno: quando preenchidos, decidem.
  const cpf = normalizarCpf(aprovado.cpf);
  if (cpf && indices.porCpf[cpf]) {
    return { registro: indices.porCpf[cpf], nomeAmbiguo: false };
  }

  const email = normalizarEmail(aprovado.email);
  if (email && indices.porEmail[email]) {
    return { registro: indices.porEmail[email], nomeAmbiguo: false };
  }

  const nome = normalizarTexto(aprovado.nome);
  const candidatos = (nome && indices.porNome[nome]) || [];
  if (candidatos.length === 0) {
    return { registro: null, nomeAmbiguo: false };
  }
  if (candidatos.length === 1) {
    return { registro: candidatos[0].registro, nomeAmbiguo: false };
  }

  // Homônimos: tenta desempatar pelo curso da chamada. A comparação é
  // por "contém" nos dois sentidos, porque o curso digitado na chamada
  // costuma ser mais curto que o nome completo do curso no Forms
  // (ex.: "PC Gamer" vs "Montagem e Configuração ... (PC GAMER)").
  const curso = normalizarTexto(aprovado.curso);
  if (curso) {
    const doMesmoCurso = candidatos.filter(function (item) {
      const cursoInscricao = normalizarTexto(item.registro.curso);
      if (!cursoInscricao) {
        return false;
      }
      return cursoInscricao.indexOf(curso) !== -1 || curso.indexOf(cursoInscricao) !== -1;
    });
    if (doMesmoCurso.length === 1) {
      return { registro: doMesmoCurso[0].registro, nomeAmbiguo: false };
    }
  }

  return { registro: null, nomeAmbiguo: true };
}
