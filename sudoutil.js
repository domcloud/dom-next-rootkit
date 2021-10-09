#!/usr/bin/env node

import shelljs from 'shelljs'
import cli from 'cli'
import dotenv from 'dotenv'
import path from 'path';
import {
    chmodSync,
    chownSync,
    statSync
} from 'fs';
import {
    fileURLToPath
} from 'url';

const __dirname = path.dirname(fileURLToPath(
    import.meta.url));
dotenv.config({
    path: path.join(__dirname, './.env')
});

const {
    cat,
    cd,
    exec,
    exit,
} = shelljs;

const env = Object.assign({}, {
    NGINX_PATH: '/etc/nginx/nginx.conf',
    NGINX_OUT: '/etc/nginx/nginx.conf',
    NGINX_BIN: 'nginx',
    NGINX_START: 'systemctl start nginx',
    NGINX_TMP: path.join(__dirname, '.tmp/nginx'),
    IPTABLES_PATH: '/etc/sysconfig/iptables',
    IPTABLES_SAVE: 'iptables-save',
    IPTABLES_LOAD: 'iptables-restore',
    IP6TABLES_PATH: '/etc/sysconfig/ip6tables',
    IP6TABLES_SAVE: 'ip6tables-save',
    IP6TABLES_LOAD: 'ip6tables-restore',
    IPTABLES_TMP: path.join(__dirname, '.tmp/iptables'),
    IP6TABLES_TMP: path.join(__dirname, '.tmp/ip6tables'),
    IPTABLES_WHITELIST_EXEC: 'sh ' + path.join(__dirname, 'src/whitelist/refresh.sh'),
    NAMED_HOSTS: '/var/named/$.hosts',
    NAMED_OUT: '/var/named/$.hosts',
    NAMED_CHECK: 'named-checkzone',
    NAMED_RELOAD: 'rndc reload $',
    NAMED_RESYNC: 'rndc retransfer $',
    NAMED_TMP: path.join(__dirname, '.tmp/named'),
    VIRTUALMIN: 'virtualmin',
    SCRIPT: path.join(__dirname, 'sudoutil.js'),
}, process.env);

/**
 * @param {import("fs").PathLike} filePath
 */
function fixOwner(filePath) {
    const {
        uid,
        gid
    } = statSync(path.join(__dirname, './sudoutil.js'));
    chownSync(filePath, uid, gid);
    chmodSync(filePath, 0o750);
}

cd(__dirname); // making sure because we're in sudo
let arg;
switch (cli.args.shift()) {
    case 'NGINX_GET':
        cat(env.NGINX_PATH).to(env.NGINX_TMP);
        fixOwner(env.NGINX_TMP);
        exit(0);
    case 'NGINX_SET':
        if (exec(`${env.NGINX_BIN} -t -c '${env.NGINX_TMP}'`).code !== 0)
            exit(1);
        cat(env.NGINX_TMP).to(env.NGINX_OUT);
        exec(`${env.NGINX_BIN} -s reload`);
        exit(0);
    case 'NGINX_START':
        exec(env.NGINX_START);
        exit(0);
    case 'IPTABLES_GET':
        cat(env.IPTABLES_PATH).to(env.IPTABLES_TMP);
        cat(env.IP6TABLES_PATH).to(env.IP6TABLES_TMP);
        fixOwner(env.IPTABLES_TMP);
        fixOwner(env.IP6TABLES_TMP);
        exit(0);
    case 'IPTABLES_SET':
        // making sure whitelist set is exist
        exec(env.IPTABLES_WHITELIST_EXEC);
        if (cat(env.IPTABLES_TMP).exec(`${env.IPTABLES_LOAD} -t`).code !== 0)
            exit(1);
        if (cat(env.IP6TABLES_TMP).exec(`${env.IP6TABLES_LOAD} -t`).code !== 0)
            exit(1);
        cat(env.IPTABLES_TMP).to(env.IPTABLES_PATH);
        cat(env.IP6TABLES_TMP).to(env.IP6TABLES_PATH);
        exit(0);
    case 'NAMED_GET':
        arg = cli.args.shift();
        cat(env.NAMED_HOSTS.replace('$', arg)).to(env.NAMED_TMP);
        fixOwner(env.NAMED_TMP);
        exit(0);
    case 'NAMED_SET':
        arg = cli.args.shift();
        if (exec(`${env.NAMED_CHECK} ${arg} ${env.NAMED_TMP}`).code !== 0)
            exit(1);
        cat(env.NAMED_TMP).to(env.NAMED_OUT.replace('$', arg));
        exit(exec(env.NAMED_RELOAD.replace('$', arg)).code);
    case 'NAMED_SYNC':
        arg = cli.args.shift();
        exit(exec(env.NAMED_RESYNC.replace('$', arg)).code);
    case 'VIRTUALMIN':
        arg = cli.args.join(' ');
        exit(exec(env.VIRTUALMIN + " " + arg).code);
    default:
        console.error(`Unknown Mode`);
        exit(1);
}