/**
 * Certificados Carreta Digital
 *
 * Automatiza o fluxo semanal: cruza os aprovados por frequência com as
 * inscrições do Google Forms de cada estado, gera os certificados em PDF
 * no Drive e registra tudo na aba Base de Dados.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎓 Certificados')
    .addItem('Processar todos os estados', 'processarTodosEstados')
    .addItem('Processar um estado...', 'processarUmEstado')
    .addSeparator()
    .addItem('Validar configuração', 'validarConfiguracao')
    .addToUi();
}

function processarTodosEstados() {
  executarProcessamento(null);
}

function processarUmEstado() {
  const ui = SpreadsheetApp.getUi();
  const resposta = ui.prompt(
    'Processar um estado',
    'Digite o nome do estado exatamente como está na coluna "Estado" da aba Config:',
    ui.ButtonSet.OK_CANCEL
  );
  if (resposta.getSelectedButton() !== ui.Button.OK) {
    return;
  }
  const estado = resposta.getResponseText().trim();
  if (estado) {
    executarProcessamento(estado);
  }
}

/**
 * Processa os estados ativos (todos, ou apenas o informado em
 * filtroEstado). Linhas já processadas são puladas, então a função
 * pode ser executada quantas vezes for preciso.
 */
function executarProcessamento(filtroEstado) {
  const inicio = Date.now();
  const ui = SpreadsheetApp.getUi();

  let configs;
  try {
    configs = lerConfiguracoes();
  } catch (erro) {
    ui.alert('Erro na configuração', erro.message, ui.ButtonSet.OK);
    return;
  }

  if (filtroEstado) {
    const filtroNormalizado = normalizarTexto(filtroEstado);
    configs = configs.filter(function (cfg) {
      return normalizarTexto(cfg.estado) === filtroNormalizado;
    });
    if (configs.length === 0) {
      ui.alert(
        'Estado não encontrado',
        'Nenhum estado ativo chamado "' + filtroEstado + '" na aba Config.',
        ui.ButtonSet.OK
      );
      return;
    }
  }

  const baseDados = abrirBaseDados();
  const totais = { gerados: 0, jaExistiam: 0, naoEncontrados: 0, ambiguos: 0 };
  const erros = [];
  let tempoEstourado = false;

  for (let c = 0; c < configs.length && !tempoEstourado; c++) {
    const cfg = configs[c];
    try {
      tempoEstourado = processarEstado(cfg, baseDados, totais, erros, inicio);
    } catch (erro) {
      erros.push(cfg.estado + ': ' + erro.message);
    }
  }

  let resumo =
    'Certificados gerados: ' + totais.gerados + '\n' +
    'Já gerados anteriormente: ' + totais.jaExistiam + '\n' +
    'Não encontrados na inscrição: ' + totais.naoEncontrados + '\n' +
    'Nomes ambíguos (preencha o CPF): ' + totais.ambiguos;
  if (tempoEstourado) {
    resumo +=
      '\n\n⏱️ O limite de tempo de execução foi atingido antes do fim. ' +
      'Execute o menu novamente para continuar de onde parou — ' +
      'os certificados já gerados não serão duplicados.';
  }
  if (erros.length > 0) {
    resumo += '\n\n⚠️ Erros:\n' + erros.join('\n');
  }
  ui.alert('Processamento concluído', resumo, ui.ButtonSet.OK);
}

/**
 * Processa a aba de aprovados de um estado. Devolve true se o limite
 * de tempo de execução foi atingido no meio do processamento.
 */
function processarEstado(cfg, baseDados, totais, erros, inicio) {
  // A lista de aprovados pode estar em outra planilha (coluna
  // "ID Planilha de Aprovados" da Config) ou na própria mestre.
  const planilhaAprovados = cfg.idAprovados
    ? SpreadsheetApp.openById(cfg.idAprovados)
    : SpreadsheetApp.getActiveSpreadsheet();
  const abaAprovados = planilhaAprovados.getSheetByName(cfg.abaAprovados);
  if (!abaAprovados) {
    throw new Error('aba de aprovados "' + cfg.abaAprovados + '" não encontrada.');
  }

  const valores = abaAprovados.getDataRange().getValues();
  if (valores.length < 2) {
    return false; // nenhum aprovado listado ainda
  }

  const colunas = mapearCabecalhos(valores[0]);
  if (!(APROVADOS_COLS.NOME in colunas)) {
    throw new Error(
      'a aba "' + cfg.abaAprovados + '" precisa de uma coluna "' + APROVADOS_COLS.NOME + '".'
    );
  }

  const colStatus = garantirColuna(abaAprovados, colunas, APROVADOS_COLS.STATUS);
  const colLink = garantirColuna(abaAprovados, colunas, APROVADOS_COLS.LINK);

  const indices = carregarInscricoes(cfg);

  const pegar = function (linha, nomeColuna) {
    return nomeColuna in colunas && colunas[nomeColuna] < linha.length
      ? String(linha[colunas[nomeColuna]] || '').trim()
      : '';
  };
  // Se a aba tiver uma coluna "Estado", cada estado da Config processa
  // apenas as suas linhas — permite juntar todos numa aba única.
  const temColunaEstado = APROVADOS_COLS.ESTADO in colunas;
  const estadoNormalizado = normalizarTexto(cfg.estado);

  for (let i = 1; i < valores.length; i++) {
    const linha = valores[i];
    const aprovado = {
      nome: pegar(linha, APROVADOS_COLS.NOME),
      semana: pegar(linha, APROVADOS_COLS.SEMANA),
      escola: pegar(linha, APROVADOS_COLS.ESCOLA),
      curso: pegar(linha, APROVADOS_COLS.CURSO),
      cpf: pegar(linha, APROVADOS_COLS.CPF),
      email: pegar(linha, APROVADOS_COLS.EMAIL)
    };
    if (!aprovado.nome) {
      continue;
    }
    if (temColunaEstado &&
        normalizarTexto(pegar(linha, APROVADOS_COLS.ESTADO)) !== estadoNormalizado) {
      continue;
    }

    const statusAtual = colunas[APROVADOS_COLS.STATUS] < linha.length
      ? String(linha[colunas[APROVADOS_COLS.STATUS]] || '').trim()
      : '';
    // Reprocessa apenas linhas pendentes ou não encontradas na rodada
    // anterior (para o caso de o cadastro ter sido corrigido).
    if (statusAtual === STATUS.GERADO || statusAtual === STATUS.JA_EXISTIA) {
      continue;
    }

    if (Date.now() - inicio > LIMITE_EXECUCAO_MS) {
      return true;
    }

    const numeroLinha = i + 1;
    const busca = buscarInscricao(indices, aprovado);
    if (!busca.registro) {
      if (busca.nomeAmbiguo) {
        abaAprovados.getRange(numeroLinha, colStatus).setValue(STATUS.AMBIGUO);
        totais.ambiguos++;
      } else {
        abaAprovados.getRange(numeroLinha, colStatus).setValue(STATUS.NAO_ENCONTRADO);
        totais.naoEncontrados++;
      }
      continue;
    }
    // No certificado e na base valem a semana, a escola e o curso da
    // chamada (o que o aluno de fato frequentou); os demais dados vêm
    // da inscrição.
    const registro = Object.assign({}, busca.registro, {
      semana: aprovado.semana,
      escola: aprovado.escola,
      curso: aprovado.curso || busca.registro.curso
    });

    const chave = chaveBaseDados(cfg.estado, registro.cpf, registro.nome, registro.curso);
    if (baseDados.chaves[chave]) {
      abaAprovados.getRange(numeroLinha, colStatus).setValue(STATUS.JA_EXISTIA);
      totais.jaExistiam++;
      continue;
    }

    try {
      const link = gerarCertificado(registro, cfg);
      registrarNaBase(baseDados, cfg, registro, link);
      abaAprovados.getRange(numeroLinha, colStatus).setValue(STATUS.GERADO);
      abaAprovados.getRange(numeroLinha, colLink).setValue(link);
      totais.gerados++;
    } catch (erro) {
      erros.push(cfg.estado + ' / ' + aprovado.nome + ': ' + erro.message);
    }
  }

  return false;
}

/**
 * Garante que a coluna exista na aba (cria no final, se preciso) e
 * devolve o número da coluna (1-indexado) para uso com getRange.
 */
function garantirColuna(aba, colunas, nomeColuna) {
  if (nomeColuna in colunas) {
    return colunas[nomeColuna] + 1;
  }
  const novaColuna = aba.getLastColumn() + 1;
  aba.getRange(1, novaColuna).setValue(nomeColuna);
  colunas[nomeColuna] = novaColuna - 1;
  return novaColuna;
}
