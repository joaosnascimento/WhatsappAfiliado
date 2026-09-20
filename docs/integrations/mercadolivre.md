# Mercado Livre Brasil

## Fluxo funcional

O sistema não usa DevCenter OAuth nem depende da API de Catálogo MLB.

O fluxo suportado é:

1. Adicione uma oferta em **Ofertas → Mercado Livre — adicionar oferta** colando a URL do anúncio.
2. Na oferta criada, clique em **Gerar / Associar Link de Afiliado**.
3. Abra o gerador oficial do Mercado Livre.
4. Gere o link de afiliado.
5. Volte ao WhatsappAfiliado e cole o link.
6. O backend valida o domínio e associa o link à oferta.
7. Somente ofertas com status AFFILIATE_LINK_READY podem ser publicadas no WhatsApp.

O sistema não armazena cookies, senhas ou sessões do Mercado Livre e não chama endpoints internos não documentados para gerar links.

## Segurança

Links comuns não são publicados como links de afiliado. O endpoint de associação aceita somente URLs HTTPS do Mercado Livre, com preferência por links meli.la.

## Automação

Depois que o link oficial é associado, a geração da mensagem por IA, deduplicação e fila de publicação continuam automáticas.
