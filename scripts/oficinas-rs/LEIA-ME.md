# Lista de oficinas do Rio Grande do Sul

Gera um CSV com **nome e celular** de oficinas ativas no RS, a partir dos
dados abertos de CNPJ da Receita Federal.

```bash
bash scripts/oficinas-rs/coletar.sh
```

Saída em `scripts/oficinas-rs/saida/oficinas-rs.csv`:

| nome | telefone | municipio | especialidade | porte | cnpj | email |
|------|----------|-----------|---------------|-------|------|-------|

## Por que esta fonte, e não raspagem do Google Maps

Raspar Google Maps, Telelistas ou similares viola os termos de uso desses
serviços e produz dados sem procedência auditável. A base de CNPJ da Receita é
**pública, oficial, gratuita e completa** — e, principalmente, traz o **CNAE**,
que é a classificação oficial da atividade econômica. Isso elimina o palpite:
não é preciso deduzir pelo nome se "Auto Center Silva" é oficina, porque o
código da atividade diz exatamente o que a empresa faz.

CNAEs usados (ajustáveis via variável `CNAES`):

| Código | Atividade |
|--------|-----------|
| 4520001 | Manutenção e reparação mecânica |
| 4520002 | Lanternagem, funilaria e pintura |
| 4520003 | Manutenção e reparação elétrica |
| 4520004 | Alinhamento e balanceamento |
| 4520005 | Lavagem, lubrificação e polimento |
| 4520006 | Borracharia |
| 4520007 | Instalação e reparação de acessórios |
| 4520008 | Capotaria |

Para focar só no público do Reparo360 (funilaria, pintura e mecânica):

```bash
CNAES=4520001,4520002,4520003 bash scripts/oficinas-rs/coletar.sh
```

## Como o celular é separado do fixo

No Brasil, celular tem **9 dígitos e começa em 9**; fixo tem 8 e começa em 2–5.
A base não tem campo de tipo, então essa regra é a única forma confiável. Só são
aceitos DDDs do RS: **51, 53, 54, 55**. Quando `telefone_1` é fixo, o script
tenta `telefone_2`.

## Custo de execução

A base não é particionada por estado, então é preciso baixar tudo e filtrar:

- Estabelecimentos: 10 arquivos, **~5 GB**
- Empresas (para razão social): 10 arquivos, **~1,4 GB**

O script faz *streaming*: baixa uma parte, filtra pelo pipe, apaga e segue. O
pico de disco é de um arquivo (~2 GB na maior parte), não dos 6,4 GB somados.
Conte de 1 a 3 horas dependendo da conexão. É seguro interromper e rodar de novo.

Se o token do compartilhamento da Receita mudar, o script avisa e explica como
obter o novo — exporte em `RFB_SHARE_TOKEN`.

---

# ⚠️ Antes de enviar qualquer mensagem

Montar a lista é legal. **Disparar mensagem para ela não é automaticamente.**
Dois problemas distintos:

## 1. LGPD

O número de celular de uma oficina MEI é, na prática, o telefone pessoal do
dono — é **dado pessoal** (Lei 13.709/2018, art. 5º, I). O fato de constar de
base pública **não libera o uso para qualquer finalidade**: o art. 7º, §3º
mantém as obrigações de finalidade legítima, boa-fé e direitos do titular.

Para prospecção B2B, a base legal viável é o **legítimo interesse** (art. 7º,
IX), e ela exige:

- finalidade concreta e informada no primeiro contato;
- avaliação de impacto documentada (o *LIA* — art. 10, §3º);
- identificação clara de quem está falando e de onde veio o contato;
- **opt-out imediato e respeitado** (art. 18, §2º), com registro do descadastro.

Sem esses itens registrados, o disparo fica exposto a sanção da ANPD e a ação
individual — e você conhece esse terreno melhor que eu.

## 2. WhatsApp: o bloqueio prático

Este é o obstáculo que costuma passar batido. A **Política de Mensageria do
WhatsApp Business** exige *opt-in prévio* para mensagem de marketing. Disparo
frio em lote, mesmo por WhatsApp Business API com template aprovado, tende a
gerar denúncia por spam — e a consequência é **banimento do número**, às vezes
em poucas horas. Não é uma questão de contornar limite técnico: é o modelo de
negócio da plataforma.

### Alternativas que funcionam

| Canal | Precisa opt-in? | Observação |
|-------|-----------------|------------|
| Ligação humana | Não | Mais eficaz em oficina; permite qualificar na hora |
| SMS transacional | Regra mais branda | Custo por envio, exige remetente identificado |
| E-mail (campo `email` do CSV) | Legítimo interesse | Menor risco de bloqueio; use ferramenta com descadastro |
| WhatsApp | **Sim** | Só depois que a oficina iniciar a conversa |
| Anúncio "click-to-WhatsApp" | Não | A oficina inicia a conversa → opt-in natural |

A rota mais segura e a que costuma converter melhor: **anúncio geolocalizado
com click-to-WhatsApp**, ou ligação da equipe comercial usando o CSV como
roteiro. Nos dois casos o contato parte da oficina ou de um humano
identificado, e o problema de opt-in desaparece.

## Recomendação

Use este CSV como **base de inteligência comercial** — quantas oficinas de
funilaria existem em Caxias, quais municípios estão descobertos, onde abrir
primeiro — e não como lista de disparo automático. O dado é excelente para
decidir onde investir; é péssimo como gatilho de spam.
