
/**
 * Convert the specified number of bytes into a human-friendly string.
 * 
 * @param {Number} bytes 
 */
const as_filesize = bytes => {
    const trunc = full => Math.round(full * 10) / 10;

    const KILOBYTE = 1024;
    const MEGABYTE = KILOBYTE * 1024;
    const GIGABYTE = MEGABYTE * 1024;

    if (bytes > GIGABYTE) return `${trunc(bytes / GIGABYTE)} GB`;
    else if (bytes > MEGABYTE) return `${trunc(bytes / MEGABYTE)} MB`;
    else if (bytes > KILOBYTE) return `${trunc(bytes / KILOBYTE)} KB`;
    
    return `${bytes} bytes`;
};

module.exports = {
    ready(item) {
        return `
            <p class="filename">
              <i class="fa-file-o fa"></i>&nbsp;
              <a href="${item.download_path}">${item.name}</a>
            </p>
            <p class="size">${as_filesize(item.size_bytes)}</p>
            <p class="expires">expires on ${item.expires}</p>
            <p class="remove">x</p>
        `;
    },
    in_progress(item) {
        return `
            <p class="filename">
              <i class="fa-file-o fa"></i>&nbsp;
              <span>${item.name}</span>
            </p>
            <p class="size">${as_filesize(item.size_bytes)}</p>
            <p class="expires">dropping: ${item.progress}%</p>
            <p class="remove">x</p>
        `;
    },
}