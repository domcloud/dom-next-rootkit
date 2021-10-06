import dotenv from 'dotenv';
import {
    runConfigInBackground
} from "./src/controllers/runner.js";
import { initUtils } from './src/util.js';

dotenv.config();
initUtils();

process.on('message', (msg) => {
    console.log(`Executing`, msg);
    // @ts-ignore
    const {
        body,
        domain,
        sandbox,
        callback
    } = msg;
    runConfigInBackground(body, domain, sandbox, callback).catch(err => {
        console.error(err);
    });
});

console.log(`Starting runner node ${process.pid}`);
process.on('exit', (code) => {
    console.log(`Exiting runner node ${process.pid} with code ${code}`);
});