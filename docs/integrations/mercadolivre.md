# Integração Mercado Livre Brasil — Documentação Técnica e de Afiliados

Esta documentação detalha a arquitetura, autenticação, obtenção de produtos e tratamento de links de afiliado do **Mercado Livre Brasil**.

---

## 1. Distinção Crítica: API Pública vs. Programa de Afiliados

> [!IMPORTANT]
> **A API pública/DevCenter do Mercado Livre NÃO é o Programa de Afiliados.**
> 
> * **API do DevCenter (`api.mercadolibre.com`)**: Focada em vendedores, anúncios, catálogo, pedidos e compradores. Ela permite consultar produtos públicos, dados de itens, categorias e vendedores, mas **não gera links rastreáveis de comissão de afiliados por padrão**.
> * **Programa de Afiliados do Mercado Livre (`afiliados.mercadolivre.com.br`)**: É uma plataforma separada com seu próprio sistema de atribuição (`meli.la` e parâmetros de rastreamento `matt_tool`).
> 
> **Regra de Segurança da Plataforma:**
> O sistema **nunca** substitui a URL comum por um link de afiliado sem registrar ambos. Se a conta conectada não possuir permissão de API direta de afiliado, a oferta permanece em `VALIDATED` e a plataforma exige a importação do link oficial (`meli.la`) antes da publicação automática.

---

## 2. Credenciais e DevCenter

1. Acesse o **[Mercado Livre Developers](https://developers.mercadolivre.com.br/)**.
2. Crie uma nova aplicação no DevCenter.
3. Configure os seguintes dados:
   * **Nome da Aplicação:** `Automação Afiliados WhatsApp`
   * **Redirect URI:** `https://SEU_DOMINIO/api/auth/mercadolivre/callback`
   * **Escopos:** `read`, `offline_access`
4. Obtenha as variáveis de ambiente:
   * `MERCADOLIVRE_CLIENT_ID` (App ID)
   * `MERCADOLIVRE_CLIENT_SECRET` (Secret Key)
   * `MERCADOLIVRE_REDIRECT_URI`

---

## 3. Fluxo de Autenticação OAuth 2.0

O fluxo segue rigorosamente o padrão OAuth 2.0 com Authorization Code Grant:

```
Usuário
  ↓
Clica em "Conectar Mercado Livre"
  ↓
GET /api/auth/mercadolivre/url
  ↓
Redireciona para https://auth.mercadolivre.com.br/authorization?response_type=code&client_id={CLIENT_ID}&redirect_uri={REDIRECT_URI}
  ↓
Usuário faz login no Mercado Livre e concede consentimento
  ↓
Mercado Livre redireciona para MERCADOLIVRE_REDIRECT_URI com `?code=AUTH_CODE`
  ↓
Backend troca o código por tokens em POST https://api.mercadolibre.com/oauth/token
  ↓
Recebe { access_token, refresh_token, user_id, expires_in }
  ↓
Armazena com segurança na conta do workspace
```

### Renovação de Token (Refresh Token)

O `access_token` expira a cada 6 horas. O `MercadoLivreApiClient` e `MercadoLivreOAuthService` renovam automaticamente antes ou durante requisições usando:

```http
POST https://api.mercadolibre.com/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&client_id={CLIENT_ID}&client_secret={CLIENT_SECRET}&refresh_token={REFRESH_TOKEN}
```

---

## 4. Endpoints Oficiais Utilizados

| Operação | Endpoint | Método | Descrição |
|---|---|---|---|
| Busca de Itens | `/sites/MLB/search?q={termo}&limit={N}` | GET | Pesquisa no catálogo oficial do Brasil |
| Detalhes do Item | `/items/{ITEM_ID}` | GET | Obtém preços, fotos, frete e atributos |
| Itens em Lote | `/items?ids={ID1,ID2}` | GET | Detalha múltiplos itens simultaneamente |
| Categoria | `/categories/{CATEGORY_ID}` | GET | Árvore de categorias |
| Vendedor | `/users/{SELLER_ID}` | GET | Reputação e nome da loja oficial |
| Dados do Usuário | `/users/me` | GET | Validação do token ativo e permissões |

### Campos Armazenados e Normalizados

* `item_id` (ex: `MLB3419082341`)
* `site_id` (`MLB`)
* `title`
* `permalink` (URL original do produto)
* `thumbnail` / `pictures`
* `price` (preço atual à vista)
* `original_price` (preço anterior quando informado pela API)
* `condition` (`new` ou `used`)
* `seller` (reputação e nickname)
* `shipping` (`free_shipping`, modalidade de logística)
* `official_store` (loja oficial quando presente)

---

## 5. Regras de Links de Afiliado e Segurança

1. **Anti-Scraping / Anti-Fraude:** O sistema não realiza web scraping com credenciais do usuário.
2. **Ciclo de Estados da Oferta:**
   * `DISCOVERED`: Produto localizado na API de busca.
   * `VALIDATED`: Dados confirmados, preço e estoque checados.
   * `AFFILIATE_LINK_READY`: Link de afiliado oficial (`meli.la` ou link rastreado do portal de afiliados) validado e associado.
   * `READY_TO_PUBLISH` / `SCHEDULED` / `PUBLISHED`: Apenas itens com link de afiliado confirmado podem ser disparados.
3. **Validação de Formato:** A URL de afiliado deve conter o domínio oficial e os parâmetros de atribuição; links comuns idênticos ao permalink são terminantemente recusados.
