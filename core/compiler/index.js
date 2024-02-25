import { Parser } from 'acorn';
import acornJsx from 'acorn-jsx';
import { generate as astring } from 'astring';
import { TemplateGenerator } from './transform/TemplateGenerator.js';
import { SourceMapGenerator } from 'source-map';

// compile = parse + generate
export function compile(code, options) {
    const parseOptions = options?.parse;
    const generateOptions = options?.generate;
    const ast = parse(code, parseOptions);
    return generate(ast, generateOptions);
}

// parse = js --> ast
const JsxParser = Parser.extend(acornJsx());
const base = {
    ecmaVersion: 'latest'
};
const required = {
    sourceType: 'module',
    locations: true,
};

export function parse(code, options = {}) {
    return JsxParser.parse(code, {
        ...base,
        ...options,
        ...required,
    });
}

// generate = ast --> code + html
export function generate(ast, config) {
    const file = config?.sourceFile || 'module.jsx';
    const sourceMap = new SourceMapGenerator({ file });
    const generator = new TemplateGenerator();

    const code = astring(ast, {
        ...config,
        generator,
        sourceMap,
    });

    return {
        code,
        templates: generator.templates,
        map: sourceMap.toJSON(),
        // exposed for testing
        _sourceMap: sourceMap,
    };
}
