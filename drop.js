const Hapi = require('hapi');
const Inert = require('inert');
const Nes = require('nes');
const fs = require('fs');

const Events = require('./events');
const FILE_STORAGE_DIRECTORY = 'storage';
const SECONDS_LIFETIME = 30;

let next_id = 0;

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
    server.subscription('/files/updates');
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
                // Delete the file.
                fs.unlink(active_files[i].download_path);
                // Let all clients know.
                server.publish('/files/updates', Events.Expire(active_files[i]));
                // Remove it from the active files array.
                active_files.splice(i, 1);
                i--;
            }
        }
    }, 5000);

    console.log(`Drop server ready.`);
});