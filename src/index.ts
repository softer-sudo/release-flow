import { greet } from './greet.ts'

console.log(greet(process.argv.slice(2).join(' ')))
