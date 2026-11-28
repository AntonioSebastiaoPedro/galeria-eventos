# Galeria de Eventos

Álbum digital colaborativo de eventos. O organizador cria a galeria de um casamento, aniversário, baptizado ou formatura e recebe um **link e um QR Code exclusivos**. Os convidados apontam a câmara do telemóvel, abrem a galeria e **partilham as suas fotografias e vídeos**, sem instalar nada e sem criar conta. No fim, o organizador tem num só lugar o álbum feito por todos.

Este repositório contém o **MVP**.

## Documentação

| Documento | Conteúdo |
|---|---|
| [docs/funcionalidades.md](docs/funcionalidades.md) | Todas as funcionalidades, por interveniente (organizador, convidado, administração), planos, limites e privacidade |
| [docs/arquitectura.md](docs/arquitectura.md) | Stack, estrutura, modelo de dados, acesso às galerias, envio e processamento, URLs assinadas, tempo real, ZIP |
| [docs/api.md](docs/api.md) | Todas as rotas da API |
| [docs/comandos-make.md](docs/comandos-make.md) | Comandos do Makefile, portas, desenvolvimento, deploy e backups |

## Stack

Monorepo com o backend e o frontend separados, com a mesma stack, organização e infraestrutura do projecto `unia-presence`:

- **backend/** — Laravel 13 (PHP 8.4), Sanctum, Reverb, Telescope, PostgreSQL 17, Redis, GD e FFmpeg
- **frontend/** — React 19 + TypeScript, Vite, Tailwind CSS 4, TanStack Query, PWA
- **docker/**, `compose*.yml`, `Makefile`, `scripts/` — Docker Compose (dev/prod), nginx, Caddy, deploy e backups

## Começar

Requisitos: Docker com Compose e `make`.

```bash
make setup
```

Abrir http://localhost:25373 e entrar com o telemóvel `923 000 001` (ou `organizador@galeria.local`) e a senha `password`, ou criar uma conta. A galeria de demonstração está em "Os seus eventos" → evento → "Ver galeria".

As portas são diferentes das do `unia-presence` (interface 25373, API 29680, PostgreSQL 25639…) — ver [docs/comandos-make.md](docs/comandos-make.md#portas-desenvolvimento).

```bash
make test    # testes do backend
make lint    # Pint, oxlint e TypeScript
make deploy  # na VPS
```

## MVP

Incluído: contas de organizadores com telemóvel ou e-mail, criar e editar eventos, galerias públicas ou privadas (chave no link/QR e código de acesso), link e QR Code exclusivos (com cartão para imprimir), envio de fotografias e vídeos sem conta, visualização em grelha e em ecrã inteiro, moderação (automática ou manual, apagar, bloquear convidados), estatísticas, descarregar individualmente e em ZIP, seleccionar e partilhar no WhatsApp, Instagram e Facebook, limites de armazenamento por plano, mudança de plano com pagamento por Multicaixa Express (comprovativo confirmado pela administração) e área de administração.

Fica para depois: mensagens dos convidados, mural em tempo real, convites digitais, álbuns automáticos, categorias, IA, pagamentos confirmados automaticamente e SMS. Ver [docs/funcionalidades.md](docs/funcionalidades.md#7-o-que-fica-para-depois-do-mvp).
