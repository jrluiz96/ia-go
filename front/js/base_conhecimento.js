if (typeof window.bashPublications === 'undefined') {
    window.bashPublications = {
        categories: [],
        lastUpdate: null,

        init: function () {
            // window.bashPublications.loadFromStorage();
            // if (window.bashPublications.categories.length === 0) {
            window.bashPublications.fetchPublications();
            // }
            window.bashPublications.setupEventListeners();
            window.bashPublications.renderAll();
        },

        loadFromStorage: function () {
            const stored = localStorage.getItem('bashPublications');
            if (stored) {
                const data = JSON.parse(stored);
                window.bashPublications.categories = data.categories || [];
                window.bashPublications.lastUpdate = data.lastUpdate ? new Date(data.lastUpdate) : null;
            }
        },

        saveToStorage: function () {
            const data = {
                categories: window.bashPublications.categories,
                lastUpdate: new Date().toISOString()
            };
            localStorage.setItem('bashPublications', JSON.stringify(data));
        },

        fetchPublications: function () {
            let usuario = JSON.parse(localStorage.getItem("usuario"));
            data = {
                usuario_id_sessao: usuario.id,
            }
            urlOp="v1/sessao/baseConhecimento"
            // urlOp='v1/app/infohub/categoria/find-categorias-publicacoes'           
            req(urlOp, 'POST', data, (response) => {
                
                if (!response.data) {
                    avisos('Base de Conhecimento', response.message || 'Nenhum dado retornado', "error");
                    return;
                }
                if (response.data.length === 0) {
                    avisos('Base de Conhecimento', 'Nenhum registro encontrado!', "warning");
                    return;
                }
                // try {
                    if (response.data) {
                        window.bashPublications.processResponse(response.data);
                        window.bashPublications.saveToStorage();
                        window.bashPublications.renderAll();
                    }
                // } catch (error) {
                //     if (error) {
                //         console.error('Erro ao processar dados da fila:', error);
                //         avisos('Base de Conhecimento', 'Erro na requisição', "error");
                //         window.bashPublications.publications = window.bashPublications.getMockCategories();
                //         window.bashPublications.saveToStorage();
                //         window.bashPublications.renderAll();
                //     }
                // }
            }, (error) => {
                if (error){
                    console.error(error);
                    avisos('Base de Conhecimento', error.message || 'Erro na requisição', "error");
                }
                window.bashPublications.publications = window.bashPublications.getMockCategories();
                window.bashPublications.saveToStorage();
                window.bashPublications.renderAll();
            });
        },
        processResponse: function (responseData) {
            console.log(responseData);
            // responseData é um array de categorias
            window.bashPublications.categories = responseData.map(category => ({
                id: category.id,
                name: category.nome,
                publications: category.publicacoes.map(pub => ({
                    id: pub.publicacao_id,
                    title: pub.publicacao_titulo,
                    creationDate: pub.publicacao_criacao,
                    content: pub.publicacao_publicacao ? JSON.parse(pub.publicacao_publicacao) : null,
                    comments: pub.comentarios || [],
                    hasSupport: pub.bl_atendimento,
                    clientId: pub.cliente_id,
                    file: pub.arquivo
                })|| [])
            }));
        },

        getMockCategories: function () {
            // Dados mockados com a mesma estrutura
            return [
                {
                    id: "57825c4a-7ce0-41ee-88a4-1840795b7642",
                    name: "Bash Technology - Manual",
                    publications: [
                        {
                            id: "df4786f5-c252-4da6-888f-6cf9b8e665c1",
                            title: "Tela de Atendimento Callphone",
                            rating: 4.5,
                            creationDate: "07-11-2024 14:57:48",
                            content: {
                                time: 1738002251297,
                                blocks: [
                                    {
                                        id: "QMuIoRFre_",
                                        type: "paragraph",
                                        data: {
                                            text: "1- Na tela inicial do sistema App, acesse o atendimento PABX clicando no icone ao lado do nome de usuario."
                                        }
                                    }
                                ]
                            },
                            comments: [],
                            hasSupport: true,
                            clientId: "fb37e0ec-b9f8-4ae3-90a5-229228471319",
                            file: ""
                        }
                    ]
                }
            ];
        },

        renderAll: function () {
            const container = $('#manual_base_conhecimento_container');
            container.empty().addClass('flex h-full bg-base-100');

            // Criar sidebar
            const sidebar = $('<div>', {
                class: 'w-1/3 bg-base-200 border-r border-base-300 flex flex-col h-full overflow-y-auto'
            });

            // Criar área de conteúdo
            const contentArea = $('<div>', {
                class: 'w-2/3 p-6 overflow-y-auto bg-base-100',
                id: 'itemContent'
            }).append(
                $('<div>', {
                    class: 'flex flex-col items-center justify-center h-full text-gray-400',
                    html: `
                        <i class="fas fa-book-open text-4xl mb-3"></i>
                        <p class="text-lg">Selecione uma publicação na lista ao lado</p>
                    `
                })
            );

            // Preencher sidebar com categorias e publicações
            window.bashPublications.categories.forEach(category => {
                const accordionId = `accordion-${category.id}`;

                const categoryContainer = $('<div>', {
                    class: 'border-b border-base-300'
                });

                const accordionButton = $('<button>', {
                    class: 'flex justify-between items-center w-full p-4 font-medium text-left hover:bg-base-300 transition-colors',
                    html: `
                        <span class="flex items-center gap-2">
                            <i class="fas fa-folder text-primary"></i>
                            ${category.name}
                        </span>
                        <i class="fas fa-chevron-down transition-transform duration-200"></i>
                    `,
                    click: (e) => {
                        const icon = $(e.currentTarget).find('i.fa-chevron-down');
                        icon.toggleClass('rotate-180');
                        $(`#${accordionId}`).slideToggle(200);
                    }
                });

                const publicationsList = $('<ul>', {
                    id: accordionId,
                    class: 'hidden space-y-1 p-2 bg-base-100'
                });

                category.publications.forEach(publication => {
                    const pubBtn = $('<button>', {
                        class: 'flex justify-between items-center w-full px-3 py-2 text-left rounded-lg hover:bg-base-300 transition-colors',
                        html: `
                            <span class="truncate">${publication.title}</span>
                            ${publication.rating ? `<span class="badge badge-primary badge-sm">${publication.rating.toFixed(1)}</span>` : ''}
                        `,
                        click: (e) => {
                            // Remove active class from all buttons
                            $('.publication-btn').removeClass('bg-primary text-primary-content');
                            // Add active class to clicked button
                            $(e.currentTarget).addClass('bg-primary text-primary-content');
                            console.log(publication);
                            window.bashPublications.renderPublicationContent(publication, contentArea);
                        }
                    }).addClass('publication-btn');

                    publicationsList.append($('<li>').append(pubBtn));
                });
                categoryContainer.append(accordionButton, publicationsList);
                sidebar.append(categoryContainer);

                // Abre o primeiro accordion por padrão
                if (window.bashPublications.categories.indexOf(category) === 0) {
                    accordionButton.find('i.fa-chevron-down').addClass('rotate-180');
                    publicationsList.removeClass('hidden').show();
                }
            });

            container.append(sidebar, contentArea);

            // Se houver publicações, renderizar a primeira por padrão
            if (window.bashPublications.categories.length > 0 && window.bashPublications.categories[0].publications.length > 0) {
                const firstPubBtn = sidebar.find('.publication-btn').first();
                firstPubBtn.addClass('bg-primary text-primary-content');
                window.bashPublications.renderPublicationContent(window.bashPublications.categories[0].publications[0], contentArea);
            }
        },
        renderPublicationContent: function (publication, container) {
            // Limpar container
            container.empty();            
            // Criar cabeçalho
            const header = $('<div>', { class: 'mb-6' }).append(
                $('<h2>', {
                    class: 'text-2xl font-bold mb-2',
                    text: publication.title
                }),
                $('<div>', { class: 'flex items-center gap-2 mb-4' }).append(
                    publication.rating ? $('<div>', {
                        class: 'badge badge-primary',
                        text: `Nota: ${publication.rating.toFixed(1)}`
                    }) : '',
                    $('<span>', {
                        class: 'text-sm text-gray-500',
                        text: `Publicado em: ${publication.creationDate}`
                    })
                )
            );

            // Renderizar conteúdo (usando EditorJS)
            const contentContainer = $('<div>', { class: 'prose max-w-none' });

            if (publication.content && publication.content.blocks) {
                publication.content.blocks.forEach(block => {
                    if (block.type === 'paragraph') {
                        contentContainer.append(
                            $('<p>', { text: block.data.text })
                        );
                    } else if (block.type === 'header') {
                        const level = `h${block.data.level}`;
                        contentContainer.append(
                            $(`<${level}>`, {
                                class: 'font-bold mt-4 mb-2',
                                text: block.data.text
                            })
                        );
                    } else if (block.type === 'image') {
                        contentContainer.append(
                            $('<img>', {
                                src: block.data.url,
                                class: 'max-w-full rounded-lg shadow-md my-4',
                                alt: block.data.caption || ''
                            })
                        );
                    }
                    if (block.type === 'link') {
                        contentContainer.append(
                            $('<a>', {
                                href: block.data.link,
                                target: '_blank',
                                class: 'btn btn-info btn-sm my-2 gap-2 inline-flex items-center',
                                html: `<i class="fas fa-link"></i> ${block.data.text || block.data.link}`
                            })
                        );
                    }
                    // Adicione outros tipos de blocos conforme necessário
                });
            } else if (publication.content && publication.content.data && publication.content.data.texto) {
                let rawText = publication.content.data.texto;

                // 🔹 Corrigir escapes do conteúdo vindo do backend
                rawText = rawText
                    .replace(/\\\\/g, '\\')       // \\\\ => \ 
                    .replace(/\\#/g, '#')         // \# => #
                    .replace(/\\>/g, '>')         // \> => >
                    .replace(/\\\*/g, '*')        // \* => *
                    .replace(/\\_/g, '_')         // \_ => _
                    .replace(/\\\./g, '.')        // \. => .
                    .replace(/\\n/g, '\n');       // \n => quebra real

                // 🔹 Remove > vazios
                rawText = rawText.replace(/^>\s*$/gm, '');

                // 🔹 Títulos com limpeza de \
                rawText = rawText.replace(/^####\s+(.+)$/gm, (_, titulo) =>
                    `<h5 class="text-lg font-semibold mt-4 mb-2">${titulo.split('\\').join('')}</h5>`
                );
                rawText = rawText.replace(/^###\s+(.+)$/gm, (_, titulo) =>
                    `<h4 class="text-lg font-semibold mt-4 mb-2">${titulo.split('\\').join('')}</h4>`
                );
                rawText = rawText.replace(/^##\s+(.+)$/gm, (_, titulo) =>
                    `<h3 class="text-xl font-semibold mt-6 mb-3">${titulo.split('\\').join('')}</h3>`
                );
                rawText = rawText.replace(/^#\s+(.+)$/gm, (_, titulo) =>
                    `<h2 class="text-2xl font-bold mt-8 mb-4">${titulo.split('\\').join('')}</h2>`
                );

                // 🔹 Blockquote com filtro de lixo
                rawText = rawText.replace(/^>\s*(.*)$/gm, (_, conteudo) => {
                    const clean = conteudo.trim();
                    if (
                        clean === '' ||
                        clean.startsWith('!') ||
                        clean === '>' ||
                        clean === '| >' ||
                        clean === '\\>'
                    ) return '';
                    return `<blockquote class="border-l-4 border-primary pl-4 my-3 italic"><i class="fas fa-quote-left text-primary mr-2"></i>${clean}</blockquote>`;
                });

                // 🔹 Negrito e itálico
                rawText = rawText.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
                rawText = rawText.replace(/\*([^*]+)\*/g, '<em>$1</em>');
                rawText = rawText.replace(/__([^_]+)__/g, '<strong>$1</strong>');
                rawText = rawText.replace(/_([^_]+)_/g, '<em>$1</em>');

                // 🔹 Quebra de linha (markdown)
                rawText = rawText.replace(/\n/g, '');
                
                // 🔹 Alertas DaisyUI
                rawText = rawText.replace(/\{\.is-info\}/g, '<div class="alert alert-info my-4"><i class="fas fa-info-circle mr-2"></i><span>Informação importante.</span></div>');
                rawText = rawText.replace(/\{\.is-warning\}/g, '<div class="alert alert-warning my-4"><i class="fas fa-exclamation-triangle mr-2"></i><span>Aviso.</span></div>');
                rawText = rawText.replace(/\{\.is-success\}/g, '<div class="alert alert-success my-4"><i class="fas fa-check-circle mr-2"></i><span>Sucesso!</span></div>');
                rawText = rawText.replace(/\{\.is-danger\}/g, '<div class="alert alert-error my-4"><i class="fas fa-times-circle mr-2"></i><span>Erro!</span></div>');

                // 🔹 Listas
                rawText = rawText.replace(/\{\.links-list\}/g, '<ul class="list-disc ml-6 mt-2 mb-4">');

                // 🔹 Links
                rawText = rawText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="link link-info">$1</a>');

                // 🔹 Imagens
                rawText = rawText.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
                    const fullSrc = src.startsWith('http') ? src : `https://kb.detran.rs.gov.br/pt-br${src}`;
                    return `<img src="${fullSrc}" alt="${alt}" class="rounded shadow-md my-4 max-w-full">`;
                });

                // 🔹 Montar HTML final
                const temp = $('<div>', { html: rawText, class: 'prose max-w-none' });

                // 🔹 Remove "Assuntos do tópico"
                temp.find('h2, h3').each(function () {
                    if ($(this).text().trim().toLowerCase() === 'assuntos do tópico') {
                        let $next = $(this).next();
                        while ($next.length && !$next.is('h2, h3')) {
                            const $toRemove = $next;
                            $next = $next.next();
                            $toRemove.remove();
                        }
                        $(this).remove();
                    }
                });

                // 🔹 Apêndice ao container final
                contentContainer.append(temp);
            }

            const commentsSection = $('<div>', { class: 'mt-8' }).append(
                $('<div>', { class: 'flex flex-row items-center justify-center gap-3 mb-6 h-10' }).append(
                    $('<h3>', {
                        class: 'text-xl font-semibold flex items-center gap-2',
                        html: `<i class="fas fa-comments text-primary"></i> Comentários`
                    }),
                    $('<span>', {
                        class: 'badge badge-primary',
                        text: publication.comments.length
                    })
                )
            );
            // Seção de comentários
            if (publication.comments && publication.comments.length > 0) {
                const commentsList = $('<div>', { class: 'space-y-6' });

                publication.comments.forEach(comment => {
                    const commentDate = formatarData(comment.data);
                    commentsList.append(
                        $('<div>', { class: 'flex gap-4 group border rounded p-2' }).append(
                            // Avatar do usuário
                            $('<div>', { class: 'flex-shrink-0' }).append(
                                $('<div>', {
                                    class: 'avatar placeholder',
                                    html: `
                                        <div class="bg-neutral-focus text-neutral-content rounded-full w-12 h-12 flex items-center justify-center">
                                            <i class="fas fa-user text-lg"></i>
                                        </div>
                                    `
                                })
                            ),

                            // Corpo do comentário
                            $('<div>', { class: 'flex-1' }).append(
                                $('<div>', { class: 'flex justify-between items-center mb-1' }).append(
                                    $('<span>', {
                                        class: 'font-bold text-base-content flex items-center gap-2',
                                        html: `
                                            ${comment.usuario || 'Anônimo'}
                                            ${comment.resposta_oficial ?
                                                '<span class="badge badge-primary badge-sm gap-1"><i class="fas fa-check-circle"></i> Oficial</span>' : ''}
                                        `
                                    }),
                                    $('<span>', {
                                        class: 'text-xs text-gray-500 flex items-center gap-1',
                                        html: `<i class="far fa-clock"></i> ${commentDate}`
                                    })
                                ),

                                $('<div>', {
                                    class: 'text-base-content/90 mb-2 pl-1',
                                    text: comment.texto
                                }),

                                // Ações do comentário
                                $('<div>', { class: 'flex gap-4 text-sm opacity-0 group-hover:opacity-100 transition-opacity' }).append(
                                    $('<button>', {
                                        class: 'btn btn-ghost btn-xs gap-1 text-gray-500 hover:text-primary',
                                        html: `<i class="fas fa-thumbs-up"></i> Curtir`
                                    }),

                                    $('<button>', {
                                        class: 'btn btn-ghost btn-xs gap-1 text-gray-500 hover:text-primary',
                                        html: `<i class="fas fa-reply"></i> Responder`
                                    }),

                                    $('<button>', {
                                        class: 'btn btn-ghost btn-xs gap-1 text-gray-500 hover:text-error',
                                        html: `<i class="fas fa-flag"></i> Reportar`
                                    })
                                )
                            )
                        )
                    );
                });

                commentsSection.append(commentsList);

                // Formulário de novo comentário
                commentsSection.append(
                    $('<div>', { class: 'mt-8 pt-6 border-t border-base-200' }).append(
                        $('<h4>', {
                            class: 'text-lg font-medium mb-4 flex items-center gap-2',
                            html: `<i class="fas fa-edit"></i> Adicionar comentário`
                        }),
                        $('<form>', { class: 'space-y-3' }).append(
                            $('<textarea>', {
                                class: 'textarea textarea-bordered w-full',
                                placeholder: 'Escreva seu comentário...',
                                rows: 3
                            }),
                            $('<div>', { class: 'flex justify-end gap-2' }).append(
                                $('<button>', {
                                    type: 'button',
                                    class: 'btn btn-ghost',
                                    text: 'Cancelar'
                                }),
                                $('<button>', {
                                    type: 'submit',
                                    class: 'btn btn-primary gap-2',
                                    html: `<i class="fas fa-paper-plane"></i> Enviar`
                                })
                            )
                        )
                    )
                );
            } else {
                commentsSection.append(
                    $('<div>', { class: 'text-center py-8' }).append(
                        $('<i>', {
                            class: 'fas fa-comment-slash text-4xl text-gray-300 mb-3'
                        }),
                        $('<p>', {
                            class: 'text-gray-500 font-medium',
                            text: 'Nenhum comentário ainda'
                        }),
                        $('<p>', {
                            class: 'text-sm text-gray-400',
                            text: 'Seja o primeiro a comentar!'
                        }),
                        $('<button>', {
                            class: 'btn btn-primary btn-sm mt-4 gap-2',
                            html: `<i class="fas fa-plus"></i> Adicionar comentário`
                        })
                    )
                );
            }
            // Adicionar tudo ao container principal
            container.append(header, contentContainer, commentsSection);

            // Rolar para o topo
            container.scrollTop(0);
        },
        setupEventListeners: function () {
            // Configure os event listeners necessários
        },

        // Métodos utilitários
        getCategoryById: function (id) {
            return window.bashPublications.categories.find(cat => cat.id === id);
        },

        getPublicationById: function (id) {
            for (const category of window.bashPublications.categories) {
                const publication = category.publications.find(pub => pub.id === id);
                if (publication) return publication;
            }
            return null;
        },
        addComment: function (publicationId, comment) {
            const publication = window.bashPublications.getPublicationById(publicationId);
            if (publication) {
                publication.comments.push(comment);
                window.bashPublications.saveToStorage();
                window.bashPublications.renderAll();
                return true;
            }
            return false;
        }
    };
}
$(document).ready(function () {
    window.bashPublications.init();
});