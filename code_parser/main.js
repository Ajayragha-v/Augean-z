const { parseCode } = require("./parser/code_parser");
const { traverse } = require("./parser/astTraverser");


const code = `
const user = {
    name: "Ajay",
    age: 18
};

for (const key in user) {
    console.log(key);
}
`;


const parsed = parseCode(code);


if (parsed.success) {

    console.log("✅ Code parsed successfully!\n");


    const result = {
        variables: [],
        literals: [],
        operators: [],
        functions: [],
        function_calls: [],
        return_statements: [],
        control_flow: [],
        loops: []
    };


    traverse(parsed.ast, result);


    console.log(JSON.stringify(result, null, 2));


} else {

    console.log("❌ Syntax Error");

    console.log(parsed.error);

}