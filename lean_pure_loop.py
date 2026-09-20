import json
import os
import subprocess
import re
from openai import OpenAI

# -------------------------------------------------------------------
# CONFIGURATION
# -------------------------------------------------------------------
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Path to your Lean REPL binary
LEAN_REPL_PATH = "./repl/.lake/build/bin/repl"

# -------------------------------------------------------------------
# 1. LEAN 4 SUBPROCESS INTERFACE (CORE LEAN ONLY)
# -------------------------------------------------------------------
def verify_lean4_code(lean_code: str) -> tuple[bool, str]:
    """
    Pipes pure Lean 4 code to the Lean REPL subprocess.
    """
    payload = json.dumps({"command": lean_code})
    
    try:
        process = subprocess.Popen(
            [LEAN_REPL_PATH],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        stdout, stderr = process.communicate(input=payload)
        response = json.loads(stdout)
        messages = response.get("messages", [])
        
        # Parse compiler/tactic errors
        errors = []
        for msg in messages:
            if msg.get("severity") == "error":
                pos = msg.get("pos", {})
                line = pos.get("line", "?")
                col = pos.get("column", "?")
                errors.append(f"Line {line}, Col {col}: {msg.get('data')}")
        
        if not errors:
            return True, "Code & Proof Verified Successfully!"
        else:
            return False, "\n".join(errors)
            
    except Exception as e:
        return False, f"Subprocess/REPL Error: {str(e)}"

# -------------------------------------------------------------------
# 2. LLM PROMPT GENERATOR (PURE LEAN ONLY)
# -------------------------------------------------------------------
def generate_lean_attempt(given_constraints: dict, find_spec: dict, error_history: list) -> str:
    """
    Translates 'Given' and 'Find' parameters into standard Lean 4 code.
    """
    system_prompt = (
        "You are an expert formal programmer in pure Lean 4. "
        "Write complete, executable Lean 4 code that implements an algorithm "
        "and proves its post-conditions."
        "\nIMPORTANT CONSTRAINTS:"
        "\n1. Do NOT import Mathlib or external libraries. Use standard Lean 4 built-ins only."
        "\n2. Output ONLY clean executable Lean 4 code without markdown backticks."
        "\n3. Ensure algorithms are pure and well-founded (define termination measures if recursive)."
    )
    
    user_prompt = f"""
    ### GIVEN (Inputs & Constraints):
    {json.dumps(given_constraints, indent=2)}

    ### FIND (Algorithm & Property Verification):
    {json.dumps(find_spec, indent=2)}
    """

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    # Append compiler errors if re-trying
    for err in error_history:
        messages.append({"role": "assistant", "content": err["code"]})
        messages.append({
            "role": "user", 
            "content": f"Lean 4 compilation failed with error:\n{err['error']}\n\nPlease revise the Lean 4 code to fix this error."
        })

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        temperature=0.1
    )

    clean_code = response.choices[0].message.content.strip()
    
    # Clean up markdown code block wrappers
    clean_code = re.sub(r"^```lean\s*", "", clean_code)
    clean_code = re.sub(r"^```\s*", "", clean_code)
    clean_code = re.sub(r"\s*```$", "", clean_code)
    
    return clean_code

# -------------------------------------------------------------------
# 3. BACKPROPAGATION LOOP
# -------------------------------------------------------------------
def run_lean_proof_loop(given: dict, find: dict, max_retries: int = 3) -> str | None:
    """
    Executes the feedback loop between LLM and Lean 4 REPL.
    """
    error_history = []
    
    print("\n🚀 Starting Pure Lean 4 Formalization Loop...")
    
    for attempt in range(1, max_retries + 1):
        print(f"\n--- [Attempt {attempt}/{max_retries}] Generating Lean 4 Code ---")
        
        # Step 1: LLM generates pure Lean code
        lean_code = generate_lean_attempt(given, find, error_history)
        print("Generated Code:")
        print("--------------------------------------------------")
        print(lean_code)
        print("--------------------------------------------------")
        
        # Step 2: Symbolic Verification with Lean 4 REPL
        print("\n🔍 Verifying with Lean 4 Subprocess...")
        is_valid, lean_output = verify_lean4_code(lean_code)
        
        # Step 3: Success or Loop
        if is_valid:
            print(f"\n✅ SUCCESS on attempt {attempt}! Code and proof verified.")
            return lean_code
        
        print(f"\n❌ Lean 4 Verification Error Caught:\n{lean_output}")
        
        # Step 4: Backpropagate error context into history
        error_history.append({
            "code": lean_code,
            "error": lean_output
        })
        
    print(f"\n🚨 Max retries ({max_retries}) reached without a verified proof.")
    return None

# -------------------------------------------------------------------
# EXAMPLE EXECUTION
# -------------------------------------------------------------------
if __name__ == "__main__":
    # Standard Lean input format without external packages
    given_data = {
        "inputs": [
            {"name": "n", "type": "Nat"}
        ],
        "preconditions": "n >= 0"
    }
    
    find_data = {
        "algorithm_goal": "Write a function `double (n : Nat) : Nat` that multiplies `n` by 2 using addition.",
        "post_condition": "Prove theorem `double_eq_add` that `double n = n + n` for all `n`."
    }

    verified_code = run_lean_proof_loop(given=given_data, find=find_data, max_retries=3)
    
    if verified_code:
        print("\n=== FINAL VERIFIED LEAN 4 OUTPUT ===")
        print(verified_code)
