const Nes = require('nes/client');

const stifle = event => {
    event.stopPropagation();
    event.preventDefault();
};

const show_hide = (show, hide) => {
    show.classList.add('show');
    hide.classList.remove('show');
};

window.addEventListener('DOMContentLoaded', () => {
    const drop = document.querySelector('.drop');
    const drop_drop_msg = document.querySelector('.drop .drop-msg');
    const drop_file_list = document.querySelector('.drop .file-list');

    const client = new Nes.Client(`ws://${location.host}`);
    const file_list = [];

    // Connect to the updates websocket and wait for events. Update the 
    // file list and then re-render once the event is registered.
    client.connect(err => {
        client.subscribe('/files/updates', update => {
            console.log(update);
            if (update.event === 'add') {
                update.target.expires = moment(update.target.expires).format('MMM Do [at] h:mm:ss a');
                file_list.push(update.target);
            } else if (update.event === 'expire') {
                const i = file_list.findIndex(f => f.id === update.target.id);
                file_list.splice(i, 1);
            } else {
                console.error('Unknown event type');
                console.log(update);
            }

            render_files(file_list);
        }, () => {});
    });

    drop.addEventListener('dragenter', e => {
        stifle(e);

        show_hide(drop_drop_msg, drop_file_list);
    });

    drop.addEventListener('dragover', stifle);

    drop.addEventListener('dragleave', e => {
        stifle(e);

        show_hide(drop_file_list, drop_drop_msg);
    });

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

    // show_hide(drop_file_list, drop_drop_msg);
    // show_hide(drop_drop_msg, drop_file_list);
    render_files(file_list);
    
    /**
     * Update the list of files visible in the DOM.
     * 
     * @param {Array} list 
     */
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
            <p class="expires">expires on ${item.expires}</p>
            <p class="remove">x</p>
        `;

            fragment.appendChild(el);
        });

        parent.appendChild(fragment);

        if (list.length > 0) {
            console.log('revealing file list');
            show_hide(drop_file_list, drop_drop_msg);
        } else {
            console.log('hiding file list');
            show_hide(drop_drop_msg, drop_file_list);
        }
    }
});