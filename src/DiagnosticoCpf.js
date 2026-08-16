/**
 * DIAGNÓSTICO DA BUSCA POR CPF
 * ------------------------------------------------------------------
 * Ferramenta de investigação para quando a consulta por CPF passa a
 * responder "não tem certificado" para todo mundo.
 *
 * Não altera nenhum dado: apenas lê a planilha e escreve um relatório
 * na aba "_Diagnóstico CPF" (pode apagar a aba depois).
 *
 * COMO USAR:
 * 1. Cole este arquivo no Apps Script DA PLANILHA ONDE A BUSCA ACONTECE
 *    (a que tem a fórmula de consulta / a base pesquisada).
 * 2. No editor, selecione a função "diagnosticarBuscaCpf" e clique em
 *    Executar (ou chame criarMenuDiagnostico() no seu onOpen).
 * 3. Informe um CPF que você TEM CERTEZA que possui certificado.
 * 4. Leia a aba "_Diagnóstico CPF".
 */

const DIAG_ABA = '_Diagnóstico CPF';
// Quantas linhas inspecionar em busca de fórmulas (elas costumam ficar
// no topo; limitar mantém a execução rápida em bases grandes).
const DIAG_LINHAS_FORMULAS = 200;

/**
 * Menu opcional. NÃO se chama onOpen de propósito: se este arquivo for
 * colado num projeto que já tem um onOpen (como o gerador), dois
 * onOpen se anulariam. Para ter o menu, chame esta função dentro do
 * onOpen que já existe; ou rode "diagnosticarBuscaCpf" direto pelo
 * editor do Apps Script (botão Executar).
 */
function criarMenuDiagnostico() {
  SpreadsheetApp.getUi()
    .createMenu('🔎 Diagnóstico')
    .addItem('Diagnosticar busca por CPF', 'diagnosticarBuscaCpf')
    .addToUi();
}

function diagnosticarBuscaCpf() {
  const ui = SpreadsheetApp.getUi();
  const resposta = ui.prompt(
    'Diagnóstico da busca por CPF',
    'Digite um CPF que você tem CERTEZA que possui certificado emitido:',
    ui.ButtonSet.OK_CANCEL
  );
  if (resposta.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  const cpfBruto = resposta.getResponseText().trim();
  const cpfAlvo = diagSoDigitos_(cpfBruto);
  if (!cpfAlvo) {
    ui.alert('Informe um CPF com números para o diagnóstico.');
    return;
  }

  const planilha = SpreadsheetApp.getActive();
  const linhas = [];
  const add = function (secao, item, detalhe) {
    linhas.push([secao, item, detalhe]);
  };

  add('ENTRADA', 'CPF digitado', cpfBruto);
  add('ENTRADA', 'Só dígitos', cpfAlvo + ' (' + cpfAlvo.length + ' dígitos)');
  add('ENTRADA', 'Normalizado (11 dígitos)', diagNormalizarCpf_(cpfAlvo) || '(não parece um CPF)');
  add('ENTRADA', 'Planilha analisada', planilha.getName());
  add('', '', '');

  let colunasEncontradas = 0;
  let achouEmAlgumLugar = false;

  planilha.getSheets().forEach(function (aba) {
    const nomeAba = aba.getName();
    if (nomeAba === DIAG_ABA) {
      return;
    }
    if (aba.getLastRow() < 2 || aba.getLastColumn() < 1) {
      add('ABA: ' + nomeAba, 'Vazia', 'sem dados para analisar');
      add('', '', '');
      return;
    }

    const valores = aba.getDataRange().getValues();
    const cabecalho = valores[0].map(function (c) {
      return String(c == null ? '' : c).trim();
    });

    // Uma coluna é candidata a CPF pelo cabeçalho ou pelo conteúdo.
    const candidatas = [];
    for (let c = 0; c < cabecalho.length; c++) {
      const tituloSimples = diagTextoSimples_(cabecalho[c]);
      // Telefone também tem 9-11 dígitos: fica de fora para não poluir.
      if (/TELEFONE|CELULAR|FONE|WHATSAPP/.test(tituloSimples)) {
        continue;
      }
      const tituloParece = tituloSimples.indexOf('CPF') !== -1;
      let comCaraDeCpf = 0;
      let preenchidas = 0;
      for (let r = 1; r < valores.length; r++) {
        const v = valores[r][c];
        if (v === '' || v == null) continue;
        preenchidas++;
        const d = diagSoDigitos_(v);
        if (d.length >= 9 && d.length <= 11) comCaraDeCpf++;
      }
      const maioriaParece = preenchidas > 0 && comCaraDeCpf / preenchidas > 0.5;
      if (tituloParece || maioriaParece) {
        candidatas.push({ indice: c, preenchidas: preenchidas, comCaraDeCpf: comCaraDeCpf });
      }
    }

    if (candidatas.length === 0) {
      add('ABA: ' + nomeAba, '⚠️ Nenhuma coluna de CPF',
          'Cabeçalhos: ' + cabecalho.join(' | '));
      add('', '', '');
      return;
    }

    candidatas.forEach(function (cand) {
      colunasEncontradas++;
      const c = cand.indice;
      const titulo = cabecalho[c] || '(sem cabeçalho)';
      const letra = diagLetraColuna_(c + 1);
      const rotulo = 'Coluna ' + letra + ' "' + titulo + '"';

      add('ABA: ' + nomeAba, rotulo, cand.preenchidas + ' células preenchidas, ' +
        cand.comCaraDeCpf + ' com cara de CPF');

      // Tipos e formatos presentes na coluna: revelam o clássico
      // "CPF virou número e perdeu o zero à esquerda".
      let comoNumero = 0, comFormatacao = 0, comEspacoSobrando = 0, comEspacoEstranho = 0;
      let onzeDigitos = 0, dezDigitos = 0;
      const amostras = [];
      let linhaAchada = 0;
      let achouExato = false, achouNormalizado = false;

      for (let r = 1; r < valores.length; r++) {
        const v = valores[r][c];
        if (v === '' || v == null) continue;
        if (typeof v === 'number') comoNumero++;
        const texto = String(v);
        if (/[.\-]/.test(texto)) comFormatacao++;
        if (texto !== texto.trim()) comEspacoSobrando++;
        if (/[ ​]/.test(texto)) comEspacoEstranho++;
        const d = diagSoDigitos_(v);
        if (d.length === 11) onzeDigitos++;
        if (d.length === 10) dezDigitos++;
        if (amostras.length < 3) {
          amostras.push(JSON.stringify(texto) + ' [' + typeof v + ']');
        }
        // Comparação crua (como uma fórmula faria) x normalizada
        if (texto.trim() === cpfBruto) {
          achouExato = true;
          linhaAchada = r + 1;
        }
        if (diagNormalizarCpf_(d) && diagNormalizarCpf_(d) === diagNormalizarCpf_(cpfAlvo)) {
          achouNormalizado = true;
          linhaAchada = linhaAchada || (r + 1);
        }
      }

      add('', '  Amostra de valores', amostras.join('   ·   '));
      add('', '  Guardados como número', comoNumero + (comoNumero
        ? '  ⚠️ número perde o zero à esquerda; formate a coluna como Texto'
        : ''));
      add('', '  Com pontos/traços', comFormatacao);
      add('', '  Com 11 dígitos / com 10', onzeDigitos + ' / ' + dezDigitos +
        (dezDigitos ? '  ⚠️ os de 10 dígitos perderam o zero inicial' : ''));
      if (comEspacoSobrando) {
        add('', '  ⚠️ Com espaço sobrando', comEspacoSobrando + ' células');
      }
      if (comEspacoEstranho) {
        add('', '  ⚠️ Com espaço invisível', comEspacoEstranho + ' células (colagem de site/PDF)');
      }

      if (achouExato) {
        achouEmAlgumLugar = true;
        add('', '  ✅ CPF ENCONTRADO', 'igualzinho ao digitado, na linha ' + linhaAchada);
      } else if (achouNormalizado) {
        achouEmAlgumLugar = true;
        add('', '  ⚠️ CPF EXISTE, mas escrito diferente',
          'está na linha ' + linhaAchada + '. A busca falha por causa da ' +
          'formatação/tipo, não por falta de dado.');
      } else {
        add('', '  ❌ CPF não existe nesta coluna', '');
      }
      add('', '', '');
    });
  });

  // Fórmulas de consulta: é aqui que o erro real costuma ficar escondido.
  const formulas = [];
  planilha.getSheets().forEach(function (aba) {
    if (aba.getName() === DIAG_ABA) return;
    const ultimaLinha = Math.min(aba.getLastRow(), DIAG_LINHAS_FORMULAS);
    if (ultimaLinha < 1 || aba.getLastColumn() < 1) return;
    const f = aba.getRange(1, 1, ultimaLinha, aba.getLastColumn()).getFormulas();
    for (let r = 0; r < f.length; r++) {
      for (let c = 0; c < f[r].length; c++) {
        const formula = f[r][c];
        if (!formula) continue;
        if (/PROCV|VLOOKUP|CORRESP|MATCH|ÍNDICE|INDICE|INDEX|IMPORTRANGE|FILTER|FILTRO|PROCX|XLOOKUP/i.test(formula)) {
          formulas.push({
            aba: aba.getName(),
            celula: diagLetraColuna_(c + 1) + (r + 1),
            formula: formula,
            valor: String(aba.getRange(r + 1, c + 1).getDisplayValue())
          });
        }
      }
    }
  });

  add('FÓRMULAS DE BUSCA', 'Encontradas', formulas.length +
    ' (nas primeiras ' + DIAG_LINHAS_FORMULAS + ' linhas de cada aba)');
  formulas.slice(0, 20).forEach(function (f) {
    const mascarada = /SEERRO|IFERROR|SEERRO|IFNA|SENÃODISP/i.test(f.formula);
    add('', f.aba + '!' + f.celula, f.formula);
    add('', '  resultado exibido', f.valor +
      (mascarada
        ? '   ⚠️ a fórmula tem SEERRO/IFERROR: qualquer erro real ' +
          '(#REF!, #N/A, IMPORTRANGE sem permissão) aparece como texto amigável'
        : ''));
    if (/IMPORTRANGE/i.test(f.formula)) {
      add('', '  ⚠️ usa IMPORTRANGE', 'a autorização entre planilhas pode ter caído — ' +
        'abra a célula e reconceda o acesso');
    }
  });
  add('', '', '');

  // Conclusão
  add('CONCLUSÃO', 'Colunas de CPF analisadas', String(colunasEncontradas));
  if (colunasEncontradas === 0) {
    add('CONCLUSÃO', '❌ Causa provável',
      'Não existe coluna de CPF nesta planilha. Se a busca consulta esta base, ' +
      'ela nunca vai achar ninguém — o CPF precisa ser gravado junto do certificado.');
  } else if (!achouEmAlgumLugar) {
    add('CONCLUSÃO', '❌ Causa provável',
      'O CPF testado não está em nenhuma coluna: a base pesquisada pode ser a ' +
      'errada, estar desatualizada, ou os certificados novos não estão sendo ' +
      'gravados nela.');
  } else {
    add('CONCLUSÃO', '⚠️ Causa provável',
      'O dado EXISTE. A falha é de comparação (tipo/formatação) ou de fórmula — ' +
      'veja os avisos acima.');
  }

  diagEscreverRelatorio_(planilha, linhas);
  ui.alert('Diagnóstico concluído',
    'Abra a aba "' + DIAG_ABA + '" para ver o relatório completo.',
    ui.ButtonSet.OK);
}

// ---------- Auxiliares (prefixo diag para não colidir com o resto) ----------

function diagSoDigitos_(valor) {
  return String(valor == null ? '' : valor).replace(/\D/g, '');
}

/** CPF comparável: 11 dígitos, com zeros à esquerda recuperados. */
function diagNormalizarCpf_(valor) {
  const d = diagSoDigitos_(valor);
  if (d.length < 9 || d.length > 11) return '';
  return d.length === 11 ? d : ('00000000000' + d).slice(-11);
}

function diagTextoSimples_(valor) {
  return String(valor == null ? '' : valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

/** 1 -> A, 27 -> AA */
function diagLetraColuna_(numero) {
  let letra = '';
  let n = numero;
  while (n > 0) {
    const resto = (n - 1) % 26;
    letra = String.fromCharCode(65 + resto) + letra;
    n = Math.floor((n - 1) / 26);
  }
  return letra;
}

function diagEscreverRelatorio_(planilha, linhas) {
  let aba = planilha.getSheetByName(DIAG_ABA);
  if (aba) {
    aba.clear();
  } else {
    aba = planilha.insertSheet(DIAG_ABA);
  }
  const conteudo = [['Seção', 'Item', 'Detalhe']].concat(linhas);
  aba.getRange(1, 1, conteudo.length, 3).setValues(conteudo);
  aba.getRange(1, 1, 1, 3).setFontWeight('bold');
  aba.setColumnWidth(1, 170);
  aba.setColumnWidth(2, 260);
  aba.setColumnWidth(3, 620);
  aba.setFrozenRows(1);
  aba.activate();
}
