import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import countUsages from "./index"
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
const glob = String(argv._[0]);

countUsages(glob,argv);