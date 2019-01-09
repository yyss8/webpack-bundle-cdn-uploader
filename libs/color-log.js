const resetColor = "\x1b[0m";
const successColor = "\x1b[32m";
const errorColor = "\x1b[31m";

class ColorLog{
    success(text = ''){
        console.log( successColor, text );
    }

    error( text = '' ){
        console.log( errorColor, text );
    }

    reset( text = '' ){
        console.log( resetColor, text );
    }
}

module.exports = new ColorLog();