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
// Absolute path to storage location.
const FILE_STORAGE_DIRECTORY = yargs.dir;
// URL prefix added to all download paths.
const PUBLIC_STORAGE_DIR = '_';
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
    this.download_path = `${PUBLIC_STORAGE_DIR}/${raw.filename}`;
    this.size_bytes = raw.bytes;
    // If inactive, record shouldn't be discussed with the frontend.
    // If inactive, should try to delete each cycle until its gone.
    this.active = true;

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
 * File upload route. Copies the file from temporary storage to FILE_STORAGE_DIRECTORY.
 */
server.route({
    method: 'POST',
    path: '/files/submit',
    handler(req, reply) {
        const raw = req.payload.file;
        const file = new DropFile(raw);

        const orig = fs.createReadStream(raw.path);
        const perm = fs.createWriteStream(`${FILE_STORAGE_DIRECTORY}/${file.name}`);

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

/**
 * Serve dropped files. Hapi / Inert will limit this endpoint to only serve files from 
 * the specified file storage directory.
 */
server.route({
    method: 'GET',
    path: `/${PUBLIC_STORAGE_DIR}/{filename}`,
    handler(req, reply) {
        const filename = req.params.filename;
        log(`Serving ${filename}`);

        reply.file(filename, {
            confine: FILE_STORAGE_DIRECTORY,
        });
    },
});

/**
 * Serve static frontend content. Dropped files themselves are not served from this endpoint.
 */
server.route({
    method: 'GET',
    path: '/{path*}',
    handler: {
        directory: {
            path: `${__dirname}/public`,
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

            // If this record is active and has an expiration date in the past, mark as inactive and 
            // notify the frontend that it's gone. 
            if (current.active && current.expires && Date.now() > Date.parse(current.expires)) {
                log(`Deleting file '${current.name}'`);
                current.active = false;

                // Let all clients know.
                server.publish('/files/updates', Events.Expire(current));
            }

            // Try to collect garbage. If it doesn't work we'll try again next time.
            if (!current.active) {
                try {
                    fs.unlink(current.download_path, noop);
                    // Remove it from the active files array.
                    active_files.splice(i, 1);
                    i--;
                } catch (e) {
                    log(`Couldn't delete '${current.name}'; will try again later.`);
                }
            }
        }
    }, 5000);

    log(`Drop server ready.`);
});