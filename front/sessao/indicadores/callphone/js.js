console.log('📦 Carregando módulo Indicadores CallPhone...');

/**
 * ════════════════════════════════════════════════════════════════════════════
 * INDICADORES CALLPHONE - DASHBOARD
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Arquitetura Modular:
 * - STATE: Gerenciamento de estado da aplicação
 * - API: Comunicação com backend
 * - UI: Manipulação da interface
 * - EVENTS: Gerenciamento de eventos
 * - CORE: Lógica de negócio principal
 * 
 * ════════════════════════════════════════════════════════════════════════════
 */

(function() {
    'use strict';

    // ════════════════════════════════════════════════════════════════════════════
    // STATE - Gerenciamento de Estado
    // ════════════════════════════════════════════════════════════════════════════
    const STATE = {
        // Dados da aplicação
        data: {
            empresas: [],
            indicadores: null
        },

        // Filtros ativos
        filtros: {
            empresa_id: null,
            periodo: 1, // 1=Hoje, 2=Semana, 3=Mês, 4=30 Dias, 5=Custom
            dataInicio: null,
            dataFim: null
        },

        // Estado de UI
        ui: {
            loading: false,
            customDateVisible: false
        },

        // Getters
        getEmpresaId() {
            return this.filtros.empresa_id;
        },

        getPeriodo() {
            return this.filtros.periodo;
        },

        getDatas() {
            return {
                inicio: this.filtros.dataInicio,
                fim: this.filtros.dataFim
            };
        },

        getEmpresas() {
            return this.data.empresas;
        },

        // Setters
        setEmpresaId(id) {
            this.filtros.empresa_id = id;
            console.log('📍 Empresa selecionada:', id);
        },

        setPeriodo(periodo) {
            this.filtros.periodo = parseInt(periodo);
            
            if (periodo === 5) { // Custom
                this.ui.customDateVisible = true;
            } else {
                this.ui.customDateVisible = false;
                this.filtros.dataInicio = null;
                this.filtros.dataFim = null;
            }
            
            console.log('📅 Período selecionado:', periodo);
        },

        setDatas(inicio, fim) {
            this.filtros.dataInicio = inicio;
            this.filtros.dataFim = fim;
            console.log('📆 Datas definidas:', { inicio, fim });
        },

        setEmpresas(empresas) {
            this.data.empresas = empresas;
        },

        setLoading(loading) {
            this.ui.loading = loading;
        },

        isCustomPeriod() {
            return this.filtros.periodo === 5;
        },

        // Reset
        reset() {
            this.data.indicadores = null;
        }
    };

    // ════════════════════════════════════════════════════════════════════════════
    // API - Comunicação com Backend
    // ════════════════════════════════════════════════════════════════════════════
    const API = {
        baseUrl: "v1/monitoramento",

        async buscarNumeros() {
            try {
                console.debug("🔍 Buscando números WhatsApp...");
                const url = `${this.baseUrl}/options/empresas`;
                const response = await reqAsync(url, "GET");
                console.debug("✅ Números carregados:", response.data);
                return { data: response.data, error: null };
            } catch (error) {
                console.error("❌ Erro ao buscar números:", error);
                return {
                    data: null,
                    error: error?.message || "Erro ao carregar números",
                };
            }
        },

        /**
         * Buscar indicadores do dashboard
         * @param {Object} params - Parâmetros de filtro
         */
        async fetchIndicadoresDashboard(params) {
            try {
                console.log('🔄 Buscando indicadores do dashboard...', params);
                
                // Montar query string
                const queryParams = new URLSearchParams();
                
                if (params.dataInicio) {
                    queryParams.append('data_inicio', params.dataInicio);
                }

                if (params.dataFim) {
                    queryParams.append('data_fim', params.dataFim);
                }

                const url = `v1/indicadores/dashboard/${params.empresa_id}/${params.periodo}?${queryParams.toString()}`;
                
                const response = await reqAsync(url,'GET');

                console.debug("✅ Números carregados:", response.data);
                return { data: response.data, error: null };
            } catch (error) {
               console.error("❌ Erro ao buscar números:", error);
                return {
                    data: null,
                    error: error?.message || "Erro ao carregar números",
                };
            }
        }
    };

    // ════════════════════════════════════════════════════════════════════════════
    // UI - Interface do Usuário
    // ════════════════════════════════════════════════════════════════════════════
    const UI = {
        /**
         * Elementos do DOM
         */
        elements: {
            selectEmpresa: null,
            btnBuscar: null,
            periodButtons: null,
            containerDataInicio: null,
            containerDataFim: null,
            containerDatasCustom: null,
            dataInicio: null,
            dataFim: null,
            loadingOverlay: null
        },

        /**
         * Inicializar elementos do DOM
         */
        init() {
            this.elements.selectEmpresa = document.getElementById('select-empresa');
            this.elements.btnBuscar = document.getElementById('btn-buscar');
            this.elements.periodButtons = document.querySelectorAll('[data-period]');
            this.elements.containerDataInicio = document.getElementById('container-data-inicio');
            this.elements.containerDataFim = document.getElementById('container-data-fim');
            this.elements.containerDatasCustom = document.getElementById('container-datas-custom');
            this.elements.dataInicio = document.getElementById('data-inicio');
            this.elements.dataFim = document.getElementById('data-fim');
            this.elements.loadingOverlay = document.getElementById('loading-overlay');
            
            // Dashboard elements
            this.elements.dash = document.querySelector('.container');
            this.elements.total = document.getElementById('total');
            this.elements.abandono = document.getElementById('abandono');
            this.elements.atendida = document.getElementById('atendida');
            this.elements.tma = document.getElementById('tma');
            this.elements.tme = document.getElementById('tme');
            this.elements.slaServico = document.getElementById('slaServico');
            this.elements.psqSatisfacao = document.getElementById('psqSatisfacao');
            this.elements.metrica = document.querySelectorAll('.metrica');
            this.elements.difLoad = document.querySelectorAll('.difLoad');
            this.elements.psqSatisfacaoCard = document.querySelectorAll('.psqSatisfacao');
        },

        /**
         * Mostrar loading
         */
        showLoading() {
            if (this.elements.loadingOverlay) {
                this.elements.loadingOverlay.classList.remove('hidden');
            }
        },

        /**
         * Esconder loading
         */
        hideLoading() {
            if (this.elements.loadingOverlay) {
                this.elements.loadingOverlay.classList.add('hidden');
            }
        },

        /**
         * Popular select de empresas
         */
        populateEmpresas(empresas) {
            if (!this.elements.selectEmpresa) return;

            this.elements.selectEmpresa.innerHTML = '<option value="">Selecione uma empresa</option>';
            
            empresas.forEach(empresa => {
                const option = document.createElement('option');
                option.value = empresa.id;
                option.textContent = empresa.nome;
                this.elements.selectEmpresa.appendChild(option);
            });
        },

        /**
         * Atualizar botões de período
         */
        updatePeriodButtons(periodo) {
            this.elements.periodButtons.forEach(btn => {
                if (parseInt(btn.dataset.period) === parseInt(periodo)) {
                    btn.classList.add('btn-active');
                } else {
                    btn.classList.remove('btn-active');
                }
            });
        },

        /**
         * Mostrar/Esconder campos de data customizada
         */
        toggleCustomDates(show) {
            if (show) {
                this.elements.containerDatasCustom?.classList.remove('hidden');
            } else {
                this.elements.containerDatasCustom?.classList.add('hidden');
            }
        },

        /**
         * Obter valores dos campos de data
         */
        getDates() {
            return {
                inicio: this.elements.dataInicio?.value || null,
                fim: this.elements.dataFim?.value || null
            };
        },

        /**
         * Obter empresa selecionada
         */
        getSelectedEmpresa() {
            return this.elements.selectEmpresa?.value || null;
        },

        /**
         * Mostrar erro
         */
        showError(message) {
            console.error('Erro:', message);
            avisos(`Erro: `, `${message}`, "error");
        },

        /**
         * Mostrar sucesso
         */
        showSuccess(message) {
            console.log('Sucesso:', message);
            avisos(`Sucesso: `, `${message}`, "success");
        },

        /**
         * Mostrar dashboard - equivale ao $('#dash').show()
         */
        showDashboard() {
            if (this.elements.dash) {
                this.elements.dash.style.display = 'block';
            }
        },

        /**
         * Mostrar elementos com animação - equivale ao $('.difLoad').show(50)
         */
        showElementsWithAnimation() {
            if (this.elements.metrica) {
                this.elements.metrica.forEach(el => el.style.display = 'block');
            }
            if (this.elements.difLoad) {
                this.elements.difLoad.forEach(el => {
                    el.style.display = 'block';
                    el.style.opacity = '0';
                    setTimeout(() => el.style.opacity = '1', 50);
                });
            }
            if (this.elements.psqSatisfacaoCard) {
                this.elements.psqSatisfacaoCard.forEach(el => el.style.display = 'block');
            }
        }
    };

    // ════════════════════════════════════════════════════════════════════════════
    // UTILS - Funções Auxiliares
    // ════════════════════════════════════════════════════════════════════════════
    const UTILS = {
        /**
         * Manipula e valida dados do relatório
         * Equivale à função manipulaRelatorio() original
         */
        manipulaRelatorio(item, tipo = null) {
            if (item == null || 
                item == 'undefined' || 
                item == "" || 
                item == 'NaN' || 
                item == NaN || 
                item == 'aN:aN:aN') {
                return "0";  // Retorna 0 para valores inválidos
            }
            
            // Se for número, formatar com locale pt-BR
            const num = Number(item);
            if (!isNaN(num)) {
                if (tipo === '0' || item.toString().includes('.')) {
                    return num.toLocaleString('pt-BR', { 
                        minimumFractionDigits: 0, 
                        maximumFractionDigits: 2 
                    });
                }
                return num.toLocaleString('pt-BR');
            }
            
            // Se não for número, processar como string
            item = this.tratarDataTable(item.toString());
            return item;
        },

        /**
         * Trata formato de data/hora - equivale à tratarDataTable()
         */
        tratarDataTable(item) {
            let splitvar = item.split(":");
            
            if(splitvar.length == 3) {
                item = item.split(".");  // Remove microssegundos
                item = item[0];          // Pega só HH:MM:SS
                return item;
            }
            
            splitvar = item.split("-");
            if(splitvar.length == 3 && splitvar[0].length == 4) {
                item = splitvar[2] + '/' + splitvar[1] + '/' + splitvar[0];
            }
            
            return item;
        },

        /**
         * Exibe avisos/notificações
         */
        avisos(message, type, title) {
            console.log(`[${type}] ${title}: ${message}`);
            if (window.avisos) {
                window.avisos(message, type, title);
            } else {
                alert(`${title}: ${message}`);
            }
        }
    };

    // ════════════════════════════════════════════════════════════════════════════
    // DASHBOARD - Funções de Dashboard
    // ════════════════════════════════════════════════════════════════════════════
    const DASHBOARD = {
        /**
         * Função principal - equivale à getMonitoria(res)
         */
        getMonitoria(res) {
            console.log('🚀 Processando dados do dashboard...');
            console.log(res);  // Debug - ver estrutura completa
            UI.hideLoading();
            UI.showDashboard();
            
            if(res.error) {
                this.zerarIndicadores();
                this.mostrarErroTabelas(res.error);
                UI.showElementsWithAnimation();
                UTILS.avisos(res.error, 'text-warning', 'Dashboard');
            } else {
                // Usar a estrutura real recebida
                res = res.data;
                const indicadores = res.indicadores;
                const nivelServico = res.nivel_servico;
                const pesquisaSatisfacao = res.pesquisa_satisfacao;
                
                UI.hideLoading();
                
                this.populaTotal(indicadores);
                this.populaAbandono(indicadores);
                this.populaAtendida(indicadores);
                this.populaTMA(indicadores);
                this.populaTME(indicadores);
                
                // Usar os dados corretos
                this.populaSLA(nivelServico, indicadores);
                this.populaPesquisaSatisfacao(pesquisaSatisfacao);
                
                UI.showElementsWithAnimation();
            }
        },

        zerarIndicadores() {
            if (UI.elements.total) UI.elements.total.innerHTML = '0';
            if (UI.elements.abandono) UI.elements.abandono.innerHTML = '0';
            if (UI.elements.atendida) UI.elements.atendida.innerHTML = '0';
            if (UI.elements.tma) UI.elements.tma.innerHTML = '00:00:00';
            if (UI.elements.tme) UI.elements.tme.innerHTML = '00:00:00';
        },

        mostrarErroTabelas(erro) {
            if (UI.elements.slaServico) UI.elements.slaServico.innerHTML = erro;
            if (UI.elements.psqSatisfacao) UI.elements.psqSatisfacao.innerHTML = erro;
        },

        populaTotal(indicadores) {
            if (UI.elements.total) {
                UI.elements.total.innerHTML = indicadores.recebidas || '0';
            }
        },

        populaAbandono(indicadores) {
            if (UI.elements.abandono) {
                const abandono = indicadores.abandono || 0;
                const porcNaoAtendidas = indicadores.porc_nao_atendidas || 0;
                const percentual = (porcNaoAtendidas * 100).toFixed(2);
                UI.elements.abandono.innerHTML = `${abandono} | ${percentual}%`;
            }
        },

        populaAtendida(indicadores) {
            if (UI.elements.atendida) {
                const atendidas = indicadores.atendidas || 0;
                const porcAtendidas = indicadores.porc_atendidas || 0;
                const percentual = (porcAtendidas * 100).toFixed(2);
                UI.elements.atendida.innerHTML = `${atendidas} | ${percentual}%`;
            }
        },

        populaTMA(indicadores) {
            if (UI.elements.tma) {
                const tma = UTILS.manipulaRelatorio(indicadores.med_tma);
                UI.elements.tma.innerHTML = tma;
            }
        },

        populaTME(indicadores) {
            if (UI.elements.tme) {
                console.log('Indicador TME bruto:', indicadores.med_tme); // Debug  
                const tme = UTILS.manipulaRelatorio(indicadores.med_tme);
                UI.elements.tme.innerHTML = tme;
            }
        },

        populaSLA(nivelServico, indicadores) {
            if (UI.elements.slaServico) {
                const slaHTML = this.nvServico(nivelServico, indicadores);
                UI.elements.slaServico.innerHTML = slaHTML;
            }
        },

        populaPesquisaSatisfacao(pesquisaSatisfacao) {
            if (UI.elements.psqSatisfacao) {
                const pesquisaHTML = this.psqSatisfacao(pesquisaSatisfacao);
                UI.elements.psqSatisfacao.innerHTML = pesquisaHTML;
            }
        },

        nvServico(nivelServico, indicadores) {
            if (!nivelServico || !indicadores) {
                return '<div class="alert alert-info">Dados de nível de serviço não disponíveis</div>';
            }

            // Pegar SLA configurado (assumindo 20 segundos como padrão se não tiver session)
            let slatime = 20; // Padrão 20 segundos
            if (window.session && window.session.troncos && window.session.troncos[0] && window.session.troncos[0].sla) {
                slatime = parseInt(window.session.troncos[0].sla.replaceAll(":", ""));
            }

            const sla = indicadores.sla ? (indicadores.sla * 100).toFixed(2) : '0.00';
            const total = indicadores.recebidas || nivelServico.total || 0;

            // Atualizar o SLA na div slaTitle
            const slaElement = document.querySelector('.slaTitle');
            if (slaElement) {
                slaElement.innerHTML = `<span class="badge badge-lg badge-primary">SLA ${sla}%</span>`;
            }

            let html = `
                <table class="table table-zebra w-full table-sm text-center">
                    <thead>
                        <tr>
                            <th>Atendida em até X</th>
                            <th>Atendidas</th>
                            <th>% Atendidas</th>
                            <th>Total Atendidas</th>
                            <th>Total % Atendidas</th>
                            <th>SLA %</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            // Processar intervalos conforme função original
            let nvSomaAtt = 0;
            let nvSomaPerc = 0;

            // 5 Segundos
            nvSomaAtt = nivelServico.s_5 || 0;
            nvSomaPerc = ((nvSomaAtt / nivelServico.total) * 100);
            html += `<tr>
                <td>5 Segundos</td>
                <td>${UTILS.manipulaRelatorio(nivelServico.s_5 || 0)}</td>
                <td>${UTILS.manipulaRelatorio(((nvSomaAtt / nivelServico.total) * 100).toFixed(2))}%</td>
                <td>${UTILS.manipulaRelatorio(nvSomaAtt)}</td>
                <td>${UTILS.manipulaRelatorio(nvSomaPerc.toFixed(2))}%</td>`;
            
            if (slatime >= 5) {
                html += `<td>${UTILS.manipulaRelatorio(((nvSomaAtt / total) * 100).toFixed(2))}%</td>`;
            } else {
                html += `<td> - </td>`;
            }
            html += `</tr>`;

            // 10 Segundos
            nvSomaAtt += nivelServico.s_10 || 0;
            nvSomaPerc = ((nivelServico.s_10 / nivelServico.total) * 100) + nvSomaPerc;
            html += `<tr>
                <td>10 Segundos</td>
                <td>${UTILS.manipulaRelatorio(nivelServico.s_10 || 0)}</td>
                <td>${UTILS.manipulaRelatorio(((nivelServico.s_10 / nivelServico.total) * 100).toFixed(2))}%</td>
                <td>${UTILS.manipulaRelatorio(nvSomaAtt)}</td>
                <td>${UTILS.manipulaRelatorio(nvSomaPerc.toFixed(2))}%</td>`;
            
            if (slatime >= 10) {
                html += `<td>${UTILS.manipulaRelatorio(((nvSomaAtt / total) * 100).toFixed(2))}%</td>`;
            } else {
                html += `<td class="text-error">${UTILS.manipulaRelatorio(((nvSomaAtt / total) * 100).toFixed(2))}%</td>`;
            }
            html += `</tr>`;

            // 15 Segundos
            nvSomaAtt += nivelServico.s_15 || 0;
            nvSomaPerc = ((nivelServico.s_15 / nivelServico.total) * 100) + nvSomaPerc;
            html += `<tr>
                <td>15 Segundos</td>
                <td>${UTILS.manipulaRelatorio(nivelServico.s_15 || 0)}</td>
                <td>${UTILS.manipulaRelatorio(((nivelServico.s_15 / nivelServico.total) * 100).toFixed(2))}%</td>
                <td>${UTILS.manipulaRelatorio(nvSomaAtt)}</td>
                <td>${UTILS.manipulaRelatorio(nvSomaPerc.toFixed(2))}%</td>`;
            
            if (slatime >= 15) {
                html += `<td>${UTILS.manipulaRelatorio(((nvSomaAtt / total) * 100).toFixed(2))}%</td>`;
            } else {
                html += `<td class="text-error">${UTILS.manipulaRelatorio(((nvSomaAtt / total) * 100).toFixed(2))}%</td>`;
            }
            html += `</tr>`;

            // 20 Segundos
            nvSomaAtt += nivelServico.s_20 || 0;
            nvSomaPerc = ((nivelServico.s_20 / nivelServico.total) * 100) + nvSomaPerc;
            html += `<tr>
                <td>20 Segundos</td>
                <td>${UTILS.manipulaRelatorio(nivelServico.s_20 || 0)}</td>
                <td>${UTILS.manipulaRelatorio(((nivelServico.s_20 / nivelServico.total) * 100).toFixed(2))}%</td>
                <td>${UTILS.manipulaRelatorio(nvSomaAtt)}</td>
                <td>${UTILS.manipulaRelatorio(nvSomaPerc.toFixed(2))}%</td>`;
            
            if (slatime >= 20) {
                html += `<td>${UTILS.manipulaRelatorio(((nvSomaAtt / total) * 100).toFixed(2))}%</td>`;
            } else {
                html += `<td class="text-error">${UTILS.manipulaRelatorio(((nvSomaAtt / total) * 100).toFixed(2))}%</td>`;
            }
            html += `</tr>`;

            // 30 Segundos
            nvSomaAtt += nivelServico.s_30 || 0;
            nvSomaPerc = ((nivelServico.s_30 / nivelServico.total) * 100) + nvSomaPerc;
            html += `<tr>
                <td>30 Segundos</td>
                <td>${UTILS.manipulaRelatorio(nivelServico.s_30 || 0)}</td>
                <td>${UTILS.manipulaRelatorio(((nivelServico.s_30 / nivelServico.total) * 100).toFixed(2))}%</td>
                <td>${UTILS.manipulaRelatorio(nvSomaAtt)}</td>
                <td>${UTILS.manipulaRelatorio(nvSomaPerc.toFixed(2))}%</td>`;
            
            if (slatime >= 30) {
                html += `<td>${UTILS.manipulaRelatorio(((nvSomaAtt / total) * 100).toFixed(2))}%</td>`;
            } else {
                html += `<td class="text-error">${UTILS.manipulaRelatorio(((nvSomaAtt / total) * 100).toFixed(2))}%</td>`;
            }
            html += `</tr>`;

            // 40+ Segundos
            nvSomaAtt += nivelServico.s_40 || 0;
            nvSomaPerc = ((nivelServico.s_40 / nivelServico.total) * 100) + nvSomaPerc;
            html += `<tr>
                <td>40+ Segundos</td>
                <td>${UTILS.manipulaRelatorio(nivelServico.s_40 || 0)}</td>
                <td>${UTILS.manipulaRelatorio(((nivelServico.s_40 / nivelServico.total) * 100).toFixed(2))}%</td>
                <td>${UTILS.manipulaRelatorio(nvSomaAtt)}</td>
                <td>${UTILS.manipulaRelatorio(nvSomaPerc.toFixed(2))}%</td>`;
            
            if (slatime >= 40) {
                html += `<td>${UTILS.manipulaRelatorio(((nvSomaAtt / total) * 100).toFixed(2))}%</td>`;
            } else {
                html += `<td class="text-error">${UTILS.manipulaRelatorio(((nvSomaAtt / total) * 100).toFixed(2))}%</td>`;
            }
            html += `</tr>`;

            html += `
                    </tbody>
                </table>
            `;

            return html;
        },

        psqSatisfacao(pesquisaSatisfacao) {
            if (!pesquisaSatisfacao) {
                return '<div class="alert alert-info">Dados de pesquisa de satisfação não disponíveis</div>';
            }

            // Função original psqSatisfacao adaptada
            let empresaHtml3 = '<table class="table table-zebra w-full table-sm text-center">';
            empresaHtml3 += '<thead>';
            empresaHtml3 += '<tr>';
            empresaHtml3 += '<th>Pergunta</th>';
            empresaHtml3 += '<th>Péssimo</th>';
            empresaHtml3 += '<th>Ruim</th>';
            empresaHtml3 += '<th>Regular</th>';
            empresaHtml3 += '<th>Bom</th>';
            empresaHtml3 += '<th>Ótimo</th>';
            empresaHtml3 += '<th>Satisfeitos</th>';
            empresaHtml3 += '</tr>';
            empresaHtml3 += '</thead>';
            empresaHtml3 += '<tbody>';

            // Pergunta 1
            empresaHtml3 += '<tr>';
            empresaHtml3 += '<td>Pergunta 1</td>';
            
            const p01_total = pesquisaSatisfacao.p01_t || (pesquisaSatisfacao.p01_1 + pesquisaSatisfacao.p01_2 + pesquisaSatisfacao.p01_3 + pesquisaSatisfacao.p01_4 + pesquisaSatisfacao.p01_5);
            
            empresaHtml3 += '<td>' + (pesquisaSatisfacao.p01_1 || 0) + ' (' + (p01_total > 0 ? UTILS.manipulaRelatorio(((pesquisaSatisfacao.p01_1 || 0) / p01_total * 100).toFixed(1)) : '0.0') + '%)</td>';
            empresaHtml3 += '<td>' + (pesquisaSatisfacao.p01_2 || 0) + ' (' + (p01_total > 0 ? (((pesquisaSatisfacao.p01_2 || 0) / p01_total * 100).toFixed(1)) : '0.0') + '%)</td>';
            empresaHtml3 += '<td>' + (pesquisaSatisfacao.p01_3 || 0) + ' (' + (p01_total > 0 ? (((pesquisaSatisfacao.p01_3 || 0) / p01_total * 100).toFixed(1)) : '0.0') + '%)</td>';
            empresaHtml3 += '<td>' + (pesquisaSatisfacao.p01_4 || 0) + ' (' + (p01_total > 0 ? (((pesquisaSatisfacao.p01_4 || 0) / p01_total * 100).toFixed(1)) : '0.0') + '%)</td>';
            empresaHtml3 += '<td>' + (pesquisaSatisfacao.p01_5 || 0) + ' (' + (p01_total > 0 ? (((pesquisaSatisfacao.p01_5 || 0) / p01_total * 100).toFixed(1)) : '0.0') + '%)</td>';
            
            const satisfeitos_p01 = (pesquisaSatisfacao.p01_5 || 0) + (pesquisaSatisfacao.p01_4 || 0);
            empresaHtml3 += '<td>' + satisfeitos_p01 + ' (' + (p01_total > 0 ? UTILS.manipulaRelatorio(((satisfeitos_p01 / p01_total) * 100).toFixed(1)) : '0.0') + '%)</td>';
            empresaHtml3 += '</tr>';

            // Pergunta 2
            empresaHtml3 += '<tr>';
            empresaHtml3 += '<td>Pergunta 2</td>';
            
            const p02_total = pesquisaSatisfacao.p02_t || (pesquisaSatisfacao.p02_1 + pesquisaSatisfacao.p02_2 + pesquisaSatisfacao.p02_3 + pesquisaSatisfacao.p02_4 + pesquisaSatisfacao.p02_5);
            
            empresaHtml3 += '<td>' + (pesquisaSatisfacao.p02_1 || 0) + ' (' + (p02_total > 0 ? (((pesquisaSatisfacao.p02_1 || 0) / p02_total * 100).toFixed(1)) : '0.0') + '%)</td>';
            empresaHtml3 += '<td>' + (pesquisaSatisfacao.p02_2 || 0) + ' (' + (p02_total > 0 ? (((pesquisaSatisfacao.p02_2 || 0) / p02_total * 100).toFixed(1)) : '0.0') + '%)</td>';
            empresaHtml3 += '<td>' + (pesquisaSatisfacao.p02_3 || 0) + ' (' + (p02_total > 0 ? (((pesquisaSatisfacao.p02_3 || 0) / p02_total * 100).toFixed(1)) : '0.0') + '%)</td>';
            empresaHtml3 += '<td>' + (pesquisaSatisfacao.p02_4 || 0) + ' (' + (p02_total > 0 ? (((pesquisaSatisfacao.p02_4 || 0) / p02_total * 100).toFixed(1)) : '0.0') + '%)</td>';
            empresaHtml3 += '<td>' + (pesquisaSatisfacao.p02_5 || 0) + ' (' + (p02_total > 0 ? (((pesquisaSatisfacao.p02_5 || 0) / p02_total * 100).toFixed(1)) : '0.0') + '%)</td>';
            
            const satisfeitos_p02 = (pesquisaSatisfacao.p02_5 || 0) + (pesquisaSatisfacao.p02_4 || 0);
            empresaHtml3 += '<td>' + satisfeitos_p02 + ' (' + (p02_total > 0 ? UTILS.manipulaRelatorio(((satisfeitos_p02 / p02_total) * 100).toFixed(1)) : '0.0') + '%)</td>';
            empresaHtml3 += '</tr>';

            // Total Geral
            const total_p_1 = (pesquisaSatisfacao.p02_1 || 0) + (pesquisaSatisfacao.p01_1 || 0);
            const total_p_2 = (pesquisaSatisfacao.p02_2 || 0) + (pesquisaSatisfacao.p01_2 || 0);
            const total_p_3 = (pesquisaSatisfacao.p02_3 || 0) + (pesquisaSatisfacao.p01_3 || 0);
            const total_p_4 = (pesquisaSatisfacao.p02_4 || 0) + (pesquisaSatisfacao.p01_4 || 0);
            const total_p_5 = (pesquisaSatisfacao.p02_5 || 0) + (pesquisaSatisfacao.p01_5 || 0);
            const totalGeral = total_p_1 + total_p_2 + total_p_3 + total_p_4 + total_p_5;

            empresaHtml3 += '<tr class="font-bold bg-base-200">';
            empresaHtml3 += '<td>Total Geral</td>';
            empresaHtml3 += '<td>' + total_p_1 + ' (' + (totalGeral > 0 ? UTILS.manipulaRelatorio((total_p_1 * 100 / totalGeral).toFixed(1)) : '0.0') + '%)</td>';
            empresaHtml3 += '<td>' + total_p_2 + ' (' + (totalGeral > 0 ? UTILS.manipulaRelatorio((total_p_2 * 100 / totalGeral).toFixed(1)) : '0.0') + '%)</td>';
            empresaHtml3 += '<td>' + total_p_3 + ' (' + (totalGeral > 0 ? UTILS.manipulaRelatorio((total_p_3 * 100 / totalGeral).toFixed(1)) : '0.0') + '%)</td>';
            empresaHtml3 += '<td>' + total_p_4 + ' (' + (totalGeral > 0 ? UTILS.manipulaRelatorio((total_p_4 * 100 / totalGeral).toFixed(1)) : '0.0') + '%)</td>';
            empresaHtml3 += '<td>' + total_p_5 + ' (' + (totalGeral > 0 ? UTILS.manipulaRelatorio((total_p_5 * 100 / totalGeral).toFixed(1)) : '0.0') + '%)</td>';
            empresaHtml3 += '<td>' + (total_p_4 + total_p_5) + ' (' + (totalGeral > 0 ? UTILS.manipulaRelatorio(((total_p_5 + total_p_4) * 100 / totalGeral).toFixed(1)) : '0.0') + '%)</td>';
            empresaHtml3 += '</tr>';

            empresaHtml3 += '</tbody>';
            empresaHtml3 += '</table>';

            return empresaHtml3;
        }
    };

    // ════════════════════════════════════════════════════════════════════════════
    // EVENTS - Gerenciamento de Eventos
    // ════════════════════════════════════════════════════════════════════════════
    const EVENTS = {
        /**
         * Inicializar eventos
         */
        init() {
            this.bindSelectEmpresa();
            this.bindPeriodButtons();
            this.bindBuscarButton();
            this.bindCustomDates();
        },

        /**
         * Evento de mudança de empresa
         */
        bindSelectEmpresa() {
            UI.elements.selectEmpresa?.addEventListener('change', (e) => {
                const empresaId = e.target.value;
                STATE.setEmpresaId(empresaId);
            });
        },

        /**
         * Eventos dos botões de período
         */
        bindPeriodButtons() {
            UI.elements.periodButtons?.forEach(btn => {
                btn.addEventListener('click', () => {
                    const periodo = parseInt(btn.dataset.period);
                    STATE.setPeriodo(periodo);
                    UI.updatePeriodButtons(periodo);
                    UI.toggleCustomDates(periodo === 5);
                    
                    // Se já tiver empresa selecionada, buscar automaticamente
                    if (STATE.getEmpresaId()) {
                        CORE.buscarIndicadores();
                    }
                });
            });
        },

        /**
         * Evento do botão buscar
         */
        bindBuscarButton() {
            UI.elements.btnBuscar?.addEventListener('click', () => {
                CORE.buscarIndicadores();
            });
        },

        /**
         * Eventos de datas customizadas
         */
        bindCustomDates() {
            UI.elements.dataInicio?.addEventListener('change', () => {
                const dates = UI.getDates();
                STATE.setDatas(dates.inicio, dates.fim);
            });

            UI.elements.dataFim?.addEventListener('change', () => {
                const dates = UI.getDates();
                STATE.setDatas(dates.inicio, dates.fim);
            });
        }
    };

    // ════════════════════════════════════════════════════════════════════════════
    // CORE - Lógica Principal
    // ════════════════════════════════════════════════════════════════════════════
    const CORE = {
        /**
         * Inicializar aplicação
         */
        async init() {
            console.log('🚀 Inicializando Indicadores CallPhone Dashboard...');
            
            // Inicializar UI
            UI.init();
            
            // Inicializar eventos
            EVENTS.init();
            
            // Carregar empresas
            await this.carregarEmpresas();
            
            // Definir período padrão
            STATE.setPeriodo(1); // Hoje
            UI.updatePeriodButtons(1);
            
            console.log('✅ Indicadores CallPhone Dashboard inicializado');
        },

        /**
         * Carregar lista de empresas
         */
        async carregarEmpresas() {
            try {
                const response = await API.buscarNumeros();

                const empresas = response.data.map(item => {return {id: item.id, label: `${item.nome}`, numero: item.id};});

                STATE.setEmpresas(empresas);
                popularSelect('select-empresa', empresas, 'label', 'numero');
                
                console.log('✅ Empresas carregadas:', empresas.length);
            } catch (error) {
                console.error('❌ Erro ao carregar empresas:', error);
                UI.showError('Erro ao carregar empresas. Tente novamente.');
            }
        },

        /**
         * Buscar indicadores do dashboard
         */
        async buscarIndicadores() {

            if (!this.validarFiltros()) {
                return;
            }

            UI.showLoading();
            STATE.setLoading(true);

            // Montar parâmetros
            const params = this.montarParametros();

            // Buscar dados
            const response = await API.fetchIndicadoresDashboard(params);
            
            // Processa dados usando getMonitoria
            DASHBOARD.getMonitoria(response);
            
            console.log('✅ Dados recebidos:', response);
            UI.showSuccess('Indicadores carregados com sucesso!');
        },

        /**
         * Validar filtros antes de buscar
         */
        validarFiltros() {
            const empresaId = STATE.getEmpresaId();
            if (!empresaId) {
                UI.showError('Por favor, selecione uma empresa');
                return false;
            }

            // Validar datas customizadas
            if (STATE.isCustomPeriod()) {
                const { inicio, fim } = STATE.getDatas();
                
                if (!inicio || !fim) {
                    UI.showError('Por favor, preencha as datas de início e fim');
                    return false;
                }

                if (new Date(inicio) > new Date(fim)) {
                    UI.showError('A data de início deve ser anterior à data de fim');
                    return false;
                }
            }

            return true;
        },

        /**
         * Montar parâmetros para a API
         */
        montarParametros() {
            const params = {
                empresa_id: STATE.getEmpresaId(),
                periodo: STATE.getPeriodo()
            };

            if (STATE.isCustomPeriod()) {
                const { inicio, fim } = STATE.getDatas();
                params.dataInicio = inicio;
                params.dataFim = fim;
            }

            return params;
        }
    };

    // ════════════════════════════════════════════════════════════════════════════
    // INICIALIZAÇÃO
    // ════════════════════════════════════════════════════════════════════════════
    
    // Inicializar quando o DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => CORE.init());
    } else {
        CORE.init();
    }

    // ════════════════════════════════════════════════════════════════════════════
    // EXPORTAR PARA WINDOW (para debug e acesso externo)
    // ════════════════════════════════════════════════════════════════════════════
    
    window.IndicadoresCallphone = {
        STATE,
        API,
        UI,
        EVENTS,
        CORE,
        UTILS,
        DASHBOARD
    };

})();

console.log('✅ Módulo Indicadores CallPhone carregado com sucesso');
