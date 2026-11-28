# Arquitectura

Monorepo com o **backend** (API Laravel) e o **frontend** (SPA React) separados, a mesma stack, organização e infraestrutura do projecto `unia-presence`. As funcionalidades estão descritas em [funcionalidades.md](funcionalidades.md).

## Visão geral

```
                    ┌──────────── VPS ────────────────────────────────────────────┐
 Telemóvel  ──TLS──▶│ Caddy (anfitrião) ──▶ nginx (contentor "web")               │
 (convidado,        │                         ├─ /            SPA (frontend/dist) │
  organizador)      │                         ├─ /api, /sanctum, /broadcasting    │
                    │                         │      └─▶ PHP-FPM (app)            │
                    │                         └─ /app (WebSocket) ─▶ Reverb       │
                    │                                                             │
                    │  queue (miniaturas, vídeos, ZIP, avisos) ─┐                 │
                    │  scheduler (limpezas diárias)             ├─ volume storage │
                    │  app ─────────────────────────────────────┘   (ficheiros)   │
                    │  PostgreSQL (dados)    Redis (sessões, cache, fila)         │
                    └─────────────────────────────────────────────────────────────┘
```

| Componente | Tecnologia |
|---|---|
| Frontend | React 19 + TypeScript, Vite 8, Tailwind CSS 4, TanStack Query, React Router 7, PWA (vite-plugin-pwa), oxlint |
| Backend | Laravel 13 (PHP 8.4), Sanctum (sessão por cookie), Reverb (WebSocket), Telescope |
| Base de dados | PostgreSQL 17 |
| Sessões, cache e filas | Redis 7 (predis) |
| Imagens | GD (com JPEG/WebP e EXIF) |
| Vídeos | FFmpeg / ffprobe |
| QR Code | endroid/qr-code |
| E-mail | Mailpit (desenvolvimento), Resend (produção) |
| Deploy | Docker Compose + Caddy na VPS (TLS) |

Não há microserviços: é um monólito organizado por módulos.

## Estrutura do repositório

```
compose.yml            serviços comuns (app, queue, scheduler, reverb, nginx, postgres, redis)
compose.dev.yml        desenvolvimento: código montado, portas no host, node (Vite) e mailpit
compose.prod.yml       produção: restart, imagem "web" com a SPA compilada
Makefile               comandos do dia a dia (ver docs/comandos-make.md)
docker/php/Dockerfile  imagens: frontend (build) → vendor → app (PHP-FPM) → web (nginx + SPA)
docker/nginx/          default.conf (dev), prod.conf, security-headers.conf
docker/caddy/          bloco do Caddy da VPS
scripts/               deploy.sh, backup.sh, restore.sh
backend/               API Laravel
frontend/              SPA React
docs/                  esta documentação
```

### Backend (`backend/`)

```
app/Models/                  User, Event, EventGuest, EventMedia, EventExport
app/Modules/Eventos/         Plans, PlanRequests (mudança de plano), GalleryAccess (quem vê o quê), EventPresenter, EventQrCode
app/Modules/Conteudos/       MediaRules, MediaUrls (URLs assinadas), MediaPresenter,
                             ImageProcessor (GD), VideoProcessor (FFmpeg),
                             Actions/StoreMedia, Actions/DeleteMedia,
                             Jobs/ProcessMedia, Events/MediaChanged (Reverb)
app/Modules/Exportacoes/     Jobs/BuildEventZip
app/Modules/Notificacoes/    Notifications/ResetPassword, PlanRequestSubmitted (à administração), PlanRequestReviewed (ao organizador)
app/Http/Controllers/        AuthController, EventController, EventMediaController, EventGuestController,
                             EventExportController, MediaFileController, Gallery/GalleryController,
                             Admin/AdminController
config/plans.php             planos por evento
config/media.php             limites e tipos de ficheiros, tamanhos das miniaturas, validade das URLs
routes/api.php               toda a API (ver docs/api.md)
routes/channels.php          canal privado events.{id}
routes/console.php           tarefas agendadas
tests/Feature/               testes (PHPUnit, PostgreSQL)
```

### Frontend (`frontend/src/`)

```
api.ts            cliente da API (cookies + CSRF) e upload() com progresso (XHR)
auth.tsx          sessão do organizador
uploader.ts       fila de envios (2 em paralelo, progresso, repetir, cancelar)
image.ts          conversão HEIC→JPEG e redução de fotografias no telemóvel
qrCard.ts         cartão do QR Code em PNG/PDF e folhas A4 com 9 cartões (desenhados no navegador)
share.tsx         painel Partilhar (WhatsApp, Instagram, Facebook) e Guardar no telemóvel (iPhone)
shareFiles.ts     descarregar os ficheiros para a partilha do sistema; descarregar vários de uma vez
echo.ts           Reverb (carregado só na área do organizador)
components.tsx    Layout, botões, campos, modais…
pagination.tsx    listas paginadas (páginas no computador, scroll infinito no telemóvel)
pages/            Landing, autenticação, organizer/*, admin/*, gallery/*
```

Rotas da interface:

| Rota | Página |
|---|---|
| `/` | Apresentação e planos |
| `/entrar`, `/criar-conta`, `/recuperar-senha`, `/definir-senha` | Conta do organizador |
| `/eventos`, `/eventos/novo` | Eventos do organizador |
| `/eventos/:id` (+ `/conteudos`, `/convidados`, `/definicoes`) | Gestão de um evento |
| `/conta` | Dados e senha |
| `/admin` | Administração |
| `/g/:slug` | Galeria dos convidados (pública) |

## Modelo de dados

```
users ─────────< events ─────────< event_media >───────── event_guests
  id               id                 id                    id
  name             user_id            event_id              event_id
  email (opcional) title              event_guest_id ───────┘
  phone (opcional) slug (único)       user_id (organizador)  name
  password
  role             description        guest_name             access_version
  disabled_at      event_type         media_type             blocked_at
                   event_date         status                 ip_address
                   cover_path         original_path          last_seen_at
                   visibility         original_name
                   access_key         mime_type            event_exports
                   access_version     file_size              id, event_id, user_id
                   access_code (hash) preview_path           status, path
                   upload_enabled     thumbnail_path         file_size, items, error
                   allow_videos       width, height
                   moderation         duration
                   status             caption
                   plan               processed_at
```

- `users`: organizadores (`role = organizer`) e administração (`superadmin`). Os convidados **não** têm conta. Cada conta tem **telemóvel, e-mail ou os dois** (ambos únicos): `phone` guarda-se no formato internacional (`+244923456789`, ver `User::normalizePhone`). As notificações por e-mail só vão para quem tem e-mail (`routeNotificationForMail`).
- `plan_requests`: pedidos de mudança de plano de um evento — `from_plan`, `to_plan`, `amount_kz` (a diferença), `status` (`pending`, `approved`, `rejected`, `cancelled`), comprovativo (`proof_path`, `proof_name`, `proof_mime`, `proof_size`), `admin_note` (motivo da recusa), `reviewed_by`, `reviewed_at`. A lógica está em `App\Modules\Eventos\PlanRequests`: um pendente de cada vez (com o evento bloqueado, `FOR UPDATE`), a aprovação muda o plano na mesma transacção e nunca o baixa.
- `events`: a galeria e as suas definições. `access_key` vai no link/QR das privadas; `access_version` aumenta quando se cria um novo link.
- `event_guests`: cada navegador que entrou numa galeria (corresponde à tabela `event_accesses` do documento do produto). Guarda o nome, o bloqueio e a versão da chave com que entrou.
- `event_media`: cada fotografia ou vídeo, com o estado (`processing` → `approved`/`pending`, ou `failed`) e os caminhos do original e das versões geradas. Os ficheiros nunca vão para a base de dados.
- `event_exports`: pedidos de ZIP.

O espaço usado de um evento é a soma de `file_size` dos conteúdos não falhados; não há contador separado que possa ficar dessincronizado.

## Acesso às galerias

`App\Modules\Eventos\GalleryAccess` decide, para cada pedido:

1. **Organizador do evento ou superadmin** (sessão autenticada): vê sempre, mesmo com a galeria desactivada; os envios dele são publicados sem moderação.
2. **Galeria desactivada**: mais ninguém entra (`423`).
3. **Convidado bloqueado**: `403`.
4. **Privada**: só com um `EventGuest` na sessão com a `access_version` actual. Obtém-se com `POST /api/g/{slug}/access` com a `key` (do link/QR) ou o `code`.
5. **Pública**: qualquer pessoa vê; o `EventGuest` é criado no primeiro envio (ou quando escreve o nome).

O convidado é reconhecido pela **sessão Laravel** (cookie `HttpOnly`, guardada no Redis, 14 dias — `SESSION_LIFETIME`). O Sanctum só inicia a sessão para pedidos vindos do próprio frontend (`SANCTUM_STATEFUL_DOMAINS`), o que também dá protecção CSRF a todos os pedidos que alteram dados.

## Envio e processamento

```
Telemóvel                       app (PHP-FPM)                          queue
─────────                       ─────────────                          ─────
HEIC→JPEG / reduzir (image.ts)
POST /api/g/{slug}/media ──▶  1. acesso (GalleryAccess), envios abertos,
 (1 ficheiro, XHR c/ progresso)  nome do convidado, limite por hora
                               2. tipo pelo conteúdo (finfo), tamanho, vídeos
                                  permitidos (plano + definição)
                               3. grava o original: events/{id}/originals/<uuid>.<ext>
                               4. transacção com o evento bloqueado (FOR UPDATE):
                                  espaço e nº de fotografias do plano → cria
                                  event_media (processing)
                               5. ProcessMedia na fila ─────────────▶ fotografia: GD abre, endireita (EXIF),
◀── 201 (status processing)                                            grava preview 2048px e thumb 480px (JPEG,
                                                                       sem metadados), largura/altura
grelha actualiza a cada 4 s                                            vídeo: ffprobe (duração), regrava sem
enquanto houver "A preparar"                                           metadados + faststart (sem recomprimir),
                                                                       capa 1280px + thumb
                                                                       → approved (moderação auto / organizador)
                                                                         ou pending (moderação manual)
                                                                       → falha: failed + ficheiros apagados
                                                                       MediaChanged ─▶ Reverb ─▶ organizador
```

Notas:

- Um ficheiro por pedido: o progresso é exacto, um erro não estraga os outros, e cada pedido fica abaixo dos limites do PHP/nginx (`docker/php/uploads.ini`, `client_max_body_size 320m`, Caddy `max_size 320MB`).
- Se o original for gravado mas os limites do plano falharem, o ficheiro é apagado logo.
- O job tem 2 tentativas; se ambas falharem (`failed()`), o conteúdo é marcado `failed` e os ficheiros apagados — não fica "a preparar" para sempre.
- O documento do produto sugere URLs pré-assinadas para envio directo ao Object Storage. No MVP, com o armazenamento local do `unia-presence`, o envio passa pelo PHP. Ver [Armazenamento](#armazenamento).

## Entrega dos ficheiros

Os ficheiros estão num disco **privado** (`storage/app/private`, volume Docker `storage`). Só saem pela rota `GET /api/media/{media}/{variante}`, protegida por **URL assinada** (`signed:relative`), gerada por `MediaUrls` apenas para quem pode ver o conteúdo:

| Variante | Convidado | Organizador (`m=1` na assinatura) |
|---|---|---|
| `thumb` | miniatura 480 px | idem |
| `preview` | fotografia 2048 px / capa do vídeo | idem |
| `stream` | vídeo (com `Range`, para avançar) | idem |
| `download` | fotografia 2048 px sem metadados; vídeo | **original** |
| `original` | — | original |

- A validade arredonda a blocos de 6 horas (`url_ttl_hours`): a mesma imagem tem a mesma URL durante o bloco e o navegador usa a cache; uma URL dura entre 6 e 12 horas.
- Sem `m=1`, a rota recusa conteúdos de galerias desactivadas e conteúdos falhados.
- A capa do evento sai da mesma forma (`events.cover`).
- As respostas usam `BinaryFileResponse` (suporta `Range`, necessário para os vídeos no iOS).

## Tempo real

`MediaChanged` é emitido (pela fila) no canal privado `events.{id}` sempre que um conteúdo chega, fica pronto, falha, é aprovado ou apagado. A área do organizador (`EventShell`) ouve o canal e actualiza o resumo, os conteúdos e as estatísticas. O canal só autoriza quem gere o evento (`routes/channels.php`). O aviso não leva dados dos convidados, só o id e o estado.

Os convidados não usam WebSocket: a grelha consulta a API a cada 30 s (4 s enquanto têm envios a preparar). O cliente do Reverb só é descarregado na área do organizador.

## ZIP

`POST /api/events/{id}/export` cria um `event_exports` (`queued`) e põe `BuildEventZip` na fila (timeout 30 min; o worker corre com `--timeout=1800`). O job junta os originais aprovados com `ZipArchive` sem recomprimir (`CM_STORE`), grava em `exports/{event_id}/<uuid>.zip` e marca `ready`. A interface consulta o estado a cada 3 s. O scheduler apaga os ZIP com mais de 7 dias.

## Tarefas agendadas (`routes/console.php`)

| Tarefa | Frequência |
|---|---|
| `limpar-zip`: apaga ZIP com mais de `export_ttl_days` dias | diária |
| `limpar-envios-falhados`: apaga registos `failed` com mais de 1 dia | diária |
| `limpar-telescope`: `telescope:prune --hours=168` | diária |

## Partilha nas redes

O navegador não consegue entregar ficheiros a uma rede social por um endereço. `share.tsx`:

- **links**: WhatsApp com `https://wa.me/?text=`, Facebook com `https://www.facebook.com/sharer/sharer.php?u=`; o Instagram não tem endereço de partilha, por isso copia-se o link e abre-se `instagram.com/direct/inbox/`;
- **ficheiros** (telemóvel): `navigator.share({ files })` (Web Share API nível 2). Os ficheiros são descarregados **quando o painel abre** (`fetchFiles`, com as URLs assinadas `download`): o navegador só abre a partilha logo a seguir a um toque, e esperar pelo download depois do toque fazia-a falhar. Limites de 30 ficheiros e 200 MB;
- **computador sem partilha de ficheiros**: WhatsApp e Facebook recebem o link da galeria.

A pré-visualização do link no Facebook e no WhatsApp mostra o título e a imagem gerais da aplicação: a SPA não gera etiquetas Open Graph por galeria.

## Armazenamento

O MVP usa o disco local do Laravel num volume Docker (como o `unia-presence`), partilhado entre `app`, `queue` e `scheduler`, e incluído nos backups (`scripts/backup.sh`). Os comprovativos de pagamento ficam em `events/{id}/plan-requests/` (apagados com o evento) e só saem por `GET /api/plan-requests/{id}/proof`, autenticado, com `Content-Security-Policy: sandbox`.

O disco é configurável (`MEDIA_DISK`, `config/media.php`) e todo o acesso passa por `Storage::disk(MediaRules::disk())`. Para passar a um Object Storage compatível com S3:

1. instalar `league/flysystem-aws-s3-v3` e configurar o disco `s3`;
2. em `MediaUrls`, devolver `Storage::temporaryUrl()` em vez da rota assinada;
3. nos processadores (GD/FFmpeg), copiar o original para um ficheiro temporário antes de o abrir (hoje usam `$disk->path()`);
4. opcionalmente, envio directo com URLs pré-assinadas e confirmação posterior no backend.

## Segurança

- Sessão por cookie `HttpOnly` (Sanctum stateful) com CSRF; `SESSION_SECURE_COOKIE=true` em produção.
- `trustProxies` para os limites por IP funcionarem atrás do nginx/Caddy.
- Limites de pedidos por rota (ver [api.md](api.md)) e de tentativas de entrada (5 por e-mail+IP).
- Validação do tipo pelo conteúdo; nomes de ficheiro aleatórios; imagens > 120 MP recusadas; `X-Content-Type-Options: nosniff` nos ficheiros.
- A gestão de um evento alheio responde `404` (não revela que existe).
- Contas desactivadas perdem a sessão no pedido seguinte (`EnsureAccountEnabled`).
- Cabeçalhos de segurança no nginx (`docker/nginx/security-headers.conf`).
- Contentores PHP sem root (`USER www-data`).
- Backups com `umask 077`, opcionalmente cifrados com `age`.

## Testes

`backend/tests/Feature` (PHPUnit, base PostgreSQL `galeria_eventos_test`): autenticação, eventos, galeria (acesso público/privado, chave, código, bloqueio, envios, limites do plano, tipos, processamento real de fotografias e de vídeos com FFmpeg, URLs assinadas), moderação, ZIP e administração. Correm com `make test`.
