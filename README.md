# Reparo360

SaaS premium de orçamento visual assistido por IA para oficinas de funilaria, pintura e mecânica.

**MVP visual frontend** — construído com Next.js 15 full-stack (App Router + React 19 + Tailwind 4). Backend, auth real, banco e IA vêm nas próximas fases.

## Stack

- **Next.js 15** (App Router, Turbo, React 19)
- **TypeScript** estrito
- **Tailwind CSS 4** (config via `@theme` no CSS)
- **Zustand** — estado do rascunho de orçamento
- **Framer Motion** — animações
- **Lucide React** — ícones

## Executar localmente

```bash
cd reparo360
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Rotas

| Rota | Descrição |
|------|-----------|
| `/` | Redireciona direto para o dashboard |
| `/dashboard` | Tela "Avaliação de danos": seletor de 204 veículos por marca, troca de cor da pintura e danos clicáveis no 3D |
| `/solicitar` | Fluxo em 5 passos: veículo → peças → danos → fotos → resumo |
| `/apresentacao` | Landing page premium (antiga home) |
| `/login` | Login premium com painel de destaque |

## Estrutura

```
reparo360/
├── app/
│   ├── page.tsx              # Landing
│   ├── layout.tsx
│   ├── globals.css           # Paleta, glassmorphism, animações
│   ├── solicitar/            # Fluxo de orçamento
│   ├── dashboard/            # Damage assessment
│   └── login/
├── components/
│   ├── ui/                   # GlassCard, StatCard, PremiumButton, ConfidenceBadge, StatusPill
│   ├── car/                  # CarSvg — SVG interativo com hotspots
│   ├── budget/               # Steps: veículo, peças, danos, fotos, resumo
│   └── dashboard/            # Sidebar, PartsOverview, GeneralInfo
├── lib/
│   ├── pricing.ts            # Motor ZONE × DAMAGE × SEVERITY
│   ├── car-parts.ts          # Labels e listas
│   ├── mock-data.ts          # Dados de demonstração
│   └── utils.ts              # cn, formatBRL, formatDate
├── stores/
│   └── budget-store.ts       # Zustand — rascunho multi-step
├── types/
│   └── index.ts              # CarPart, DamageType, Budget, etc.
└── public/
    ├── cars/                 # 52 modelos .glb + CREDITS.md (atribuição obrigatória)
    └── images/reference/     # Imagem de referência do design
```

## Modelos 3D

Os 204 veículos em `public/cars/` foram baixados do Sketchfab via API e quase
todos têm licença **CC Attribution** (1 é Attribution-ShareAlike), que permite
uso comercial **desde que o autor seja creditado**. As atribuições estão em
[`public/cars/CREDITS.md`](public/cars/CREDITS.md) — mantenha essa lista visível
no produto (ex.: página "Sobre") e não a remova.

Catálogo em `lib/vehicles.ts`, agrupado por marca (30 marcas). Cobre carros novos
e antigos vendidos no Brasil — de Fusca, Opala, Chevette, Corcel e Brasília até
Onix, HB20, Compass e T-Cross — mais 17 modelos genéricos sem marca (10 extraídos
de um pacote único com `@gltf-transform`).

### Troca de cor da pintura

`lib/car-paint.ts` mapeia, para cada `.glb`, **qual material é a pintura da lataria**.
Isso é necessário porque os modelos vêm de dezenas de autores com convenções de nome
incompatíveis (`carpaint`, `Pintura`, `kuzov`, `Material.001`, `g10m0`). O mapa foi
gerado analisando os arquivos: nome inequívoco tem prioridade; quando o nome não diz
nada, a escolha vem da geometria — o material que cobre quase todo o comprimento e
largura do carro e sobe acima das rodas (o que descarta rodas, aros e assoalho).
195 dos 204 foram resolvidos; os 9 restantes (listados no topo do arquivo) não têm
seletor de cor funcional — o visualizador funciona normalmente, só a repintura não.

Se algum carro recolorir a peça errada, **corrija o nome do material nesse arquivo** —
é a única fonte de verdade usada pelo visualizador. Em modelos marcados
`textured: true` a cor tinge a textura original em vez de substituí-la.

### Tamanho

`public/cars/` ocupa **362 MB** (comprimidos com meshopt via `@gltf-transform` —
eram 1,35 GB antes, -73%; a compressão decodifica no navegador sem CDN externo,
já embutida no `three-stdlib` que o drei usa). Isso não está no `.gitignore` e
conta no deploy — ainda vale considerar mover para um CDN/bucket se o projeto
crescer mais.

## Motor de orçamento

Arquivo `lib/pricing.ts`. Recebe `CarPart` + `DamageType[]`, calcula:

- Mão de obra (`labor_hours × R$ 160`)
- Pintura e peças (tabela por zona)
- Materiais (12% do subtotal)
- Margem da oficina (18%)
- **Faixa de confiança** — % de danos com match direto na tabela

## Identidade visual

Paleta definida em `app/globals.css` via `@theme`:

- `--color-bg: #0B0F17` (fundo)
- `--color-primary: #2563EB` (azul principal)
- `--color-primary-glow: #3B82F6`
- `--color-success / warning / danger`
- Fonte **Inter**, bordas 24px, sombras azuis, glassmorphism leve

## Próximas fases

1. **Backend** — API Routes do Next 15 + Prisma + Postgres (auth, budgets, workshops)
2. **Multi-tenant** — middleware por subdomínio (`oficina.reparo360.com`)
3. **PDF** — `@react-pdf/renderer` server-side com layout A4 horizontal
4. **WhatsApp** — WhatsApp Cloud API para envio de leads
5. **IA** — YOLOv8 + OpenCV via microserviço FastAPI, GPT para descrição técnica
6. **Deploy** — Vercel para o app + Neon/Supabase para Postgres

## Notas de stack

Optamos por **Next.js full-stack** em vez de Next + FastAPI para o MVP: um deploy só, TypeScript ponta-a-ponta, Server Actions substituem boa parte da API. Quando entrar visão computacional, FastAPI volta como microserviço isolado só para IA.
