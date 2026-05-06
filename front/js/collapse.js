class BashAccordion {
    constructor(container, options = {}) {
        this.container = this._getContainer(container);
        this.options = {
            duration: options.duration || 300,
            easing: options.easing || 'ease-in-out',
            id: options.id || '',
            title: options.title || '',
            content: options.content || '',
            ...options
        };
        this.accordion = null;
        this.accordionButton = null;
        this.accordionContent = null;
        this.icon = null;
        this.isCollapsed = true;
        this.init();
    }

    init() {
        this.createElement();
        this.attachEvents();
    }

    _getContainer(container) {
        if (typeof container === 'string') {
            return $(container);
        } else if (container instanceof HTMLElement) {
            return $(container);
        } else if (container instanceof jQuery) {
            return container;
        } else {
            throw new Error("Invalid container provided for BashAccordion.");
        }
    }

    createElement() {
        const $accordion = $('<div>');
        const $accordionTitle = $('<div>');
        const $accordionButton = $('<button>');
        const $accordionContent = $('<div>');
        const $icon = $('<i>');

        // Icon
        $icon.addClass("fa-solid fa-angle-right").attr("data-icon", "");

        // Classes
        $accordion.addClass("accordion w-full border border-base-100 bg-base-100 rounded-xl flex-col gap-2 border-b p-3 border-neutral pr-2");
        if (this.options.id) $accordion.attr('id', this.options.id);
        $accordionTitle.addClass("accordion-title flex flex-row justify-between items-center w-full");
        $accordionButton.addClass("p-4 flex-1 flex justify-start gap-2 items-center font-semibold py-2");
        $accordionContent.addClass("accordion-content px-4 pb-4 w-full text-base-content");
        $accordionContent.hide();

        $accordionButton.text(this.options.title);
        $accordionButton.prepend($icon);

        if (this.options.content) $accordionContent.html(this.options.content);

        $accordionTitle.append($accordionButton);
        $accordion.append($accordionTitle);
        $accordion.append($accordionContent);

        // Store references
        this.accordion = $accordion;
        this.accordionButton = $accordionButton;
        this.accordionContent = $accordionContent;
        this.icon = $icon;

        // Store instance reference on the element for state management
        $accordion.data('bashAccordion', this);

        // Add to container
        console.log("Adding accordion to container:", this.container);
        if (this.container) this.container.append($accordion);
    }

    attachEvents() {
        this.accordionButton.on("click", () => this.toggle());
    }

    toggle() {
        const $accordion = this.accordion;
        const $content = this.accordionContent;
        const $icon = this.icon;

        // Close siblings first
        const $siblings = $accordion.siblings(".accordion");
        $siblings.each((index, sibling) => {
            const $sibling = $(sibling);
            const $siblingContent = $sibling.find(".accordion-content");
            const $siblingIcon = $sibling.find("[data-icon]");
            
            if ($siblingContent.is(":visible")) {
                $siblingContent.slideUp(this.options.duration);
                $siblingIcon.removeClass("fa-angle-down").addClass("fa-angle-right");
                $sibling.removeClass("bg-base-300");
                
                // Update sibling state if it has a BashAccordion instance
                const siblingInstance = $sibling.data('bashAccordion');
                if (siblingInstance) {
                    siblingInstance.isCollapsed = true;
                }
            }
        });

        // Check current state AFTER closing siblings
        const isCurrentlyOpen = $content.is(":visible");

        // Now toggle current accordion
        if (isCurrentlyOpen) {
            this.collapse($accordion, $content, $icon);
        } else {
            this.expand($accordion, $content, $icon);
        }
    }

    expand($accordion, $content, $icon) {
        if (!this.isCollapsed) return;
        $accordion.addClass("bg-base-300");
        $content.slideDown(this.options.duration);
        $icon.removeClass("fa-angle-right").addClass("fa-angle-down");
        this.isCollapsed = false;
        $accordion.trigger('accordion:expanded');
    }

    collapse($accordion, $content, $icon) {
        if (this.isCollapsed) return;
        $accordion.removeClass("bg-base-300");
        $content.slideUp(this.options.duration);
        $icon.removeClass("fa-angle-down").addClass("fa-angle-right");
        this.isCollapsed = true;
        $accordion.trigger('accordion:collapsed');
    }

    setContent(content) {
        this.accordionContent.html(content);
        this.collapse(this.accordion, this.accordionContent, this.icon);
    }

    getElement() {
        return this.accordion;
    }

    getBody() {
        return this.accordionContent;
    }

    destroy() {
        if (this.accordion && this.accordion.length) {
            // Remove data reference before destroying
            this.accordion.removeData('bashAccordion');
            this.accordion.remove();
        }
    }
}