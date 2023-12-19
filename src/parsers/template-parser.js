import { Parser as HtmlParser } from 'htmlparser2';
import { smartTrimLeft, smartTrimRight } from '../transformers/smart-trim.js';
import voidElements from '../utils/void-elements.js';

export function parse(azNode) {
    const { template } = azNode;
    const { quasis, bindings } = template;

    // element context
    let context = null;
    const contextStack = [];
    const peek = () => contextStack.at(-1); 
    const addContext = (name) => {
        const ctx = {
            inTagOpen: true,
            el: {
                name,
                childCount: 0
            },
            attrs: [],
            isBound: false,
        };
        contextStack.push(ctx);
        context = ctx; 
    };
    const removeContext = () => {
        contextStack.pop();
        context = contextStack.at(-1);
    };

    // add a root context for parsing ease
    addContext('<>');

    // html builder for current template element
    let html = [];
    let chunks = [];
    const pushHtmlChunk = () => {
        const chunk = html;
        html = [];
        if(chunk.length) chunks.push(chunk);
        return chunk;
    };

    const closeOpenTag = () => {
        if(attribute) addAttribute(attribute);

        const curEl = peek();        
        if(curEl.inTagOpen) {
            curEl.inTagOpen = false;
            html.push('>');
        }
    };

    let attribute = null;
    const addAttribute = (attr = attribute) => {
        let { name, value = '', quote = '' } = attr;
        if(value === '') {
            context.attrs.push(` ${name}`);
        }
        else {
            context.attrs.push(` ${name}=${quote}${value}${quote}`);
        }

        if(attr === attribute) attribute = null;
    };

    
    const handler = {
        onopentagname(name) {
            // increment index on parent context and close its opening
            context.el.childCount++;
            // closeOpenTag();
            // make this context the current context
            addContext(name);
            html.push(`<${name}`);
            html.push(context.attrs);
        },
        onattribute(name, value, quote) {
            if(attribute) addAttribute();
            attribute = { name, value, quote };
        },
        onopentag(name, attributes, isImplied) {
            closeOpenTag();
        },
        ontext(text) {            
            // closeOpenTag();
            context.el.childCount++;
            html.push(text);
        },
        onclosetag(name, isImplied) {
            // either close with >, />, or </tag>
            if(isImplied && !voidElements.has(name)) html.push('/'); 
            // closeOpenTag();
            if(!isImplied) html.push(`</${name}>`);

            removeContext();
        },
        oncomment(comment) {
            // implement me...
        },
    };

    var parser = new HtmlParser(handler, { recognizeSelfClosing: true });

    // opening quasi
    let quasi = quasis[0];
    let text = smartTrimLeft(quasi.value.raw);
    parser.write(text);
    pushHtmlChunk();

    // binding targets
    const targets = [];

    for(let i = 0; i < bindings.length; i++) {
        const binding = bindings[i];
        const { el } = context;

        let queryIndex = targets.lastIndexOf(el);
        if(queryIndex === -1) queryIndex = (targets.push(el) - 1);
        binding.queryIndex = queryIndex;
        // use the obj ref so will be child count by the end
        binding.element = el;
        
        let trimmedQuote = '';
        if(context.inTagOpen) {
            /* property binder */
            if(attribute) addAttribute();

            // This forces the parser to close the 
            // attribute as it might be waiting for
            // more attribute text content
            let quote = text.at(-1);
            if(quote !== '"' || quote !== "'") quote = '"';    
            parser.write(trimmedQuote = quote);
            
            if(attribute) binding.propertyKey = attribute.name;
            // remove the html attribute (it won't get pushed)
            attribute = null;
        }
        else { /* child node (text or block) */
            
            // copy value as el will increment w/ more added
            binding.childIndex = el.childCount;
            parser.write('<text-node></text-node>');
        }

        if(!context.isBound) {
            addAttribute({ name: 'data-bind' });
            context.isBound = true;
        }

        pushHtmlChunk();

        // next template element
        quasi = quasis[i + 1];
        text = quasi.value.raw;
        if(trimmedQuote && text[0] === trimmedQuote) {
            text = text.slice(1);
        }
        else {
            // TODO: Quote match validation errors
        }
        if(i + 1 === bindings.length) text = smartTrimRight(text);
        parser.write(text);
    }
    
    parser.end();
    
    // don't forget the last chunk!
    pushHtmlChunk();
    azNode.chunks = chunks.map(chunk => chunk.flat().join(''));

    // TBD:
    // azNode.targets = targets;

    return azNode;
}