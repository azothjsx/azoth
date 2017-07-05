
export function makeFragment(html) {
    return toFragment(makeDiv(html).childNodes);
}

export function toFragment(childNodes) {
    const fragment = document.createDocumentFragment();
    
    let node;
    while(node = childNodes[0]) {
        fragment.appendChild(node);
    }

    return fragment;
}

const div = document.createElement('div');
export function makeDiv(html) {
    div.innerHTML = html;
    return div;
}

export function makeHtml(html) {
    return makeDiv(html).innerHTML;
}