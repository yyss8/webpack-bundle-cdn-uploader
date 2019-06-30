

class ColorLog {

    constructor() {
        this.resetColor = "\x1b[0m";
        this.successColor = "\x1b[32m";
        this.errorColor = "\x1b[31m";
    }

    success(text = '') {
        console.log(this.successColor, text);
    }

    error(text = '') {
        console.log(this.errorColor, text);
    }

    reset(text = '') {
        console.log(this.resetColor, text);
    }

    colorParts(colorParts) {
        let outputing = [];
        colorParts.forEach(({ text, type }) => {
            const color = `${type}Color`
            outputing.push(
                this[color],
                text
            );
        });
        console.log(...outputing);
    }
}

module.exports = new ColorLog();