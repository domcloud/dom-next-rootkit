import {
    checkAuth,
    checkGet,
} from '../util.js';
import express from 'express';
import runConfig from '../executor/runner.js';
import got from 'got';
import {
    promisify
} from 'util';
import {
    PassThrough
} from 'stream';
import {
    fork
} from 'child_process';
import path from 'path';
import fs from 'fs';
import {
    fileURLToPath
} from 'url';
import {
    dirname
} from 'path';

/**
 * @param {import('stream').Writable} stream
 * @param {string} content
 */
function writeAsync(stream, content) {
    return new Promise((resolve, reject) => {
        stream.write('' + content, 'utf-8', (err) => {
            if (err)
                reject(err)
            else
                resolve();
        })
    });
}

export async function runConfigInBackground(body, domain, sandbox, callback) {
    let sss = '';
    const write = new PassThrough();
    const headers = {
        'Content-Type': 'text/plain',
    };
    write.on('data', (chunk) => {
        if (!sss)
            // for startup message
            got.post(callback, {
                headers,
                body: 'Running runner... Please wait...\n' + chunk,
            });
        sss += chunk;
    });
    write.on('end', () => {
        // and finish message
        got.post(callback, {
            headers,
            body: sss
        });
    });
    try {
        await runConfig(body || {}, domain + "", async (s) => {
            console.log('> ' + s);
            await writeAsync(write, s);
        }, sandbox);
    } catch (error) {
        console.log('!> ', error);
        if (error.stdout !== undefined) {
            await writeAsync(write, `$> Error occured with exit code ${error.code || 'unknown'}\n`);
            await writeAsync(write, error.stdout + '\n');
            await writeAsync(write, error.stderr + '\n');
        } else {
            await writeAsync(write, '$> Error occured\n');
            await writeAsync(write, JSON.stringify(error) + '\n');
        }
    } finally {
        console.log('!> finish');
        await writeAsync(write, '\n$> Execution Finished\n');
        if (write && !write.writableEnded) {
            write.end();
        }
    }
}
/**
 * @type {import('child_process').ChildProcess}
 */
let singletonRunning;

const __filename = fileURLToPath(
    import.meta.url);
const __dirname = dirname(__filename);
const childLogger = fs.createWriteStream(path.join(__dirname, `../../logs/${new Date().toISOString().substr(0, 10)}.log`), {
    'flags': 'a',
});
export async function runConfigInBackgroundSingleton(payload) {
    if (!singletonRunning || singletonRunning.connected === false) {
        singletonRunning = fork(path.join(__dirname, '../../runner.js'), [], {
            stdio: ['ignore', 'pipe', 'pipe', 'ipc']
        });
        singletonRunning.stderr.pipe(childLogger);
        singletonRunning.stdout.pipe(childLogger);
    }
    singletonRunning.send(payload, (err) => {
        console.log('!> ', err);
    });
}

export default function () {
    var router = express.Router();
    router.post('/', checkAuth, checkGet(['domain']), async function (req, res, next) {
        runConfigInBackgroundSingleton({
            body: req.body,
            domain: req.query.domain + "",
            sandbox: !!parseInt(req.query.sandbox + '' || '0'),
            callback: req.header('x-callback'),
        });
        res.json('OK');
    });
    return router;
}