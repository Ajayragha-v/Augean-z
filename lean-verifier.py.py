import os
import re
import subprocess
import json
from mistralai import Mistral

# 1. API Configuration
rupert = "YOUR_MISTRAL_API_KEY_HERE"  # Replace with your actual Mistral API key
Mathematician_AI_api = Mistral(api_key=rupert)
MODEL_NAME = "labs-leanstral-1-5"  # Fine-tuned for Lean 4 theorem proving and code

# 2. Local Lean Environment Configuration
LEAN_FILE_PATH = "TempProof.lean"
MAX_ATTEMPTS = 5

def extract_lean_code(llm_response: str) -> str:
    """Extracts raw code from Markdown codeblocks (```lean ... ```)"""
    match = re.search(r"```lean\s*(.*?)\s*```", llm_response, re.DOTALL)
    if match:
        return match.group(1)
    return llm_response.strip()

def run_lean_compiler(code: str) -> tuple[bool, str]:
    """Writes Lean code to disk and invokes the local Lean compiler via CLI."""
    with open(LEAN_FILE_PATH, "w", encoding="utf-8") as f:
        f.write(code)

    try:
        result = subprocess.run(
            ["lake", "env", "lean", LEAN_FILE_PATH],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        # Check for 0 exit code AND lack of "error:" in standard error / output
        output = result.stderr if result.stderr else result.stdout
        if result.returncode == 0 and "error:" not in output:
            return True, "Success! Lean 4 algorithm compiled and verified."
        else:
            return False, output.strip()
            
    except subprocess.TimeoutExpired:
        return False, "Error: Lean 4 compilation timed out."
    except FileNotFoundError:
        return False, "Error: Lean 4/Lake executable not found in system PATH."

def mathematician_lean_loop(spec_data: dict | str) -> str:
    """Feedback loop: Mistral -> Local Lean 4 Compiler -> Mistral (Retry on Error)"""
    
    # Format input spec if passed as a dictionary (from Layer 1 JSON)
    spec_str = json.dumps(spec_data, indent=2) if isinstance(spec_data, dict) else spec_data

    system_prompt = (
        "You are a formal mathematician and computer scientist specializing in Lean 4.\n"
        "Your task is to take a specification and generate a mathematically sound, executable algorithm.\n\n"
        "Requirements:\n"
        "1. Write an executable computational algorithm using a Lean 4 `def` statement.\n"
        "2. Formulate a Lean 4 `theorem` that asserts the `def` algorithm satisfies the given propositions/expected results.\n"
        "3. Prove the theorem using valid Lean 4 tactics (e.g., `rfl`, `simp`, `omega`, `decide`).\n"
        "4. Wrap your entire code strictly in a markdown block: ```lean ... ```.\n"
        "5. Do NOT use `sorry` or leave goals unsolved."
    )

    user_prompt = f"Write an executable Lean 4 algorithm (`def`) and formal proof (`theorem`) for this specification:\n{spec_str}"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    for attempt in range(1, MAX_ATTEMPTS + 1):
        print(f"\n--- [Attempt {attempt}/{MAX_ATTEMPTS}] Asking Mathematician AI ---")
        
        # Call Mistral API
        response = Mathematician_AI_api.chat.complete(
            model=MODEL_NAME,
            messages=messages
        )
        
        raw_output = response.choices[0].message.content
        lean_code = extract_lean_code(raw_output)
        print("Generated Lean 4 Algorithm & Proof:\n", lean_code)

        # Compile and check locally
        is_valid, error_log = run_lean_compiler(lean_code)

        if is_valid:
            print("\n✅ ALGORITHM & PROOF VERIFIED BY LEAN 4!")
            return lean_code
        else:
            print("\n❌ Lean 4 Verification Failed.")
            print("Compiler Error Logs:\n", error_log)
            
            # Feed error back to Mistral
            messages.append({"role": "assistant", "content": raw_output})
            messages.append({
                "role": "user",
                "content": (
                    f"The Lean 4 compiler failed with this error:\n"
                    f"```\n{error_log}\n```\n"
                    f"Please fix the `def` algorithm or tactic proof and return the updated Lean 4 code."
                )
            })

    raise Exception("Failed to produce a valid Lean 4 algorithm/proof within maximum retries.")

# --- EXECUTION RUNNER ---
if __name__ == "__main__":
    # Example Layer 1 JSON input
    sample_json_spec = {
        "function_name": "fast_factorial",
        "variables": ["n: Nat"],
        "given": ["n >= 0"],
        "assumptions": ["Standard Natural number arithmetic"],
        "propositions": ["The function computes n!"],
        "expected_result": "fast_factorial 5 = 120"
    }

    try:
        verified_code = mathematician_lean_loop(sample_json_spec)
        print("\nFinal Verified Lean 4 Code Output:\n")
        print(verified_code)
    except Exception as e:
        print(f"\nPipeline failed: {e}")