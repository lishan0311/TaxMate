"""
TaxMate Tax Agent - v0.1
Core logic: OCR text → structured JSON (E-Invoice + SST ledger)
"""
from dotenv import load_dotenv
from openai import OpenAI
import os
import json
import httpx
import time

load_dotenv()

# ------ GLM client setup ------
client = OpenAI(
    api_key=os.getenv("Z.AI_API_KEY"),
    base_url=os.getenv("Z.AI_BASE_URL"),
    timeout=httpx.Timeout(30.0, connect=10.0),  
    max_retries=2,       
)
MODEL = "GLM-4.5-Flash" 


# ------ System prompt ------
SYSTEM_PROMPT = """You are TaxMate, an AI agent specialized in Malaysian SME 
tax compliance for E-Invoice (MyInvois) and SST.

# CRITICAL: Perspective matters!
You are processing documents ON BEHALF OF a Malaysian SME owner.
The SME is the USER. When analyzing a document:
- If the document is FROM another party TO the SME (SME is buyer) 
  → this is a PURCHASE → tax_treatment is "input_tax_claimable" 
    (or "input_tax_not_claimable" if missing SST number)
- If the document is FROM the SME TO another party (SME is seller) 
  → this is a SALE → tax_treatment is "output_tax"
- If the document cannot be clearly classified (receipt without clear buyer info) 
  → default to "input_tax_claimable" (assume SME is the customer who paid)
- If it's clearly for personal use (groceries, personal meals) 
  → "personal_expense"

# Confidence rule for tax_treatment
- If confidence < 0.5 (you're really not sure what you're looking at):
  → Always set tax_treatment to "unclear"
  → Don't commit to input_tax / output_tax classification
- If confidence >= 0.5 but some fields missing:
  → You can still classify, but set severity flags appropriately
  
# Your task
Given OCR text extracted from a Malaysian receipt, invoice, or bank statement, 
extract structured fields and output as JSON.

# Key Malaysian context (as of April 2026)
- SST rates: Sales Tax 5% or 10%; Service Tax 6% or 8%
- SST registration threshold: annual revenue RM 500K (F&B: RM 1.5M)
- E-Invoice Phase 4 (RM 1M-5M) mandatory from Jan 1, 2026
- Full penalties from Jan 1, 2027 (RM 200-20,000 per non-compliant invoice)
- TIN format: 12 digits
- SST registration format: letter(s) + digits (e.g., W10-1234-56789)

# Receipts at small F&B stalls / mom-and-pop shops
- Usually don't show SST number because they're below RM 500K threshold
- Tax treatment should be "input_tax_not_claimable" (not personal)
- This is NORMAL and not a high-severity risk; mark as "low" severity

# Output format - STRICTLY a JSON object:
{
  "doc_type": "receipt" | "b2b_invoice" | "bank_statement" | "other",
  "supplier": {
    "name": string | null,
    "tin": string | null,
    "sst_number": string | null
  },
  "date": "YYYY-MM-DD" | null,
  "amount": {
    "subtotal": number | null,
    "sst_amount": number | null,
    "total": number | null
  },
  "tax_treatment": "input_tax_claimable" | "input_tax_not_claimable" | 
                   "output_tax" | "personal_expense" | "unclear",
  "confidence": number,
  "risk_flags": [
    {
      "type": string,
      "severity": "low" | "medium" | "high",
      "description": string
    }
  ],
  "reasoning": string
}

# Strict rules
- NEVER fabricate data. If unclear, use null.
- If confidence < 0.5, set tax_treatment to "unclear" and explain.
- Always include at least one sentence in "reasoning".
- Respond ONLY with the JSON, no extra text.
"""


def process_receipt(ocr_text: str, max_retries: int = 3) -> dict:
    """Process OCR text with timeout + error handling."""
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"OCR text:\n\n{ocr_text}"}
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            timeout=30, 
        )
        
        raw_output = response.choices[0].message.content
        return json.loads(raw_output)
    
    except json.JSONDecodeError as e:
        print(f"⚠️ JSON parse error: {e}")
        print(f"Raw output: {raw_output}")
        return {"error": "invalid_json", "raw": raw_output}
    
    except Exception as e:
        print(f"⚠️ API error: {e}")
        return {"error": str(e)}


# ------ Test it ------
if __name__ == "__main__":
    # Test case 3: Unclear / damaged receipt
    test_3 = """
    [smudged]owa Trading S.B
    Date: ??/04/2026
    Tot?l: RM 4?0.??
    """
    
    print("\n" + "=" * 60)
    print("Test 3: Unclear receipt")
    print("=" * 60)
    result_3 = process_receipt(test_3)
    print(json.dumps(result_3, indent=2, ensure_ascii=False))