const { analyzeWithLLM } = require("./llmDetector.js");
function analyzeBug(intent, actual) {
  const lowerIntent = intent.toLowerCase();

  let expectedOperator = null;
  let expectedOperation = null;

  if (lowerIntent.includes("sum") || lowerIntent.includes("add")) {
    expectedOperator = "+";
    expectedOperation = "addition";
  } else if (
    lowerIntent.includes("difference") ||
    lowerIntent.includes("subtract")
  ) {
    expectedOperator = "-";
    expectedOperation = "subtraction";
  } else if (
    lowerIntent.includes("product") ||
    lowerIntent.includes("multiply")
  ) {
    expectedOperator = "*";
    expectedOperation = "multiplication";
  } else if (
    lowerIntent.includes("divide") ||
    lowerIntent.includes("quotient")
  ) {
    expectedOperator = "/";
    expectedOperation = "division";
  }

  if (lowerIntent.includes("even") || lowerIntent.includes("odd")) {
    const isEven = lowerIntent.includes("even");
    const expectedCondition = isEven ? "n % 2 === 0" : "n % 2 !== 0";

    if (actual && actual.includes("n % 2")) {
      return {
        description: `The return condition may be incorrect for checking ${
          isEven ? "even" : "odd"
        } numbers.`,
        location: "return statement",
        expected: expectedCondition,
        actual: actual,
      };
    }

    return {
      description: `The return statement does not appear to correctly check whether n is ${
        isEven ? "even" : "odd"
      }.`,
      location: "return statement",
      expected: expectedCondition,
      actual: actual,
    };
  }

  if (lowerIntent.includes("first name") || lowerIntent.includes("firstname")) {
    const expectedProperty = "user.firstname";

    if (actual && actual.includes("firstname")) {
      return {
        description:
          "The return statement appears to access the expected first-name property.",
        location: "return statement",
        expected: expectedProperty,
        actual: actual,
      };
    }

    return {
      description:
        "The return statement does not appear to access the expected first-name property.",
      location: "return statement",
      expected: expectedProperty,
      actual: actual,
    };
  }

  if (expectedOperator) {
    if (actual && actual.includes(expectedOperator)) {
      return {
        description: `The return statement appears to use the expected ${expectedOperation} operation.`,
        location: "return statement",
        expected: actual,
        actual: actual,
      };
    }

    return {
      description: `The return statement does not use the expected ${expectedOperation} operation.`,
      location: "return statement",
      expected: expectedOperator,
      actual: actual,
    };
  }

  return {
    description: "Unable to determine the expected behavior from the intent.",
    location: "return statement",
    expected: null,
    actual: actual,
  };
}

function generateAssumptions(intent, parameters) {
  const assumptions = [];

  if (parameters.length > 0) {
    assumptions.push(
      `The parameters ${parameters.join(" and ")} are valid inputs for the function.`,
    );
  }

  const lowerIntent = intent.toLowerCase();

  if (
    lowerIntent.includes("sum") ||
    lowerIntent.includes("add") ||
    lowerIntent.includes("difference") ||
    lowerIntent.includes("subtract") ||
    lowerIntent.includes("product") ||
    lowerIntent.includes("multiply") ||
    lowerIntent.includes("divide") ||
    lowerIntent.includes("quotient")
  ) {
    assumptions.push(
      "The operation described in the user intent represents the expected behavior.",
    );
  }

  return assumptions;
}

function generateQuestions(
  codeAnalysis,
  errorAnalysis,
  intentAnalysis,
  bugHypothesis,
) {
  const questions = [];

  if (!intentAnalysis.expectedBehavior) {
    questions.push("What should the function do?");
  }

  if (!codeAnalysis.returnStatement) {
    questions.push("What value or behavior should the function return?");
  }

  if (errorAnalysis.type === "unknown") {
    questions.push("What type of error is being reported?");
  }

  if (!bugHypothesis.expected) {
    questions.push("What behavior or result was expected?");
  }

  if (
    bugHypothesis.expected &&
    bugHypothesis.actual &&
    bugHypothesis.expected === bugHypothesis.actual
  ) {
    questions.push("Can you provide an example input and the expected output?");
  }

  return questions;
}

function calculateConfidence(bugHypothesis, questions) {
  let confidence = 0.5;

  if (bugHypothesis.actual) {
    confidence += 0.2;
  }

  if (bugHypothesis.expected) {
    confidence += 0.2;
  }

  if (questions.length === 0) {
    confidence += 0.1;
  }

  return Math.round(Math.min(confidence, 1) * 100) / 100;
}

async function detective(code, error, intent) {
  if (!code) {
    throw new Error("Code is required");
  }

  if (!error) {
    throw new Error("Error information is required");
  }

  if (!intent) {
    throw new Error("User intent is required");
  }

  const functionMatch = code.match(/function\s+(\w+)\s*\((.*?)\)/);

  const returnMatch = code.match(/return\s+(.+?);/);

  const parameters = functionMatch
    ? functionMatch[2]
        .split(",")
        .map((param) => param.trim())
        .filter(Boolean)
    : [];

  const codeAnalysis = {
    functions: functionMatch ? [functionMatch[1]] : [],
    parameters: parameters,
    variables: parameters,
    returnStatement: returnMatch ? returnMatch[1].trim() : null,
  };

  const errorAnalysis = {
    type: error.type || "unknown",
    message: error.message || "No error message provided",
    severity: error.type === "syntax" ? "high" : "medium",
  };

  const intentAnalysis = {
    expectedBehavior: intent,
    targetFunction: codeAnalysis.functions[0] || null,
  };

  const relevantElements = {
    function: codeAnalysis.functions[0] || null,
    parameters: codeAnalysis.parameters,
    returnStatement: codeAnalysis.returnStatement,
  };

  const bugHypothesis = analyzeBug(intent, codeAnalysis.returnStatement);

  const questions = generateQuestions(
    codeAnalysis,
    errorAnalysis,
    intentAnalysis,
    bugHypothesis,
  );

  const assumptions = generateAssumptions(intent, codeAnalysis.parameters);

  const confidence = calculateConfidence(bugHypothesis, questions);
  let llmAnalysis = null;

  if (confidence < 0.9) {
    llmAnalysis = await analyzeWithLLM(code, error, intent, {
      codeAnalysis,
      errorAnalysis,
      intentAnalysis,
      relevantElements,
      bugHypothesis,
      questions,
      assumptions,
      confidence,
    });
  }

  return {
    status: "analysis_complete",
    codeAnalysis: codeAnalysis,
    errorAnalysis: errorAnalysis,
    intentAnalysis: intentAnalysis,
    relevantElements: relevantElements,
    bugHypothesis: bugHypothesis,
    questions: questions,
    assumptions: assumptions,
    confidence: confidence,
    llmAnalysis: llmAnalysis
  };
}

module.exports = { detective };
