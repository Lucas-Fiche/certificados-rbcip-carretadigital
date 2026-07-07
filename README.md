# Certificados Carreta Digital

Automação do fluxo semanal de certificados do projeto Carreta Digital, feita em
**Google Apps Script**. Em uma única execução, para os 9 estados, o script:

1. Lê os alunos **aprovados por frequência** (lista que você preenche a partir da chamada, com Semana, Escola, Curso e Nome);
2. Busca cada um **pelo nome** na **planilha de inscrições** do estado (Google Forms) — havendo mais de uma inscrição com o mesmo nome, vale sempre a mais recente;
3. **Gera o certificado em PDF** a partir de um template do Google Slides ou Docs, salvando na pasta do Drive do estado (substitui o Autocrat);
4. Grava os dados do aluno + link do certificado na aba **Base de Dados**;
5. Marca o status de cada aluno na lista de aprovados (`CERTIFICADO GERADO`, `NÃO ENCONTRADO NA INSCRIÇÃO`, `JÁ GERADO ANTERIORMENTE`) e, quando o mesmo nome tem mais de uma inscrição com CPF/e-mail diferentes, registra um aviso na coluna `Observações`.

Rodar de novo é sempre seguro: alunos já processados são pulados e nunca há
certificado duplicado.

---

## 1. Estrutura da planilha mestre

Crie um Google Sheets novo (a "planilha mestre") com as abas abaixo.

### Aba `Config` — uma linha por estado

| Estado | ID Planilha de Inscrições | Aba de Inscrições | ID Planilha de Aprovados | Aba de Aprovados | ID da Pasta no Drive | ID do Template | Ativo |
|--------|---------------------------|-------------------|--------------------------|------------------|----------------------|----------------|-------|
| Maranhão | 1AbC...xyz              | Respostas ao formulário 1 | 1JkL...mno | Aprovados - Maranhão | 1DeF...uvw | 1GhI...rst | SIM |
| Roraima  | ...                     |                   | 1JkL...mno | Aprovados - Roraima  | ...        | ...        | SIM |

- **ID Planilha de Inscrições**: o trecho da URL entre `/d/` e `/edit` da planilha gerada pelo Forms.
- **Aba de Inscrições**: opcional; se vazio, usa a primeira aba da planilha.
- **ID Planilha de Aprovados**: opcional; ID da planilha onde está a lista de
  aprovados por frequência. Se vazio, o script procura a aba na própria
  planilha mestre.
- **Aba de Aprovados**: opcional; se vazio, usa `Aprovados - {Estado}`.
- **ID da Pasta no Drive**: o trecho final da URL da pasta onde os PDFs devem ser salvos.
- **ID do Template**: ID do arquivo Google Slides ou Docs do certificado.
- **Ativo**: `SIM` ou `NÃO` — permite pausar um estado sem apagar a linha.

### Lista de aprovados por frequência (preenchida a partir da chamada)

| Semana | Escola | Curso | Nome |
|--------|--------|-------|------|
| 12/05 a 16/05 | E.E. Santos Dumont | PC Gamer | Maria da Silva |

- **Nome** é obrigatório e é a chave da busca: escreva-o o mais parecido
  possível com o que o aluno digitou na inscrição (maiúsculas/minúsculas,
  acentos e espaços extras não importam; abreviações e sobrenomes faltando
  importam). Se houver mais de uma inscrição com o mesmo nome, o script usa
  sempre **a mais recente** (pelo Carimbo de data/hora).
- **Curso** é o que sai no certificado (o curso da chamada, não o da
  inscrição, que os alunos às vezes preenchem errado).
- **Semana** e **Escola** vão para a Base de Dados e podem aparecer no
  certificado via placeholders.
- Colunas opcionais: **Estado** (permite juntar todos os estados numa aba
  única — cada linha da Config processa só as linhas do seu estado),
  **CPF** e **E-mail** (quando preenchidos, têm prioridade sobre o nome
  na busca).
- As colunas **Status**, **Link do Certificado** e **Observações** são
  criadas e preenchidas automaticamente pelo script.

Você pode organizar como preferir: uma planilha própria só para os aprovados
(com uma aba por estado, ou uma aba única com a coluna Estado) apontada pela
coluna "ID Planilha de Aprovados" da Config, ou abas dentro da própria
planilha mestre.

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
| `{{nome}}` | Nome Formatado (da inscrição) |
| `{{curso}}` | Curso da lista de aprovados (da chamada) |
| `{{estado}}` | Estado (coluna da aba Config) |
| `{{semana}}` | Semana da lista de aprovados |
| `{{escola}}` | Escola da lista de aprovados |
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

1. Preencha os aprovados por frequência da semana (Semana, Escola, Curso,
   Nome) na lista de aprovados.
2. Menu **🎓 Certificados → Processar todos os estados** (ou
   **Processar um estado...** para rodar só um).
3. Ao final, um resumo mostra quantos certificados foram gerados, quantos já
   existiam, quantos alunos não foram encontrados e quantos foram gerados
   com aviso de homônimo.
4. Revise as linhas marcadas `NÃO ENCONTRADO NA INSCRIÇÃO` (grafia do nome
   diferente da inscrição), corrija e rode de novo — só as pendências são
   reprocessadas. Linhas com texto na coluna `Observações` merecem uma
   conferida, mas o certificado já foi gerado.

Use **🎓 Certificados → Validar configuração** sempre que adicionar um estado
ou trocar um template: ele confere todos os IDs sem gerar nada.

## 6. Detalhes de funcionamento

- **Busca do aluno**: pelo nome normalizado (maiúsculas, sem acentos e sem
  espaços duplicados). Havendo mais de uma inscrição com o mesmo nome, vale
  sempre a **mais recente** pelo Carimbo de data/hora. Se CPF ou e-mail
  estiverem preenchidos na lista de aprovados, eles têm prioridade por
  serem únicos.
- **Aviso de homônimo**: se o mesmo nome aparece nas inscrições com
  CPFs/e-mails diferentes entre si, podem ser dois alunos distintos. O
  certificado sai normalmente com os dados da inscrição mais recente, e a
  coluna `Observações` recebe um aviso para conferência. Para forçar um
  aluno específico, preencha o CPF ou e-mail na linha e reprocesse.
- **Semana, Escola e Curso** do certificado e da Base de Dados vêm da lista
  de aprovados (o que o aluno de fato frequentou); os dados pessoais vêm
  da inscrição.
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
| Muitos `NÃO ENCONTRADO NA INSCRIÇÃO` | O nome anotado na chamada está abreviado ou faltando sobrenome em relação ao que o aluno digitou no Forms. Complete o nome e rode de novo. |
| Aviso de homônimo em `Observações` | O mesmo nome tem inscrições com CPF/e-mail diferentes (possíveis alunos distintos). O certificado saiu com a inscrição mais recente; para trocar, preencha o CPF ou E-mail da linha e reprocesse. |
| "não foi possível abrir a planilha/pasta/template" | ID errado na aba Config ou a conta que autorizou o script não tem acesso ao arquivo. Use **Validar configuração** para localizar. |
| O menu 🎓 não aparece | Recarregue a planilha; se persistir, confira se os arquivos foram colados no Apps Script e salvos. |
