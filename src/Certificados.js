/**
 * Geração dos certificados em PDF a partir de um template do
 * Google Slides ou Google Docs (substitui o Autocrat).
 *
 * Placeholders aceitos no template (escreva exatamente assim):
 *   {{nome}} {{curso}} {{estado}} {{cpf}} {{email}} {{telefone}}
 *   {{nascimento}} {{idade}} {{data}}
 *
 * {{data}} é a data de geração do certificado (dd/mm/aaaa).
 */

/**
 * Gera o certificado de um aluno e devolve a URL do PDF no Drive.
 */
function gerarCertificado(registro, cfg) {
  const template = DriveApp.getFileById(cfg.idTemplate);
  const pasta = DriveApp.getFolderById(cfg.idPasta);

  const nomeArquivo = sanitizarNomeArquivo(
    'Certificado - ' + registro.nome + (registro.curso ? ' - ' + registro.curso : '')
  );

  const valores = {
    nome: registro.nome,
    curso: registro.curso,
    estado: cfg.estado,
    cpf: registro.cpf,
    email: registro.email,
    telefone: registro.telefone,
    nascimento: registro.nascimento,
    idade: registro.idade,
    data: dataDeHoje()
  };

  const copia = template.makeCopy(nomeArquivo, pasta);
  try {
    const tipo = template.getMimeType();
    if (tipo === MimeType.GOOGLE_SLIDES) {
      preencherSlides(copia.getId(), valores);
    } else if (tipo === MimeType.GOOGLE_DOCS) {
      preencherDocs(copia.getId(), valores);
    } else {
      throw new Error('O template precisa ser Google Slides ou Google Docs.');
    }

    const pdf = pasta.createFile(
      copia.getAs(MimeType.PDF).setName(nomeArquivo + '.pdf')
    );

    if (!MANTER_COPIA_EDITAVEL) {
      copia.setTrashed(true);
    }
    return pdf.getUrl();
  } catch (erro) {
    // Não deixa cópias pela metade no Drive quando algo falha.
    copia.setTrashed(true);
    throw erro;
  }
}

function preencherSlides(idArquivo, valores) {
  const apresentacao = SlidesApp.openById(idArquivo);
  Object.keys(valores).forEach(function (chave) {
    apresentacao.replaceAllText('{{' + chave + '}}', String(valores[chave] || ''));
  });
  apresentacao.saveAndClose();
}

function preencherDocs(idArquivo, valores) {
  const documento = DocumentApp.openById(idArquivo);
  const corpo = documento.getBody();
  Object.keys(valores).forEach(function (chave) {
    // replaceText usa expressão regular; as chaves precisam ser escapadas.
    corpo.replaceText('\\{\\{' + chave + '\\}\\}', String(valores[chave] || ''));
  });
  documento.saveAndClose();
}
