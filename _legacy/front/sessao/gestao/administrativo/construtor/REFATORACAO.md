# Refatoração do Construtor de Fluxos

## Mudanças Realizadas

### Problema Original
O código utilizava variáveis globais `window.funcao = ...` para expor funções, o que não seguia o padrão do projeto estabelecido pelo `blacklist/js.js`.

### Solução Implementada

O código foi completamente refatorado seguindo o padrão modular do projeto:

#### 1. Estrutura Modular

O código foi organizado em módulos bem definidos:

- **API**: Todas as chamadas HTTP para o backend
  - `buscar()` - Busca fluxos com filtros
  - `criar()` - Cria novo fluxo
  - `atualizar()` - Atualiza fluxo existente
  - `deletar()` - Remove fluxo
  - `restaurar()` - Restaura fluxo deletado

- **STATE**: Gerenciamento do estado da aplicação
  - `fluxos` - Dados e configurações dos fluxos
  - `modals` - Instâncias de modais
  - Outras propriedades de estado

- **UI**: Funções de interface e renderização
  - `init()` - Inicialização da UI
  - `loadFluxos()` - Carrega dados dos fluxos
  - `renderFluxosTable()` - Renderiza tabela
  - `updateFluxosPagination()` - Atualiza paginação
  - Funções auxiliares de UI

- **MODALS**: Templates de modais
  - `createNovoFluxoForm()` - Form de criação
  - `createEditFluxoForm()` - Form de edição

- **EVENTS**: Handlers de eventos
  - `handleFluxoFilter()` - Filtro de fluxos
  - `handleCreateFluxo()` - Criação de fluxo
  - `handleEditFluxo()` - Edição de fluxo
  - `openNovoFluxoModal()` - Abrir modal de criação
  - `viewFluxo()` - Visualizar fluxo
  - `editFluxo()` - Editar fluxo
  - `toggleFluxoStatus()` - Ativar/desativar
  - `deleteFluxo()` - Deletar fluxo
  - `restoreFluxo()` - Restaurar fluxo

- **CORE**: Inicialização da aplicação
  - `init()` - Inicializa todos os módulos

#### 2. Namespace Global

Em vez de expor múltiplas variáveis `window.*`, agora existe apenas um namespace:

```javascript
window.BashFluxos = {
    API,
    UI,
    STATE,
    EVENTS,
    MODALS,
    CORE,
    // Métodos públicos para uso inline
    changeFluxoPage: (page) => UI.changeFluxoPage(page),
    viewFluxo: (id) => EVENTS.viewFluxo(id),
    editFluxo: (id) => EVENTS.editFluxo(id),
    toggleFluxoStatus: (id, status) => EVENTS.toggleFluxoStatus(id, status),
    deleteFluxo: (id) => EVENTS.deleteFluxo(id),
    restoreFluxo: (id) => EVENTS.restoreFluxo(id),
    closeModal: (name) => EVENTS.closeModal(name)
};
```

#### 3. Uso de Async/Await

Todas as chamadas de API foram convertidas para usar `async/await` com `reqAsync()` em vez de callbacks, tornando o código mais limpo e fácil de manter:

**Antes:**
```javascript
req('v1/admin/fluxos', 'POST', data,
    function(response) { /* sucesso */ },
    function(error) { /* erro */ }
);
```

**Depois:**
```javascript
const { data, error } = await API.criar(payload);
if (error) {
    avisos('Erro', error, 'error');
    return;
}
avisos('Sucesso', 'Fluxo criado!', 'success');
```

#### 4. Padrão de Resposta Consistente

Todas as funções da API retornam um objeto com `{ data, error }`:

```javascript
try {
    const response = await reqAsync(url, method, payload);
    return { data: response.data, error: null };
} catch (error) {
    console.error('❌ Erro:', error);
    return { data: null, error: error?.message || 'Erro padrão' };
}
```

#### 5. Atualização de Chamadas Inline

Todas as chamadas inline no HTML foram atualizadas:

**Antes:**
```html
<button onclick="deleteFluxo(123)">Excluir</button>
```

**Depois:**
```html
<button onclick="window.BashFluxos.deleteFluxo(123)">Excluir</button>
```

### Benefícios

1. **Organização**: Código modular e bem estruturado
2. **Manutenibilidade**: Fácil localizar e modificar funcionalidades
3. **Consistência**: Segue o padrão do projeto (blacklist)
4. **Namespace único**: Evita poluição do escopo global
5. **Melhor tratamento de erros**: Uso de async/await
6. **Logs padronizados**: Mensagens com emojis para debug

### Arquivos Modificados

- `/front/frontend/sessao/gestao/administrativo/construtor/js.js` - Refatorado completamente
- `/front/frontend/sessao/gestao/administrativo/construtor/js.js.bak` - Backup do original
- `/front/frontend/sessao/gestao/administrativo/construtor/js_old.js` - Versão antiga com erros

### Compatibilidade

O código refatorado mantém 100% de compatibilidade com o HTML existente (`index.html`), apenas alterando a forma como as funções são expostas globalmente.

### Como Usar

```javascript
// Acessar estado
console.log(window.BashFluxos.STATE.fluxos.data);

// Chamar funções públicas
window.BashFluxos.viewFluxo(123);
window.BashFluxos.editFluxo(456);

// Acessar API diretamente
const { data, error } = await window.BashFluxos.API.buscar(1, { q: 'teste' });

// Recarregar dados
await window.BashFluxos.UI.loadFluxos();
```

## Checklist de Validação

- [x] Código organizado em módulos (API, STATE, UI, EVENTS, MODALS, CORE)
- [x] Uso de async/await em vez de callbacks
- [x] Namespace único `window.BashFluxos`
- [x] Padrão de resposta `{ data, error }` nas APIs
- [x] Logs padronizados com emojis
- [x] Remoção de `window.funcao = ...`
- [x] Sem erros de lint/compilação
- [x] Compatível com HTML existente
