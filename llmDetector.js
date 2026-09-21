require("dotenv").config();

const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function analyzeWithLLM(code, error, intent, deterministicReport) {
  const response = await client.responses.create({
    model: "gpt-5.6-luna",

    input: `
You are the reasoning layer of an AI code debugging system.

Analyze the code, error, user intent, and deterministic analysis.

CODE:
${code}

ERROR:
${JSON.stringify(error, null, 2)}

USER INTENT:
${intent}

DETERMINISTIC ANALYSIS:
${JSON.stringify(deterministicReport, null, 2)}

Identify:
- the most likely cause of the bug
- the suspicious code
- expected behavior
- actual behavior
- missing information
- confidence from 0 to 1

Do NOT generate corrected code.
`,
  });

  return response.output_text;
}

module.exports = {
  analyzeWithLLM,
};
