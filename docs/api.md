# API

Todas as rotas estão em `backend/routes/api.php`, com o prefixo `/api`. Respostas em JSON; erros de validação com `422` e `{ message, errors: { campo: [mensagem] } }` (mensagens em português).

**Autenticação**: sessão por cookie (Laravel Sanctum, modo *stateful*). Antes de um pedido que altera dados, o cliente obtém o cookie `XSRF-TOKEN` com `GET /sanctum/csrf-cookie` e envia-o no cabeçalho `X-XSRF-TOKEN` (ver `frontend/src/api.ts`). Os convidados também têm sessão, sem conta.

Listas paginadas devolvem o formato do Laravel: `{ data, current_page, last_page, per_page, total, … }`; aceitam `page` e `per_page` (10–100).

Legenda: 🔓 público · 👤 convidado (sessão) · 🔑 organizador autenticado · 🛡 superadmin.

## Conta

| Método | Rota | | Descrição |
|---|---|---|---|
| POST | `/register` | 🔓 | `name, email, password, password_confirmation` → cria organizador e inicia sessão (201) |
| POST | `/login` | 🔓 | `email, password, remember?` → utilizador |
| POST | `/forgot-password` | 🔓 | `email` → envia ligação (resposta sempre igual) |
| POST | `/reset-password` | 🔓 | `email, token, password, password_confirmation` |
| GET | `/me` | 🔑 | `{ id, name, email, role }` |
| PUT | `/me` | 🔑 | `name, email` |
| POST | `/change-password` | 🔑 | `current_password, password, password_confirmation` |
| POST | `/logout` | 🔑 | |

Limite: 30 pedidos/minuto por IP (`throttle:30,1,auth`); login: 5 tentativas erradas por e-mail+IP.

## Planos

| Método | Rota | | Descrição |
|---|---|---|---|
| GET | `/plans` | 🔓 | `[{ key, name, price_kz, storage_mb, max_photos, videos, zip }]` |

## Eventos (organizador)

Um evento de outro organizador responde `404` (a administração acede a todos).

| Método | Rota | Descrição |
|---|---|---|
| GET | `/events` | Eventos do organizador |
| POST | `/events` | Criar: `title, event_type, event_date, description?, visibility?, access_code?, upload_enabled?, allow_videos?, moderation?` (201) |
| GET | `/events/{id}` | Detalhe |
| PUT | `/events/{id}` | Alterar os mesmos campos + `status` (`active`/`disabled`) e `remove_access_code` |
| DELETE | `/events/{id}` | Apagar tudo. Corpo: `confirm` = nome do evento |
| POST | `/events/{id}/cover` | `cover` (ficheiro JPEG/PNG/WebP) |
| DELETE | `/events/{id}/cover` | Remover capa |
| POST | `/events/{id}/regenerate-key` | Nova chave (o link antigo deixa de funcionar) |
| GET | `/events/{id}/qr` | `{ url, qr_png }` (`qr_png` é um data URI PNG de 800 px) |
| GET | `/events/{id}/stats` | `counts, guests, blocked_guests, contributors, top_contributors[], by_day[]` |

`event_type`: `birthday`, `wedding`, `baptism`, `graduation`, `corporate`, `party`, `other`. `visibility`: `private` (omissão) ou `public`. `moderation`: `auto` (omissão) ou `manual`.

Objecto evento:

```json
{
  "id": 1, "title": "Aniversário da Dicla", "slug": "aniversario-da-dicla-k3x9qa",
  "description": "…", "event_type": "birthday", "event_date": "2026-11-25",
  "visibility": "private", "has_access_code": true, "upload_enabled": true,
  "allow_videos": true, "moderation": "auto", "status": "active",
  "plan": { "key": "premium", "name": "Premium", "price_kz": 12000, "storage_mb": 10240, "max_photos": null, "videos": true, "zip": true },
  "cover_url": "/api/events/1/cover?v=…&expires=…&signature=…",
  "guest_url": "https://…/g/aniversario-da-dicla-k3x9qa?k=<chave>",
  "owner": { "id": 2, "name": "…", "email": "…" },
  "counts": { "photos": 128, "videos": 24, "pending": 3, "processing": 0, "storage_used": 812345678, "storage_limit": 10737418240 },
  "created_at": "…"
}
```

## Conteúdos e moderação (organizador)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/events/{id}/media` | Paginado (48). Filtros: `status` (`pending`, `approved`, `processing`, `failed`; sem filtro = todos menos falhados), `type` (`photo`/`video`), `guest_id` |
| POST | `/events/{id}/media` | Enviar como organizador: `file`, `caption?` (publicado sem moderação) |
| POST | `/events/{id}/media/bulk` | `action` (`approve`/`delete`), `ids[]` (até 200; só os deste evento) |
| POST | `/media/{id}/approve` | Aprovar um conteúdo `pending` |
| DELETE | `/media/{id}` | Apagar conteúdo e ficheiros |

Objecto conteúdo (organizador) = objecto da galeria + `guest_id, by_organizer, original_name, file_size, original_url`.

## Convidados (organizador)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/events/{id}/guests` | Paginado; `search` pelo nome. `{ id, name, blocked, photos, videos, last_seen_at, created_at }` |
| POST | `/guests/{id}/block` | `remove_media?` (apaga tudo o que enviou) |
| POST | `/guests/{id}/unblock` | |

## ZIP (organizador)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/events/{id}/export` | Último pedido ou `null` |
| POST | `/events/{id}/export` | Pede um ZIP (201). `403` se o plano não incluir ZIP. Se já houver um em curso, devolve-o |
| GET | `/exports/{id}/download` | Descarrega o ZIP (`ready`); `404` se já expirou |

Objecto: `{ id, status: queued|processing|ready|failed, file_size, items, error, created_at, expires_at }`.

## Galeria dos convidados

Prefixo `/g/{slug}`. Limite geral: 240 pedidos/minuto por IP.

| Método | Rota | | Descrição |
|---|---|---|---|
| GET | `/g/{slug}` | 🔓 | Cabeçalho da galeria e estado do acesso (ver abaixo) |
| POST | `/g/{slug}/access` | 🔓 | `key` (do link/QR) ou `code`. Admite o navegador e devolve o mesmo que o GET. Limite: 20 em 10 min |
| PUT | `/g/{slug}/me` | 👤 | `name` — nome/pseudónimo do convidado |
| GET | `/g/{slug}/media` | 👤 | Paginado (30). `type` (`photo`/`video`), `sort` (`new`/`old`). Aprovados + os do próprio convidado ainda a preparar/por aprovar |
| POST | `/g/{slug}/media` | 👤 | `file`, `name` (obrigatório para convidados), `caption?` (201). Limites: 60/min por IP e 150/hora por convidado |
| DELETE | `/g/{slug}/media/{id}` | 👤 | Só o que o próprio enviou (o organizador apaga qualquer um) |

`GET /g/{slug}`:

```json
{
  "slug": "…", "title": "…", "event_type": "wedding", "event_date": "2026-11-15",
  "visibility": "private", "has_access_code": true,
  "access": "granted",            // granted | needs_access | blocked | disabled
  "is_manager": false,
  "guest": { "name": "Tia Rosa" },
  // só com access = granted:
  "description": "…", "cover_url": "…", "upload_enabled": true, "moderation": "auto",
  "photos": 128, "videos": 24, "storage_full": false,
  "rules": { "photo_max_mb": 25, "video_max_mb": 300, "videos": true, "photo_types": ["image/jpeg", "image/png", "image/webp"], "video_types": ["video/mp4", "video/quicktime", "video/webm", "video/3gpp"], "caption_max": 280 }
}
```

Erros das rotas 👤: `403` (privada sem acesso, bloqueado, envios fechados), `423` (galeria desactivada), `422` (validação/limites do plano), `429` (limites de pedidos).

Objecto conteúdo (galeria):

```json
{
  "id": 13, "type": "photo", "status": "approved", "width": 2048, "height": 1536, "duration": null,
  "caption": "Que noite!", "author": "Ana", "created_at": "…", "mine": false, "can_delete": false,
  "thumb_url": "/api/media/13/thumb?expires=…&signature=…",
  "preview_url": "/api/media/13/preview?…", "stream_url": null, "download_url": "/api/media/13/download?…"
}
```

## Ficheiros (URLs assinadas)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/media/{id}/{variante}` | `thumb`, `preview`, `stream`, `download`, `original`. Só com assinatura válida (`403` sem ela). Suporta `Range` |
| GET | `/events/{id}/cover` | Capa do evento, assinada |

As URLs vêm sempre nas respostas da API; não se constroem no cliente. Ver [arquitectura](arquitectura.md#entrega-dos-ficheiros).

## Administração

| Método | Rota | | Descrição |
|---|---|---|---|
| GET | `/admin/overview` | 🛡 | `organizers, events, active_events, events_by_plan, media, videos, storage_used` |
| GET | `/admin/events` | 🛡 | Paginado; `search` (evento, endereço, organizador), `plan` |
| PUT | `/admin/events/{id}/plan` | 🛡 | `plan` |
| GET | `/admin/users` | 🛡 | Paginado; `search` |
| POST | `/admin/users/{id}/disable` | 🛡 | Não a própria conta |
| POST | `/admin/users/{id}/enable` | 🛡 | |

## Tempo real

Canal privado `events.{id}` (autorização em `POST /broadcasting/auth`, só para quem gere o evento). Evento `.media.changed` com `{ id, status }`, onde `status` é `processing`, `approved`, `pending`, `failed` ou `deleted`.
