import fs from 'fs';
import fg from 'fast-glob';
import {parse} from '@babel/parser';
import traverse from '@babel/traverse';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
const argv = yargs(hideBin(process.argv)).options({
    "min-usages": {
        alias: 'm',
        default:1,
        description: 'Filter function with usages min than the passed value',
        type:'number'
    },
    "ignore-test-files":{
        default:false,
        type:"boolean",
        descrtiption:"don't count function invocation in .test.js files"
    }
}).parseSync();
// @ts-ignore
const glob = String(argv._[0]);

async function main() {    
if(!fg.isDynamicPattern(glob)){
    console.log(`Incorrect glob was passed. Please pass a glob as an argument. 
        For more info please refer to https://github.com/mrmlnc/fast-glob`);
    return;
}

    const files = await fg(glob);
    const functionMap = new Map();

    const minUsagesToShow = !isNaN(argv.minUsages) ? argv.minUsages : 1;
    const shouldIgnoreTestFiles = argv.ignoreTestFiles;
    
    files.forEach(file => { // first iteration, collect all function declaration, export declaration, etc
        const code = fs.readFileSync(file, 'utf8');        
        const ast = parse(code, {sourceType: 'module', plugins: ['jsx']});
        traverse(ast, {
            VariableDeclaration: function (path) {
                path.node.declarations.forEach(declaration => {
                    const declarationType = declaration.init?.type;
                    if (declarationType === 'FunctionExpression' ||
                        declarationType === 'ArrowFunctionExpression') {
                        // @ts-ignore
                        const functionName = declaration.id.name;
                        if(!functionMap.has(functionName)){
                            functionMap.set(functionName, { count: 0,
                                path:new Set([file])});
                            return;
                        }
                        functionMap.get(functionName).path.add(file);
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
                        if(!functionMap.has(functionName)){
                            functionMap.set(functionName, { count: 0,
                                path:new Set([file])});
                            return;
                        }
                        functionMap.get(functionName).path.add(file);
                    }

                    const fileNameStart = file.lastIndexOf('/'); // when anonymous fn
                    const fileName = file.slice(fileNameStart + 1)
                    if(!functionMap.has(fileName)){
                        functionMap.set(fileName, { count: 0,
                            path:new Set([file])});
                        return;
                    }
                    functionMap.get(fileName).path.add(file);
                }
            }, ExportNamedDeclaration: function (path) {
                const declaration = path.node.declaration;
                
                if (!declaration) {
                    return;
                }
                if (declaration.type === 'FunctionDeclaration') {
                    
                    // @ts-ignore
                    const functionName = declaration.id.name;                    
                    if(!functionMap.has(functionName)){
                        functionMap.set(functionName, { count: 0,
                            path:new Set([file])});                            
                        return;
                    }
                    functionMap.get(functionName).path.add(file);
                }
                if (declaration.type === 'VariableDeclaration') {
                    declaration.declarations.forEach(declaration => {

                        if (declaration.type === 'VariableDeclarator') {

                            if (declaration.init && (declaration.init.type === 'FunctionExpression' ||
                                declaration.init.type === 'ArrowFunctionExpression' ||
                                declaration.init.type === 'CallExpression')) { // when variable is created like const Foo = bar(); Possibly, a fn
                                // @ts-ignore
                                const functionName = declaration.id.name;
                                if(!functionMap.has(functionName)){
                                    functionMap.set(functionName, { count: 0,
                                        path:new Set([file])});
                                    return;
                                }
                                functionMap.get(functionName).path.add(file);
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
        const ast = parse(code, {sourceType: 'module', plugins: ['jsx']});
        traverse(ast, {
            CallExpression: function (path) {
                if(shouldIgnoreTestFiles && file.indexOf('.test')!==-1){
                    return;
                }
                if (path.node.callee.type === 'Identifier') {
                    const functionName = path.node.callee.name;
                    if (functionMap.has(functionName)) {
                        functionMap.get(functionName).count++;
                    }
                }
            },
            VariableDeclaration: function (path) {
                if(shouldIgnoreTestFiles && file.indexOf('.test')!==-1){
                    return;
                }
                path.node.declarations.forEach(declaration => {
                    const declarationType = declaration.init?.type;
                    if (declarationType === 'CallExpression') {
                        const argumentsOfFn = declaration.init.arguments;
                        argumentsOfFn.forEach(argument => {
                            // @ts-ignore
                            if (argument.name && functionMap.has(argument.name)) {
                                // @ts-ignore
                                const functionName = argument.name
                                functionMap.get(functionName).count++;

                            }
                        })
                        // @ts-ignore
                        const functionName = declaration.id.name;
                        if (functionMap.has(functionName)){

                        functionMap.get(functionName).count++;
                        }
                    }
                })
            }, JSXElement: function (path) {
                if(shouldIgnoreTestFiles && file.indexOf('.test')!==-1){
                    return;
                }
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
        .filter(el => el[1].count >= minUsagesToShow);

    console.log(new Map(sortedArray));
}

main()