/**
 * Leitura e validação da aba Config da planilha mestre.
 *
 * Cada linha da aba Config descreve um estado:
 *   Estado | ID Planilha de Inscrições | Aba de Inscrições | Aba de Aprovados
 *   | ID da Pasta no Drive | ID do Template | Ativo
 */

/**
 * Lê a aba Config e retorna a lista de configurações de estado.
 * Linhas com Ativo = NÃO são ignoradas.
 */
function lerConfiguracoes() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  const aba = planilha.getSheetByName(ABA_CONFIG);
  if (!aba) {
    throw new Error(
      'A aba "' + ABA_CONFIG + '" não foi encontrada. ' +
      'Crie a aba de configuração conforme o README do projeto.'
    );
  }

  const valores = aba.getDataRange().getValues();
  if (valores.length < 2) {
    throw new Error('A aba "' + ABA_CONFIG + '" não tem nenhum estado configurado.');
  }

  const colunas = mapearCabecalhos(valores[0]);
  [CONFIG_COLS.ESTADO, CONFIG_COLS.ID_INSCRICOES, CONFIG_COLS.ID_PASTA, CONFIG_COLS.ID_TEMPLATE]
    .forEach(function (obrigatoria) {
      if (!(obrigatoria in colunas)) {
        throw new Error(
          'A coluna obrigatória "' + obrigatoria + '" não existe na aba "' + ABA_CONFIG + '".'
        );
      }
    });

  const configs = [];
  for (let i = 1; i < valores.length; i++) {
    const linha = valores[i];
    const estado = String(linha[colunas[CONFIG_COLS.ESTADO]] || '').trim();
    if (!estado) {
      continue; // linha em branco
    }

    const ativo = CONFIG_COLS.ATIVO in colunas
      ? normalizarTexto(linha[colunas[CONFIG_COLS.ATIVO]])
      : 'SIM';
    if (ativo === 'NAO' || ativo === 'N' || ativo === 'FALSE') {
      continue;
    }

    configs.push({
      estado: estado,
      idInscricoes: String(linha[colunas[CONFIG_COLS.ID_INSCRICOES]] || '').trim(),
      abaInscricoes: CONFIG_COLS.ABA_INSCRICOES in colunas
        ? String(linha[colunas[CONFIG_COLS.ABA_INSCRICOES]] || '').trim()
        : '',
      abaAprovados: CONFIG_COLS.ABA_APROVADOS in colunas &&
        String(linha[colunas[CONFIG_COLS.ABA_APROVADOS]] || '').trim()
        ? String(linha[colunas[CONFIG_COLS.ABA_APROVADOS]] || '').trim()
        : 'Aprovados - ' + estado,
      idPasta: String(linha[colunas[CONFIG_COLS.ID_PASTA]] || '').trim(),
      idTemplate: String(linha[colunas[CONFIG_COLS.ID_TEMPLATE]] || '').trim()
    });
  }

  if (configs.length === 0) {
    throw new Error('Nenhum estado ativo encontrado na aba "' + ABA_CONFIG + '".');
  }
  return configs;
}

/**
 * Item de menu: verifica se todos os recursos configurados (planilhas,
 * abas, pastas e templates) estão acessíveis, sem gerar nada.
 */
function validarConfiguracao() {
  const ui = SpreadsheetApp.getUi();
  let configs;
  try {
    configs = lerConfiguracoes();
  } catch (erro) {
    ui.alert('Erro na configuração', erro.message, ui.ButtonSet.OK);
    return;
  }

  const planilhaMestre = SpreadsheetApp.getActiveSpreadsheet();
  const problemas = [];

  configs.forEach(function (cfg) {
    // Planilha e aba de inscrições
    try {
      const inscricoes = SpreadsheetApp.openById(cfg.idInscricoes);
      const aba = cfg.abaInscricoes
        ? inscricoes.getSheetByName(cfg.abaInscricoes)
        : inscricoes.getSheets()[0];
      if (!aba) {
        problemas.push(cfg.estado + ': aba de inscrições "' + cfg.abaInscricoes + '" não existe.');
      } else {
        const colunas = mapearCabecalhos(aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0]);
        [INSCRICAO_COLS.NOME, INSCRICAO_COLS.CPF, INSCRICAO_COLS.CURSO].forEach(function (col) {
          if (!(col in colunas)) {
            problemas.push(cfg.estado + ': coluna "' + col + '" não encontrada nas inscrições.');
          }
        });
      }
    } catch (erro) {
      problemas.push(cfg.estado + ': não foi possível abrir a planilha de inscrições (' + erro.message + ').');
    }

    // Aba de aprovados na planilha mestre
    if (!planilhaMestre.getSheetByName(cfg.abaAprovados)) {
      problemas.push(cfg.estado + ': aba de aprovados "' + cfg.abaAprovados + '" não existe nesta planilha.');
    }

    // Pasta de destino
    try {
      DriveApp.getFolderById(cfg.idPasta);
    } catch (erro) {
      problemas.push(cfg.estado + ': não foi possível abrir a pasta do Drive (' + cfg.idPasta + ').');
    }

    // Template
    try {
      const template = DriveApp.getFileById(cfg.idTemplate);
      const tipo = template.getMimeType();
      if (tipo !== MimeType.GOOGLE_SLIDES && tipo !== MimeType.GOOGLE_DOCS) {
        problemas.push(cfg.estado + ': o template precisa ser Google Slides ou Google Docs.');
      }
    } catch (erro) {
      problemas.push(cfg.estado + ': não foi possível abrir o template (' + cfg.idTemplate + ').');
    }
  });

  if (problemas.length === 0) {
    ui.alert(
      'Configuração válida ✅',
      configs.length + ' estado(s) ativo(s), todos os recursos acessíveis.',
      ui.ButtonSet.OK
    );
  } else {
    ui.alert(
      'Problemas encontrados (' + problemas.length + ')',
      problemas.join('\n'),
      ui.ButtonSet.OK
    );
  }
}
