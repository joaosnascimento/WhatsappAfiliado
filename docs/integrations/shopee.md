# Integração Shopee Brasil — Documentação Técnica da Affiliate Open API

Esta documentação detalha a arquitetura, autenticação, cálculo de assinatura criptográfica, operações GraphQL e rastreamento com SubIds da **Shopee Affiliate Open API para o Brasil**.

---

## 1. Distinção: Shopee Open Platform vs. Shopee Affiliate Open API

> [!IMPORTANT]
> **A Shopee possui duas APIs distintas:**
> 
> * **Shopee Open Platform (`partner.shopeemobile.com`)**: Destinada a vendedores e gerenciamento de pedidos/estoque de lojas.
> * **Shopee Affiliate Open API (`open-api.affiliate.shopee.com.br/graphql`)**: Exclusiva para parceiros afiliados autorizados. Ela permite buscar ofertas com comissão confirmada, gerar short links oficiais com SubIds e obter relatórios de conversão e comissão.
>
> Esta plataforma integra diretamente com a **Shopee Affiliate Open API Brasil**.

---

## 2. Credenciais Necessárias

1. Acesse o portal **Shopee Afiliados Brasil** e registre-se na **Affiliate Open Platform**.
2. Na seção de desenvolvedor/API de afiliados, obtenha:
   * `SHOPEE_AFFILIATE_APP_ID`: Identificador numérico da sua aplicação de afiliado.
   * `SHOPEE_AFFILIATE_SECRET`: Chave secreta compartilhada para cálculo da assinatura criptográfica.
3. Configure as variáveis em `.env` ou na tela **Afiliados** da plataforma:
   ```env
   SHOPEE_AFFILIATE_APP_ID="123456789"
   SHOPEE_AFFILIATE_SECRET="sua_chave_secreta_aqui"
   ```

---

## 3. Autenticação por Assinatura SHA-256

A Shopee Affiliate Open API **não utiliza OAuth bearer tokens**. Cada requisição deve ser assinada individualmente via hash SHA-256 no header `Authorization`.

### Fórmula da Assinatura:
```
Factor = AppId + Timestamp + Payload + Secret
Signature = SHA256_HEX(Factor)
```

Onde:
* `AppId`: O ID da aplicação.
* `Timestamp`: Tempo Unix atual em segundos (ex: `1710000000`).
* `Payload`: O corpo exato (minificado/cru) do JSON da requisição GraphQL.
* `Secret`: A chave secreta da aplicação.

### Formato do Header HTTP:
```http
Authorization: SHA256 Credential={AppId}, Timestamp={Timestamp}, Signature={Signature}
Content-Type: application/json
```

O `ShopeeSignatureService` implementa essa assinatura e valida integridade via comparação segura de buffer (`timingSafeEqual`).

---

## 4. Endpoints e Queries GraphQL

O endpoint único para o Brasil é:
`https://open-api.affiliate.shopee.com.br/graphql`

### 4.1. Busca de Ofertas (`productOfferV2`)
Permite pesquisar ofertas aprovadas com filtros avançados:
* `keyword`: Termo de busca (ex: "Pokémon", "Fone Bluetooth").
* `minPrice` / `maxPrice`: Faixa de preço.
* `minDiscount`: Desconto percentual mínimo.
* `minCommissionRate`: Taxa mínima de comissão do afiliado (ex: 8%).
* `sortType`: Ordenação por relevância, volume de vendas ou comissão.

Campos retornados e mapeados:
* `itemId`, `shopId`, `productName`, `imageUrl`, `productLink`, `price`, `discountRate`, `commissionRate`, `commission`, `sales`, `rating`.

### 4.2. Ofertas por Loja (`shopOfferV2`)
Permite buscar comissões especiais oferecidas diretamente por lojas participantes:
* Retorna `shopId`, `shopName`, `commissionRate`, `rating`, `offerLink`.

### 4.3. Geração de Short Links Oficiais (`generateShortLink`)
Recebe a URL original do anúncio na Shopee e gera o link encurtado oficial (`s.shopee.com.br/...`) com parâmetros de atribuição e rastreamento.

```graphql
mutation generateShortLink($originUrl: String!, $subIds: [String]) {
  generateShortLink(input: { originUrl: $originUrl, subIds: $subIds }) {
    shortLink
    originUrl
    subIds
  }
}
```

### 4.4. Relatórios de Conversão (`conversionReport`)
Consulta pedidos faturados com atribuição ao afiliado:
* Retorna `orderId`, `purchaseTime`, `subIds`, `commission`, `itemPrice`, `orderStatus`.

---

## 5. Rastreamento Avançado com SubIds

A Shopee permite anexar até **5 SubIds** alfanuméricos em cada link gerado para saber exatamente a origem de cada venda:
* `subId[0]`: Canal/Plataforma (ex: `whatsapp`)
* `subId[1]`: Destino/Grupo (ex: `grupo_pokemon`)
* `subId[2]`: Campanha (ex: `campanha_setembro`)
* `subId[3]`: Categoria (ex: `tcg_cards`)
* `subId[4]`: Mecanismo (ex: `auto_scheduler`)

O sistema gera esses SubIds automaticamente no momento da criação do link e os rastreia na tabela de conversões e no painel de auditoria.

---

## 6. Tratamento de Erros e Rate Limits

* **Erros de Credencial (401 / 403 / Invalid Signature):** Falham imediatamente e alertam o usuário no painel de diagnóstico (sem retries infinitos).
* **Rate Limits (429) e Erros 5xx:** O `ShopeeAffiliateApiClient` aplica retries com backoff exponencial (`Math.pow(2, attempt) * 500ms`).
* **Limite de Requisições:** Controlado por token bucket no `RateLimiter` da plataforma (máximo de 5 req/s por padrão).
