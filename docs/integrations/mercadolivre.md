# Mercado Livre — automação pelo navegador

O WhatsappAfiliado usa o Portal de Afiliados do Mercado Livre por meio de um navegador Chromium automatizado. O fluxo oficial documentado pelo Mercado Livre é abrir o Gerador de Links, informar a URL de um produto, gerar o link e divulgá-lo.

## Fluxo automático

1. O usuário clica em **Conectar Mercado Livre**.
2. O WhatsappAfiliado abre um Chromium isolado.
3. O usuário faz login normalmente no Mercado Livre.
4. A sessão autenticada é capturada e armazenada de forma protegida no registro da conta.
5. O scheduler usa as palavras-chave configuradas nos destinos.
6. O navegador pesquisa produtos no Mercado Livre.
7. Para cada produto elegível, o navegador abre o Gerador de Links e informa a URL.
8. O link afiliado retornado é validado e salvo.
9. A oferta entra no pipeline: IA → deduplicação → fila → WhatsApp.
10. Se a sessão expirar ou o portal mudar, a oferta não é publicada sem link afiliado válido e a conta passa para reconexão.

## Segurança

- Senha nunca é coletada pelo WhatsappAfiliado.
- A sessão não é colocada em .env.
- O estado da sessão fica dentro de credentials_encrypted, cifrado pelo repositório persistente.
- O sistema salva o link afiliado, não a senha.
- Não há dependência do OAuth DevCenter nem da API de catálogo para a geração do link.

## Requisitos locais

O projeto usa Playwright para controlar Chromium. Depois de instalar as dependências:

`npm run browser:install`

Em servidor sem interface gráfica, o processo usa Chromium headless para manutenção e geração. A primeira autenticação precisa ocorrer em ambiente com navegador visível ou usando uma sessão previamente autenticada.

## Resiliência

O provider possui seletores alternativos para o campo de URL e o botão de geração. Se o Portal mudar, o sistema falha fechado: nenhuma oferta sem link afiliado confirmado segue para publicação.
