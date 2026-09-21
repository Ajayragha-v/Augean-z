const { detective } = require("./detective");

const code = `
function calculate(a, b) {
    return a + b;
}
`;

const error = {
    type: "logic",
    message: "The function is not working correctly"
};

const intent = "The function is not working correctly";

async function main() {
    try {
        const result = await detective(code, error, intent);

        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Detective error:", error.message);
    }
}

main();