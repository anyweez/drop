
module.exports = {
    Add(file) {
        return {
            event: 'add',
            target: file,
        };
    },

    Expire(file) {
        return {
            event: 'expire',
            target: file,
        };
    }
};