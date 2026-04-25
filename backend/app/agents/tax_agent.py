"""
TaxMate Tax Agent - v0.4
"""
from dotenv import load_dotenv
import os
import json
import time
import re
from tenacity import retry, stop_after_attempt, wait_exponential
from anthropic import Anthropic
import httpx
 
load_dotenv()
 
# ============================================================
# LLM Engine Selection
# ============================================================

client = Anthropic(
    api_key=os.getenv("Z.AI_API_KEY"),
    base_url="https://api.ilmu.ai/anthropic", 
    timeout=httpx.Timeout(180.0, connect=30.0),
    max_retries=2,
)
MODEL = "ilmu-glm-5.1"
print("🚀 Using Z.AI GLM (production mode)")
 
 
# ============================================================
# System Prompt (L3: Adaptive behavior rules)
# ============================================================
SYSTEM_PROMPT = """You are TaxMate, an AI tax compliance agent for Malaysian SMEs.
You have access to tools. You MUST use them — never skip tools when relevant.
 
# WORKFLOW — adapt based on what you find:
1. ALWAYS start by calling lookup_sst_rule with a relevant query about the document type you see.
2. If you find an SST number → MUST call validate_sst_number to verify format.
3. If you find a tax/SST amount → MUST call calculate_tax to cross-check the math.
4. If NO SST number is found → call lookup_sst_rule about "threshold" rules, then call flag_for_human_review.
5. If the total exceeds RM 1,000 → call lookup_sst_rule about "e-invoice" requirements.
6. If this is a food/restaurant/F&B receipt → call lookup_sst_rule about "8%" F&B service tax rates.
7. If confidence < 0.7 after your analysis → MUST call flag_for_human_review.
8. After completing all checks → call generate_tax_advice with a brief summary of what you found.
9. Finally, produce your structured JSON output.
 
You should call 3-6 tools per document. More tools = more thorough analysis.
 
# CRITICAL: Perspective
You process documents ON BEHALF OF a Malaysian SME owner (the buyer).
- Receipt/invoice FROM a supplier TO the SME → PURCHASE → "input_tax_claimable"
  (or "input_tax_not_claimable" if supplier has no valid SST number)
- Document FROM the SME TO a customer → SALE → "output_tax"
- Unclear → default to "input_tax_claimable"
- Personal use → "personal_expense"
 
# Malaysian tax context (April 2026)
- Sales Tax: 5% (specific goods) / 10% (standard manufactured goods)
- Service Tax: 6% (most services) / 8% (F&B, telecom, credit cards, parking, logistics)
- SST threshold: RM 500K annual turnover (F&B: RM 1.5M)
- E-Invoice Phase 4 (RM 1M-5M revenue): mandatory from Jan 1, 2026
- Penalties from Jan 1, 2027: RM 200-20,000 per non-compliant invoice
- SST-02 filing: bi-monthly, due within 30 days after taxable period ends
 
# Small F&B stalls without SST number
- Normal for businesses below RM 500K threshold
- Tax treatment: "input_tax_not_claimable" (NOT personal_expense)
- Severity: "low"
 
# Confidence rules
- confidence < 0.5 → tax_treatment MUST be "unclear"
- confidence 0.5-0.7 → classify but add risk flags + call flag_for_human_review
- confidence > 0.7 → classify normally
 
# Final output — STRICTLY this JSON:
{
  "doc_type": "receipt" | "b2b_invoice" | "bank_statement" | "other",
  "supplier": {"name": string|null, "tin": string|null, "sst_number": string|null},
  "date": "YYYY-MM-DD" | null,
  "amount": {"subtotal": number|null, "sst_amount": number|null, "total": number|null},
  "tax_treatment": "input_tax_claimable"|"input_tax_not_claimable"|"output_tax"|"personal_expense"|"unclear",
  "confidence": number,
  "risk_flags": [{"type": string, "severity": "low"|"medium"|"high", "description": string}],
  "reasoning": string
}
 
NEVER fabricate data. If unclear, use null. Output JSON only at the end.
"""
 
 
# ============================================================
# Tool Definitions
# ============================================================
TOOL_DEFINITIONS = {
    "lookup_sst_rule": {
        "description": "Query LHDN knowledge base for SST rules, tax rates, MSIC codes, thresholds, or E-Invoice requirements. Call this FIRST for every document.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "What to look up, e.g. 'service tax 6%', 'F&B threshold', 'e-invoice', 'SST format', 'input tax'"}
            },
            "required": ["query"]
        }
    },
    "validate_sst_number": {
        "description": "Verify SST registration number format against JKDM standard. Call this whenever you see an SST number.",
        "parameters": {
            "type": "object",
            "properties": {
                "sst_number": {"type": "string", "description": "The SST registration number to validate"}
            },
            "required": ["sst_number"]
        }
    },
    "calculate_tax": {
        "description": "Calculate expected SST and cross-check against the receipt's stated tax amount. Call this whenever a tax amount appears on the receipt.",
        "parameters": {
            "type": "object",
            "properties": {
                "amount": {"type": "number", "description": "Base/subtotal amount in RM before tax"},
                "rate": {"type": "number", "description": "Tax rate as decimal, e.g. 0.06 for 6%, 0.08 for 8%"}
            },
            "required": ["amount", "rate"]
        }
    },
    "flag_for_human_review": {
        "description": "Flag this document for accountant review. Call when: confidence < 0.7, missing SST number on large invoice, data ambiguous, or calculation mismatch found.",
        "parameters": {
            "type": "object",
            "properties": {
                "reason": {"type": "string", "description": "Specific reason why accountant review is needed"},
                "severity": {"type": "string", "enum": ["low", "medium", "high"]}
            },
            "required": ["reason", "severity"]
        }
    },
    "generate_tax_advice": {
        "description": "Generate a specific tax planning tip based on what was found in this document. Call this as your final tool before producing output.",
        "parameters": {
            "type": "object",
            "properties": {
                "context": {"type": "string", "description": "Brief summary: supplier type, amount, tax status, any issues found"}
            },
            "required": ["context"]
        }
    },
}
 
 
# ============================================================
# Tool Execution (L3: cross-validation in calculate_tax)
# ============================================================
def execute_tool(name: str, args: dict, ocr_text: str = "") -> str:
    """Execute a tool call and return result string."""
 
    if name == "lookup_sst_rule":
        query = args.get("query", "").lower()
        rules = [
            ("6%", "Service Tax at 6% applies to most taxable services under Service Tax Act 2018 (e.g., professional services, management services, IT services)."),
            ("8%", "Service Tax at 8% applies to: (a) credit/charge cards, (b) food & beverage — restaurants, cafes, bars with annual turnover > RM 1.5M, (c) telecommunication, (d) parking, (e) logistics services. Rate increased from 6% to 8% effective 1 March 2024."),
            ("5%", "Sales Tax at 5% applies to specific goods under Schedule 1 of Sales Tax (Rates of Tax) Order 2018, including certain food preparations, building materials, and IT equipment."),
            ("10%", "Sales Tax at 10% is the standard rate for most manufactured and imported taxable goods not covered by the 5% rate."),
            ("threshold", "SST registration is MANDATORY when annual taxable turnover exceeds RM 500,000. Special threshold for F&B industry (Group I services): RM 1,500,000. Businesses below threshold are NOT required to register and cannot charge SST."),
            ("e-invoice", "E-Invoice Phase 4: MANDATORY for businesses with annual revenue RM 1,000,000 to RM 5,000,000 from 1 January 2026. Non-compliance penalties (RM 200-20,000 per invoice) begin 1 January 2027. All B2B transactions must generate MyInvois-compliant e-invoices."),
            ("format", "SST registration number format per JKDM: 1 letter prefix + 2 digits + hyphen + 4 digits + hyphen + 8 digits. Example: P11-2508-30000123. Prefixes: J = Sales Tax (registered manufacturer), P = Service Tax (registered provider), W = Special scheme (e.g., petroleum). Any deviation from this format indicates potential invalid registration."),
            ("penalty", "Late SST-02 filing/payment penalties: 10% (first 30 days late), 25% (31-60 days), 40% (61+ days). Per Section 26 Sales Tax Act 2018 / Section 26 Service Tax Act 2018."),
            ("input tax", "Input tax credit: Under Sales Tax, registered MANUFACTURERS can claim deduction for Sales Tax paid on raw materials/components (Sales Tax Deduction mechanism). Service Tax has NO input tax credit mechanism — service tax paid is a final cost. This is a key difference from GST."),
            ("output tax", "Output tax: SST that a registered person charges on their taxable goods/services. Must be declared in SST-02 and remitted to JKDM within 30 days after the taxable period ends."),
            ("sst-02", "SST-02 is the bi-monthly return form filed with JKDM. Taxable periods: Jan-Feb, Mar-Apr, May-Jun, Jul-Aug, Sep-Oct, Nov-Dec. Filing deadline: last day of the month following the taxable period (e.g., Jan-Feb due by 31 March). Must declare: total taxable sales/services, tax payable, deductions, and net tax payable."),
            ("f&b", "F&B (Food & Beverage) businesses: Service Tax registration threshold is RM 1,500,000 annual turnover (higher than standard RM 500K). Registered F&B businesses charge 8% Service Tax (not 6%). Applies to restaurants, cafes, bars, catering, private dining, food courts with AC/entertainment."),
        ]
        for keyword, rule in rules:
            if keyword in query:
                return rule
        return f"General SST guidance for '{args.get('query', '')}': Refer to JKDM SST Guidelines at mysst.customs.gov.my or consult a registered tax agent. Key principle: all taxable goods/services by registered persons must be declared in SST-02."
 
    elif name == "validate_sst_number":
        sst = args.get("sst_number", "").strip()
        pattern = r'^[A-Z]\d{2}-\d{4}-\d{8}$'
        if re.match(pattern, sst):
            prefix = sst[0]
            prefix_meanings = {
                "J": "Sales Tax — registered manufacturer",
                "P": "Service Tax — registered service provider",
                "W": "Special scheme (e.g., petroleum, designated areas)",
            }
            meaning = prefix_meanings.get(prefix, "Unknown registration category")
            return f"SST number '{sst}' is VALID. Prefix '{prefix}' = {meaning}. This supplier is SST-registered and can legitimately charge SST."
        else:
            issues = []
            if not sst:
                issues.append("Empty SST number")
            elif not sst[0].isalpha():
                issues.append(f"Invalid prefix '{sst[0]}' — must be a letter (J/P/W)")
            if '-' not in sst:
                issues.append("Missing hyphens — format should be X99-9999-99999999")
            parts = sst.split('-')
            if len(parts) == 3:
                if len(parts[2]) != 8:
                    issues.append(f"Last segment has {len(parts[2])} digits — should be 8")
            return f"SST number '{sst}' is INVALID. Issues: {'; '.join(issues) if issues else 'Does not match pattern X99-9999-99999999'}. This may indicate: (a) data entry error, (b) supplier not SST-registered, or (c) OCR misread. Recommend manual verification."
 
    elif name == "calculate_tax":
        amount = args.get("amount", 0)
        rate = args.get("rate", 0.06)
        expected_tax = round(amount * rate, 2)
        expected_total = round(amount + expected_tax, 2)
 
        result = f"Calculated: RM {amount:.2f} x {rate*100:.1f}% = SST RM {expected_tax:.2f}. Expected total: RM {expected_total:.2f}."
 
        # L3 UPGRADE: Cross-validate against receipt's actual SST amount
        sst_patterns = [
            r'SST[^RM]*RM\s*([\d,.]+)',
            r'(?:cukai|tax)[^RM]*RM\s*([\d,.]+)',
            r'SST\s*\(?\d+%?\)?\s*:?\s*RM\s*([\d,.]+)',
        ]
        actual_sst = None
        for pattern in sst_patterns:
            matches = re.findall(pattern, ocr_text, re.IGNORECASE)
            if matches:
                try:
                    actual_sst = float(matches[0].replace(',', ''))
                    break
                except ValueError:
                    continue
 
        if actual_sst is not None:
            diff = abs(actual_sst - expected_tax)
            if diff < 0.05:
                result += f" CROSS-CHECK PASSED: Receipt SST RM {actual_sst:.2f} matches calculated RM {expected_tax:.2f}. Tax calculation is correct."
            else:
                pct_diff = (diff / expected_tax * 100) if expected_tax > 0 else 0
                result += f" CROSS-CHECK WARNING: Receipt shows SST RM {actual_sst:.2f} but calculated RM {expected_tax:.2f}. Difference: RM {diff:.2f} ({pct_diff:.1f}%). Possible causes: rounding, mixed tax rates, or calculation error. Flag for accountant review."
        else:
            result += " Note: Could not find SST amount on receipt for cross-validation. May not be separately itemized."
 
        # Also check total
        total_patterns = [r'[Tt]otal[^RM]*RM\s*([\d,.]+)']
        for pattern in total_patterns:
            matches = re.findall(pattern, ocr_text)
            if matches:
                try:
                    actual_total = float(matches[-1].replace(',', ''))
                    total_diff = abs(actual_total - expected_total)
                    if total_diff < 0.05:
                        result += f" Total verification: RM {actual_total:.2f} matches expected RM {expected_total:.2f}."
                    elif total_diff > 1:
                        result += f" Total mismatch: Receipt RM {actual_total:.2f} vs expected RM {expected_total:.2f}. Difference RM {total_diff:.2f}."
                    break
                except ValueError:
                    continue
 
        return result
 
    elif name == "flag_for_human_review":
        reason = args.get("reason", "Unspecified")
        severity = args.get("severity", "medium")
        actions = {
            "low": "Document will appear in accountant's review queue as low priority. Can be batch-approved.",
            "medium": "Document requires individual accountant review before approval. Will be highlighted in review queue.",
            "high": "URGENT: Document blocked from SST-02 filing until accountant resolves this issue. Notification sent to accountant.",
        }
        return f"FLAGGED [{severity.upper()}]: {reason}. Action: {actions.get(severity, actions['medium'])}"
 
    elif name == "generate_tax_advice":
        context = args.get("context", "").lower()
        advice_prompt = f"""Based on this Malaysian SME receipt analysis:
{context}

Give ONE specific, actionable tax planning tip.
Requirements:
- Relevant to Malaysian SST/Income Tax context
- Concrete action for owner/accountant
- Keep it concise (1-2 sentences)
"""
        try:
            return "Tax planning advice: " + _generate_text(
                prompt=advice_prompt,
                system_instruction="You are a Malaysian SST compliance advisor.",
                temperature=0.3,
            )
        except Exception:
            return (
                "Tax planning advice: Keep all original tax invoices for 7 years per JKDM "
                "requirements and ensure supplier SST registration numbers are verified."
            )
 
    return f"Unknown tool: {name}"
 
 
# ============================================================
# Z.AI/ILMU-GLM-5.1 Agent Runner
# ============================================================
def _run_agent_openai(ocr_text: str, max_steps: int = 8) -> dict:
    """Multi-step agent using Anthropic function calling (ILMU API)."""

    # Anthropic 工具格式（和 OpenAI 不一样）
    anthropic_tools = []
    for name, defn in TOOL_DEFINITIONS.items():
        anthropic_tools.append({
            "name": name,
            "description": defn["description"],
            "input_schema": defn["parameters"]
        })

    thinking_steps = []
    
    messages = [
        {"role": "user", "content": f"""
        {SYSTEM_PROMPT}
        
        Process this Malaysian receipt/invoice. Use ALL relevant tools before producing your final JSON:
        
        {ocr_text}
        """}
    ]

    for step in range(max_steps):
        try:
            # 🔧 Anthropic API 
            response = client.messages.create(
                model=MODEL,
                messages=messages,
                tools=anthropic_tools,
                temperature=0.1,
                max_tokens=4096,
            )

            if response.stop_reason == "tool_use":
                tool_use_block = None
                for block in response.content:
                    if block.type == "tool_use":
                        tool_use_block = block
                        break
                
                if tool_use_block:
                    func_name = tool_use_block.name
                    func_args = tool_use_block.input

                    thinking_steps.append({
                        "step": step + 1,
                        "type": "tool_call",
                        "action": f"Agent calls: {func_name}",
                        "input": func_args,
                    })

                    tool_result = execute_tool(func_name, func_args, ocr_text)

                    thinking_steps.append({
                        "step": step + 1,
                        "type": "tool_result",
                        "action": "Tool returns result",
                        "output": tool_result[:500],
                    })

                    # 🔧 Message history in Anthropic format
                    # 1. First add the assistant's replies (including tool_use)
                    messages.append({
                        "role": "assistant",
                        "content": response.content
                    })
                    
                    # 2. Add tool results (in a specific format)
                    messages.append({
                        "role": "user",
                        "content": [
                            {
                                "type": "tool_result",
                                "tool_use_id": tool_use_block.id,
                                "content": tool_result
                            }
                        ]
                    })
                    continue

            # No tool calls are the final answer.
            final_text = ""
            for block in response.content:
                if block.type == "text":
                    final_text += block.text

            thinking_steps.append({
                "step": step + 1,
                "type": "final_answer",
                "action": "Agent produces final classification",
            })

            try:
                cleaned = _clean_json(final_text)
                result = json.loads(cleaned)
                result["thinking_steps"] = thinking_steps
                return result
            except json.JSONDecodeError:
                return {"error": "invalid_json", "raw": final_text, "thinking_steps": thinking_steps}

        except Exception as e:
            print(f"⚠️ Step {step+1} error: {e}")
            import traceback
            traceback.print_exc()
            thinking_steps.append({"step": step + 1, "type": "error", "action": str(e)})
            continue

    return {"error": "max_steps_exceeded", "thinking_steps": thinking_steps}

 
# ============================================================
# L4: Cross-Document Batch Analysis Agent
# ============================================================
def analyze_monthly_batch(documents: list) -> dict:
    """
    Cross-document reasoning agent.
    After all receipts are processed individually, this agent
    analyzes ALL documents together to find patterns, anomalies,
    duplicates, and tax optimization opportunities.
    """
    summary_items = []
    for doc in documents:
        r = doc.get("agent_result", {})
        if not r or "error" in r:
            continue
        summary_items.append({
            "supplier": doc.get("supplier_name", "Unknown"),
            "amount": doc.get("total_amount", 0),
            "sst": r.get("amount", {}).get("sst_amount", 0),
            "tax_treatment": doc.get("tax_treatment", "unclear"),
            "date": r.get("date"),
            "risk_count": doc.get("risk_count", 0),
            "confidence": r.get("confidence", 0),
            "sst_number": r.get("supplier", {}).get("sst_number"),
        })
 
    if not summary_items:
        return {
            "batch_health": "needs_review",
            "summary": "No valid documents to analyze.",
            "duplicate_warnings": [],
            "anomalies": [],
            "tax_tips": [],
            "compliance_issues": [],
        }
 
    prompt = f"""You are a senior Malaysian tax analyst reviewing {len(summary_items)} documents for one SME's monthly SST-02 filing.
 
Analyze ALL documents TOGETHER and provide:
 
1. DUPLICATE DETECTION: Same supplier + same date + similar amount (within 10%) = potential duplicate. List any found.
2. ANOMALY DETECTION: Amounts that are >3x the average, or suppliers appearing suspiciously often. Flag unusual patterns.
3. TAX SUMMARY: Calculate total input tax claimable, input tax not claimable, output tax, and net payable.
4. TAX OPTIMIZATION: Based on spending patterns, give 2-3 SPECIFIC actionable tips to reduce net SST payable.
5. COMPLIANCE RISKS: Documents with high risk flags, missing SST numbers on large amounts, or low confidence scores.
6. SST-02 READINESS: Is this batch ready to file? What needs fixing first?
 
Documents:
{json.dumps(summary_items, indent=2, default=str)}
 
Respond ONLY with this JSON:
{{
  "batch_health": "ready" | "needs_review" | "at_risk",
  "total_documents": {len(summary_items)},
  "total_input_tax_claimable": number,
  "total_input_tax_not_claimable": number,
  "total_output_tax": number,
  "net_payable": number,
  "duplicate_warnings": [
    {{"suppliers": string, "dates": string, "amounts": string, "reason": string}}
  ],
  "anomalies": [
    {{"supplier": string, "type": "unusual_amount" | "high_frequency" | "missing_data", "description": string, "severity": "low" | "medium" | "high"}}
  ],
  "tax_tips": [
    {{"title": string, "description": string, "potential_saving": string}}
  ],
  "compliance_issues": [
    {{"issue": string, "severity": "low" | "medium" | "high", "action_needed": string, "affected_documents": number}}
  ],
  "filing_readiness": {{
    "ready_count": number,
    "needs_review_count": number,
    "blocked_count": number,
    "recommendation": string
  }},
  "summary": string
}}"""
 
    try:
        response = client.messages.create(
            model=MODEL,
            messages=[
                {"role": "user", "content": f"{prompt}\n\nYOU MUST RESPOND WITH JSON ONLY, NO OTHER TEXT."}
            ],
            system="You are a Malaysian SST compliance analyst. Be specific.",
            temperature=0.2,
            max_tokens=4096,
            timeout=60,
        )

        # Extract the returned text
        final_text = ""
        for block in response.content:
            if block.type == "text":
                final_text += block.text

        # Clean and parse JSON
        cleaned = _clean_json(final_text)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            # Try to fix truncated JSON by closing open structures
            fixed = _repair_json(cleaned)
            return json.loads(fixed)

    except Exception as e:
        print(f"⚠️ Batch analysis error: {e}")
        return {
            "error": str(e),
            "batch_health": "needs_review",
            "summary": f"Batch analysis failed: {str(e)}",
            "duplicate_warnings": [],
            "anomalies": [],
            "tax_tips": [],
            "compliance_issues": [],
        }
 
# ============================================================
# Unified Entry Points
# ============================================================
def _clean_json(raw: str) -> str:
    """Strip markdown fences if present."""
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw
        if raw.endswith("```"):
            raw = raw.rsplit("```", 1)[0]
    return raw.strip()


def _repair_json(raw: str) -> str:
    """Attempt to fix truncated JSON by closing open structures."""
    raw = raw.strip()
    # Track open brackets/braces
    in_string = False
    escape_next = False
    open_stack = []
    for ch in raw:
        if escape_next:
            escape_next = False
            continue
        if ch == '\\':
            if in_string:
                escape_next = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch in '{[':
            open_stack.append(ch)
        elif ch == '}' and open_stack and open_stack[-1] == '{':
            open_stack.pop()
        elif ch == ']' and open_stack and open_stack[-1] == '[':
            open_stack.pop()
    # Close any open string
    if in_string:
        raw += '"'
    # Close open brackets/braces in reverse order
    closing = {'{': '}', '[': ']'}
    for bracket in reversed(open_stack):
        raw += closing[bracket]
    return raw


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def _generate_text(prompt: str, system_instruction: str, temperature: float = 0.2) -> str:
    """Unified text generation for Anthropic / ILMU-GLM-5.1."""
    response = client.messages.create(
        model=MODEL,
        messages=[
            {"role": "user", "content": prompt}
        ],
        system=system_instruction,
        temperature=temperature,
        max_tokens=2048,
        timeout=60,
    )

    final_text = ""
    for block in response.content:
        if block.type == "text":
            final_text += block.text
    return final_text.strip()



def generate_sst02_field_mapping(documents: list[dict]) -> dict:
    """AI decides SST-02 mapping from document summaries."""
    prompt = f"""You are filling an official Malaysian SST-02 return.
Given these documents, decide mapping for SST-02 fields.

Documents:
{json.dumps(documents, indent=2, default=str)}

Return JSON only with this structure:
{{
  "b1_rows": [
    {{
      "description": "string",
      "service_code": "string",
      "taxable_value": number,
      "source_document_ids": ["doc_id_1", "doc_id_2"],
      "reasoning": "short reason for mapping/rate selection"
    }}
  ],
  "totals": {{
    "item_11c_taxable": number,
    "item_11c_tax": number,
    "item_12_total_tax": number,
    "item_13_deduction": number,
    "item_15_penalty": number
  }},
  "exempt_rows": [
    {{"description": "string", "value": number}}
  ],
  "notes": "string"
}}
"""
    raw = _generate_text(
        prompt=prompt,
        system_instruction="You are a senior Malaysian SST practitioner. Output strict JSON only.",
        temperature=0.1,
    )
    return json.loads(_clean_json(raw))


def generate_review_brief(documents: list[dict]) -> str:
    prompt = f"""You are preparing a review brief for a Malaysian chartered accountant.
Summarize this document batch in 3-5 short paragraphs:
1) Overall data quality
2) High-risk documents (specific suppliers/amounts)
3) Recommended checks before signing SST-02
4) Compliance caveats

Documents:
{json.dumps(documents, indent=2, default=str)}
"""
    try:
        return _generate_text(
            prompt=prompt,
            system_instruction="You are a practical accounting reviewer. Be specific and concise.",
            temperature=0.2,
        )
    except Exception:
        high_risk = [d for d in documents if (d.get("risk_count") or 0) > 0]
        return (
            f"Batch overview: {len(documents)} document(s) loaded.\n"
            f"High-risk items: {len(high_risk)}.\n"
            "Recommended: verify high-risk receipts, confirm supplier SST numbers, "
            "then finalize SST-02 signing."
        )


def generate_personalized_email(summary: dict, month: int) -> str:
    prompt = f"""Write a professional email body to a Malaysian SME owner about SST filing.
Month: {month}/2026
Summary: {json.dumps(summary, indent=2, default=str)}

Include:
- total payable
- number of documents
- key issues if any
- filing reminder
Keep under 200 words and friendly-professional tone.
Do not add greeting or closing.
"""
    try:
        return _generate_text(
            prompt=prompt,
            system_instruction="You write concise compliance notifications for SME owners.",
            temperature=0.3,
        )
    except Exception:
        return (
            f"Your SST filing summary for {month}/2026 is ready. "
            f"Total payable: RM {summary.get('net_payable', 0)}. "
            f"Documents processed: {summary.get('total_documents', 0)}. "
            "Please submit via MySST portal before the deadline."
        )


def answer_accountant_question(question: str, documents: list[dict]) -> str:
    prompt = f"""You are TaxMate, Malaysian SST compliance assistant.
Current month documents:
{json.dumps(documents, indent=2, default=str)}

Accountant question: {question}

Answer using only these documents + Malaysian SST rules.
If uncertain, say uncertainty explicitly.

FORMAT RULES — follow strictly:
- Do NOT use markdown formatting (no *, no **, no ##, no |, no backticks)
- Use plain text only. For emphasis, use UPPERCASE words.
- Use numbered lists like: 1. 2. 3.
- Use dashes (-) for bullet points, but NOT asterisks.
- For tables, use a simple lined format like:
  Field: Value
  Field: Value
- Keep responses concise and well-structured.
"""
    try:
        return _generate_text(
            prompt=prompt,
            system_instruction="You are an accountant copilot. Be specific and evidence-based. NEVER use markdown formatting (no *, **, ##, |, backticks). Use plain text only with numbered lists (1. 2. 3.) and dashes (-) for bullets.",
            temperature=0.25,
        )
    except Exception:
        return (
            "AI copilot is temporarily unavailable due to model traffic. "
            f"You can still proceed with manual review across {len(documents)} document(s)."
        )
 
 
def process_receipt(ocr_text: str, max_retries: int = 2) -> dict:
    """
    Main entry point for single-document processing.
    Runs multi-step agentic workflow with adaptive tool calling.
    """
    for attempt in range(max_retries):
        try:
            return _run_agent_openai(ocr_text)
        except Exception as e:
            error_str = str(e)
            if "429" in error_str or "rate limit" in error_str.lower():
                wait_time = 5 * (attempt + 1)
                print(f"⚠️ Rate limited. Waiting {wait_time}s... (retry {attempt+1}/{max_retries})")
                time.sleep(wait_time)
                continue
            print(f"⚠️ Agent error: {e}")
            import traceback
            traceback.print_exc()
            return {"error": str(e), "thinking_steps": []}
    return {"error": "max_retries_exceeded", "thinking_steps": []}
 
 
# ============================================================
# Test
# ============================================================
if __name__ == "__main__":
    # Test 1: Clean B2B invoice
    # test_1 = """
    # MR.DIY TRADING SDN BHD
    # No. 45, Jalan Kepong, 52100 Kuala Lumpur
    # SST No: W10-1234-56789012
    # TIN: 201801234567
 
    # Invoice No: INV-2026-0412-001
    # Date: 12/04/2026
 
    # Description              Qty    Price
    # Office supplies          1      80.66
 
    # Subtotal:   RM 80.66
    # SST (6%):   RM 4.84
    # Total:      RM 85.50
    # """
 
    # print("=" * 60)
    # print("Test 1: Clean B2B invoice (expect 4-6 tool calls)")
    # print("=" * 60)
 
    # result = process_receipt(test_1)
 
    # if "thinking_steps" in result:
    #     print("\n--- Agent Thinking Steps ---")
    #     for ts in result["thinking_steps"]:
    #         if ts["type"] == "tool_call":
    #             print(f"  🔧 Step {ts['step']}: {ts['action']}")
    #             if "input" in ts:
    #                 print(f"     Input: {json.dumps(ts['input'])}")
    #         elif ts["type"] == "tool_result":
    #             print(f"  📋 Step {ts['step']}: {ts['action']}")
    #             output = ts.get('output', '')
    #             # Highlight cross-check results
    #             if "CROSS-CHECK" in output:
    #                 print(f"     ⚡ {output[:200]}")
    #             elif "VALID" in output or "INVALID" in output:
    #                 print(f"     ✅ {output[:200]}")
    #             else:
    #                 print(f"     Output: {output[:150]}")
    #         elif ts["type"] == "final_answer":
    #             print(f"  ✅ Step {ts['step']}: {ts['action']}")
    #         elif ts["type"] == "error":
    #             print(f"  ❌ Step {ts['step']}: {ts['action']}")
    #     print(f"  Total tool calls: {sum(1 for s in result['thinking_steps'] if s['type'] == 'tool_call')}")
    #     print("---\n")
 
    # display = {k: v for k, v in result.items() if k != "thinking_steps"}
    # print(json.dumps(display, indent=2, ensure_ascii=False))
 
    # Test batch analysis (L4)
    print("\n\n" + "=" * 60)
    print("Test: Cross-document batch analysis")
    print("=" * 60)
 
    mock_docs = [
        {"supplier_name": "MR.DIY TRADING SDN BHD", "total_amount": 85.50, "tax_treatment": "input_tax_claimable", "risk_count": 0, "agent_result": {"date": "2026-04-12", "amount": {"sst_amount": 4.84}, "confidence": 0.95, "supplier": {"sst_number": "W10-1234-56789012"}}},
        {"supplier_name": "Ali Nasi Lemak", "total_amount": 15.00, "tax_treatment": "input_tax_not_claimable", "risk_count": 1, "agent_result": {"date": "2026-04-10", "amount": {"sst_amount": None}, "confidence": 0.8, "supplier": {"sst_number": None}}},
        {"supplier_name": "SHELL MALAYSIA", "total_amount": 250.00, "tax_treatment": "input_tax_claimable", "risk_count": 0, "agent_result": {"date": "2026-04-14", "amount": {"sst_amount": 15.00}, "confidence": 0.9, "supplier": {"sst_number": "J10-1234-56789012"}}},
        {"supplier_name": "MR.DIY TRADING SDN BHD", "total_amount": 86.20, "tax_treatment": "input_tax_claimable", "risk_count": 0, "agent_result": {"date": "2026-04-12", "amount": {"sst_amount": 4.88}, "confidence": 0.95, "supplier": {"sst_number": "W10-1234-56789012"}}},
        {"supplier_name": "KFC Restaurant", "total_amount": 430.50, "tax_treatment": "input_tax_claimable", "risk_count": 0, "agent_result": {"date": "2026-04-15", "amount": {"sst_amount": 34.44}, "confidence": 0.7, "supplier": {"sst_number": None}}},
    ]
 
    batch_result = analyze_monthly_batch(mock_docs)
    print(json.dumps(batch_result, indent=2, ensure_ascii=False))
