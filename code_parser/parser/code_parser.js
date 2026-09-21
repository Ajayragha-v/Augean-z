const acorn = require("acorn");

function parseCode(code) {
    try {
        const ast = acorn.parse(code, {
            ecmaVersion: "latest",
            sourceType: "script"
        });

        return {
            success: true,
            ast: ast,
            error: null
        };

    } catch (error) {
        return {
            success: false,
            ast: null,
            error: {
                message: error.message,
                line: error.loc?.line,
                column: error.loc?.column
            }
        };
    }
}

module.exports = { parseCode };