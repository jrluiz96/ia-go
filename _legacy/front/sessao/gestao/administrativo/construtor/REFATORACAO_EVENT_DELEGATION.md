# Refatoração: Remoção completa de window.* e Event Delegation

## 🎯 Objetivo
Eliminar completamente a poluição do escopo global (`window.*`) e implementar um sistema robusto de **Event Delegation** para gerenciar eventos de forma moderna e performática.

---

## ✅ Mudanças Implementadas

### 1. **Removidas TODAS as exportações `window.*` diretas**

**Antes:**
```javascript
window.buttonCounterAdd = 0;
window.handleMediaUpload = handleMediaUpload;
window.toggleHeaderContent = toggleHeaderContent;
window.handleFuncaoChange = handleFuncaoChange;
window.carregarMensagensPorBoteria = carregarMensagensPorBoteria;
window.addButtonQuickReply = addButtonQuickReply;
window.removeButton = removeButton;
window.addButtonUrl = addButtonUrl;
window.addButtonCall = addButtonCall;
window.addButtonCopy = addButtonCopy;
window.toggleFluxoComplementar = toggleFluxoComplementar;
window.toggleFluxoComplementarEdit = toggleFluxoComplementarEdit;
window.ALL_BOTERIAS_OPTIONS = [];
```

**Depois:**
```javascript
// ZERO exportações window.* (exceto namespace e debug)
let buttonCounterAdd = 0; // Escopo local
let fluxoIniciadoModal = null;
let fluxoAddMensagemModal = null;
let fluxoEditModal = null;
const ALL_BOTERIAS_OPTIONS = []; // Escopo local
```

### 2. **Sistema de Event Delegation Centralizado**

**Implementação:**
```javascript
function setupEventDelegation() {
    // Click events (botões, ações)
    document.addEventListener('click', function(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        const mode = target.dataset.mode || 'add';
        const id = target.dataset.id;

        switch (action) {
            case 'add-button-quick-reply': addButtonQuickReply(mode); break;
            case 'add-button-url': addButtonUrl(mode); break;
            case 'add-button-call': addButtonCall(mode); break;
            case 'add-button-copy': addButtonCopy(mode); break;
            case 'remove-button': removeButton(id, mode); break;
            case 'close-modal-fluxo-iniciado': fluxoIniciadoModal?.close(); break;
            case 'close-add-fluxo-modal': closeAddFluxoModal(); break;
            case 'audio-preview-tts': AudioPreviewTextToSpeech(); break;
            case 'remove-element': document.getElementById(id)?.remove(); break;
        }
    });

    // Change events (selects, inputs)
    document.addEventListener('change', function(e) {
        const target = e.target;
        
        // Header tipo (reconhece por ID)
        if (target.id?.startsWith('header_tipo_')) {
            toggleHeaderContent(target.id.replace('header_tipo_', ''));
        }
        // Função (reconhece por ID)
        else if (target.id?.startsWith('funcao_')) {
            handleFuncaoChange(target.id.replace('funcao_', ''));
        }
        // Fluxo complementar checkbox
        else if (target.name?.startsWith('fluxo_complementar_bl_')) {
            toggleFluxoComplementar(target.name.replace('fluxo_complementar_bl_', ''));
        }
        // Carregar mensagens (data-load-messages)
        else if (target.dataset.loadMessages) {
            carregarMensagensPorBoteria(target.value, target.dataset.loadMessages);
        }
        // Media upload
        else if (target.name?.includes('header_media_file_')) {
            handleMediaUpload(target, target.name.replace('header_media_file_', ''));
        }
    });

    // Submit events
    document.addEventListener('submit', function(e) {
        if (e.target.id === 'fluxo-iniciado-form') {
            e.preventDefault();
            handleFluxoIniciadoSubmit(e.target);
        }
    });
}
```

### 3. **Substituição de Inline Event Handlers**

#### **Botões de Ação**
**Antes:**
```html
<button onclick="addButtonQuickReply('add')">Botão de Opção</button>
<button onclick="addButtonUrl('add')">Link de Site</button>
<button onclick="addButtonCall('add')">Ligação</button>
<button onclick="addButtonCopy('add')">Código de Cópia</button>
<button onclick="closeAddFluxoModal()">Cancelar</button>
<button onclick="removeButton('btn_123', 'add')">Remover</button>
<button onclick="document.getElementById('btn_123').remove()">Remover</button>
<button onclick="AudioPreviewTextToSpeech()">Escutar Áudio</button>
<button onclick="window.fluxoIniciadoModal?.close()">Fechar</button>
```

**Depois:**
```html
<button data-action="add-button-quick-reply" data-mode="add">Botão de Opção</button>
<button data-action="add-button-url" data-mode="add">Link de Site</button>
<button data-action="add-button-call" data-mode="add">Ligação</button>
<button data-action="add-button-copy" data-mode="add">Código de Cópia</button>
<button data-action="close-add-fluxo-modal">Cancelar</button>
<button data-action="remove-button" data-id="btn_123" data-mode="add">Remover</button>
<button data-action="remove-element" data-id="btn_123">Remover</button>
<button data-action="audio-preview-tts">Escutar Áudio</button>
<button data-action="close-modal-fluxo-iniciado">Fechar</button>
```

#### **Selects e Inputs**
**Antes:**
```html
<select onchange="handleFuncaoChange('add')">...</select>
<select onchange="toggleHeaderContent('add')">...</select>
<select onchange="carregarMensagensPorBoteria(this.value, 'target_id')">...</select>
<input type="file" onchange="handleMediaUpload(this, 'add')" />
<input type="checkbox" onchange="toggleFluxoComplementar('add')" />
```

**Depois:**
```html
<!-- Detecção automática por ID -->
<select id="funcao_add">...</select>
<select id="header_tipo_add">...</select>

<!-- Data-attribute para targets específicos -->
<select data-load-messages="target_id">...</select>

<!-- Detecção automática por nome do arquivo -->
<input type="file" name="header_media_file_add" id="header_media_file_add" />

<!-- Detecção automática por nome do checkbox -->
<input type="checkbox" name="fluxo_complementar_bl_add" />
```

### 4. **Modais: De window.* para variáveis locais**

**Antes:**
```javascript
window.fluxoIniciadoModal = new BashModal({...});
window.fluxoAddMensagemModal = new BashModal({...});
window.fluxoEditModal = new BashModal({...});

if (window.fluxoIniciadoModal) {
    window.fluxoIniciadoModal.close();
}
```

**Depois:**
```javascript
// Declaração no topo do IIFE
let fluxoIniciadoModal = null;
let fluxoAddMensagemModal = null;
let fluxoEditModal = null;

// Uso normal
fluxoIniciadoModal = new BashModal({...});
if (fluxoIniciadoModal) {
    fluxoIniciadoModal.close();
}
```

### 5. **Namespace Limpo (apenas para estrutura organizada)**

**Única exportação global:**
```javascript
window.BashFluxograma = {
    UTILS,
    MODALS,
    BUTTONS,
    NAVIGATION,
    CRUD,
    STATE: { opcao, FUNCOES_API, fluxoPage }
};
```

**Debug mode (apenas em localhost/dev):**
```javascript
if (window.location.hostname === 'localhost' || window.location.hostname.includes('dev')) {
    console.warn('⚠️ BashFluxograma: Modo debug ativado');
    window.BashFluxograma.DEBUG = {
        handleMediaUpload,
        toggleHeaderContent,
        // ... outras funções para debug
    };
}
```

---

## 🚀 Benefícios

### **Performance**
- ✅ **3 event listeners** ao invés de centenas de `onclick` inline
- ✅ Event delegation funciona automaticamente com elementos dinâmicos
- ✅ Sem necessidade de re-attachar eventos após inserção de HTML

### **Manutenibilidade**
- ✅ Código centralizado em um único local (`setupEventDelegation`)
- ✅ Fácil adicionar novos eventos (apenas 1 linha no switch)
- ✅ Zero poluição do escopo global
- ✅ HTML limpo e semântico

### **Segurança**
- ✅ Sem exposição de funções internas no `window`
- ✅ Content Security Policy (CSP) friendly (sem inline handlers)
- ✅ Reduz superfície de ataque XSS

### **Modularidade**
- ✅ Funções completamente encapsuladas no IIFE
- ✅ Fácil migração futura para ES modules
- ✅ Namespace organizado e consistente

---

## 📋 Checklist de Validação

- [x] Removidos todos `window.buttonCounterAdd`, `window.handleMediaUpload`, etc
- [x] Removidos todos `window.ALL_BOTERIAS_OPTIONS`
- [x] Removidos todos `window.toggleFluxoComplementarEdit`
- [x] Modais convertidos de `window.*` para variáveis locais
- [x] Todos `onclick=` substituídos por `data-action=`
- [x] Todos `onchange=` convertidos para detecção automática
- [x] Event delegation implementado e testado
- [x] Zero erros de compilação
- [x] Apenas 1 exportação `window.BashFluxograma` (namespace)
- [x] Debug mode implementado para desenvolvimento

---

## 🔧 Como Usar os Novos Data-Attributes

### **Botões com ação**
```html
<button data-action="NOME_DA_ACAO" data-mode="add|edit" data-id="opcional">
    Texto
</button>
```

### **Selects que carregam mensagens**
```html
<select data-load-messages="ID_DO_SELECT_ALVO">
    <option>...</option>
</select>
```

### **Selects com detecção automática**
- `id="funcao_add"` → Chama `handleFuncaoChange('add')`
- `id="header_tipo_edit"` → Chama `toggleHeaderContent('edit')`

### **Checkbox de fluxo complementar**
- `name="fluxo_complementar_bl_add"` → Chama `toggleFluxoComplementar('add')`

### **Input de arquivo**
- `name="header_media_file_add"` → Chama `handleMediaUpload(input, 'add')`

---

## 🎓 Lições Aprendidas

1. **Event Delegation é mais eficiente** que centenas de inline handlers
2. **Data-attributes** tornam o HTML semântico e limpo
3. **Namespace único** é suficiente para expor API pública
4. **Variáveis locais** no IIFE protegem o escopo global
5. **Detecção automática por ID/nome** reduz boilerplate no HTML

---

## 📝 Próximos Passos (Opcional)

- [ ] Converter para ES6 modules (`import/export`)
- [ ] Adicionar TypeScript para type safety
- [ ] Implementar testes unitários para event handlers
- [ ] Adicionar documentação JSDoc
- [ ] Criar build process para minificação

---

## ⚠️ Breaking Changes

**Nenhum!** A refatoração mantém compatibilidade total:
- HTML foi atualizado simultaneamente com o JavaScript
- Event delegation captura todos os eventos corretamente
- Funções continuam funcionando da mesma forma internamente
