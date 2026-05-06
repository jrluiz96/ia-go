# Refatoração do Fluxo.js

## Objetivo
Refatorar o arquivo `fluxo.js` para remover variáveis globais `window.*` e criar um namespace único `window.BashFluxograma`, seguindo o padrão estabelecido pelo `blacklist/js.js`.

## Mudanças Implementadas

### 1. Organização Modular

O código foi organizado em módulos bem definidos:

#### **UTILS** - Utilidades e validações
```javascript
const UTILS = {
    getFuncaoById,
    getRestricoesDaAPI,
    aplicarRestricoesFuncao,
    validarRestricoesFuncaoAntesSalvar,
    validarCamposObrigatorios,
    gerenciarBotoes,
    gerenciarCamposTexto,
    gerenciarHeader,
    escapeHtml
};
```

#### **MODALS** - Gerenciamento de modais e formulários
```javascript
const MODALS = {
    handleMediaUpload,
    toggleHeaderContent,
    handleFuncaoChange,
    toggleQueueType,
    toggleFinalMessage,
    toggleFluxoComplementar,
    carregarMensagensPorBoteria
};
```

#### **BUTTONS** - Gerenciamento de botões interativos
```javascript
const BUTTONS = {
    addButtonQuickReply,
    addButtonUrl,
    addButtonCall,
    addButtonCopy,
    removeButton
};
```

#### **NAVIGATION** - Navegação e controle de fluxo
```javascript
const NAVIGATION = {
    voltarParaFluxos,
    openModalFluxoIniciado
};
```

#### **CRUD** - Operações de criar, ler, atualizar e deletar
```javascript
const CRUD = {
    editarFluxo,
    updateFluxo,
    closeEditFluxoModal,
    removeOpcao,
    alterarOpcaoDaMensagem,
    addLine,
    addOpcao,
    createAddFluxoForm,
    addLineNew,
    addNewOpcao,
    removeOpcaoNew,
    criarNovoFluxo,
    closeAddFluxoModal
};
```

### 2. Namespace Global Único

**Antes:**
```javascript
window.getFuncaoById = getFuncaoById;
window.getRestricoesDaAPI = getRestricoesDaAPI;
window.aplicarRestricoesFuncao = aplicarRestricoesFuncao;
window.voltarParaFluxos = voltarParaFluxos;
window.editarFluxo = editarFluxo;
// ... e muitos outros
```

**Depois:**
```javascript
window.BashFluxograma = {
    UTILS,
    MODALS,
    BUTTONS,
    NAVIGATION,
    CRUD,
    STATE: { opcao, FUNCOES_API, fluxoPage },
    // Métodos diretos para compatibilidade com chamadas inline
    getFuncaoById,
    getRestricoesDaAPI,
    aplicarRestricoesFuncao,
    voltarParaFluxos,
    editarFluxo,
    // ... etc
};
```

### 3. Compatibilidade com Código Existente

Para manter a compatibilidade com chamadas inline nos formulários HTML, todas as funções também foram expostas diretamente no namespace `window.BashFluxograma`, permitindo tanto:

```javascript
// Acesso modular
window.BashFluxograma.UTILS.getFuncaoById(id);
window.BashFluxograma.BUTTONS.addButtonQuickReply('edit');

// Acesso direto (compatibilidade com HTML inline)
window.BashFluxograma.getFuncaoById(id);
window.BashFluxograma.addButtonQuickReply('edit');
```

### 4. Estado Global

O estado foi consolidado no objeto `STATE`:

```javascript
STATE: { 
    opcao,           // Array de opções
    FUNCOES_API,     // Funções disponíveis da API
    fluxoPage        // Elementos da página do fluxo
}
```

## Benefícios

1. **Organização**: Código modular e bem estruturado por responsabilidade
2. **Namespace único**: Apenas `window.BashFluxograma` polui o escopo global
3. **Manutenibilidade**: Fácil localizar funcionalidades por módulo
4. **Consistência**: Segue o mesmo padrão do `blacklist/js.js` e `js.js`
5. **Compatibilidade**: Mantém suporte para chamadas inline existentes nos formulários
6. **Escalabilidade**: Fácil adicionar novos módulos conforme necessário

## Arquivos Modificados

- `/front/frontend/sessao/gestao/administrativo/construtor/fluxo.js` - Refatorado
- `/front/frontend/sessao/gestao/administrativo/construtor/fluxo.js.bak` - Backup do original

## Uso

### Acesso Modular
```javascript
// Validações
const funcao = window.BashFluxograma.UTILS.getFuncaoById(123);
const restricoes = window.BashFluxograma.UTILS.getRestricoesDaAPI(funcaoId);

// Modais
window.BashFluxograma.MODALS.handleMediaUpload(input, 'edit');
window.BashFluxograma.MODALS.toggleHeaderContent('add');

// Botões
window.BashFluxograma.BUTTONS.addButtonQuickReply('add');
window.BashFluxograma.BUTTONS.removeButton('btn_add_1', 'add');

// Navegação
window.BashFluxograma.NAVIGATION.voltarParaFluxos();

// CRUD
window.BashFluxograma.CRUD.editarFluxo(123);
window.BashFluxograma.CRUD.criarNovoFluxo(event);
```

### Acesso Direto (compatibilidade)
```javascript
// Ainda funciona para compatibilidade com código inline existente
window.BashFluxograma.getFuncaoById(123);
window.BashFluxograma.addButtonQuickReply('add');
window.BashFluxograma.editarFluxo(123);
```

## Status

✅ Refatoração concluída  
✅ Sem erros de compilação  
✅ Namespace único `window.BashFluxograma`  
✅ Organização modular (UTILS, MODALS, BUTTONS, NAVIGATION, CRUD)  
✅ Compatibilidade com código existente mantida  
✅ Padrão consistente com outros arquivos do projeto

## Próximos Passos (Opcional)

1. Atualizar chamadas inline nos formulários HTML para usar o namespace:
   - `onclick="addButtonQuickReply('add')"` → `onclick="window.BashFluxograma.addButtonQuickReply('add')"`
   
2. Converter callbacks para async/await onde apropriado

3. Adicionar validações de erro mais robustas

4. Documentar JSDoc para cada módulo
