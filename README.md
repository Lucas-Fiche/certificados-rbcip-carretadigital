# Certificados Carreta Digital

Automação do fluxo semanal de certificados do projeto Carreta Digital, feita em
**Google Apps Script**. Em uma única execução, para os 9 estados, o script:

1. Lê os alunos **aprovados por frequência** (que você cola em abas da planilha mestre);
2. Busca cada um na **planilha de inscrições** do estado (Google Forms), por CPF → e-mail → nome;
3. **Gera o certificado em PDF** a partir de um template do Google Slides ou Docs, salvando na pasta do Drive do estado (substitui o Autocrat);
4. Grava os dados do aluno + link do certificado na aba **Base de Dados**;
5. Marca o status de cada aluno na aba de aprovados (`CERTIFICADO GERADO`, `NÃO ENCONTRADO NA INSCRIÇÃO`, `JÁ GERADO ANTERIORMENTE`).

Rodar de novo é sempre seguro: alunos já processados são pulados e nunca há
certificado duplicado.

---

## 1. Estrutura da planilha mestre

Crie um Google Sheets novo (a "planilha mestre") com as abas abaixo.

### Aba `Config` — uma linha por estado

| Estado | ID Planilha de Inscrições | Aba de Inscrições | Aba de Aprovados | ID da Pasta no Drive | ID do Template | Ativo |
|--------|---------------------------|-------------------|------------------|----------------------|----------------|-------|
| CE     | 1AbC...xyz                | Respostas ao formulário 1 | Aprovados - CE | 1DeF...uvw | 1GhI...rst | SIM |
| BA     | ...                       |                   |                  | ...                  | ...            | SIM |

- **ID Planilha de Inscrições**: o trecho da URL entre `/d/` e `/edit` da planilha gerada pelo Forms.
- **Aba de Inscrições**: opcional; se vazio, usa a primeira aba da planilha.
- **Aba de Aprovados**: opcional; se vazio, usa `Aprovados - {Estado}`.
- **ID da Pasta no Drive**: o trecho final da URL da pasta onde os PDFs devem ser salvos.
- **ID do Template**: ID do arquivo Google Slides ou Docs do certificado.
- **Ativo**: `SIM` ou `NÃO` — permite pausar um estado sem apagar a linha.

### Abas de aprovados — uma por estado (ex.: `Aprovados - CE`)

| Nome | CPF | E-mail |
|------|-----|--------|
| Maria da Silva | 012.345.678-90 | maria@email.com |

- **Nome** é obrigatório. **CPF** e **E-mail** são opcionais, mas deixam o
  cruzamento muito mais confiável — priorize preencher o CPF.
- As colunas **Status** e **Link do Certificado** são criadas e preenchidas
  automaticamente pelo script.
- Toda semana, basta colar os novos aprovados nessas abas.

### Aba `Base de Dados`

Criada automaticamente na primeira execução. Recebe uma linha por certificado
gerado, com todos os dados da inscrição e o link do PDF.

## 2. Planilhas de inscrição (Google Forms)

O script espera as colunas padronizadas abaixo (é o formato atual dos 9 estados):

- Carimbo de data/hora
- Nome Formatado
- Para qual curso você quer se inscrever?
- Telefone Formatado
- E-mail
- CPF Formatado
- Qual sua data de nascimento? (DIA/MÊS/ANO)
- Idade
- Cor da pele / Raça / Etnia
- Sexo
- Qual nível ou série escolar você está frequentando atualmente?
- Você é uma pessoa com deficiência (PCD)?

Se algum cabeçalho mudar, atualize `src/Constants.js` (`INSCRICAO_COLS`).

## 3. Template do certificado

Use um arquivo **Google Slides** (recomendado para certificados) ou **Google
Docs** com placeholders no texto, escritos exatamente assim:

| Placeholder | Substituído por |
|-------------|-----------------|
| `{{nome}}` | Nome Formatado |
| `{{curso}}` | Curso escolhido na inscrição |
| `{{estado}}` | Estado (coluna da aba Config) |
| `{{cpf}}` | CPF Formatado |
| `{{email}}` | E-mail |
| `{{telefone}}` | Telefone Formatado |
| `{{nascimento}}` | Data de nascimento |
| `{{idade}}` | Idade |
| `{{data}}` | Data de geração do certificado (dd/mm/aaaa) |

Cada estado pode ter seu próprio template (ou todos podem apontar para o mesmo ID).

## 4. Instalação

### Opção A — Editor do Apps Script (sem instalar nada)

1. Na planilha mestre, abra **Extensões → Apps Script**.
2. Apague o conteúdo de `Código.gs` e crie um arquivo para cada `.js` da pasta
   [`src/`](src/) deste repositório, colando o conteúdo correspondente
   (o `appsscript.json` fica visível em **Configurações do projeto →
   Mostrar arquivo de manifesto "appsscript.json"**).
3. Salve, volte para a planilha e recarregue a página — o menu
   **🎓 Certificados** aparece na barra.
4. Na primeira execução, o Google pedirá autorização para o script acessar
   suas planilhas e o Drive — autorize com a conta que tem acesso às
   planilhas dos estados.

### Opção B — clasp (para versionar via GitHub)

```bash
npm install -g @google/clasp
clasp login
cp .clasp.json.example .clasp.json   # cole o Script ID do projeto no arquivo
clasp push
```

O Script ID fica em **Apps Script → Configurações do projeto**.

## 5. Uso semanal

1. Cole os aprovados por frequência da semana nas abas `Aprovados - {Estado}`.
2. Menu **🎓 Certificados → Processar todos os estados** (ou
   **Processar um estado...** para rodar só um).
3. Ao final, um resumo mostra quantos certificados foram gerados, quantos já
   existiam e quantos alunos não foram encontrados na inscrição.
4. Revise as linhas marcadas `NÃO ENCONTRADO NA INSCRIÇÃO`, corrija o CPF/nome
   e rode de novo — só as pendências são reprocessadas.

Use **🎓 Certificados → Validar configuração** sempre que adicionar um estado
ou trocar um template: ele confere todos os IDs sem gerar nada.

## 6. Detalhes de funcionamento

- **Ordem de busca do aluno**: CPF (só dígitos, com zero à esquerda) →
  e-mail (minúsculas) → nome normalizado (maiúsculas, sem acentos e sem
  espaços duplicados). Se o aluno se inscreveu duas vezes, vale a inscrição
  mais recente.
- **Sem duplicados**: a Base de Dados guarda a chave estado + CPF (ou nome) +
  curso; alunos já registrados recebem status `JÁ GERADO ANTERIORMENTE`.
- **Limite de tempo do Apps Script (~6 min)**: em semanas muito grandes o
  script para com segurança antes do limite e avisa; basta executar o menu de
  novo que ele continua exatamente de onde parou.
- **PDF ou PDF + cópia editável**: por padrão só o PDF fica no Drive. Para
  manter também a cópia em Slides/Docs, mude `MANTER_COPIA_EDITAVEL` para
  `true` em `src/Constants.js`.

## 7. Solução de problemas

| Sintoma | Causa provável |
|---------|----------------|
| "A aba Config não foi encontrada" | A aba de configuração não se chama exatamente `Config`. |
| Muitos `NÃO ENCONTRADO NA INSCRIÇÃO` | Falta CPF na aba de aprovados e os nomes não batem com o Forms. Preencha a coluna CPF. |
| "não foi possível abrir a planilha/pasta/template" | ID errado na aba Config ou a conta que autorizou o script não tem acesso ao arquivo. Use **Validar configuração** para localizar. |
| O menu 🎓 não aparece | Recarregue a planilha; se persistir, confira se os arquivos foram colados no Apps Script e salvos. |
