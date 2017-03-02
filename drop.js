const Hapi = require('hapi');
const Inert = require('inert');
const Nes = require('nes');
const fs = require('fs');
const yargs = require('yargs')
    .usage('Usage: $0 --dir [string] --ttl [num]')
    .default('dir', 'storage')
    .default('ttl', 60)
    .argv;

const Events = require('./events');
const FILE_STORAGE_DIRECTORY = yargs.dir;
const SECONDS_LIFETIME = yargs.ttl;

let next_id = 0;

const noop = () => { };
const log = msg => console.log(`[${new Date().toISOString()}] ${msg}`);

log(`Config: Writing dropped files to public/${FILE_STORAGE_DIRECTORY}`);
log(`Config: Deleting after ${SECONDS_LIFETIME} seconds`);

function DropFile(raw) {
    this.id = next_id++;
    // The user-facing name of the file.
    this.name = raw.filename;
    // When the file should expire.
    this.expires = new Date(Date.now() + (SECONDS_LIFETIME * 1000)).toISOString();
    // Convertible into URL in frontend.
    this.download_path = `${FILE_STORAGE_DIRECTORY}/${raw.filename}`;

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
            log('New connection');

            active_files.forEach(file => {
                socket.publish(path, Events.Add(file), () => {});
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

        log(`Adding file '${file.name}`);
        reply();
    },
    config: {
        payload: {
            output: 'file',
            maxBytes: 209715200,
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

    setInterval(() => {
        for (let i = 0; i < active_files.length; i++) {
            if (Date.now() > Date.parse(active_files[i].expires)) {
                log(`Deleting file '${active_files[i].name}`);
                // Delete the file.
                try {
                    fs.unlink(active_files[i].download_path, noop);
                } catch (e) { }
                // Let all clients know.
                server.publish('/files/updates', Events.Expire(active_files[i]));
                // Remove it from the active files array.
                active_files.splice(i, 1);
                i--;
            }
        }
    }, 5000);

    log(`Drop server ready.`);
});