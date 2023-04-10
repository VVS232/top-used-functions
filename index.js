const fs = require('fs');
const fg = require('fast-glob');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const glob = process.argv.slice(2);

async function main() {
    const files = await fg(glob);
    const functionMap = new Map();
    files.forEach(file => { // first iteration, collect all function declaration, export declaration, etc
        const code = fs.readFileSync(file, 'utf8');
        const ast = parser.parse(code, {sourceType: 'module', plugins: ['jsx']});
        traverse(ast, {
            VariableDeclaration: function (path) {
                path.node.declarations.forEach(declaration => {
                    const declarationType = declaration.init?.type;
                    if (declarationType === 'FunctionExpression' ||
                        declarationType === 'ArrowFunctionExpression') {
                        const functionName = declaration.id.name;
                        functionMap.set(functionName, { count: 0});
                    }
                });

            }, ExportDefaultDeclaration: function (path) {
                const declaration = path.node.declaration;
                if (!declaration) {
                    return;
                }
                if (declaration.type === 'FunctionDeclaration') { // case when function has name
                    if (declaration.id?.name) {
                        const functionName = declaration.id.name;
                        functionMap.set(functionName, {imports: [], count: 0});
                    }

                    const fileNameStart = file.lastIndexOf('/'); // when anonymous fn
                    const fileName = file.slice(fileNameStart + 1)
                    functionMap.set(fileName, {count: 0});
                }
            }, ExportNamedDeclaration: function (path) {
                const declaration = path.node.declaration;
                if (!declaration) {
                    return;
                }
                if (declaration.type === 'FunctionDeclaration') {
                    const functionName = declaration.id.name;
                    functionMap.set(functionName, { count: 0});
                }
                if (declaration.type === 'VariableDeclaration') {
                    declaration.declarations.forEach(declaration => {

                        if (declaration.type === 'VariableDeclarator') {

                            if (declaration.init && (declaration.init.type === 'FunctionExpression' ||
                                declaration.init.type === 'ArrowFunctionExpression' ||
                                declaration.init.type === 'CallExpression')) { // when variable is created like const Foo = bar(); Possibly, a fn
                                const functionName = declaration.id.name;
                                functionMap.set(functionName, {
                                    count: 0,
                                    filename: declaration.id.loc.filename
                                });
                            }

                        }

                    });
                }
                // if (declaration.type === 'ClassDeclaration') {
                //     const functionName = declaration.id.name;
                //     functionMap.set(functionName, { count: 0 });
                // }
            }
        })
    })

    files.forEach(file => {
        const code = fs.readFileSync(file, 'utf8');
        const ast = parser.parse(code, {sourceType: 'module', plugins: ['jsx']});
        traverse(ast, {
            CallExpression: function (path) {
                if (path.node.callee.type === 'Identifier') {
                    const functionName = path.node.callee.name;
                    if (functionMap.has(functionName)) {
                        functionMap.get(functionName).count++;
                    }
                }
            },
            VariableDeclaration: function (path) {
                path.node.declarations.forEach(declaration => {
                    const declarationType = declaration.init?.type;
                    if (declarationType === 'CallExpression') {
                        const arguments = declaration.init.arguments;
                        arguments.forEach(argument => {
                            if (argument.name && functionMap.has(argument.name)) {
                                const functionName = argument.name
                                functionMap.get(functionName).count++;

                            }
                        })
                        const functionName = declaration.id.name;
                        functionMap.set(functionName, {imports: [], count: 0});
                    }
                })
            }, JSXElement: function (path) {
                if (path.node.openingElement.name.type === 'JSXIdentifier') {
                    const functionName = path.node.openingElement.name.name

                    try {
                        functionMap.get(functionName).count++;
                    } catch (e) {}

                }
            },
            ImportDeclaration(path){ // for default exports/imports
                path.node.specifiers.forEach(specifier=>{
                    if(specifier.type==='ImportDefaultSpecifier'){
                        const fileNameStart = path.node.source.value.lastIndexOf('/');
                        const fileName = path.node.source.value.slice(fileNameStart + 1)+'.js'
                    if (functionMap.has(fileName))
                        functionMap.get(fileName).count++;
                    }
                })
            }
        })
    })
    const sortedArray = Array.from(functionMap).sort((a, b) => b[1].count - a[1].count)
        .filter(el => el[1].count > 5);

    console.log(new Map(sortedArray), 'functionMap');
}

main()