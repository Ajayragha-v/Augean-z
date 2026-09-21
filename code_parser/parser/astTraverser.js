function getExpression(node) {
    if (!node) {
        return null;
    }

    // Identifier
    if (node.type === "Identifier") {
        return node.name;
    }

    // Literal value
    if (node.type === "Literal") {
        return typeof node.value === "string"
            ? `"${node.value}"`
            : String(node.value);
    }

    // Binary expression
    if (node.type === "BinaryExpression") {
        const left = getExpression(node.left);
        const right = getExpression(node.right);

        return `${left} ${node.operator} ${right}`;
    }

    // Logical expression
    if (node.type === "LogicalExpression") {
        const left = getExpression(node.left);
        const right = getExpression(node.right);

        return `${left} ${node.operator} ${right}`;
    }

    // Unary expression
    if (node.type === "UnaryExpression") {
        const argument = getExpression(node.argument);

        return `${node.operator}${argument}`;
    }

    // Update expression
    if (node.type === "UpdateExpression") {
        const argument = getExpression(node.argument);

        return node.prefix
            ? `${node.operator}${argument}`
            : `${argument}${node.operator}`;
    }

    // Assignment expression
    if (node.type === "AssignmentExpression") {
        const left = getExpression(node.left);
        const right = getExpression(node.right);

        return `${left} ${node.operator} ${right}`;
    }

    // Ternary expression
    if (node.type === "ConditionalExpression") {
        const test = getExpression(node.test);
        const consequent = getExpression(node.consequent);
        const alternate = getExpression(node.alternate);

        return `${test} ? ${consequent} : ${alternate}`;
    }

    // Member expression
    if (node.type === "MemberExpression") {
        const object = getExpression(node.object);
        const property = getExpression(node.property);

        if (node.computed) {
            return `${object}[${property}]`;
        }

        return `${object}.${property}`;
    }

    // Function call
    if (node.type === "CallExpression") {
        const callee = getExpression(node.callee);

        const args = node.arguments
            .map(argument => getExpression(argument))
            .join(", ");

        return `${callee}(${args})`;
    }

    // New expression
    if (node.type === "NewExpression") {
        const callee = getExpression(node.callee);

        const args = node.arguments
            .map(argument => getExpression(argument))
            .join(", ");

        return `new ${callee}(${args})`;
    }

    // Array expression
    if (node.type === "ArrayExpression") {
        const elements = node.elements
            .map(element => getExpression(element))
            .join(", ");

        return `[${elements}]`;
    }

    // Object expression
    if (node.type === "ObjectExpression") {
        const properties = node.properties
            .map(property => {
                const key = getExpression(property.key);
                const value = getExpression(property.value);

                return `${key}: ${value}`;
            })
            .join(", ");

        return `{ ${properties} }`;
    }

    // Variable declaration
    if (node.type === "VariableDeclaration") {
        const declarations = node.declarations
            .map(declaration => {
                const name = getExpression(declaration.id);
                const value = getExpression(declaration.init);

                if (value !== null) {
                    return `${name} = ${value}`;
                }

                return name;
            })
            .join(", ");

        return `${node.kind} ${declarations}`;
    }

    // Sequence expression
    if (node.type === "SequenceExpression") {
        return node.expressions
            .map(expression => getExpression(expression))
            .join(", ");
    }

    return `[Unsupported: ${node.type}]`;
}


function traverse(node, result) {
    if (!node || typeof node !== "object") {
        return;
    }

    switch (node.type) {

        // Variables
        case "VariableDeclarator":
            if (node.id.type === "Identifier") {
                result.variables.push(node.id.name);
            }
            break;

        // Literals
        case "Literal":
            result.literals.push(node.value);
            break;

        // Operators
        case "BinaryExpression":
        case "LogicalExpression":
        case "UnaryExpression":
        case "UpdateExpression":
        case "AssignmentExpression":
            result.operators.push(node.operator);
            break;

        // Functions
        case "FunctionDeclaration":
            result.functions.push({
                name: node.id ? node.id.name : null,
                parameters: node.params.map(param => getExpression(param))
            });
            break;

        // Function calls
        case "CallExpression":
            result.function_calls.push({
                name: node.callee.type === "Identifier"
                    ? node.callee.name
                    : null,
                arguments: node.arguments.map(argument =>
                    getExpression(argument)
                )
            });
            break;

        // Return statements
        case "ReturnStatement":
            result.return_statements.push({
                expression: getExpression(node.argument)
            });
            break;

        // Conditions
        case "IfStatement":
            result.control_flow.push({
                type: "if",
                condition: getExpression(node.test),
                has_else: node.alternate !== null
            });
            break;

        // For loop
        case "ForStatement":
            result.loops.push({
                type: "for",
                initialization: getExpression(node.init),
                condition: getExpression(node.test),
                update: getExpression(node.update)
            });
            break;

        // While loop
        case "WhileStatement":
            result.loops.push({
                type: "while",
                condition: getExpression(node.test)
            });
            break;

        // Do while loop
        case "DoWhileStatement":
            result.loops.push({
                type: "do_while",
                condition: getExpression(node.test)
            });
            break;

        // For of loop
        case "ForOfStatement":
            result.loops.push({
                type: "for_of",
                variable: getExpression(node.left),
                iterable: getExpression(node.right)
            });
            break;

        // For in loop
        case "ForInStatement":
            result.loops.push({
                type: "for_in",
                variable: getExpression(node.left),
                object: getExpression(node.right)
            });
            break;
    }

    for (const key in node) {
        if (key === "loc" || key === "start" || key === "end") {
            continue;
        }

        const child = node[key];

        if (Array.isArray(child)) {
            for (const item of child) {
                traverse(item, result);
            }
        } else if (child && typeof child === "object") {
            traverse(child, result);
        }
    }
}


module.exports = {
    traverse
};