#!/usr/bin/env node

const Hapi = require('hapi');
const Inert = require('inert');
const Nes = require('nes');
const fs = require('fs');
const yargs = require('yargs')
    .usage('Usage: $0 --dir [string] --ttl [num]')
    .default('dir', process.cwd())
    .default('ttl', 60)
    .argv;

const Events = require('./events');
const FILE_STORAGE_DIRECTORY = yargs.dir;
const APPLICATION_STORAGE_DIR = 'public/storage';
const SECONDS_LIFETIME = parseInt(yargs.ttl) === 0 ? null : parseInt(yargs.ttl);

let next_id = 0;

const noop = () => { };
const log = msg => console.log(`[${new Date().toISOString()}] ${msg}`);

log(`Config: Writing dropped files to ${FILE_STORAGE_DIRECTORY}`);
if (SECONDS_LIFETIME) log(`Config: Deleting after ${SECONDS_LIFETIME} seconds`);
else log(`Config: File deletion disabled`)

// If the user-specified storage directory doesn't exist we can't do much. Exit.
if (!fs.existsSync(FILE_STORAGE_DIRECTORY)) {
    log('Error: the specified storage dir does not exist.');
    process.exit(1);
}

// Remove and recreate symlinks to make sure they're fresh. No big deal if it 
// doesn't exist yet (normal for first-run for example).
try {
    fs.unlinkSync(APPLICATION_STORAGE_DIR, noop);
    log('Setup: removed existing symlink. Remaking...');
} catch (e) {
    log('Setup: no storage symlink exists; creating one...');
}

try {
    fs.symlinkSync(FILE_STORAGE_DIRECTORY, `./${APPLICATION_STORAGE_DIR}`, 'dir');
    log('Setup: symlink established');
} catch (e) {
    // TODO: potential errors that we need to catch here. 
    log(`Error: couldn't create symlink to storage directory:`);
    console.error(e);

    process.exit(1);
}

function DropFile(raw) {
    this.id = next_id++;
    // The user-facing name of the file.
    this.name = raw.filename;
    // When the file should expire.
    if (SECONDS_LIFETIME) {
        this.expires = new Date(Date.now() + (SECONDS_LIFETIME * 1000)).toISOString();
    } else {
        this.expires = null;
    }
    // Convertible into URL in frontend.
    this.download_path = `${APPLICATION_STORAGE_DIR}/${raw.filename}`;
    this.size_bytes = raw.bytes;

    return this;
}

// Files that are currently active.
const active_files = [];

const server = new Hapi.Server();
server.connection({
    port: 8080,
});

server.register(Inert);
server.register(Nes, () => {
    server.subscription('/files/updates', {
        onSubscribe(socket, path, params, next) {
            log('New connection accepted');

            active_files.forEach(file => {
                socket.publish(path, Events.Add(file), () => { });
            });

            next();
        }
    });
});

/**
 * File upload route. Copies 
 */
server.route({
    method: 'POST',
    path: '/files/submit',
    handler(req, reply) {
        const raw = req.payload.file;
        const file = new DropFile(raw);

        const orig = fs.createReadStream(raw.path);
        const perm = fs.createWriteStream(file.download_path);

        orig.pipe(perm).on('finish', () => {
            active_files.push(file);
            server.publish('/files/updates', Events.Add(file));
        });

        log(`Adding file '${file.name}'`);
        reply();
    },
    config: {
        payload: {
            output: 'file',
            maxBytes: 2147483648, // 2gb
            timeout: false,
        },
    }
});

server.route({
    method: 'GET',
    path: '/{path*}',
    handler: {
        directory: {
            path: 'public',
        },
    },
});

server.start(err => {
    if (err) {
        console.error(err);
        process.exit(1);
    }

    /* Check every five seconds for files that need to be deleted. */
    setInterval(() => {
        for (let i = 0; i < active_files.length; i++) {
            const current = active_files[i];

            if (current.expires && Date.now() > Date.parse(current.expires)) {
                log(`Deleting file '${current.name}'`);
                // Delete the file.
                try {
                    fs.unlink(current.download_path, noop);
                } catch (e) { }
                // Let all clients know.
                server.publish('/files/updates', Events.Expire(current));
                // Remove it from the active files array.
                active_files.splice(i, 1);
                i--;
            }
        }
    }, 5000);

    log(`Drop server ready.`);
});