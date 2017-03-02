const Nes = require('nes');

const stifle = event => {
    event.stopPropagation();
    event.preventDefault();
};

window.addEventListener('load', () => {
    const client = new Nes.Client('ws://localhost:8080');
    const file_list = [];

    // Connect to the updates websocket and wait for events. Update the 
    // file list and then re-render once the event is registered.
    client.connect(err => {
        client.subscribe('/files/updates', update => {
            if (update.event === 'add') {
                file_list.push(update.target);
            } else if (update.event === 'expire') {
                const i = file_list.findIndex(f => f.id === update.target.id);
                file_list.splice(i, 1);
            } else {
                console.error('Unknown event type');
                console.log(update);
            }

            render_files(file_list);
        }, err => { });
    });

    const drop = document.querySelector('.drop');

    drop.addEventListener('dragenter', stifle);
    drop.addEventListener('dragover', stifle);

    drop.addEventListener('drop', e => {
        stifle(e);

        const files = e.dataTransfer.files;

        Array.from(files).forEach(file => {
            const body = new FormData();
            body.append('file', file);

            const request = new XMLHttpRequest();
            request.open('POST', '/files/submit');
            request.send(body);
        });
    }, false);

    render_files(file_list);
});

function render_files(list) {
    const parent = document.querySelector('.drop ul');

    parent.innerHTML = '';
    const fragment = new DocumentFragment();

    list.forEach(item => {
        const el = document.createElement('li');
        el.innerHTML = `
            <p class="filename">
              <a href="${item.download_path}">${item.name}</a>
            </p>
            <p class="expires">${item.expires}</p>
            <p class="remove">x</p>
        `;

        fragment.appendChild(el);
    });

    parent.appendChild(fragment);
}