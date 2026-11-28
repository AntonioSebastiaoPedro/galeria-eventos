# Funcionalidades do MVP

A Galeria de Eventos é um **álbum digital colaborativo**: o organizador cria a galeria de um evento (casamento, aniversário, baptizado, formatura…), recebe um link e um QR Code exclusivos, e os convidados usam-nos para ver e partilhar fotografias e vídeos — **sem instalar nada e sem criar conta**.

Este documento descreve tudo o que o MVP faz, por interveniente. A arquitectura está em [arquitectura.md](arquitectura.md) e os pedidos à API em [api.md](api.md).

Índice:

1. [Intervenientes](#1-intervenientes)
2. [Organizador](#2-organizador)
3. [Convidado](#3-convidado)
4. [Administração da plataforma](#4-administração-da-plataforma)
5. [Planos e limites](#5-planos-e-limites)
6. [Privacidade e segurança](#6-privacidade-e-segurança)
7. [O que fica para depois do MVP](#7-o-que-fica-para-depois-do-mvp)

---

## 1. Intervenientes

| Interveniente | Conta | O que faz |
|---|---|---|
| **Organizador** | Sim (telemóvel e/ou e-mail, e senha) | Cria e gere as galerias dos seus eventos |
| **Convidado** | Não | Abre a galeria pelo link/QR Code, vê, descarrega e partilha fotografias e vídeos |
| **Administração** (superadmin) | Sim | Vê todos os eventos e contas, muda o plano de cada evento, desactiva contas |

O MVP é pensado primeiro para **particulares** (quem organiza a própria festa). Fotógrafos e empresas de eventos podem usá-lo da mesma forma, criando um evento por cliente.

### Telemóvel primeiro

As fotografias são tiradas e partilhadas no telemóvel, e é também no telemóvel que o organizador acompanha o evento. Por isso, todas as páginas (galeria, área do organizador e administração) são desenhadas primeiro para ecrãs a partir de **360 px** de largura e só depois alargadas para o computador:

- nenhuma página desliza para o lado; o que não cabe (filtros) desliza dentro do próprio controlo;
- navegação por barra inferior, separadores do evento presos no topo, botões e campos com pelo menos 40–44 px de altura e texto de 16 px nos campos (o iOS não faz zoom);
- listas e tabelas passam a cartões no telemóvel (ex.: eventos na administração);
- janelas abrem como painéis de baixo para cima; a barra inferior e os botões flutuantes respeitam a zona do gesto do iPhone;
- instalável no ecrã inicial (PWA), com a barra de estado do iOS fora do conteúdo.
- o logótipo "Galeria", no canto superior esquerdo, leva sempre à página inicial (quem tem sessão vê lá "Os meus eventos").

As páginas são verificadas num navegador com 360 px (Android) e 390 px (iPhone).

---

## 2. Organizador

### 2.1 Conta

| Funcionalidade | Onde | Regras |
|---|---|---|
| Criar conta | `/criar-conta` | Nome, **telemóvel ou e-mail** (à escolha; telemóvel por omissão) e senha (mín. 8 caracteres). Entra logo e vai para "Novo evento". |
| Entrar | `/entrar` | Um só campo **"Telemóvel ou e-mail"** e a senha. A sessão fica lembrada no navegador. Ao fim de 5 tentativas erradas (por conta + IP) espera 1 minuto. A mensagem de erro é a mesma para conta inexistente e senha errada. |
| Recuperar a senha | `/recuperar-senha` | **Com e-mail**: envia uma ligação para `/definir-senha` (a resposta é sempre igual, exista ou não a conta). **Com telemóvel**: não há SMS no MVP; a página leva ao WhatsApp de apoio (`SUPPORT_PHONE`) e a administração cria uma senha temporária (ver secção 4). |
| Alterar dados e senha | `/conta` | Nome, telemóvel, e-mail (pelo menos um dos dois) e senha (pede a senha actual). |

**Telemóvel**: muitos organizadores não têm ou não usam e-mail, por isso a conta pode ter só telemóvel. Os números angolanos escrevem-se como se quiser — `923 456 789`, `+244 923 456 789`, `00244923456789` — e guardam-se sempre como `+244923456789`; não se podem repetir. O campo mostra o indicativo `+244`; um número de outro país escreve-se começando por `+`. O e-mail continua opcional: quem o tem recupera a senha sozinho e recebe os avisos por e-mail.
| Terminar sessão | Menu lateral / topo | — |

Uma conta desactivada pela administração perde logo a sessão e não volta a entrar.

### 2.2 Criar um evento

`/eventos/novo` — campos:

| Campo | Obrigatório | Notas |
|---|---|---|
| Nome do evento | Sim | Até 120 caracteres. Ex.: "Aniversário da Dicla" |
| Tipo | Sim | Aniversário, Casamento, Baptizado, Formatura, Evento empresarial, Festa, Outro |
| Data | Sim | |
| Mensagem para os convidados | Não | Aparece no topo da galeria |
| Quem pode ver | Sim | **Privada** (por omissão) ou **Pública** — ver 2.4 |
| Código de acesso | Não | Só nas privadas. 4 a 32 caracteres, guardado cifrado (hash) |
| Aceitar envios dos convidados | — | Ligado por omissão |
| Aceitar vídeos | — | Ligado por omissão (só tem efeito se o plano incluir vídeos) |
| Aprovar antes de publicar | — | Desligado por omissão (moderação automática) |

Ao criar, a plataforma gera:

- um **endereço** `/g/<slug>`, com o nome do evento e um sufixo aleatório (ex.: `/g/aniversario-da-dicla-k3x9qa`), que não se adivinha a partir do nome;
- uma **chave secreta** de 32 caracteres (só usada nas privadas);
- o **QR Code** com esse endereço.

Cada evento novo começa no plano **Gratuito**. Cada organizador só pode ter **1 evento gratuito** de cada vez (configurável, `FREE_EVENTS_PER_USER`); para criar outro, um dos eventos tem de passar a um plano pago.

### 2.3 Lista de eventos

`/eventos` mostra os eventos do organizador (mais recentes primeiro) com capa, tipo e data, se é privada, se está desactivada, o plano, o número de fotografias e vídeos e quantos esperam aprovação.

### 2.4 Público ou privado

| | Pública | Privada |
|---|---|---|
| Quem vê | Qualquer pessoa com o link | Quem tem o link/QR Code (com a chave) **ou** o código de acesso |
| Link e QR Code | `/g/<slug>` | `/g/<slug>?k=<chave>` |
| Aparece em pesquisas/listas | Não (a plataforma não lista galerias) | Não |

Na privada, ao entrar pelo link a chave é retirada da barra de endereço: se o convidado copiar o endereço do navegador, não leva a chave. A entrada fica guardada na sessão do navegador (ver [arquitectura](arquitectura.md#acesso-às-galerias)).

**Criar um novo link** (Resumo → "O link chegou a quem não devia?"): gera outra chave. O link antigo e os QR Codes já impressos deixam de funcionar e quem entrou com a chave antiga tem de entrar de novo.

### 2.5 Resumo do evento (`/eventos/:id`)

- **Link e QR Code**: ver o QR e o link, **enviar o link** (painel com WhatsApp, Instagram, Facebook e Copiar link — ver 3.5; nas galerias privadas avisa que o link leva a chave) e descarregar o **cartão para imprimir** em **PDF (A4)** ou **imagem PNG**. O cartão leva o tipo e a data do evento, o nome, o QR Code e a instrução "Aponte a câmara do telemóvel para o código". É desenhado no navegador.
- **Cartões para as mesas (A4)**: o organizador indica quantos cartões quer (1 a 180, com atalhos 9, 18, 27 e 45) e descarrega um único PDF com **9 cartões por folha A4, em 3 filas de 3**, com linhas de corte tracejadas. Antes de descarregar vê quantas folhas vai imprimir (ex.: 20 cartões = 3 folhas, a última com 2). Cada cartão mede cerca de 6,3 × 9 cm, com um QR de uns 4 cm. Tudo é gerado no navegador.
- **Participação**: número de fotografias e vídeos publicados, de participantes (quem enviou pelo menos um conteúdo), conteúdos por aprovar, envios por dia (últimos 14 dias com envios) e quem mais partilhou (top 5).
- **Plano**: o que inclui, espaço usado (barra com percentagem) e **Mudar de plano** (ver 2.10).
- **Descarregar tudo (ZIP)**: ver 2.9.

Os números actualizam-se sozinhos quando chegam envios (tempo real, via Reverb).

### 2.6 Conteúdos e moderação (`/eventos/:id/conteudos`)

Lista de tudo o que chegou, com filtros:

- estado: **Tudo**, **Por aprovar**, **Publicados**, **A preparar** (miniaturas a ser geradas);
- tipo: fotografias ou vídeos.

Cada conteúdo mostra a miniatura, quem enviou, quando, o tamanho e a legenda. Acções:

| Acção | Efeito |
|---|---|
| Abrir | Visualizador em ecrã inteiro; o botão Descarregar dá o **original** |
| Aprovar | Só nos que esperam aprovação; passam a aparecer a todos |
| Apagar | Apaga o conteúdo e os ficheiros (original, versão reduzida e miniatura). Liberta o espaço. Não se desfaz |
| Seleccionar vários | Aprovar ou apagar em bloco (até 200 de uma vez) |

O organizador também pode **enviar fotografias e vídeos**, pela própria galeria ("Enviar na galeria"). O que ele envia é publicado logo, mesmo com moderação manual, e aparece assinado com o nome dele.

**Moderação automática** (por omissão): o que os convidados enviam aparece logo depois de processado. **Moderação manual**: só aparece depois de aprovado; o convidado que enviou vê o seu conteúdo com a etiqueta "À espera de aprovação".

### 2.7 Convidados (`/eventos/:id/convidados`)

Lista de quem entrou na galeria (nome escrito pelo convidado, quantas fotografias e vídeos enviou, quando foi visto), com pesquisa por nome.

**Bloquear** um convidado: deixa de conseguir ver a galeria e de enviar a partir daquele navegador. Opcionalmente, **apaga tudo o que ele enviou**. **Desbloquear** devolve o acesso.

Limitação conhecida: como os convidados não têm conta, quem limpar os dados do navegador numa galeria pública volta a entrar como convidado novo. Nas privadas, para cortar o acesso a todos, crie um novo link (2.4).

### 2.8 Definições (`/eventos/:id/definicoes`)

- Todos os campos da criação (2.2). O código de acesso só muda se for escrito um novo; há uma opção para o remover.
- **Imagem de capa**: JPEG, PNG ou WebP; é reduzida para 2048 px e gravada sem metadados. Aparece no topo da galeria e na lista de eventos.
- **Encerrar envios**: desligar "Aceitar envios dos convidados". A galeria continua visível e os convidados veem o aviso "O organizador fechou os envios".
- **Desactivar temporariamente a galeria**: os convidados veem "Esta galeria está temporariamente indisponível" e os links dos ficheiros deixam de funcionar. Nada é apagado; reactiva-se no mesmo sítio. O organizador continua a ver tudo.
- **Apagar o evento**: pede para escrever o nome do evento. Apaga a galeria, todos os ficheiros e os ZIP. Não se desfaz.

### 2.9 Descarregar tudo em ZIP

Nos planos **Premium** e **Exclusivo**. "Preparar o ZIP" põe o pedido na fila; a página acompanha o progresso e mostra o botão de descarregar quando estiver pronto.

- Leva os **originais** de todos os conteúdos **publicados**, em `fotografias/` e `videos/`, com nomes `0001-<nome-do-convidado>.jpg` por ordem de envio.
- Um pedido de cada vez por evento; pedir outro depois cria um ZIP actualizado.
- O ZIP fica disponível **7 dias** e depois é apagado automaticamente.
- Só o organizador (ou a administração) o descarrega.

Nos outros planos, cada conteúdo descarrega-se individualmente.

### 2.10 Mudar de plano

No cartão do plano, no resumo do evento:

1. **Mudar de plano** mostra só os planos acima do actual, com o **valor a pagar: a diferença** entre os preços (ex.: de Básico, 5 000 Kz, para Premium, 12 000 Kz, paga 7 000 Kz; do Gratuito paga o preço inteiro).
2. Ao escolher, aparecem as instruções: **enviar o valor por Multicaixa Express** para o número da Galeria (`PAYMENT_EXPRESS_NUMBER`, com o titular), com um botão para copiar o número.
3. **Anexar o comprovativo** — obrigatório: captura de ecrã ou PDF do Multicaixa Express (JPG, PNG, WebP ou PDF, até 10 MB). As fotografias do iPhone (HEIC) são convertidas para JPEG no telemóvel.
4. **Enviar pedido**: o cartão passa a mostrar "Pedido do plano X enviado", com o valor, a data, **Ver comprovativo** e **Cancelar pedido**. A administração recebe um e-mail.
5. A administração confirma o pagamento (secção 4): o plano muda **na hora** e o cartão mostra "Plano X activado". Se recusar, o cartão mostra o motivo e pode pedir de novo.

Regras: um pedido pendente de cada vez por evento; o plano só muda depois de confirmado; uma aprovação nunca baixa o plano (se entretanto o evento já subiu mais, fica). O organizador com e-mail recebe o resultado por e-mail; sem e-mail, vê-o no evento. Sem número de Multicaixa Express configurado, a aplicação não aceita pedidos e mostra o WhatsApp de apoio.

---

## 3. Convidado

### 3.1 Entrar na galeria

O convidado lê o QR Code (ou abre o link). Não precisa de conta nem de instalar nada; a página funciona em qualquer navegador recente e pode ser instalada como aplicação (PWA).

| Situação | O que vê |
|---|---|
| Galeria pública | A galeria |
| Privada, link/QR com a chave | Entra directamente (a chave sai da barra de endereço) |
| Privada sem a chave | Nome e data do evento e "Esta galeria é privada"; campo para o **código de acesso**, se o organizador o definiu |
| Código errado | "Código de acesso incorrecto." Máx. 20 tentativas em 10 minutos por IP |
| Link com chave antiga | "Este link já não é válido. Peça ao organizador o link actualizado ou o código de acesso." |
| Galeria desactivada | "Esta galeria está temporariamente indisponível." |
| Convidado bloqueado | "O organizador retirou-lhe o acesso a esta galeria." |
| Endereço errado | "Galeria não encontrada" |

### 3.2 Ver a galeria

- Cabeçalho com a capa, o nome, a data, o tipo, a mensagem do organizador e o número de fotografias e vídeos.
- **Grelha estilo Pinterest** (colunas), com a proporção real de cada fotografia (a grelha não salta ao carregar) e carregamento contínuo ao descer a página.
- Filtros **Tudo / Fotos / Vídeos** e ordenação **Recentes / Antigas** (no telemóvel, a ordem é um botão por cima da grelha).
- **Partilhar galeria** (galerias públicas): o link da galeria no painel de partilha (ver 3.5). Nas privadas não aparece: o link sem a chave não deixaria ninguém entrar.
- **Seleccionar**: toca-se nas fotografias e vídeos para os marcar (até 30 de cada vez) e, na barra de baixo, **Descarregar** ou **Partilhar** todos de uma vez (ver 3.5).
- Os vídeos mostram a capa e a duração.
- A grelha actualiza-se sozinha a cada 30 segundos (chegam fotografias novas durante a festa).
- O organizador abre a galeria na mesma aba ("Ver galeria", no cabeçalho do evento) e vê-a como os convidados; o botão **"Voltar à gestão"**, no topo, leva-o de volta ao resumo desse evento.

### 3.3 Visualizador em ecrã inteiro

- Fotografia em alta resolução (aparece primeiro a miniatura desfocada, depois a versão boa).
- Vídeos tocam ali mesmo (com avanço/recuo).
- Navegação com setas, teclado (← →, Esc) ou a deslizar o dedo.
- Legenda, quem partilhou e há quanto tempo.
- **Descarregar**: fotografias em alta resolução (até 2048 px) **sem metadados** (sem localização GPS); vídeos sem metadados.
- **Partilhar**: a própria fotografia ou vídeo, no painel de partilha (ver 3.5).
- **Apagar**: só no que o próprio convidado enviou.

### 3.4 Adicionar fotografias e vídeos

Botão **"Adicionar fotos e vídeos"** (no topo e, no telemóvel, o botão flutuante **"Adicionar"**):

1. **Nome ou pseudónimo** — obrigatório para convidados (recomendação do produto: saber quem partilhou, sem verificar). Fica lembrado no telemóvel e na galeria.
2. **Legenda** — opcional (até 280 caracteres), aplica-se ao que for escolhido a seguir.
3. **Escolher fotografias e vídeos** (vários de uma vez, da galeria do telemóvel) ou **Tirar fotografia** (abre a câmara).
4. Cada ficheiro aparece numa lista com a sua **barra de progresso**; são enviados dois de cada vez. Pode fechar o painel e continuar a ver a galeria enquanto envia.
5. Depois de enviado, o ficheiro aparece na grelha com "A preparar…" e, segundos depois, publicado (ou "À espera de aprovação", na moderação manual).

Antes de enviar, no próprio telemóvel:

- fotografias **HEIC/HEIF** (iPhone) e outros formatos são convertidas para JPEG;
- fotografias acima do limite são reduzidas;
- vídeos acima do limite, ou vídeos numa galeria que não os aceita, são recusados logo (sem gastar dados).

Erros de rede podem ser repetidos com o botão "Tentar outra vez"; ficheiros recusados pelas regras não.

Limites e mensagens (todos verificados também no servidor):

| Regra | Mensagem |
|---|---|
| Tipos aceites: JPEG, PNG, WebP, MP4, MOV, WebM, 3GP (pelo conteúdo do ficheiro, não pela extensão) | "Este tipo de ficheiro não é aceite…" |
| Fotografia até 25 MB (`MEDIA_PHOTO_MAX_MB`) | "Cada fotografia pode ter no máximo 25 MB." |
| Vídeo até 300 MB (`MEDIA_VIDEO_MAX_MB`) | "Cada vídeo pode ter no máximo 300 MB." |
| Plano sem vídeos | "O plano deste evento não inclui vídeos." |
| Organizador desligou os vídeos | "O organizador não permite vídeos nesta galeria." |
| Espaço do plano esgotado | "A galeria atingiu o limite de armazenamento do plano. Fale com o organizador." |
| Número de fotografias do plano esgotado | "A galeria atingiu o limite de 100 fotografias do plano…" |
| Envios fechados | "O organizador fechou os envios para esta galeria." |
| Mais de 150 envios por hora (anti-spam) | "Enviou muitos ficheiros na última hora…" |
| Ficheiro corrompido / que não se consegue ler | Fica marcado como falhado e é apagado |

### 3.5 Partilhar nas redes e guardar vários de uma vez

O painel **Partilhar** abre-se no link do evento (organizador, 2.5), na galeria pública, num item do visualizador e na selecção. Tem **WhatsApp, Instagram e Facebook**, **Copiar link** e **Outras apps** (a partilha do telemóvel).

| O que se partilha | WhatsApp | Facebook | Instagram |
|---|---|---|---|
| Link (evento ou galeria) | Abre o WhatsApp com a mensagem e o link, para escolher a conversa | Abre a partilha do Facebook com o link | O Instagram não aceita links vindos de sites: o link é copiado e o Instagram abre nas mensagens, para o colar (numa mensagem ou story) |
| Fotografias e vídeos, no telemóvel | Envia os **próprios ficheiros** | Idem | Idem |
| Fotografias e vídeos, no computador | Envia o link da galeria | Envia o link da galeria | Explica que tem de descarregar e publicar na aplicação |

Nenhuma rede aceita ficheiros por um endereço: no telemóvel, os ficheiros vão pela **partilha do sistema**. Ao abrir o painel, os ficheiros são preparados (com progresso, "A preparar 3 de 10…"); ao tocar na rede, abre a lista de aplicações do telemóvel e a pessoa escolhe a mesma rede. Limites: 30 itens (o máximo do WhatsApp) e 200 MB por vez (vídeos grandes, menos de cada vez).

**Descarregar vários**: no Android e no computador, cada ficheiro é descarregado (o navegador pode pedir autorização para várias transferências). No **iPhone**, os descarregamentos iriam para a app Ficheiros, não para as Fotos: abre-se o painel **Guardar no telemóvel**, que usa a partilha do sistema — escolhendo "Guardar imagens", ficam nas Fotos.

---

## 4. Administração da plataforma

`/admin` (só contas `superadmin`):

- **Visão geral**: organizadores, eventos, eventos activos, conteúdos e espaço total usado.
- **Eventos**: todos os eventos, com pesquisa por nome do evento, endereço, nome, telemóvel ou e-mail do organizador; conteúdos e espaço de cada um; **mudar o plano** directamente (ofertas ou correcções). O nome abre a gestão do evento (a administração pode gerir qualquer evento).
- **Pedidos** (com o número de pendentes; o e-mail de aviso abre `/admin?separador=pedidos`): os pedidos de mudança de plano **Por confirmar / Aprovados / Recusados**, com o evento, os planos (de → para), o **valor a confirmar**, o organizador (o telemóvel abre o WhatsApp), o **comprovativo** e:
  - **Aprovar** — depois de confirmar no Multicaixa Express que o valor chegou; o plano do evento muda logo;
  - **Recusar** — com o motivo (obrigatório), que o organizador vê no evento;
  - **Avisar no WhatsApp** — nos pedidos já tratados, mensagem pronta para o organizador.
- **Contas**: pesquisa por nome, telemóvel (com ou sem espaços) ou e-mail, número de eventos, **desactivar/reactivar** e **Repor senha** (não a própria). Repor senha cria uma **senha temporária** de 10 caracteres, mostrada uma única vez, com botões para copiar e **enviar por WhatsApp**; a pessoa entra e muda-a em Conta.
- **Telescope** (`/telescope`): diagnóstico; em produção só regista excepções e jobs falhados.

O superadmin cria-se na linha de comandos: `make prod-artisan cmd="app:create-superadmin o.teu@email.ao 'O Teu Nome'"`.

**Pagamentos no MVP**: por **Multicaixa Express**, confirmados à mão pela administração com o comprovativo (secção 2.10). A confirmação automática (pagamento por referência) fica para depois.

---

## 5. Planos e limites

Pagamento **por evento** (sem mensalidades), em modelo freemium. Valores de `backend/config/plans.php` — propostas iniciais para testar o mercado, não preços validados.

| Plano | Preço | Espaço | Fotografias | Vídeos | ZIP |
|---|---|---|---|---|---|
| Gratuito | 0 Kz | 1 GB | até 100 | Não | Não |
| Básico | 5.000 Kz | 2 GB | sem limite | Sim | Não |
| Premium | 12.000 Kz | 10 GB | sem limite | Sim | Sim |
| Exclusivo | 25.000 Kz | 30 GB | sem limite | Sim | Sim |

Todos os planos têm link e QR Code (são a forma principal de levar os convidados à galeria). O "mural em tempo real" e a "personalização" do plano Exclusivo ficam para depois do MVP.

- O espaço conta o tamanho dos **originais** (as miniaturas e versões reduzidas não contam). Conteúdos apagados ou falhados libertam o espaço.
- Os limites são verificados com o evento bloqueado na base de dados: vários convidados a enviar ao mesmo tempo não ultrapassam o limite.
- Ao baixar de plano, o que já existe fica; só os novos envios são recusados se ultrapassarem o novo limite.

---

## 6. Privacidade e segurança

- **Ficheiros nunca públicos**: ficam num disco privado e só saem por **URLs assinadas e temporárias** (6 a 12 horas). Sem a assinatura, o servidor responde 403.
- **Chaves com entropia**: a chave das privadas tem ~190 bits; o endereço tem um sufixo aleatório. O código de acesso é guardado como hash.
- **Sem metadados para os convidados**: a localização GPS e outros dados das câmaras não chegam aos outros convidados (fotografias reduzidas e vídeos regravados sem metadados). O organizador recebe os originais das fotografias.
- **Nomes aleatórios**: os ficheiros são gravados com nomes aleatórios; o nome original só fica na base de dados (visível ao organizador).
- **Tipo verificado pelo conteúdo**, não pela extensão; imagens gigantes (> 120 MP) são recusadas para proteger o servidor.
- **Limites de pedidos**: entrada e registo (30/min), código de acesso (20 em 10 min), envios (60/min por IP e 150/hora por convidado), galeria (240/min).
- **Retenção**: os conteúdos ficam enquanto o evento existir; o organizador apaga conteúdos ou o evento inteiro quando quiser (com os ficheiros). Os ZIP apagam-se ao fim de 7 dias; os registos de envios falhados ao fim de 1 dia.
- **Autorização para partilhar**: a galeria lembra que, ao partilhar, o convidado confirma que pode publicar as imagens e que as pessoas fotografadas concordam.
- Cabeçalhos de segurança no nginx (HSTS, `frame-ancestors 'none'`, `nosniff`…), TLS obrigatório em produção, backups cifráveis com `age`.

---

## 7. O que fica para depois do MVP

Previsto no documento do produto e deliberadamente fora desta versão:

| Funcionalidade | Notas |
|---|---|
| Mensagens dos convidados (livro de recordações) | Nova tabela `event_messages` |
| Mural em tempo real (projector) | O canal Reverb por evento já existe |
| Convites digitais | |
| Galeria pós-evento: apresentação automática, álbum, "mais populares" | |
| Secções/categorias (cerimónia, recepção…) | |
| Organização por inteligência artificial | |
| Pagamentos confirmados automaticamente | Hoje a administração confirma o comprovativo do Multicaixa Express |
| Recuperar a senha por SMS | Hoje, contas sem e-mail pedem ajuda por WhatsApp |
| Armazenamento S3 e envio directo com URLs pré-assinadas | O disco já é configurável (`MEDIA_DISK`); ver [arquitectura](arquitectura.md#armazenamento) |
| Versões comprimidas dos vídeos | Hoje o vídeo é regravado sem recomprimir |
| Planos para profissionais (fotógrafos, salões, decoração) | |
