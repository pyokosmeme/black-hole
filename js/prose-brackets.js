// Opt in after markdown renders; empty markup and invisible text are not prose.
export function markProseBrackets(root) {
    const selector = '.author-bio, blockquote';
    const elements = [...root.querySelectorAll(selector)];
    if (root.matches(selector)) elements.unshift(root);

    for (const element of elements) {
        const text = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                const excluded = node.parentElement.closest('[hidden], [aria-hidden="true"], script, style, template');
                return !excluded && /[^\s\u200B-\u200D\uFEFF]/u.test(node.textContent)
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_REJECT;
            }
        });
        element.classList.toggle('has-prose', Boolean(text.nextNode()));
    }
}
