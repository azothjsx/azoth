import { generate } from 'astring';
import { HtmlGenerator } from './HtmlGenerator.js';
import { Generator } from './GeneratorBase.js';
import isValidName from 'is-valid-var-name';
import { Analyzer } from './Analyzer.js';

function getNextLine(state) {
    const { indent, lineEnd, } = state;
    const indentation = indent.repeat(state.indentLevel);
    return `${lineEnd}${indentation}`;
}

export class TemplateGenerator extends Generator {
    templates = [];

    constructor() {
        super();
        this.htmlGenerator = node => generate(node, {
            generator: new HtmlGenerator(),
        });
    }

    JSXFragment(node, state) {
        this.JSXTemplate(node, state);
    }

    JSXElement(node, state) {
        this.JSXTemplate(node, state);
    }

    JSXTemplate(node, state) {
        const analyzer = new Analyzer(node);
        const template = analyzer.generateTemplate(this.htmlGenerator);
        if(!template.isEmpty) {
            this.templates.push(template);
        }

        this.InjectionWrapper(template, state);
    }

    /* Adopt implicit arrow as containing function */
    ArrowFunctionExpression(node, state) {
        if(node.body?.type === 'JSXElement') {
            node.body = {
                type: 'BlockStatement',
                body: [{
                    type: 'ReturnStatement',
                    argument: node.body,
                }]
            };
        }
        super.ArrowFunctionExpression(node, state);
    }

    /* Inject template statements above and return root dom */
    ReturnStatement(node, state) {
        // custom handling for direct return of jsx
        if(node.argument?.type === 'JSXElement') {
            node.argument.isReturnArg = true;
            this.JSXElement(node.argument, state);
            return;
        }

        super.ReturnStatement(node, state);
    }

    InjectionWrapper(template, state) {
        const { isEmpty, boundElements, node, bindings } = template;

        // console.log('wrap', node.isComponent, node.queryIndex, bindings.length);

        if(node.isComponent) {
            if(node.isReturnArg) state.write(`return `);

            if(bindings.length !== 1) {
                throw new Error('Unexpected component binding length');
            }

            const { expr } = bindings[0];
            state.write(`__createElement(`);
            this[expr.type](expr, state);
            this.JSXComponentProps(node, state);
            state.write(`)`);

            if(node.isReturnArg) state.write(`;`);

            return;

        }
        else if(isEmpty || (!boundElements.length) && node.queryIndex !== -1) {
            if(node.isReturnArg) state.write(`return `);
            this.TemplateRenderer(template, state);
            // dom root property
            if(!isEmpty) state.write(`[0]`);
            if(node.isReturnArg) state.write(`;`);

            return;
        }

        let nextLine = getNextLine(state);

        const useIIFEWrapper = !node.isReturnArg;
        if(useIIFEWrapper) {
            state.write(`(() => {`);
            state.indentLevel++;
            nextLine = getNextLine(state);
            state.write(nextLine);
        }

        this.JSXDomLiteral(template, state);

        state.write(`${nextLine}return __root;`);

        if(useIIFEWrapper) {
            state.indentLevel--;
            nextLine = getNextLine(state);
            state.write(`${nextLine}})()`);
        }
    }

    TemplateRenderer({ id, isEmpty, isDomFragment }, state) {
        if(isEmpty) {
            state.write('null');
            return;
        }

        state.write(`t${id}(`);
        if(isDomFragment) state.write('true');
        state.write(`)`);
    }

    JSXIdentifier(identifier, state) {
        state.write(identifier.name);
    }

    JSXDomLiteral(template, state) {
        const { boundElements, bindings } = template;

        const { indent, lineEnd, } = state;
        let indentation = indent.repeat(state.indentLevel);
        let nextLine = `${lineEnd}${indentation}`;

        // template service renderer call
        const rootVarName = `__root`;
        if(boundElements.length) {
            state.write(`const [${rootVarName}, __targets] = `);
            this.TemplateRenderer(template, state);
            state.write(';');
        }
        else {
            state.write(`const ${rootVarName} = `);
            this.TemplateRenderer(template, state);
            state.write('[0];');
        }

        // target variables
        for(let i = 0; i < boundElements.length; i++) {
            state.write(`${nextLine}const __target${i} = __targets[${i}];`);
        }

        // childNode variables prevent binding mutations from changing 
        // .childNode[1] returned value as it is a live list)
        for(let i = 0; i < bindings.length; i++) {
            const { element: { queryIndex }, type, index } = bindings[i];
            if(type !== 'child') continue;
            state.write(`${nextLine}const __child${i} = `);
            const varName = queryIndex === -1 ? rootVarName : `__target${queryIndex}`;
            state.write(`${varName}.childNodes[${index}];`);
        }

        // bindings
        for(let i = 0; i < bindings.length; i++) {
            const { element: { queryIndex }, type, node, expr } = bindings[i];
            state.write(`${nextLine}`);

            if(!this[expr.type]) {
                throw new TypeError(`Unexpected Binding expression AST type "${expr.type}"`);
            }

            if(node.isComponent) {
                state.write(`__composeElement(`);
                this[expr.type](expr, state);
                state.write(`, __child${i}`);
                this.JSXComponentProps(node, state);
                state.write(`);`);
            }
            else if(type === 'child') {
                state.write(`__compose(`);
                this.JSXExpressionContext(expr, state);
                state.write(`, __child${i});`);
            }
            else if(type === 'prop') {
                const varName = queryIndex === -1 ? rootVarName : `__target${queryIndex}`;
                state.write(`${varName}`);
                // TODO: more property validation
                const propName = node.name.name;
                // TODO: refactor with component props
                if(isValidName(propName)) {
                    state.write(`.${propName}`);
                }
                else {
                    state.write(`["${propName}"]`);
                }

                /* expression */
                state.write(` = (`); // do we need (...)? 
                this.JSXExpressionContext(expr, state);
                state.write(`);`);
            }
            else {
                const message = `Unexpected binding type "${type}", expected "child" or "prop"`;
                throw new Error(message);
            }
        }
    }

    JSXComponentProps({ props }, state) {
        if(!props?.length) return;

        state.write(`, {`);
        for(let i = 0; i < props.length; i++) {
            const { node, expr } = props[i];
            // TODO: Dom lookup, JS .prop v['prop'], etc. 
            // refactor with code below
            state.write(` ${node.name.name}: `);
            this.JSXExpressionContext(expr, state);
            state.write(`,`);
        }
        state.write(` }`);
    }

    // process javascript in {...} exprs,
    // stack context to support nested template,
    // recursive template processing ftw!
    JSXExpressionContext(node, state) {
        this[node.type](node, state);
    }

}


